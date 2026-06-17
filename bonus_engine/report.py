"""Report writer — PAYOUT PER PERSON to Excel/CSV."""

from __future__ import annotations

from pathlib import Path

import pandas as pd


PAYOUT_COLUMNS = [
    "country",
    "primary_job",
    "employee_number",
    "attendance_pct",
    "total_possible",
    "timecard_loss_pct",
    "awol_loss_pct",
    "termination_reason",
    "payout_local",
    "store_incentive_payout",
    "manager_incentive_payout",
]


def write_payout_report(
    payout_df: pd.DataFrame,
    output_path: str | Path,
    *,
    format: str | None = None,
) -> Path:
    """Write final payout DataFrame to Excel or CSV.

    Parameters
    ----------
    payout_df:
        Output of ``payout.compute_final_payout``.
    output_path:
        Destination file path (.xlsx or .csv).
    format:
        Optional override: ``excel`` or ``csv``. Inferred from suffix if omitted.

    Returns
    -------
    Path
        Written file path.
    """
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    out = payout_df.reindex(columns=PAYOUT_COLUMNS)
    fmt = format or ("excel" if path.suffix.lower() in {".xlsx", ".xls"} else "csv")

    if fmt == "excel":
        out.to_excel(path, index=False, sheet_name="PAYOUT PER PERSON")
    else:
        out.to_csv(path, index=False)

    return path


def format_timecard_pct(value: float) -> str:
    """Format timecard loss as percentage string matching sheet (e.g. '0%')."""
    pct = value * 100 if value <= 1 else value
    return f"{pct:.0f}%"
