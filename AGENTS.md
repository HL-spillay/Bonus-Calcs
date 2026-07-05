# Bonus Calc — agent instructions

Human-readable design lives in **`docs/`**. Start at [docs/README.md](docs/README.md).

## BigQuery system

- **Project:** `bidataops`
- **Dataset:** `Store_Bonus_Calculation`
- **Scope:** single `cycle_month` per run; no history/partitioning yet
- **Compute:** BigQuery SQL pipeline
- **UI:** Google Sheets (config + raw + Connected result tabs)
- **Glue:** light Apps Script sync only — no bonus math in Sheets

## Graphify (project knowledge graph)

This repo uses [Graphify](https://github.com/safishamsi/graphify) for navigation.

**Before exploring many files**, prefer:

```bash
graphify query "<question>"
graphify path "<from>" "<to>"
graphify explain "<concept>"
```

Build or refresh:

```bash
graphify .          # full build (needs LLM API key for docs)
graphify update .   # after SQL / Apps Script changes only
```

See [docs/graphify.md](docs/graphify.md).

## Do not implement

- Corrections tab logic
- Multi-month partitioning (unless explicitly requested)
- Bonus formulas in Google Sheets

## Key business rules (summary)

- **Base fact table:** labour clocking — employee × store × position per month
- **policy_key:** stamped on Store Master; sparse KPI weights (missing = N/A)
- **Overrider:** from `cfg_overrider_tier` only (sales/target brackets)
- **Cluster managers:** home store + managed-store amounts from Cluster Manager tab
- **Angola:** often run later in the month via country filter on pipeline

Confirmed decisions: [docs/decisions-log.md](docs/decisions-log.md).
