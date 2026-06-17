import openpyxl

PATH = "Formula extraction 2026-05 sales targets for communication_Formula.xlsx"
wb = openpyxl.load_workbook(PATH, read_only=True, data_only=True)

# These "Formulas - X" tabs contain the formula TEXT of every cell (as written by extractFormulas.gs)
targets = [
    "Formulas - New Payout summary m",
    "Formulas - New Payout summary s",
    "Formulas - Calculations",
    "Formulas - Qualifying Stores",
    "Formulas - PAYOUT PER PERSON",
]

for name in targets:
    ws = wb[name]
    total = 0
    formula_cells = 0
    distinct_row2 = []
    for ri, row in enumerate(ws.iter_rows(values_only=True), start=1):
        for ci, v in enumerate(row, start=1):
            if v is None or str(v).strip() == "":
                continue
            total += 1
            s = str(v)
            if s.startswith("="):
                formula_cells += 1
                if ri == 2 and len(distinct_row2) < 6:
                    distinct_row2.append((ci, s[:90]))
    print("=" * 80)
    print(name)
    print(f"  non-empty cells: {total}   formula cells: {formula_cells}")
    print("  sample row-2 formulas:")
    for ci, s in distinct_row2:
        print(f"    col{ci}: {s}")
wb.close()
