# Bonus Model — Plain-English Logic Spec

> **Legacy reference.** The active system design is documented in [README.md](README.md), [design.md](design.md), and [schemas-and-pipeline.md](schemas-and-pipeline.md). This file describes the *old Google Sheets formula workbook* for business-rule context only. Corrections tab logic is excluded from the new system.

> Reverse-engineered from `Formula extraction 2026-05 sales targets for communication`
> (Audit + Formula exports). This document describes **what the current workbook
> actually does**, in plain English, so it can be rebuilt as a clean,
> config-driven engine.
>
> **How to review this:** read each section, correct anything wrong, and fill in
> the **[CONFIRM]** notes. Anything marked **[ASSUMPTION]** is my best read of the
> formula and needs your sign-off. Once agreed, this becomes the build spec.

---

## 1. What the model produces

For one monthly cycle, the workbook calculates **two bonuses per qualifying store**,
then splits them down to **per-employee payouts**:

1. **Store bonus** — a pool worth **10% of sales above target**, shared among store
   staff, gated mainly on the *Shrinkage-excluding-oil* (Abs Unacc Variance) check.
2. **Manager bonus** — a percentage of each manager's **monthly bonus potential**,
   earned by passing a country-specific set of **KPI gates**, plus a **sales
   overrider** bonus for beating target, plus a **cluster manager** share.

Final outputs are the `PAYOUT PER PERSON` tab (the payout file) and
`New Info for store bonus comms` (the per-store communication text).

---

## 2. The sheets, grouped by role

| Role | Sheets |
|------|--------|
| **Raw inputs** (pasted/imported each cycle) | `Sales`, `Targets`, `Employees info`, `Exchange info`, `Extra Awol`, `import`, `Timecard exceptions individual`, `Timecard exception_edits stores`, and the raw blocks feeding each KPI sheet |
| **Reference / lookups** | `Store master` (IMPORTRANGE master list), `VLook` (emails, codes, oil category), `list` (named range) |
| **Eligibility hub** | `Qualifying Stores` |
| **KPI gates** | `Oil shrink`, `Oil Quality`, `Abs Unacc Variance`, `Labour`, `Delivery Stores Performance`, `Virtual Assistant Adoption`, `RSA, ZIM, MAU & AngolaBanking`, `Zambia Banking`, `Drop Validation Impact`, `Blocked Drains Impact`, `Angola Results` |
| **Config / criteria** | `Managers criteria`, `Store Staff Criteria` |
| **Bonus engines** | `New Payout summary manager bonus`, `New Payout summary store bonus`, `Cluster Manager` |
| **Consolidation** | `Calculations` |
| **Final output** | `PAYOUT PER PERSON`, `Corrections`, `New Info for store bonus comms` |

---

## 3. End-to-end data flow

```
Raw imports (Sales, Targets, Employees, Timecards, KPI raw data, Exchange)
        │
        ▼
Store master / VLook  ──►  Qualifying Stores   (decides who is a "Store" or "Manager" entry, and eligibility)
        │                         │
        │        ┌────────────────┴───────────────────────────────────┐
        │        ▼                                                      ▼
        │   KPI gate sheets (each returns PASS/FAIL per store)     Exchange info
        │   Oil shrink · Oil Quality · Abs Unacc Variance ·            (ZAR rates)
        │   Labour · Delivery · Virtual Assistant · Banking ·
        │   Drop Validation · Blocked Drains
        │        │
        ▼        ▼
New Payout summary MANAGER bonus  ── feeds ──►  New Payout summary STORE bonus
        │   (manager payout %, overrider)            (store pool, per-person split)
        │                                                   │
        └───────────────┬───────────────────────────────────┘
                        ▼
                   Calculations   (per employee: combine store + manager + overrider, prorate by attendance)
                        │
                        ▼
                 PAYOUT PER PERSON   (apply attendance gate, timecard & AWOL losses, termination rules)
                        │
                        ▼
                  Corrections (manual old-vs-new adjustments)   +   New Info for store bonus comms (text)
```

---

## 4. Eligibility — `Qualifying Stores`

This sheet turns the master store list into the list of entries that can earn a bonus,
splitting each store into a **Store** row and/or a **Manager** row.

- Pulls each store's **Country, Region, Status, trade dates, type** from `Store master`.
- **Store Valid Date** (`R`): store is valid if its *original opening date* `Q` ≤
  **end of the month before last** (`EOMONTH(DATE(2026,5,1), -1)` → 30 Apr 2026). **[CONFIRM: the `DATE(2026,5,1)` is the cycle month and is the main date knob.]**
- **Manager Valid Date** (`S`): same idea against a manager-specific cutoff (`$W$2`).
- **Type** (`T`): `"Store"`, `"Manager"`, or `"NA"` — excludes `Closed` and
  `BOTSWANA FRANCHISE`. **[ASSUMPTION: a store can appear once as a Store entry and once as a Manager entry.]**
- Lesotho is folded into **South Africa** for the country label.

> **Why it matters:** almost every KPI sheet starts from `Qualifying Stores!C` (the
> store list) and filters by country. This is the spine of the model.

---

## 5. KPI gates (each returns PASS / FAIL per store)

All KPI sheets follow the same pattern: take the qualifying-store list, look up the
store's raw metric, compare to a threshold, output `PASS`/`FAIL`.

| KPI sheet | Pass rule (plain English) | Threshold source |
|-----------|---------------------------|------------------|
| **Oil shrink** | Oil shrink % (`units shrink / units sold`) is **above** the store-category threshold | `Store Staff Criteria` oil table by store size (EXTRA-LARGE `0.0065` … SMALL `-0.3677`) |
| **Oil Quality** | 3 sub-checks (TPM ≤5% over 25; Co-Pilot checklist ≥89.5%; stock-take ≥89.5%). Each worth **3%**; all three → **10%** | Hardcoded `0.05`, `0.895`; score `0.03` each / `0.1` all |
| **Abs Unacc Variance** (shrink ex-oil) | Variance as % of sales is **between** the country lower & upper limits | `Store Staff Criteria` rows 29–36 (most `0–6%`; Angola `−0.75%…0.75%`) |
| **Labour** | Coverage deviation acceptable (`PASS` default if not found). Excludes Angola | `Labour` raw block |
| **Delivery Stores Performance** | Acceptance rate PASS **and** online rate PASS (online ≥ `0.9`) | `Q2 = 0.9`; availability `0.985`, acceptance `≤1`, cancellations `≤0.001` |
| **Virtual Assistant Adoption** | Nudges, thawing plan (≥`0.85`), drop plan (≥`0.85`) all PASS; avg response ≤ `2` | Hardcoded `0.85`, `2` |
| **Banking (RSA/ZIM/MAU/Angola)** | `"Compliant"` → PASS | raw block |
| **Banking (Zambia)** | `"Incentive Payout"` → PASS | raw block |
| **Drop Validation Impact** | Valid drop score `< 0.745` → **100% impact** (a penalty) | `M2 = 0.745` |
| **Blocked Drains Impact** | Listed store → impact `1` (penalty), else `0` | manual list |

**[CONFIRM]** the per-KPI raw inputs (how each metric arrives) — these are the monthly pastes.

---

## 6. Manager bonus engine — `New Payout summary manager bonus`

One row per qualifying store. Key columns:

### 6.1 Payout % of monthly bonus (`R`)
A country-specific **sum of KPI weights** for the gates the store passed. Example for
**South Africa / Lesotho (delivery)**:

```
payout% =  (Sales PASS      ? 10% : 0)
         + (Oil shrink PASS ?  0% : 0)
         + (Oil quality     ? variable, from Oil Quality score : 0)
         + (Shrink-ex-oil PASS ? 10% : 0)
         + (Labour PASS     ? 25% : 0)
         + (Delivery PASS   ? 10% : 0)
         + (Co-Pilot PASS   ? 25% : 0)
         + (Banking PASS    ? 10% : 0)
```

The exact weights differ per country/store-type block in `Managers criteria` (see §10.1).
Different branches handle **delivery vs non-delivery**, **Namibia, Zambia (delivery/non),
Eswatini, Angola HL, Angola Deb&Vida, Mauritius, Zimbabwe**. If `Q="NO"` (blocked drains) → `0%`.

### 6.2 Net payout % (`X`)
`payout% reduced by the blocked-drains figure` (`if blocked ≥ payout% → 0, else payout% − blocked`).
**[ASSUMPTION: `X` is the figure actually used downstream in `Calculations`.]**

### 6.3 Overrider bonus (`AK`) — reward for beating sales target
Tiered flat amount based on **Over/Under % of Sales Target** (`W`); zero if Abs Unacc
Variance failed or Angola:

| Sales vs target | Overrider payout |
|-----------------|------------------|
| 100% – 105% | 250 |
| 105% – 110% | 500 |
| 110% – 115% | 750 |
| 115% – 120% | 1000 |
| ≥ 120% | 1250 |

(From `Managers criteria` rows 133–137.)

### 6.4 Sales figures
`S/T/U/V/W` compute sales target & actual in local currency and Rand (via `Exchange info`),
and **Over/Under %** = actual ÷ target. Columns `Z`–`AG` are human-readable "PASS. xx% payout"
explanations for the comms tab (not used in math).

---

## 7. Store bonus engine — `New Payout summary store bonus`

One row per qualifying store.

- **Overall Qualification (`R`)**: Angola → qualifies if achieved sales target;
  elsewhere → achieved sales target **AND** Abs Unacc Variance = PASS.
- **Potential payout local currency (`S`)**: `10% × (actual sales − sales target)`
  (only the amount over target; 0 if not qualified).
- **Payout % (`T`)** — weighting from `Store Staff Criteria`:
  - **Angola**: `0.70` guaranteed `+ 0.30` if Abs Unacc PASS.
  - **Everyone else**: `0.00` base `+ 0.00` if oil-shrink PASS `+ 1.00` if Abs Unacc PASS.
  - **[CONFIRM]** so today the store bonus is effectively **all-or-nothing on Shrink-ex-oil** (oil-shrink weight is 0). Is that intended, or a placeholder?
- **Payout Amount local currency (`V`)**: `payout% × (actual − target) × 10%`.
- **Per-person split**: `Payout Amount Rand ÷ Employee Count` (`Z`), with a **minimum
  floor of 50 per person** (`AA`), then multiplied back up by headcount (`AB`) and
  converted to local currency (`AC`).

> `Employee Count` per store comes from `Employees info!J:K`, which counts employees with
> attendance ≥ 80% in the cycle.

---

## 8. Cluster Manager — `Cluster Manager`

For cluster managers (who oversee multiple stores):

- Final payout % of manager bonus per managed store (`H`), then **× 30%** (`I`) — a
  cluster manager earns **30%** of the manager bonus % of their stores.
- **Cluster Manager Bonus (`J`)** = `manager-summary net payout % × monthly bonus
  (position+country) × 30%`.
- **Final Cluster Bonus (`L`)** = `J + (manager overrider × 30%)`.

**[CONFIRM]** the `0.3` cluster share is a key parameter.

---

## 9. Consolidation & final payout

### 9.1 `Calculations` (one row per employee, ~10k rows)
Inputs per employee (from HR/timecard import): person number, name, status, **PrimaryJob**,
**PrimaryStore**, days, hire date, **%OfPrimaryJobDays (`H`)**, AWOL days, absent days,
actual hours, days worked, termination reason.

Derived:
- **Country (`N`)** = store → country.
- **Manager Bonus (`R`)**: `0` if Absconded/Discharged; blank for "Star"/"Brand" jobs;
  for **Manager** jobs:
  ```
  ( manager-summary net payout %  ×  monthly bonus[position, country]
    + cluster-manager bonus[store] )
  × %OfPrimaryJobDays                      (attendance proration)
  × (1 − Drop Validation impact)
  ```
- **Store Bonus (`S`)**: `(per-store payout pool ÷ store headcount) × %OfPrimaryJobDays
  × (1 − Blocked Drains) × (1 − Drop Validation)`.
- **Manager Overrider (`T`)**: `overrider × %OfPrimaryJobDays × (1 − Blocked Drains)`;
  `0` for Zimbabwe & Mauritius.

### 9.2 `PAYOUT PER PERSON` (the payout file)
Per employee, brings together the three components (Manager `E`, Store `F`, Overrider `G`
— **[ASSUMPTION: E/F/G map to `Calculations` R/S/T]**) and applies the final gates:

- **Total possible payout (`I`)** = `E + F + G`, **but only if attendance `H ≥ 80`**, else `0`.
- **Timecard loss (`J`)** = individual timecard-exception penalty %.
- **AWOL/Absent (`K`)** = `100%` (lose all) if any AWOL/absent day in `Calculations`/`Extra Awol`, else `0%`.
- **Store Incentive Payout (`N`)** = `0` if terminated (Misconduct/Discharged/Absconded)
  or attendance < 80; otherwise `Store × (1−J) × (1−K)`, with a **minimum of 50** if the
  result is between 1 and 50.
- **Manager Incentive Payout (`O`)** = same rule on `(Manager + Overrider)`.
- **Payout local currency (`M`)** = `0` if bad termination, else `Total × (1−J) × (1−K)`.

### 9.3 `Corrections`
Manual reconciliation: for a pasted employee number it pulls the **old** store/manager
payout vs the **new** payout and shows the **difference** and a consolidated amount, with a
comment/reason. Used for one-off overrides. **[CONFIRM how corrections should carry into the new system — manual override table?]**

### 9.4 `New Info for store bonus comms`
Pure presentation: reshapes the store-bonus results into per-store sentences
(e.g. *"20% of the amount over the sales target: 1,234"*, criteria pass/fail explanations).
No new math — it can be a report/template in the new system.

---

## 10. Configuration parameters (the knobs → new `config`)

These are the values that should live in a single config, not be buried in formulas.

### 10.1 Manager KPI weights by country/store-type (`Managers criteria` D-column)
Per-country blocks; weights sum to 100%. Sample (RSA delivery): Sales 10%, Oil quality 10%,
Shrink-ex-oil 10%, Labour 25%, Delivery 10%, Co-Pilot 25%, Banking 10%. Other blocks:
RSA non-delivery, Namibia, Zambia (delivery/non-delivery), Eswatini, Angola HL, Angola
Deb&Vida, Mauritius, Zimbabwe. **[CONFIRM these weights are current.]**

### 10.2 Monthly bonus potential by position × country (`Managers criteria` rows 103–130)
| Position | Example monthly amounts (local) |
|----------|---------------------------------|
| Branch Manager | RSA 2,083.33 · Angola 42,253.92 · Namibia 1,916.67 · Zambia 1,208.33 · Zimbabwe 140 · Mauritius 8,312.50 · Lesotho 2,083.33 · Eswatini 2,083.33 |
| Assistant Manager | RSA 1,666.67 · Angola 28,405.92 · … |
| Junior Manager | RSA 500 · Angola 10,501.58 · … |

(These are annual ÷ 12.)

### 10.3 Overrider tiers (`Managers criteria` rows 133–137)
See §6.3 (250 / 500 / 750 / 1000 / 1250 across the 100→120%+ bands).

### 10.4 Cluster manager share
`30%` (§8).

### 10.5 Store bonus weighting (`Store Staff Criteria` rows 3–7)
| Category | RSA/Zam/Nam/Swaz/Les | Angola |
|----------|----------------------|--------|
| Guaranteed | 0.00 | 0.70 |
| Oil shrink | 0.00 | 0.00 |
| Shrink ex-oil | 1.00 | 0.30 |

Store pool = **10%** of sales over target. Per-person **floor = 50**.

### 10.6 Oil-shrink thresholds by store size (`Store Staff Criteria` rows 17–22)
EXTRA-LARGE `0.0065` · LARGE `−0.0835` · MEDIUM `−0.196` · MEDIUM-LARGE `−0.1514` ·
MEDIUM-SMALL `−0.2175` · SMALL `−0.3677`.

### 10.7 Shrink-ex-oil limits by country (`Store Staff Criteria` rows 29–36)
Most countries `0%`–`6%`; **Angola `−0.75%`–`0.75%`**.

### 10.8 Other hardcoded gates
- **Attendance gate**: `≥ 80%` of primary-job days to earn anything.
- **Per-person minimum payout**: `50` (both store & manager incentive).
- **Oil quality**: ≤ `5%` TPM over 25; checklist & stock-take ≥ `89.5%`; `3%` per sub-check, `10%` total.
- **Delivery**: online ≥ `90%`; availability `98.5%`; cancellations ≤ `0.1%`.
- **Virtual assistant**: thaw/drop plan ≥ `85%`; response ≤ `2`.
- **Drop validation**: valid-drop score `< 0.745` → full penalty.
- **Cycle month**: `DATE(2026,5,1)` drives the date cutoffs.

---

## 11. Country special-casing (important!)

The model branches heavily by country. **Angola** is the biggest exception:

- Store bonus has a **70% guaranteed** component (vs 0% elsewhere).
- Tighter shrink-ex-oil limits (`±0.75%`).
- **Excluded** from Oil Quality, Labour, Virtual Assistant, and the overrider bonus.
- Separate `Angola Results` sheet for oil metrics.

Other special cases: **Zimbabwe & Mauritius** get no manager overrider; **Botswana
Franchise** excluded; **Lesotho** treated as South Africa; Zambia split into delivery vs
non-delivery; Eswatini/Swaziland naming used interchangeably.

**[CONFIRM]** the full list of countries in scope and any that are being added/removed.

---

## 12. Known data-quality smells (worth fixing in the rebuild)

- One manager-summary connection references a sheet literally named **`A`** — likely a typo/broken ref.
- "Eswatini" vs "SWAZILAND"/"Swaziland" used inconsistently.
- Several `"Closed for revamp / Not eligible"` string results flow into numeric columns.
- `Oil shrink` PASS rule uses `>` (strictly greater) against threshold — confirm boundary behaviour.
- Massive per-row copied formulas in `Calculations` & `PAYOUT PER PERSON` (~190k cells) — the source of the 10M-cell limit error.

---

## 13. Open questions for you to confirm

1. **Cycle/date**: is `DATE(2026,5,1)` the single "run month" input?
2. **Store bonus**: is it intended that the store bonus is currently all-or-nothing on
   Shrink-ex-oil (oil-shrink weight = 0)?
3. **Component mapping** in `PAYOUT PER PERSON` E/F/G (Manager/Store/Overrider) — confirm.
4. **Corrections**: how should manual overrides work in the new system?
5. **Which numbers change each cycle** vs fixed policy (so I split config into "monthly inputs" vs "policy")?
6. **Countries in scope** and any planned changes.
7. **1–2 known-correct examples** (employee → expected payout) to lock in regression tests.

---

## 14. Proposed shape of the new system (for reference)

- `config/policy.yaml` — KPI weights, monthly bonus tables, overrider tiers, thresholds, floors, cluster share (everything in §10).
- `config/cycle.yaml` — the month, exchange rates, exception lists.
- `inputs/` — the monthly raw data (sales, targets, employees, timecards, KPI raw).
- `bonus_engine/` — `eligibility.py`, `kpis.py`, `manager_bonus.py`, `store_bonus.py`,
  `consolidate.py`, `payout.py`.
- `tests/` — regression tests against the current sheet's known outputs.
- Outputs written back to Google Sheets / Excel / CSV.

*End of spec — please annotate and return.*
