from pathlib import Path
from typing import List, Sequence

from dagster import AssetKey, AssetSpec, Definitions, multi_asset

from dbt_example.dagster_defs.table_existence_check import build_table_existence_check
from dbt_example.shared.lakehouse_utils import id_from_path, load_csv_to_duckdb


def lakehouse_asset_key(*, csv_path) -> AssetKey:
    return AssetKey(["lakehouse", id_from_path(csv_path)])


def specs_from_lakehouse(*, csv_path: Path) -> Sequence[AssetSpec]:
    return [AssetSpec(key=lakehouse_asset_key(csv_path=csv_path))]


def defs_from_lakehouse(
    *, specs: Sequence[AssetSpec], csv_path: Path, duckdb_path: Path, columns: List[str]
) -> Definitions:
    @multi_asset(specs=specs)
    def _multi_asset() -> None:
        load_csv_to_duckdb(
            csv_path=csv_path,
            db_path=duckdb_path,
            columns=columns,
        )

    return Definitions(assets=[_multi_asset])


def lakehouse_existence_check_defs(csv_path: Path, duckdb_path: Path) -> Definitions:
    return Definitions(
        asset_checks=[
            build_table_existence_check(
                target_key=lakehouse_asset_key(csv_path=csv_path),
                duckdb_path=duckdb_path,
                table_name=id_from_path(csv_path),
                schema="lakehouse",
            )
        ]
    )
