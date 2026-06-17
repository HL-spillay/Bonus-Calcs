"""Load Audit workbook sheets into named pandas DataFrames."""

from __future__ import annotations

from pathlib import Path
from typing import Mapping

import pandas as pd

# Logical key → exact sheet name in the Audit export
SHEET_MAP: dict[str, str] = {
    "payout_per_person": "PAYOUT PER PERSON",
    "corrections": "Corrections",
    "calculations": "Calculations",
    "cluster_manager": "Cluster Manager",
    "extra_awol": "Extra Awol",
    "managers_criteria": "Managers criteria",
    "store_staff_criteria": "Store Staff Criteria",
    "employees_info": "Employees info",
    "sales": "Sales",
    "targets": "Targets",
    "exchange_info": "Exchange info",
    "qualifying_stores": "Qualifying Stores",
    "manager_bonus_summary": "New Payout summary manager bonu",
    "store_bonus_summary": "New Payout summary store bonus",
    "store_bonus_comms": "New Info for store bonus comms",
    "oil_shrink": "Oil shrink",
    "abs_unacc_variance": "Abs Unacc Variance",
    "labour": "Labour",
    "angola_results": "Angola Results",
    "virtual_assistant": "Virtual Assistant Adoption",
    "oil_quality": "Oil Quality",
    "banking_rsa_zim_mau_angola": "RSA, ZIM, MAU & AngolaBanking",
    "banking_zambia": "Zambia Banking",
    "delivery_performance": "Delivery Stores Performance",
    "timecard_exceptions_individual": "Timecard exceptions individual",
    "timecard_exceptions_stores": "Timecard exception_edits stores",
    "drop_validation_impact": "Drop Validation Impact",
    "blocked_drains_impact": "Blocked Drains Impact",
    "vlook": "VLook",
    "store_master": "Store master",
    "import": "import",
}


def load_workbook(audit_xlsx: str | Path, sheets: list[str] | None = None) -> dict[str, pd.DataFrame]:
    """Read selected sheets from the Audit xlsx into a dict of DataFrames.

    Parameters
    ----------
    audit_xlsx:
        Path to the Audit export workbook.
    sheets:
        Optional list of logical keys from ``SHEET_MAP``. Defaults to all mapped sheets.

    Returns
    -------
    dict[str, pd.DataFrame]
        Keys are logical names; values are raw sheet DataFrames (no header normalisation).
    """
    path = Path(audit_xlsx)
    if not path.exists():
        raise FileNotFoundError(f"Audit workbook not found: {path}")

    keys = sheets or list(SHEET_MAP.keys())
    sheet_names = {k: SHEET_MAP[k] for k in keys if k in SHEET_MAP}

    xl = pd.ExcelFile(path, engine="openpyxl")
    available = set(xl.sheet_names)
    frames: dict[str, pd.DataFrame] = {}

    for logical, sheet_name in sheet_names.items():
        if sheet_name not in available:
            raise ValueError(f"Sheet {sheet_name!r} not found in {path.name}")
        frames[logical] = pd.read_excel(xl, sheet_name=sheet_name, header=None)

    return frames


def load_config(config_dir: str | Path) -> tuple[Mapping, Mapping]:
    """Load ``policy.yaml`` and ``cycle.yaml`` from *config_dir*."""
    import yaml

    config_dir = Path(config_dir)
    with open(config_dir / "policy.yaml", encoding="utf-8") as f:
        policy = yaml.safe_load(f)
    with open(config_dir / "cycle.yaml", encoding="utf-8") as f:
        cycle = yaml.safe_load(f)
    return policy, cycle
