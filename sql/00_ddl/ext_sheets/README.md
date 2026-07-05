# External tables over Google Sheets

Templates for `bidataops.Store_Bonus_Calculation`. **Replace placeholders before running.**

## Placeholders

| Placeholder | Replace with |
|-------------|--------------|
| `SHEET_URL_BONUS` | Bonus calc workbook URL, e.g. `https://docs.google.com/spreadsheets/d/FILE_ID/edit` |
| `SHEET_URL_LABOUR` | Labour clocking workbook URL (if separate file) |

## Files

| File | Sheet tab |
|------|-----------|
| `ext_bonus_criteria.sql` | Bonus Criteria |
| `ext_labour_clocking.sql` | Labour Clocking |
| `ext_store_master.sql` | Store Master |
| `ext_cycle.sql` | Cycle |

Additional `ext_*` files for Sales, KPI feeds — add as tabs are stabilised.

## Run order

```bash
# After dataset exists:
bq query --use_legacy_sql=false < ext_cycle.sql
bq query --use_legacy_sql=false < ext_bonus_criteria.sql
# ...
```

Or run all from BigQuery console.

## Verify

```sql
SELECT COUNT(*) FROM `bidataops.Store_Bonus_Calculation.ext_bonus_criteria`;
SELECT COUNT(*) FROM `bidataops.Store_Bonus_Calculation.ext_labour_clocking`;
```

See [docs/external-tables-sheets.md](../../docs/external-tables-sheets.md) for architecture and view layer.
