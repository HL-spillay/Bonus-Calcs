"""KPI gate evaluation — PASS/FAIL per qualifying store for all 10 gates."""

from __future__ import annotations

from typing import Mapping

import pandas as pd

KPI_COLUMNS = [
    "oil_shrink",
    "oil_quality",
    "shrink_ex_oil",
    "labour",
    "delivery",
    "virtual_assistant",
    "banking_rsa",
    "banking_zambia",
    "drop_validation",
    "blocked_drains",
]


def evaluate_kpis(
    qualifying: pd.DataFrame,
    sheets: Mapping[str, pd.DataFrame],
    policy: Mapping,
    cycle: Mapping,
) -> pd.DataFrame:
    """Evaluate all KPI gates for each qualifying store.

    Each gate sheet follows the same pattern: lookup metric for store, compare to
    threshold from policy, emit PASS or FAIL.

    Parameters
    ----------
    qualifying:
        Output of ``eligibility.build_qualifying_stores`` (must include ``store``,
        ``country``).
    sheets:
        Loaded workbook frames (oil_shrink, abs_unacc_variance, labour, etc.).
    policy:
        Thresholds and weights from policy.yaml.
    cycle:
        Cycle-specific overrides.

    Returns
    -------
    pd.DataFrame
        One row per store with PASS/FAIL columns for each KPI gate.
    """
    if qualifying.empty:
        return pd.DataFrame(columns=["store", "country", *KPI_COLUMNS])

    stores = qualifying[["store", "country"]].drop_duplicates().reset_index(drop=True)
    for col in KPI_COLUMNS:
        stores[col] = "FAIL"  # scaffold default until raw lookups wired

    return stores


def oil_shrink_pass(
    shrink_pct: float,
    store_category: str,
    policy: Mapping,
) -> str:
    """Oil shrink PASS when shrink_pct > category threshold (strictly greater)."""
    thresholds = policy.get("oil_shrink_thresholds", {})
    threshold = thresholds.get(store_category.upper().replace(" ", "-"), 0.0)
    return "PASS" if shrink_pct > threshold else "FAIL"


def shrink_ex_oil_pass(
    variance_pct: float,
    country: str,
    policy: Mapping,
) -> str:
    """Abs Unacc Variance PASS when variance is between country lower/upper limits."""
    limits = policy.get("shrink_ex_oil_limits", {})
    bounds = limits.get(country, {"upper": 0.06, "lower": 0.0})
    lower = bounds.get("lower", 0.0)
    upper = bounds.get("upper", 0.06)
    if lower <= variance_pct <= upper:
        return "PASS"
    return "FAIL"


def oil_quality_score(
    tpm_pass: bool,
    checklist_pass: bool,
    stock_take_pass: bool,
    policy: Mapping,
) -> float:
    """Return oil quality weight contribution (0, 0.03, 0.06, 0.09, or 0.10)."""
    oq = policy.get("oil_quality", {})
    sub = oq.get("sub_check_weight", 0.03)
    full = oq.get("all_pass_weight", 0.10)
    checks = [tpm_pass, checklist_pass, stock_take_pass]
    if all(checks):
        return full
    return sum(sub for c in checks if c)


def delivery_pass(
    acceptance_pass: bool,
    online_rate: float,
    policy: Mapping,
) -> str:
    """Delivery PASS when acceptance PASS and online rate ≥ threshold."""
    min_online = policy.get("delivery", {}).get("online_rate_min", 0.90)
    if acceptance_pass and online_rate >= min_online:
        return "PASS"
    return "FAIL"
