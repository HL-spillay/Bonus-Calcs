# Decisions log

Confirmed decisions. Add a dated entry when business rules change.

## 2026-07-05 — Platform & scope

| Decision | Choice |
|----------|--------|
| Compute engine | BigQuery (`bidataops.Store_Bonus_Calculation`, **location US**) |
| UI | Google Sheets (config + raw + Connected result tabs) |
| History / partitioning | None — single `cycle_month` per run; manual Sheet backup |
| Corrections tab | Out of scope |
| Overrider | From `cfg_overrider_tier` only (sales/target brackets) |
| Angola timing | Exclude from early run (~before 10th); include in late run |
| Python engine | Retired — fresh BigQuery design |

## 2026-07-05 — Labour clocking (base fact table)

**Source:** shared labour clocking Google Sheet.

**Columns (confirmed):**

| Column | Maps to |
|--------|---------|
| person_personNumber | employee_id |
| person_fullname | employee_name |
| Person_employmentStatus | employment_status |
| PrimaryJob | position |
| PrimaryStore | store_id |
| DayPrimaryJob | day_primary_job |
| HireDate | hire_date |
| %OfPrimaryJobDays | pct_of_primary_job_days |
| AllAWOLDay | awol_days |
| AllAbsentDays | absent_days |
| ActualHours | actual_hours |
| Days Worked | days_worked |
| TerminationReason | termination_reason |

**Grain:** one row per employee × store × position (per cycle month).

## 2026-07-05 — Multi-store proration (`work_share`)

Use **both** fields from labour data:

- **`%OfPrimaryJobDays`** — primary proration for manager bonus, overrider, and attendance-related logic (matches legacy `%OfPrimaryJobDays` behaviour).
- **`ActualHours`** — use where hour-based allocation is needed (e.g. splitting store bonus pool across lines when an employee worked multiple stores); exact formula to be validated on first regression examples.

Document the final formula in this file once validated against 2–3 known employees.

## 2026-07-05 — Cluster managers

- Listed at **bottom** of Calculation output.
- **Home store:** normal manager bonus path for home store/position.
- **Managed stores:** amounts from **Cluster Manager** tab (30% share of manager bonus % × potential per store, plus overrider share per rules).

## 2026-07-05 — Policy key / sparse KPIs

- `policy_key` stamped on Store Master (manual override allowed).
- KPI weights in **long** config table; missing row = KPI not applicable (NA), not FAIL.
- Wide Bonus Criteria sheet is OK for editing; sync unpivots on load.

## 2026-07-05 — Graphify (project knowledge graph)

| Decision | Choice |
|----------|--------|
| Tool | [Graphify](https://github.com/safishamsi/graphify) (`graphifyy` on PyPI) |
| Purpose | Queryable map of docs, SQL, Apps Script — **not** business data |
| Cursor integration | `.cursor/rules/graphify.mdc` via `graphify cursor install --project` |
| First build | Requires LLM API key (repo is doc-heavy); SQL-only updates use `graphify update .` |
| First build | Requires LLM API key (repo is doc-heavy); SQL-only updates use `graphify update .` |
| Docs | [graphify.md](graphify.md) |

## 2026-07-05 — Google Sheets workbook

| Field | Value |
|-------|--------|
| Workbook | **Espy 2026-06 Bonus Calc Sheet V2** |
| URL | https://docs.google.com/spreadsheets/d/19do6Op70r7OkvS0u9EsyXkicxI0WzzQW3gvKOgJJbi4 |
| Labour tab | `Labour_Data` |
| BigQuery dataset location | **US** |
| External tables | `sql/00_ddl/ext_sheets/` |

V1 workbook retired — all config, raw, and labour tabs live in V2.

## Open (still to confirm during build)

- [ ] Exact `work_share` formula combining `%OfPrimaryJobDays` and `ActualHours` for store bonus line split
- [ ] Headcount: Employees info vs labour clocking derivation
- [ ] Lesotho policy keys (`HL_LES_*` vs RSA keys)
- [ ] Overrider zero for Zimbabwe & Mauritius
- [ ] Per-person floor (50) — after aggregation only?
