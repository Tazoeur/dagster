import * as React from 'react';
import {useEffect, useMemo, useState} from 'react';
import {
  FilterableAssetDefinition,
  useAssetDefinitionFilterState,
} from 'shared/assets/useAssetDefinitionFilterState.oss';

import {useAssetGroupSelectorsForAssets} from './AssetGroupSuggest';
import {CloudOSSContext} from '../app/CloudOSSContext';
import {isCanonicalStorageKindTag} from '../graph/KindTags';
import {ChangeReason} from '../graphql/types';
import {useFilters} from '../ui/BaseFilters';
import {FilterObject} from '../ui/BaseFilters/useFilter';
import {useAssetGroupFilter} from '../ui/Filters/useAssetGroupFilter';
import {useAssetOwnerFilter, useAssetOwnersForAssets} from '../ui/Filters/useAssetOwnerFilter';
import {useAssetTagFilter, useAssetTagsForAssets} from '../ui/Filters/useAssetTagFilter';
import {useChangedFilter} from '../ui/Filters/useChangedFilter';
import {useCodeLocationFilter} from '../ui/Filters/useCodeLocationFilter';
import {
  useAssetKindTagsForAssets,
  useComputeKindTagFilter,
} from '../ui/Filters/useComputeKindTagFilter';
import {useStorageKindFilter} from '../ui/Filters/useStorageKindFilter';
import {WorkspaceContext} from '../workspace/WorkspaceContext';
import {buildRepoAddress} from '../workspace/buildRepoAddress';

const EMPTY_ARRAY: any[] = [];

const ALL_CHANGED_IN_BRANCH_VALUES = Object.values(ChangeReason);

export function useAssetCatalogFiltering<
  T extends {
    id: string;
    definition?: FilterableAssetDefinition | null;
  },
>({
  assets = EMPTY_ARRAY,
  includeRepos = true,
  loading = false,
  isEnabled = true,
}: {
  assets: T[] | undefined;
  includeRepos?: boolean;
  loading?: boolean;
  isEnabled?: boolean;
}) {
  const {
    filters,
    filterFn,
    setAssetTags,
    setChangedInBranch,
    setComputeKindTags,
    setGroups,
    setOwners,
    setCodeLocations,
    setStorageKindTags,
    setSelectAllFilters,
  } = useAssetDefinitionFilterState({isEnabled});

  const allAssetGroupOptions = useAssetGroupSelectorsForAssets(assets);
  const allComputeKindTags = useAssetKindTagsForAssets(assets);
  const allAssetOwners = useAssetOwnersForAssets(assets);

  const groupsFilter = useAssetGroupFilter({
    allAssetGroups: allAssetGroupOptions,
    assetGroups: filters.selectAllFilters.includes('groups')
      ? allAssetGroupOptions
      : filters.groups,
    setGroups,
  });
  const changedInBranchFilter = useChangedFilter({
    changedInBranch: filters.selectAllFilters.includes('changedInBranch')
      ? ALL_CHANGED_IN_BRANCH_VALUES
      : filters.changedInBranch,
    setChangedInBranch,
  });
  const computeKindFilter = useComputeKindTagFilter({
    allComputeKindTags,
    computeKindTags: filters.selectAllFilters.includes('computeKindTags')
      ? allComputeKindTags
      : filters.computeKindTags,
    setComputeKindTags,
  });
  const ownersFilter = useAssetOwnerFilter({
    allAssetOwners,
    owners: filters.selectAllFilters.includes('owners') ? allAssetOwners : filters.owners,
    setOwners,
  });

  const tags = useAssetTagsForAssets(assets);
  const storageKindTags = useMemo(() => tags.filter(isCanonicalStorageKindTag), [tags]);
  const nonStorageKindTags = useMemo(
    () => tags.filter((tag) => !isCanonicalStorageKindTag(tag)),
    [tags],
  );

  const tagsFilter = useAssetTagFilter({
    allAssetTags: nonStorageKindTags,
    tags: filters.selectAllFilters.includes('tags') ? nonStorageKindTags : filters.tags,
    setTags: setAssetTags,
  });
  const storageKindFilter = useStorageKindFilter({
    allAssetStorageKindTags: storageKindTags,
    storageKindTags: filters.selectAllFilters.includes('storageKindTags')
      ? storageKindTags
      : filters.storageKindTags,
    setStorageKindTags,
  });

  const {isBranchDeployment} = React.useContext(CloudOSSContext);
  const {allRepos} = React.useContext(WorkspaceContext);

  const allRepoAddresses = useMemo(() => {
    return allRepos.map((repo) =>
      buildRepoAddress(repo.repository.name, repo.repositoryLocation.name),
    );
  }, [allRepos]);

  const reposFilter = useCodeLocationFilter({
    codeLocations: filters.selectAllFilters?.includes('codeLocations')
      ? allRepoAddresses
      : filters.codeLocations,
    setCodeLocations,
  });

  const uiFilters = React.useMemo(() => {
    const uiFilters: FilterObject[] = [
      groupsFilter,
      computeKindFilter,
      storageKindFilter,
      ownersFilter,
      tagsFilter,
    ];
    if (isBranchDeployment) {
      uiFilters.push(changedInBranchFilter);
    }
    if (allRepos.length > 1 && includeRepos) {
      uiFilters.unshift(reposFilter);
    }
    return uiFilters;
  }, [
    allRepos.length,
    changedInBranchFilter,
    computeKindFilter,
    groupsFilter,
    includeRepos,
    isBranchDeployment,
    ownersFilter,
    reposFilter,
    storageKindFilter,
    tagsFilter,
  ]);
  const components = useFilters({filters: uiFilters});

  const isFiltered: boolean = !!Object.values(filters as Record<string, any[]>).some(
    (filter) => filter?.length,
  );

  const [didWaitAfterLoading, setDidWaitAfterLoading] = useState(false);

  useEffect(() => {
    /**
     * This effect handles syncing the `selectAllFilters` query param state with the actual filtering state.
     * eg: If all of the items are selected then we include that key, otherwise we remove it.
     */
    if (loading || !isEnabled) {
      return;
    }
    if (!didWaitAfterLoading) {
      requestAnimationFrame(() => setDidWaitAfterLoading(true));
      return;
    }
    let nextAllFilters = [...filters.selectAllFilters];

    let didChange = false;

    [
      ['owners', filters.owners, allAssetOwners] as const,
      ['tags', filters.tags, nonStorageKindTags] as const,
      ['computeKindTags', filters.computeKindTags, allComputeKindTags] as const,
      ['storageKindTags', filters.storageKindTags, storageKindTags] as const,
      ['groups', filters.groups, allAssetGroupOptions] as const,
      ['changedInBranch', filters.changedInBranch, Object.values(ChangeReason)] as const,
      ['codeLocations', filters.codeLocations, allRepos] as const,
    ].forEach(([key, activeItems, allItems]) => {
      if (!allItems.length) {
        return;
      }
      if ((activeItems?.length ?? 0) !== allItems.length) {
        // Not all items are included, lets remove the key if its included
        if (filters.selectAllFilters?.includes(key)) {
          didChange = true;
          nextAllFilters = nextAllFilters.filter((filter) => filter !== key);
        }
      } else if (activeItems?.length && !filters.selectAllFilters?.includes(key)) {
        // All items are included, lets add the key since its not already included
        didChange = true;
        nextAllFilters.push(key);
      }
    });

    if (didChange) {
      setSelectAllFilters?.(nextAllFilters);
    }
  }, [
    allAssetGroupOptions,
    allAssetOwners,
    allComputeKindTags,
    allRepos,
    didWaitAfterLoading,
    filters,
    loading,
    nonStorageKindTags,
    setSelectAllFilters,
    storageKindTags,
    isEnabled,
  ]);

  const filtered = React.useMemo(
    () => assets.filter((a) => filterFn(a.definition ?? {})),
    [filterFn, assets],
  ) as T[];

  return {
    activeFiltersJsx: components.activeFiltersJsx,
    filterButton: components.button,
    isFiltered,
    filterFn,
    filtered,
    computeKindFilter,
    storageKindFilter,
    groupsFilter,
    renderFilterButton: components.renderButton,
  };
}
