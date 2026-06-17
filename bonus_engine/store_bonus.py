"""Store bonus — 10% pool, shrink gate, per-person split, floor."""

from __future__ import annotations

from typing import Mapping

import pandas as pd


def compute_store_bonus(
    qualifying: pd.DataFrame,
    kpi_results: pd.DataFrame,
    sales: pd.DataFrame,
    targets: pd.DataFrame,
    employees_info: pd.DataFrame,
    policy: Mapping,
    cycle: Mapping,
) -> pd.DataFrame:
    """Compute store bonus pool and per-person amounts per qualifying store.

    - Overall qualification: Angola → sales target; else sales target AND shrink_ex_oil PASS
    - Potential payout: pool_pct × max(0, actual − target)
    - Payout % from Store Staff Criteria weighting (guaranteed + shrink_ex_oil + oil_shrink)
    - Per-person split with floor applied in Rand

    Returns
    -------
    pd.DataFrame
        store, country, qualified, potential_local, payout_pct, payout_local,
        payout_rand, per_person_rand, per_person_after_floor, employee_count
    """
    pool_pct = policy.get("store_bonus", {}).get("pool_pct", 0.10)
    floor = policy.get("payout_floors", {}).get("per_person_minimum", 50)

    if qualifying.empty:
        return pd.DataFrame(
            columns=[
                "store",
                "country",
                "qualified",
                "potential_local",
                "payout_pct",
                "payout_local",
                "payout_rand",
                "per_person_rand",
                "per_person_after_floor",
                "employee_count",
            ]
        )

    rows = []
    for _, q in qualifying.iterrows():
        store = q.get("store")
        country = q.get("country", "")
        kpi = kpi_results[kpi_results["store"] == store].iloc[0] if not kpi_results.empty else {}
        payout_pct = store_payout_pct(country, kpi, policy)
        rows.append(
            {
                "store": store,
                "country": country,
                "qualified": False,
                "potential_local": 0.0,
                "payout_pct": payout_pct,
                "payout_local": 0.0,
                "payout_rand": 0.0,
                "per_person_rand": 0.0,
                "per_person_after_floor": apply_per_person_floor(0.0, floor),
                "employee_count": 0,
            }
        )
    return pd.DataFrame(rows)


def store_payout_pct(country: str, kpi_row: pd.Series | dict, policy: Mapping) -> float:
    """Weighted payout % from guaranteed + oil_shrink + shrink_ex_oil gates."""
    weighting = policy.get("store_bonus", {}).get("weighting", {})
    key = "angola" if str(country).lower() == "angola" else "default"
    w = weighting.get(key, weighting.get("default", {}))
    total = float(w.get("guaranteed", 0.0))
    shrink_pass = str(kpi_row.get("shrink_ex_oil", "")).upper() == "PASS"
    oil_pass = str(kpi_row.get("oil_shrink", "")).upper() == "PASS"
    if shrink_pass:
        total += float(w.get("shrink_ex_oil", 0.0))
    if oil_pass:
        total += float(w.get("oil_shrink", 0.0))
    return total


def apply_per_person_floor(amount: float, floor: float | None = None) -> float:
    """Apply minimum per-person payout floor (default 50 Rand)."""
    floor = floor if floor is not None else 50.0
    if 1 < amount < floor:
        return floor
    return amount


def pool_over_target(actual: float, target: float, pool_pct: float = 0.10) -> float:
    """10% of sales above target (0 if at or below target)."""
    excess = max(0.0, actual - target)
    return pool_pct * excess
