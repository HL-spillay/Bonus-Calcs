"""Manager bonus — payout %, overrider tiers, cluster manager share."""

from __future__ import annotations

from typing import Mapping

import pandas as pd


def compute_manager_payout_pct(
    kpi_results: pd.DataFrame,
    qualifying: pd.DataFrame,
    policy: Mapping,
    cycle: Mapping,
) -> pd.DataFrame:
    """Sum country-specific KPI weights for passed gates → gross payout %.

    Blocked drains can zero or reduce net payout % (see ``apply_blocked_drains``).

    Returns
    -------
    pd.DataFrame
        store, country, gross_payout_pct, net_payout_pct, blocked_drains_impact
    """
    weights_cfg = policy.get("manager_kpi_weights", {})
    if kpi_results.empty:
        return pd.DataFrame(
            columns=["store", "country", "gross_payout_pct", "net_payout_pct", "blocked_drains_impact"]
        )

    rows = []
    for _, row in kpi_results.iterrows():
        block = _select_weight_block(row.get("country", ""), policy)
        kpis = block.get("kpis", {}) if block else {}
        gross = _sum_passed_weights(row, kpis)
        blocked = float(row.get("blocked_drains", 0) or 0)
        net = apply_blocked_drains(gross, blocked)
        rows.append(
            {
                "store": row["store"],
                "country": row.get("country"),
                "gross_payout_pct": gross,
                "net_payout_pct": net,
                "blocked_drains_impact": blocked,
            }
        )
    return pd.DataFrame(rows)


def apply_blocked_drains(gross_pct: float, blocked_impact: float) -> float:
    """Reduce payout % by blocked drains impact; zero if impact ≥ gross."""
    if blocked_impact >= gross_pct:
        return 0.0
    return max(0.0, gross_pct - blocked_impact)


def compute_overrider(
    over_under_pct: float,
    shrink_ex_oil_pass: str,
    country: str,
    policy: Mapping,
) -> float:
    """Tiered flat overrider amount from Over/Under % of sales target."""
    excluded = policy.get("kpi_exclusions", {}).get("overrider_excluded_countries", [])
    if country in excluded or shrink_ex_oil_pass != "PASS":
        return 0.0

    for tier in policy.get("overrider_tiers", []):
        lo = tier.get("min_pct", 0)
        hi = tier.get("max_pct")
        if over_under_pct >= lo and (hi is None or over_under_pct < hi):
            return float(tier.get("payout", 0))
    return 0.0


def compute_cluster_manager_bonus(
    manager_summary: pd.DataFrame,
    cluster_manager: pd.DataFrame,
    policy: Mapping,
    cycle: Mapping,
) -> pd.DataFrame:
    """Cluster manager earns share × net payout % × monthly bonus + overrider share."""
    share = policy.get("cluster_manager", {}).get("share", 0.30)
    monthly = policy.get("monthly_bonus_potential", {})

    if cluster_manager.empty:
        return pd.DataFrame(columns=["cluster_manager", "store", "cluster_bonus", "final_cluster_bonus"])

    # Scaffold: structure only
    return pd.DataFrame(
        columns=["cluster_manager", "store", "cluster_bonus", "overrider_share", "final_cluster_bonus"]
    )


def _select_weight_block(country: str, policy: Mapping) -> dict:
    """Pick manager KPI weight block for a country (stub — delivery/brand TBD)."""
    blocks = policy.get("manager_kpi_weights", {})
    country_lower = str(country).lower()
    for block in blocks.values():
        if str(block.get("country", "")).lower() == country_lower:
            return block
    return {}


def _sum_passed_weights(kpi_row: pd.Series, weights: Mapping[str, float]) -> float:
    """Add KPI weights where the corresponding gate is PASS."""
    total = 0.0
    mapping = {
        "sales": "sales",
        "oil_shrink": "oil_shrink",
        "oil_quality": "oil_quality",
        "shrink_ex_oil": "shrink_ex_oil",
        "labour": "labour",
        "delivery": "delivery",
        "copilot": "virtual_assistant",
        "banking": "banking_rsa",
    }
    for kpi_key, col in mapping.items():
        weight = weights.get(kpi_key, 0.0)
        if weight and str(kpi_row.get(col, "")).upper() == "PASS":
            total += float(weight)
    return total
