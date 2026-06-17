"""Consolidation — per-employee manager + store + overrider with attendance proration."""

from __future__ import annotations

from typing import Mapping

import pandas as pd


def consolidate_employee_bonuses(
    calculations: pd.DataFrame,
    manager_summary: pd.DataFrame,
    store_summary: pd.DataFrame,
    cluster_bonus: pd.DataFrame,
    kpi_results: pd.DataFrame,
    policy: Mapping,
    cycle: Mapping,
) -> pd.DataFrame:
    """Build per-employee bonus components (Calculations sheet logic).

    For each employee:
    - Manager Bonus = (net payout % × monthly bonus + cluster bonus) × %OfPrimaryJobDays
      × (1 − drop validation impact)
    - Store Bonus = (pool ÷ headcount) × %OfPrimaryJobDays × (1 − blocked drains)
      × (1 − drop validation)
    - Manager Overrider = overrider × %OfPrimaryJobDays × (1 − blocked drains);
      zero for Zimbabwe & Mauritius

    Parameters
    ----------
    calculations:
        Raw ``Calculations`` or ``import`` sheet with employee rows.
    manager_summary, store_summary, cluster_bonus, kpi_results:
        Upstream engine outputs.

    Returns
    -------
    pd.DataFrame
        employee_number, country, primary_job, primary_store, attendance_pct,
        manager_bonus, store_bonus, manager_overrider
    """
    columns = [
        "employee_number",
        "country",
        "primary_job",
        "primary_store",
        "attendance_pct",
        "manager_bonus",
        "store_bonus",
        "manager_overrider",
        "termination_reason",
        "drop_validation_impact",
        "blocked_drains_impact",
    ]
    if calculations.empty:
        return pd.DataFrame(columns=columns)

    # Scaffold: return empty structured frame until import column mapping is wired
    return pd.DataFrame(columns=columns)


def prorate_by_attendance(amount: float, pct_primary_job_days: float) -> float:
    """Multiply bonus by %OfPrimaryJobDays (0–100 scale or 0–1)."""
    if pct_primary_job_days > 1:
        pct_primary_job_days /= 100.0
    return amount * pct_primary_job_days


def apply_penalties(
    amount: float,
    drop_validation_impact: float,
    blocked_drains_impact: float,
    *,
    apply_drop: bool = True,
    apply_blocked: bool = True,
) -> float:
    """Reduce amount by drop validation and/or blocked drains impact fractions."""
    result = amount
    if apply_drop and drop_validation_impact:
        result *= 1.0 - drop_validation_impact
    if apply_blocked and blocked_drains_impact:
        result *= 1.0 - blocked_drains_impact
    return result
