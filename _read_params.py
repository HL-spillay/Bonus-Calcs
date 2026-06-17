import openpyxl
from collections import Counter

PATH = "Formula extraction 2026-05 sales targets for communication_Audit.xlsx"
wb = openpyxl.load_workbook(PATH, read_only=True, data_only=True)

def rows_of(name):
    ws = wb[name]
    out = []
    for row in ws.iter_rows(values_only=True):
        if all(c is None or str(c).strip() == "" for c in row):
            continue
        out.append(["" if c is None else str(c) for c in row])
    return out

# Parameters
print("=" * 80, "\nAudit - Parameters\n", "=" * 80)
prm = rows_of("Audit - Parameters")
print("total rows:", len(prm))
for r in prm[:120]:
    while r and r[-1] == "":
        r.pop()
    print(" | ".join(r))

# Formula Inventory: counts per sheet + sample for key sheets
print("\n" + "=" * 80, "\nAudit - Formula Inventory (overview)\n", "=" * 80)
inv = rows_of("Audit - Formula Inventory")
print("total rows:", len(inv))
header = inv[0]
print("header:", header)
per_sheet = Counter(r[0] for r in inv[1:])
for s, c in per_sheet.most_common():
    print(f"  {s}: {c}")

wb.close()
