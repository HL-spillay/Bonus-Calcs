"""Qualifying Stores eligibility — store / manager entry classification."""

from __future__ import annotations

from typing import Mapping

import pandas as pd


def _normalize_country(raw: str, policy: Mapping, cycle: Mapping) -> str:
    """Map sheet country labels to policy country keys."""
    aliases = cycle.get("country_aliases", {})
    key = str(raw).strip().upper()
    if key in aliases:
        return aliases[key]
    lesotho_maps = policy.get("eligibility", {}).get("lesotho_maps_to")
    if key == "LESOTHO" and lesotho_maps:
        return lesotho_maps
    return str(raw).strip().title()


def build_qualifying_stores(
    store_master: pd.DataFrame,
    policy: Mapping,
    cycle: Mapping,
) -> pd.DataFrame:
    """Derive qualifying store/manager rows from Store master (Qualifying Stores logic).

    Replicates the Store master → Qualifying Stores spine:
    - Store Valid Date: original opening date ≤ store_valid_through
    - Manager Valid Date: original opening date ≤ manager_valid_through
    - Type: Store / Manager / NA based on status and valid dates
    - Excludes Closed and BOTSWANA FRANCHISE

    Parameters
    ----------
    store_master:
        Raw ``Store master`` sheet (header row not assumed; caller may pre-process).
    policy:
        Policy config (eligibility rules).
    cycle:
        Cycle config (date cutoffs).

    Returns
    -------
    pd.DataFrame
        Columns: country, region, store, status, type, store_valid, manager_valid,
        classification_store, classification_manager.
    """
    cutoffs = cycle.get("date_cutoffs", {})
    store_through = pd.Timestamp(cutoffs.get("store_valid_through", "2026-03-31"))
    mgr_through = pd.Timestamp(cutoffs.get("manager_valid_through", "2026-04-30"))
    exclude_status = {s.upper() for s in policy.get("eligibility", {}).get("exclude_status", [])}

    # Stub: expect normalized store_master with named columns when wired fully.
    # For scaffold, return empty frame with expected schema if input is raw.
    columns = [
        "country",
        "region",
        "store",
        "status",
        "opening_date",
        "type",
        "store_valid",
        "manager_valid",
    ]
    if store_master.empty or store_master.shape[1] < 5:
        return pd.DataFrame(columns=columns)

    # Placeholder pass-through — full IMPORTRANGE/VLOOKUP replication TBD
    df = pd.DataFrame(columns=columns)
    return df


def filter_eligible(df: pd.DataFrame, policy: Mapping) -> pd.DataFrame:
    """Keep rows whose type is Store or Manager (not NA)."""
    allowed = set(policy.get("eligibility", {}).get("entry_types", ["Store", "Manager"]))
    if df.empty or "type" not in df.columns:
        return df
    return df[df["type"].isin(allowed)].copy()


def qualifying_store_list(df: pd.DataFrame) -> pd.Series:
    """Return ordered unique store names from qualifying entries."""
    if df.empty or "store" not in df.columns:
        return pd.Series(dtype=str)
    return df["store"].dropna().astype(str).str.strip().unique()
