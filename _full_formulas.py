import openpyxl

FPATH = "Formula extraction 2026-05 sales targets for communication_Formula.xlsx"
wb = openpyxl.load_workbook(FPATH, read_only=True, data_only=True)

# (formula tab, row, col_letter) -> label
targets = [
    ("Formulas - New Payout summary m", 2, "R", "Manager: Payout % of monthly bonus"),
    ("Formulas - New Payout summary m", 2, "X", "Manager: Payout % (for the ...)"),
    ("Formulas - New Payout summary m", 2, "AK", "Manager: Overrider Bonus"),
    ("Formulas - New Payout summary s", 2, "T", "Store: Payout %"),
    ("Formulas - Calculations", 2, "R", "Calculations: Manager Bonus"),
    ("Formulas - Calculations", 2, "S", "Calculations: Store Bonus"),
    ("Formulas - Calculations", 2, "T", "Calculations: Manager Overrider bonus"),
]

from openpyxl.utils import column_index_from_string

# read_only random access is awkward; load specific rows by scanning
wanted = {}
for tab, row, colL, label in targets:
    wanted.setdefault(tab, []).append((row, column_index_from_string(colL), colL, label))

for tab, items in wanted.items():
    ws = wb[tab]
    maxrow = max(r for r, *_ in items)
    grid = {}
    for i, rowvals in enumerate(ws.iter_rows(values_only=True), start=1):
        if i > maxrow:
            break
        grid[i] = rowvals
    for row, cidx, colL, label in items:
        rowvals = grid.get(row, ())
        val = rowvals[cidx - 1] if cidx - 1 < len(rowvals) else None
        print("=" * 80)
        print(f"{label}   [{tab} {colL}{row}]")
        print("-" * 80)
        print(val)
        print()
wb.close()
