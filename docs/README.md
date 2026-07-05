# Bonus Calculation System

Monthly employee bonus calculation for multi-country retail stores. **BigQuery** runs the math; **Google Sheets** is where people edit config and view results.

## Who this is for

Anyone taking over this project should read the docs in order:

| Doc | Purpose |
|-----|---------|
| [design.md](design.md) | Architecture, platform choice, monthly workflow, Angola split, design decisions |
| [schemas-and-pipeline.md](schemas-and-pipeline.md) | BigQuery table schemas, config model, calculation order, output tables |
| [external-tables-sheets.md](external-tables-sheets.md) | Google Sheets → BigQuery external tables + views |
| [sheets-integration.md](sheets-integration.md) | Which Sheets tabs map to which tables, run checklist |
| [decisions-log.md](decisions-log.md) | Confirmed business/technical decisions (updated as you sign off) |
| [graphify.md](graphify.md) | Project knowledge graph (Graphify) — setup, queries, handoff |
| [bonus-model-logic.md](bonus-model-logic.md) | **Legacy reference only** — reverse-engineered rules from the old formula workbook. Use for business-rule context; the new system in `design.md` supersedes implementation details. |

## Repository layout

```
Bonus-Calcs/
├── docs/                    # Design and handoff documentation (start here)
├── sql/                     # BigQuery DDL and pipeline SQL (to be added incrementally)
├── graphify-out/            # Graphify knowledge graph (generated — see docs/graphify.md)
├── .cursor/rules/graphify.mdc  # Cursor: query graph before blind file search
├── AGENTS.md                # Short instructions for AI assistants
├── auditBonusWorkbook.gs    # Optional: audit tool for legacy Sheets workbooks
├── extractFormulas.gs       # Optional: formula extraction from legacy Sheets
└── *.csv                    # Local exports / examples (not loaded automatically)
```

## Current status

- **Done:** Architecture and schema design documented; legacy Python scaffold removed; Graphify knowledge graph; master plan at [.cursor/plans/bonus_calc_redesign.plan.md](../.cursor/plans/bonus_calc_redesign.plan.md).
- **Next:** Create BigQuery dataset + tables, wire Sheets → BigQuery sync, implement pipeline SQL for non-Angola countries first.
- **Out of scope (for now):** Multi-month history/partitioning, Corrections tab, automated archival (you back up the Sheet manually each cycle).

## Monthly workflow (summary)

1. Set **cycle month** in the control Sheet tab (e.g. `2026-05`).
2. Paste or refresh **raw data** tabs (labour clocking, sales, KPI feeds, store master).
3. Review **config** tabs (policy keys, KPI weights, overrider tiers, position amounts).
4. Run sync + pipeline (Scheduled Query or Apps Script trigger) for **non-Angola** countries before ~10th.
5. Review **Calculation** and **Payout** Connected Sheet tabs.
6. Re-run later in the month with **Angola included** when Angola data is ready.
7. Download / back up the Google Sheet (config + results).

See [sheets-integration.md](sheets-integration.md) for the full checklist.

## Key concepts (30-second version)

- **`policy_key`** — e.g. `HL_RSA_D` = Hungry Lion, South Africa, delivery store. Drives which KPI weights and bonus amounts apply.
- **Labour clocking** — one row per employee × store × position × month; this is the spine of the Calculation table.
- **Store bonus** — pool at store level (10% of sales above target), split by headcount, allocated to assignment lines by work share.
- **Manager bonus** — % of monthly position potential from KPI gates passed, plus **overrider** flat amount from sales/target bracket in config.
- **Cluster manager** — home-store manager bonus + amounts from managed stores (Cluster Manager tab), appended at bottom of Calculation output.
