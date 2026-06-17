#!/usr/bin/env python3
"""CLI entry point for the bonus calculation engine."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from bonus_engine import consolidate, eligibility, kpis, loader, manager_bonus, payout, report, store_bonus


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the Gideon bonus engine for one monthly cycle.",
    )
    parser.add_argument(
        "--audit-xlsx",
        type=Path,
        default=None,
        help="Path to Audit export .xlsx (default: from cycle.yaml or repo root)",
    )
    parser.add_argument(
        "--config-dir",
        type=Path,
        default=Path("config"),
        help="Directory containing policy.yaml and cycle.yaml",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("output/payout_per_person.csv"),
        help="Output path for PAYOUT PER PERSON (.csv or .xlsx)",
    )
    parser.add_argument(
        "--sheets",
        nargs="*",
        default=None,
        help="Optional subset of logical sheet keys to load",
    )
    return parser.parse_args(argv)


def run_pipeline(
    audit_xlsx: Path,
    config_dir: Path,
    output: Path,
    sheets: list[str] | None = None,
) -> None:
    """Load config and xlsx, run pipeline stages, write payout report."""
    policy, cycle = loader.load_config(config_dir)

    if not audit_xlsx.exists():
        audit_xlsx = Path(cycle.get("input_files", {}).get("audit_xlsx", audit_xlsx))

    frames = loader.load_workbook(audit_xlsx, sheets=sheets)

    qualifying = eligibility.build_qualifying_stores(
        frames.get("store_master", frames.get("qualifying_stores")),
        policy,
        cycle,
    )
    qualifying = eligibility.filter_eligible(qualifying, policy)

    kpi_results = kpis.evaluate_kpis(qualifying, frames, policy, cycle)

    manager_summary = manager_bonus.compute_manager_payout_pct(
        kpi_results, qualifying, policy, cycle
    )
    cluster_bonus = manager_bonus.compute_cluster_manager_bonus(
        manager_summary,
        frames.get("cluster_manager"),
        policy,
        cycle,
    )

    store_summary = store_bonus.compute_store_bonus(
        qualifying,
        kpi_results,
        frames.get("sales"),
        frames.get("targets"),
        frames.get("employees_info"),
        policy,
        cycle,
    )

    consolidated = consolidate.consolidate_employee_bonuses(
        frames.get("calculations"),
        manager_summary,
        store_summary,
        cluster_bonus,
        kpi_results,
        policy,
        cycle,
    )

    payout_df = payout.compute_final_payout(
        consolidated,
        frames.get("timecard_exceptions_individual"),
        frames.get("extra_awol"),
        policy,
        cycle,
    )

    written = report.write_payout_report(payout_df, output)
    print(f"Wrote payout report: {written} ({len(payout_df)} rows)")


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    audit = args.audit_xlsx or Path(
        "Formula extraction 2026-05 sales targets for communication_Audit.xlsx"
    )
    try:
        run_pipeline(audit, args.config_dir, args.output, args.sheets)
    except FileNotFoundError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
