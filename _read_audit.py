import openpyxl

PATH = "Formula extraction 2026-05 sales targets for communication_Audit.xlsx"
wb = openpyxl.load_workbook(PATH, read_only=True, data_only=True)

def dump(sheet_name, max_rows=None):
    ws = wb[sheet_name]
    print("\n" + "=" * 80)
    print(sheet_name)
    print("=" * 80)
    n = 0
    for row in ws.iter_rows(values_only=True):
        # skip fully empty rows
        if all(c is None or str(c).strip() == "" for c in row):
            continue
        cells = ["" if c is None else str(c) for c in row]
        # trim trailing empties
        while cells and cells[-1] == "":
            cells.pop()
        print(" | ".join(cells))
        n += 1
        if max_rows and n >= max_rows:
            print(f"... (stopped at {max_rows} rows)")
            break
    print(f"[total non-empty rows printed: {n}]")

for s in ["Audit - Sheet Summary", "Audit - Connections", "Audit - Functions"]:
    dump(s)

wb.close()
