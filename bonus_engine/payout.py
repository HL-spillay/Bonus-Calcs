"""Final payout — attendance gate, timecard/AWOL loss, termination rules."""

from __future__ import annotations

from typing import Mapping

import pandas as pd


def compute_final_payout(
    consolidated: pd.DataFrame,
    timecard_exceptions: pd.DataFrame,
    extra_awol: pd.DataFrame,
    policy: Mapping,
    cycle: Mapping,
) -> pd.DataFrame:
    """Apply PAYOUT PER PERSON gates to consolidated employee bonuses.

    - Total possible payout = manager + store + overrider if attendance ≥ gate, else 0
    - Timecard loss: individual exception penalty %
    - AWOL/Absent: 100% loss if any AWOL day
    - Termination: zero for Misconduct / Discharged / Absconded
    - Store/Manager incentive columns apply floor (50) when result in (1, 50)

    Returns
    -------
    pd.DataFrame
        Matches PAYOUT PER PERSON key columns: country, primary_job, employee_number,
        attendance_pct, manager_component, store_component, overrider_component,
        total_possible, timecard_loss_pct, awol_loss_pct, termination_reason,
        payout_local, store_incentive_payout, manager_incentive_payout
    """
    gate = policy.get("attendance", {}).get("gate_pct", 0.80)
    floor = policy.get("payout_floors", {}).get("per_person_minimum", 50)
    zero_terms = set(policy.get("termination", {}).get("zero_payout_reasons", []))

    columns = [
        "country",
        "primary_job",
        "employee_number",
        "attendance_pct",
        "manager_component",
        "store_component",
        "overrider_component",
        "total_possible",
        "timecard_loss_pct",
        "awol_loss_pct",
        "termination_reason",
        "payout_local",
        "store_incentive_payout",
        "manager_incentive_payout",
    ]
    if consolidated.empty:
        return pd.DataFrame(columns=columns)

    rows = []
    for _, emp in consolidated.iterrows():
        attendance = float(emp.get("attendance_pct", 0) or 0)
        if attendance > 1:
            attendance /= 100.0

        mgr = float(emp.get("manager_bonus", 0) or 0)
        store = float(emp.get("store_bonus", 0) or 0)
        over = float(emp.get("manager_overrider", 0) or 0)
        term = emp.get("termination_reason")

        total = total_possible_payout(mgr, store, over, attendance, gate)
        tc_loss = 0.0  # lookup from timecard_exceptions TBD
        awol_loss = 0.0  # lookup from extra_awol TBD

        payout_local = final_payout_amount(total, tc_loss, awol_loss, term, zero_terms)
        store_out = incentive_payout(store, mgr, over, attendance, tc_loss, awol_loss, term, floor, "store")
        mgr_out = incentive_payout(store, mgr, over, attendance, tc_loss, awol_loss, term, floor, "manager")

        rows.append(
            {
                "country": emp.get("country"),
                "primary_job": emp.get("primary_job"),
                "employee_number": emp.get("employee_number"),
                "attendance_pct": attendance * 100,
                "manager_component": mgr,
                "store_component": store,
                "overrider_component": over,
                "total_possible": total,
                "timecard_loss_pct": tc_loss,
                "awol_loss_pct": awol_loss,
                "termination_reason": term,
                "payout_local": payout_local,
                "store_incentive_payout": store_out,
                "manager_incentive_payout": mgr_out,
            }
        )
    return pd.DataFrame(rows)


def total_possible_payout(
    manager: float,
    store: float,
    overrider: float,
    attendance_pct: float,
    gate: float = 0.80,
) -> float:
    """Sum components only if attendance meets gate (H ≥ 80%)."""
    if attendance_pct < gate:
        return 0.0
    return manager + store + overrider


def final_payout_amount(
    total: float,
    timecard_loss_pct: float,
    awol_loss_pct: float,
    termination_reason: str | None,
    zero_terms: set[str],
) -> float:
    """PAYOUT LOCAL CURRENCY after termination and penalty multipliers."""
    if termination_reason and str(termination_reason).strip() in zero_terms:
        return 0.0
    tc = timecard_loss_pct if timecard_loss_pct <= 1 else timecard_loss_pct / 100
    awol = awol_loss_pct if awol_loss_pct <= 1 else awol_loss_pct / 100
    return total * (1.0 - tc) * (1.0 - awol)


def incentive_payout(
    store: float,
    manager: float,
    overrider: float,
    attendance_pct: float,
    timecard_loss_pct: float,
    awol_loss_pct: float,
    termination_reason: str | None,
    floor: float,
    component: str,
) -> float:
    """Store or manager incentive column with floor and gates."""
    zero_terms = {"Misconduct", "Discharged", "Absconded"}
    if termination_reason and str(termination_reason).strip() in zero_terms:
        return 0.0
    if attendance_pct < 0.80 if attendance_pct <= 1 else attendance_pct < 80:
        return 0.0

    tc = timecard_loss_pct if timecard_loss_pct <= 1 else timecard_loss_pct / 100
    awol = awol_loss_pct if awol_loss_pct <= 1 else awol_loss_pct / 100
    mult = (1.0 - tc) * (1.0 - awol)

    if component == "store":
        raw = store * mult
    else:
        raw = (manager + overrider) * mult

    if 1 < raw < floor:
        return floor
    return raw
