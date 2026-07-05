# External tables — Espy 2026-06 Bonus Calc Sheet V2

**Single workbook** for config, raw data, labour, and (later) Connected result tabs.

| Field | Value |
|-------|--------|
| Workbook | [Espy 2026-06 Bonus Calc Sheet V2](https://docs.google.com/spreadsheets/d/19do6Op70r7OkvS0u9EsyXkicxI0WzzQW3gvKOgJJbi4/edit) |
| File ID | `19do6Op70r7OkvS0u9EsyXkicxI0WzzQW3gvKOgJJbi4` |
| Dataset | `bidataops.Store_Bonus_Calculation` |
| Location | **US** |

Config: [config/workbook.yaml](../../config/workbook.yaml)

## Before running DDL

1. **Share the V2 Sheet** with BigQuery access identity — **Viewer** (`705312163118-compute@developer.gserviceaccount.com` in config).
2. Confirm **tab names** match `sheet_range` in each SQL file.
3. Run [00_create_dataset.sql](../00_create_dataset.sql) first (`location = US`).

## Verify

```sql
SELECT Key, Country FROM `bidataops.Store_Bonus_Calculation.ext_managers_criteria` LIMIT 5;
SELECT person_personNumber, PrimaryStore FROM `bidataops.Store_Bonus_Calculation.ext_labour_clocking` LIMIT 5;
```

## Files

| SQL file | External table | Sheet tab |
|----------|----------------|-----------|
| ext_cycle.sql | ext_cycle | Cycle |
| ext_bonus_criteria.sql | ext_managers_criteria | Managers criteria |
| ext_store_master.sql | ext_store_master | Store master |
| ext_parameters.sql | ext_parameters | Parameters |
| ext_cluster_manager.sql | ext_cluster_manager | Cluster Manager |
| ext_exchange_info.sql | ext_exchange_info | Exchange info |
| ext_employees_info.sql | ext_employees_info | Employees info |
| ext_labour_clocking.sql | ext_labour_clocking | **Labour_Data** |

See [docs/external-tables-sheets.md](../../docs/external-tables-sheets.md).
