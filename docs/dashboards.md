# Dashboard Feeds — Store & Manager Bonus Letters

> Build spec for the two **store-level** Google Sheets tabs that feed the Looker
> (Data Studio) **Store Monthly Bonus Letter** and **Manager Monthly Bonus Letter**.
>
> Grain: **one row per store**. These tabs do **not** break down to per-person
> payout — the per-person split stays in `PAYOUT PER PERSON` / `Calculations`.
>
> Related: [bonus-model-logic.md](bonus-model-logic.md) (business rules),
> [sheets-integration.md](sheets-integration.md) (tab ↔ table map).

---

## 1. Why this rebuild

The store bonus engine now pays on a **2-pot model**, but the current dashboard
feed (`New Info for store bonus comms`) still presents the **old** structure
(Guaranteed base % + Oil-shrink weight + Abs-Unacc weight).

The Looker **Store letter already shows the 2-pot explanatory text**, yet its
data fields (Maximum potential payout, Abs Unacc, Total payout) still pull the old
comms columns — so stores see "Sales target not reached" instead of their real
Pot 1 / Pot 2 outcome. This rebuild feeds Looker the correct 2-pot data from two
clean store-level tabs.

---

## 2. The store bonus 2-pot model (source of truth)

Both pots are computed per store in **`New Payout summary store bonus`**:

| Pot | What it is | Qualification | Gross amount |
|-----|-----------|---------------|--------------|
| **Pot 1 – Sales Bonus** | Earned when the store beats sales target | col **S** (`PASS`/`FAIL`) | col **U** (10% of over-target; capped at 20% above target) |
| **Pot 2 – Performance Bonus** | Earned for running a great store even if target missed; 2% of monthly sales | col **T** (`PASS`/`FAIL`) | col **V** (2% of sales) |
| **Total pot** | Pot 1 + Pot 2 | — | col **W** |

**Pot 2 sub-criteria** (all four must pass) live in the **`Pot_2`** sheet, keyed on
`Pot_2!M` (Store):

| Criterion | Pot_2 column | Rule (per Looker letter) |
|-----------|--------------|--------------------------|
| Abs Unacc Variance (excl oil) as % of sales | `R` | below 6% |
| Chicken Score | `S` | above 60% |
| Customer Reviews | `T` | 5+ reviews |
| Scorecard | `U` | above 85% |
| **Pot 2 result** | `V` | all four `PASS` |

**Actual paid** (after weighting, min-50, headcount): `Payout Amount local (AA) →
per person AF → per store AH`. `AH` is what flows into `Calculations!S`.

### Reconciliation caveats (carry into the spec — these are real mismatches)

1. **Gross pot ≠ paid.** Columns `U`/`V`/`W` are gross pool amounts. The paid figure
   runs through `X × Y → AA → AF/AH`. Show **qualification** from the pot columns but
   **rand amounts** from `AF`/`AH`.
2. **Pot 1 amount understated for non-Hungry-Lion.** `U = Sales!E × 0.1` (10% for all),
   but Debonairs/Vida are actually paid **20%** of over-target via `X`, and get **no Pot 2**.
   Fix at source (make `U` brand-aware) if you want the standalone Pot 1 amount exactly right.
3. **Angola uses a guaranteed structure**, not pots: 70% guaranteed + 30% if Abs Unacc
   passes (`Store Staff Criteria!C4`/`C6`). Angola rows should say "guaranteed structure",
   not Pot 1 / Pot 2.

---

## 3. Current dashboard remapping (as-is)

### Management Dashboard ← `New Payout summary manager bonus` (1:1 reorder)

| Looker label | Sheet source | Notes |
|--------------|--------------|-------|
| Sales (criteria) | Sales Target DB (`AA`) | text e.g. "FAIL. Did not reach sales target" |
| Oil and Stock Control | Oil Quality DB (`AC`) | label differs from sheet header |
| Abs Unacc Variance as % of sales | Abs Unacc Variance DB (`AD`) | |
| Labour Management | Labour Efficiency DB (`AE`) | |
| Copilot Adoption | Virtual Assistant Adoption DB (`AG`) | label differs |
| Banking | Banking DB (`AH`) | |
| Delivery Performance | Delivery Performance DB (`AF`) | |
| Total Percentage obtained | Percentage obtained DB (`AK`) | net % after drop validation |
| % to Sales Target | Over/Under % Sales Target (`W`) | |
| Overrider bonus | Overrider Bonus (`AL`) | |
| Blocked Drains / Drop validation | `AI` / `AJ` | |

### Store Dashboard ← `New Info for store bonus comms` (old model — being replaced)

Presented Guaranteed / Oil shrink / Abs Unacc breakdown from comms `Z`/`AA`/`AB`,
total from `AC`. **This is what we replace with Pot 1 / Pot 2.**

---

## 4. Plan — two new store-level tabs

Create two dedicated tabs (one row per store) so Looker reads a clean, purpose-built
feed instead of the reordered comms sheet:

- **`Dash_Store`** → feeds Store Monthly Bonus Letter
- **`Dash_Manager`** → feeds Manager Monthly Bonus Letter

Both seed the store list from the engine sheet and `XLOOKUP` every other field by store.
Keep the engine sheets as pure calculation; keep these tabs presentation-only.

### Build order

1. Create `Dash_Store` and `Dash_Manager` tabs with the headers in §5 / §6.
2. Add the seed + `XLOOKUP` formulas (below).
3. Point the Looker data sources at the new tabs; remap each Looker field per §7.
4. Retire the old comms-fed fields once Looker validates.
5. (Optional) Fix `U` at source for non-HL 20% (caveat #2).

---

## 5. `Dash_Store` layout (Store Monthly Bonus Letter)

Row 1 = headers; row 2 = first data. `A` is the spilled store key.

| Col | Header | Formula (row 2, fill/spill down) |
|-----|--------|----------------------------------|
| A | Store name | `=ARRAYFORMULA(IF('New Payout summary store bonus'!C2:C="","",'New Payout summary store bonus'!C2:C))` |
| B | Bonus Period | `='Qualifying Stores'!$Y$1` (cycle month) |
| C | Country | `=ARRAYFORMULA(IF(A2:A="","",XLOOKUP(A2:A,'New Payout summary store bonus'!C:C,'New Payout summary store bonus'!A:A,,0,1)))` |
| D | Region | `…store bonus B:B` |
| E | Store Code | `…store bonus H:H` |
| F | Sales | `…store bonus K:K` (actual local) |
| G | Sales Target | `…store bonus L:L` |
| H | Achieved sales target | `…store bonus P:P` (Yes/No) |
| I | Pot 1 – Sales Bonus | see formula below |
| J | Pot 2 – Abs Unacc Variance | `="Abs Unacc Variance (<6%): "&IFERROR(XLOOKUP(A2,Pot_2!M:M,Pot_2!R:R,"N/A",0,1),"N/A")` |
| K | Pot 2 – Scorecard | `="Scorecard (>85%): "&IFERROR(XLOOKUP(A2,Pot_2!M:M,Pot_2!U:U,"N/A",0,1),"N/A")` |
| L | Pot 2 – Chicken Score | `="Chicken Score (>60%): "&IFERROR(XLOOKUP(A2,Pot_2!M:M,Pot_2!S:S,"N/A",0,1),"N/A")` |
| M | Pot 2 – Customer Reviews | `="Customer Reviews (5+): "&IFERROR(XLOOKUP(A2,Pot_2!M:M,Pot_2!T:T,"N/A",0,1),"N/A")` |
| N | Pot 2 – Performance Bonus | see formula below |
| O | Maximum potential payout | `…store bonus X:X` (potential local) |
| P | Total payout (per store) | `…store bonus AH:AH` |
| Q | Paid per person (min 50) | `…store bonus AF:AF` |
| R | Blocked Drains impact | `…store bonus` via `Blocked Drains Impact` or comms `AE` |
| S | Drop validation impact | via `Drop Validation Impact` or comms `AF` |

**Col I — Pot 1 text** (brand/country aware):

```
=ARRAYFORMULA(IF(A2:A="","",
 IF(C2:C="ANGOLA","Guaranteed structure (70% + 30% if Abs Unacc passes) — Pot 1/2 not applicable.",
  IF(XLOOKUP(A2:A,'New Payout summary store bonus'!C:C,'New Payout summary store bonus'!S:S,,0,1)="PASS",
    "Pot 1 – Sales Bonus: QUALIFIED. "&
      IF(XLOOKUP(A2:A,Brand!A:A,Brand!B:B,,0,1)="HUNGRY LION","10%","20%")&" of amount over target.",
    "Pot 1 – Sales Bonus: Not qualified — sales target not reached."))))
```

**Col N — Pot 2 result text**:

```
=ARRAYFORMULA(IF(A2:A="","",
 IF(C2:C="ANGOLA","Pot 2 not applicable in Angola.",
  IF(XLOOKUP(A2:A,Brand!A:A,Brand!B:B,,0,1)<>"HUNGRY LION","Pot 2 not applicable for this brand.",
   IF(XLOOKUP(A2:A,'New Payout summary store bonus'!C:C,'New Payout summary store bonus'!T:T,,0,1)="PASS",
     "Pot 2 – Performance Bonus: QUALIFIED (all 4 criteria passed). 2% of sales.",
     "Pot 2 – Performance Bonus: Not qualified — one or more criteria failed.")))))
```

---

## 6. `Dash_Manager` layout (Manager Monthly Bonus Letter)

| Col | Header | Formula (row 2) |
|-----|--------|-----------------|
| A | Store name | `=ARRAYFORMULA(IF('New Payout summary manager bonus'!C2:C="","",'New Payout summary manager bonus'!C2:C))` |
| B | Bonus Period | `='Qualifying Stores'!$Y$1` |
| C | Country | `…manager bonus A:A` |
| D | Region | `…manager bonus B:B` |
| E | Store Code | `…manager bonus H:H` |
| F | Sales Achieved | `…manager bonus U:U` (actual local) |
| G | Sales Target | `…manager bonus S:S` |
| H | Sales (criteria) | `…manager bonus AA:AA` (Sales Target DB text) |
| I | Labour Management | `…manager bonus AE:AE` |
| J | Copilot Adoption | `…manager bonus AG:AG` (VA Adoption DB) |
| K | Abs Unacc Variance as % of sales | `…manager bonus AD:AD` |
| L | Oil and Stock Control | `…manager bonus AC:AC` (Oil Quality DB) |
| M | Banking | `…manager bonus AH:AH` |
| N | Delivery Performance | `…manager bonus AF:AF` |
| O | Blocked Drains impact | `…manager bonus AI:AI` |
| P | Drop validation impact | `…manager bonus AJ:AJ` |
| Q | Total Percentage obtained | `…manager bonus AK:AK` (net %) |
| R | % to Sales Target | `…manager bonus W:W` |
| S | Overrider bonus | `…manager bonus AL:AL` |
| T | Store Pot 1 (optional) | `=XLOOKUP(A2,Dash_Store!A:A,Dash_Store!I:I,,0,1)` |
| U | Store Pot 2 (optional) | `=XLOOKUP(A2,Dash_Store!A:A,Dash_Store!N:N,,0,1)` |
| V | Store bonus paid (optional) | `=XLOOKUP(A2,Dash_Store!A:A,Dash_Store!P:P,,0,1)` |

Generic lookup pattern for the `…manager bonus X:X` cells:

```
=ARRAYFORMULA(IF(A2:A="","",XLOOKUP(A2:A,'New Payout summary manager bonus'!C:C,'New Payout summary manager bonus'!<col>,,0,1)))
```

---

## 7. Looker field → new tab column

### Store Monthly Bonus Letter

| Looker field | New source |
|--------------|-----------|
| Store name / Bonus Period | `Dash_Store!A` / `B` |
| Sales / Sales Target | `Dash_Store!F` / `G` |
| Achieved sales target | `Dash_Store!H` |
| Pot 1 – Sales Bonus (new) | `Dash_Store!I` |
| Pot 2 sub-criteria (new) | `Dash_Store!J:M` |
| Pot 2 – Performance Bonus (new) | `Dash_Store!N` |
| Maximum potential payout | `Dash_Store!O` |
| Total payout | `Dash_Store!P` (per store) / `Q` (per person) |
| Blocked Drains / Drop validation impact | `Dash_Store!R` / `S` |

### Manager Monthly Bonus Letter

| Looker field | New source |
|--------------|-----------|
| Store name / Bonus Period | `Dash_Manager!A` / `B` |
| Sales Achieved / Sales Target | `Dash_Manager!F` / `G` |
| Sales | `Dash_Manager!H` |
| Labour Management | `Dash_Manager!I` |
| Copilot Adoption | `Dash_Manager!J` |
| Abs Unacc Variance as % of sales | `Dash_Manager!K` |
| Oil and Stock Control | `Dash_Manager!L` |
| Banking | `Dash_Manager!M` |
| Delivery Performance | `Dash_Manager!N` |
| Blocked Drains / Drop validation impact | `Dash_Manager!O` / `P` |
| Total Percentage obtained | `Dash_Manager!Q` |
| % to Sales Target | `Dash_Manager!R` |
| Overrider bonus | `Dash_Manager!S` |

> **Timecard Exceptions Penalty** table (both letters) is a separate per-employee
> tile from `Timecard exceptions individual` — not part of these store-level tabs.

---

## 8. Build checklist

- [ ] Create `Dash_Store` tab + headers (§5)
- [ ] Create `Dash_Manager` tab + headers (§6)
- [ ] Add seed + lookup formulas; confirm one row per store, no gaps
- [ ] Verify Angola rows show guaranteed-structure text; non-HL show 20% / no Pot 2
- [ ] Repoint Looker Store letter fields → `Dash_Store` (§7)
- [ ] Repoint Looker Manager letter fields → `Dash_Manager` (§7)
- [ ] Validate 2–3 stores (Pot 1/Pot 2 qualification + paid amount) against the engine
- [ ] (Optional) Fix `U` at source for non-HL 20% (caveat #2)
