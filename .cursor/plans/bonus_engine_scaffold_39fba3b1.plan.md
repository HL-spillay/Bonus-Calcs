---
name: Bonus Engine Scaffold
overview: Scaffold the Python bonus calculation engine with pre-filled config, module stubs, a data loader, and a regression test harness — all derived from the reverse-engineered logic in `docs/bonus-model-logic.md`.
todos:
  - id: deps
    content: Install pandas + pyyaml into .venv and write requirements.txt
    status: pending
  - id: config-policy
    content: Write config/policy.yaml with all extracted parameters (KPI weights, bonus tables, overrider tiers, thresholds, floors, cluster share)
    status: pending
  - id: config-cycle
    content: Write config/cycle.yaml (cycle month, FX rates, date cutoffs)
    status: pending
  - id: loader
    content: Write bonus_engine/loader.py to read .xlsx sheets into named DataFrames
    status: pending
  - id: eligibility
    content: Write bonus_engine/eligibility.py (Qualifying Stores logic)
    status: pending
  - id: kpis
    content: Write bonus_engine/kpis.py (all 10 KPI gates → PASS/FAIL per store)
    status: pending
  - id: manager-bonus
    content: Write bonus_engine/manager_bonus.py (payout %, overrider tiers, cluster share)
    status: pending
  - id: store-bonus
    content: Write bonus_engine/store_bonus.py (10% pool, shrink gate, per-person split, floor=50)
    status: pending
  - id: consolidate
    content: Write bonus_engine/consolidate.py (per-employee proration by attendance, penalties)
    status: pending
  - id: payout
    content: Write bonus_engine/payout.py (80% attendance gate, timecard/AWOL loss, termination rules)
    status: pending
  - id: report
    content: Write bonus_engine/report.py (write PAYOUT PER PERSON to Excel/CSV)
    status: pending
  - id: run
    content: Write run.py CLI entry point
    status: pending
  - id: tests
    content: Write tests/test_regression.py (diff engine vs PAYOUT PER PERSON tab)
    status: pending
  - id: gitignore
    content: Update .gitignore (inputs/, __pycache__, *.xlsx data)
    status: pending
isProject: false
---

# Bonus Engine Scaffold

## What gets built

```
Gideon-Bonus/
├── config/
│   ├── policy.yaml        # all tunable rules (weights, tiers, thresholds, floors)
│   └── cycle.yaml         # per-run inputs (month, FX rates, exception lists)
├── bonus_engine/
│   ├── __init__.py
│   ├── loader.py          # reads .xlsx inputs into pandas DataFrames
│   ├── eligibility.py     # Qualifying Stores logic
│   ├── kpis.py            # all 10 KPI gates → PASS/FAIL per store
│   ├── manager_bonus.py   # payout % × monthly potential + overrider + cluster share
│   ├── store_bonus.py     # 10% pool, shrink gate, per-person split, floor
│   ├── consolidate.py     # per-employee: prorate by attendance, apply penalties
│   ├── payout.py          # 80% gate, timecard/AWOL loss, termination rules
│   └── report.py          # write PAYOUT PER PERSON + comms text to Excel/CSV
├── tests/
│   └── test_regression.py # diff engine output vs current sheet's known values
├── run.py                  # CLI entry point
└── requirements.txt        # openpyxl, pandas, pyyaml
```

## Architecture

```mermaid
flowchart TD
    xlsx["Input .xlsx files"]
    loader["loader.py\n(openpyxl → DataFrames)"]
    cfg["config/policy.yaml\n+ cycle.yaml"]
    elig["eligibility.py\n(Qualifying Stores)"]
    kpis["kpis.py\n(10 PASS/FAIL gates)"]
    mgr["manager_bonus.py\n(payout %, overrider, cluster)"]
    store["store_bonus.py\n(10% pool, floor)"]
    cons["consolidate.py\n(per-employee, attendance prorate)"]
    pay["payout.py\n(80% gate, AWOL, termination)"]
    report["report.py\n(Excel / CSV output)"]

    xlsx --> loader
    cfg --> elig
    cfg --> kpis
    cfg --> mgr
    cfg --> store
    loader --> elig
    elig --> kpis
    kpis --> mgr
    kpis --> store
    mgr --> cons
    store --> cons
    cons --> pay
    pay --> report
```

## Key decisions

- **pandas** for all computation (replaces the copied ARRAYFORMULA rows — one vectorised operation per rule).
- **`config/policy.yaml`** pre-filled with every value extracted: KPI weights by country/store-type, monthly bonus amounts by position × country, overrider tiers, store-bonus weightings, oil thresholds, attendance gate (80%), per-person floor (50), cluster share (30%).
- **`config/cycle.yaml`** holds the month (`2026-05`), exchange rates (from `Exchange info`), and the two date cutoffs from `Qualifying Stores`.
- **`loader.py`** reads both `.xlsx` exports directly — no manual CSV conversion needed.
- **`tests/test_regression.py`** loads the `PAYOUT PER PERSON` tab from the Audit xlsx as ground-truth and asserts the engine matches within a tolerance, so we can prove correctness before trusting the new system.
- The analysis scripts (`_inspect.py`, `_read_audit.py`, etc.) stay as-is; they are not part of the engine.
- The `.venv` already has `openpyxl`. `pandas` and `pyyaml` will be added to `requirements.txt` and installed.

## Files changed / created

- `config/policy.yaml` — new
- `config/cycle.yaml` — new
- `bonus_engine/__init__.py` — new (empty)
- `bonus_engine/loader.py` — new
- `bonus_engine/eligibility.py` — new
- `bonus_engine/kpis.py` — new
- `bonus_engine/manager_bonus.py` — new
- `bonus_engine/store_bonus.py` — new
- `bonus_engine/consolidate.py` — new
- `bonus_engine/payout.py` — new
- `bonus_engine/report.py` — new
- `tests/test_regression.py` — new
- `run.py` — new
- `requirements.txt` — new
- `.gitignore` — updated (add `inputs/`, `*.xlsx` raw data, `__pycache__`)

No existing files are modified.
