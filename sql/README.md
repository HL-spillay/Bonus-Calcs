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
2. Run all `00_ddl/*.sql`
3. Load config + dimensions from Sheets (Apps Script)
4. Load staging for `cycle_month`
5. Run `02_pipeline/run_bonus_calc.sql` with parameters:
   - `@cycle_month`
   - `@exclude_countries` (optional)

See [docs/schemas-and-pipeline.md](../docs/schemas-and-pipeline.md) for full schema and step definitions.

## Status

Not yet implemented — documentation phase complete. First implementation target: non-Angola countries, labour clocking → Calculation → Payout per person.
