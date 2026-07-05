# SQL assets

BigQuery DDL and pipeline queries will be added here incrementally.

## Planned structure

```
sql/
├── 00_ddl/           # CREATE TABLE statements
├── 01_views/         # Intermediate views (steps 1–9)
├── 02_pipeline/      # Master script or scheduled query
└── 03_sync/          # Optional: load helpers
```

## Run order

1. Create dataset (once): `bidataops.Store_Bonus_Calculation`
2. Run `00_ddl/ext_sheets/*.sql` — **external tables** over Google Sheets (set URLs)
3. Run `01_views/v_stg_labour_clocking.sql` — typed view over `Labour_Data`
4. Run `02_pipeline/run_bonus_calc.sql` with `@cycle_month`, `@exclude_countries`
5. Connect result tabs via **Connected Sheets** → `rpt_*` tables

See [docs/schemas-and-pipeline.md](../docs/schemas-and-pipeline.md) for full schema and step definitions.

## Status

Not yet implemented — documentation phase complete. First implementation target: non-Angola countries, labour clocking → Calculation → Payout per person.
