# BigQuery Schemas & Calculation Pipeline

All tables live in **`bidataops.Store_Bonus_Calculation`**. Every run uses **`cycle_month DATE`** (first day of month, e.g. `2026-05-01`). No partitioning yet — delete/reload rows for that month before each run.

---

## 1. Control

### `ctl_cycle`

Single row per run set from Sheets.

| Column | Type | Description |
|--------|------|-------------|
| cycle_month | DATE | PK — e.g. `2026-05-01` |
| store_valid_through | DATE | Stores open on/before this date qualify (store bonus) |
| manager_valid_through | DATE | Stores open on/before this date qualify (manager bonus) |
| include_countries | ARRAY&lt;STRING&gt; | NULL = all; e.g. `['South Africa','Namibia',...]` |
| exclude_countries | ARRAY&lt;STRING&gt; | e.g. `['Angola']` for early-month run |
| run_notes | STRING | Optional |

---

## 2. Reference / dimensions

### `dim_country_alias`

Normalises country labels from raw feeds.

| Column | Type | Example |
|--------|------|---------|
| raw_label | STRING | `SWAZILAND`, `SOUTH AFRICA` |
| canonical_country | STRING | `Eswatini`, `South Africa` |

### `cfg_policy_key`

One row per bonus policy (your **Key** column).

| Column | Type | Example |
|--------|------|---------|
| policy_key | STRING | `HL_RSA_D` |
| detail | STRING | RSA (Delivery Stores) |
| country | STRING | South Africa |
| brand | STRING | HUNGRY LION |
| is_delivery | BOOL | true |
| primary_kpi_for_comms | STRING | Sales |
| pct_contribution_label | STRING | 10% |
| blocked_drains_applies | BOOL | Y |
| drop_validation_applies | BOOL | Y |
| shrink_lower_limit | FLOAT64 | 0.0 |
| shrink_upper_limit | FLOAT64 | 0.06 |
| viable_minimum_bonus | FLOAT64 | 50 |

### `dim_store`

From **Store Master** + stamped `policy_key`.

| Column | Type | Description |
|--------|------|-------------|
| store_id | STRING | Stable store code |
| store_name | STRING | |
| country | STRING | Canonical |
| brand | STRING | |
| is_delivery | BOOL | |
| store_size_category | STRING | For oil-shrink threshold lookup |
| region | STRING | |
| status | STRING | Exclude Closed, franchise exclusions |
| original_open_date | DATE | Eligibility |
| policy_key | STRING | FK → cfg_policy_key |
| policy_key_override_reason | STRING | If manually overridden |

**Default `policy_key` suggestion (for Sheet formula/helper only):**

```
country + brand + (is_delivery ? '_D' : '_N')  → lookup in cfg_policy_key
```

Manual override when brand/country combo doesn't match (Angola DEB/VIDA, etc.).

### `dim_cluster_manager_assignment`

From **Cluster Manager** tab.

| Column | Type |
|--------|------|
| cycle_month | DATE |
| employee_id | STRING |
| employee_name | STRING |
| home_store_id | STRING |
| managed_store_id | STRING |
| cluster_share_pct | FLOAT64 | Default 0.30 from config |

---

## 3. Config (long/narrow — sparse KPIs OK)

### `cfg_kpi`

Catalog of KPI codes.

| kpi_code | kpi_name | gate_type |
|----------|----------|-----------|
| SALES | Sales vs target | pass_fail |
| SHRINK_EX_OIL | Shrinkage excluding oil | pass_fail |
| OIL_SHRINK | Oil shrinkage | pass_fail |
| OIL_QUALITY | Oil quality | weighted_score |
| LABOUR | Labour management | pass_fail |
| DELIVERY | Delivery performance | pass_fail |
| COPILOT | CoPilot adoption | pass_fail |
| BANKING | Banking compliance | pass_fail |
| VA_ADOPTION | Virtual assistant | pass_fail |
| BLOCKED_DRAINS | Blocked drains | penalty_impact |
| DROP_VALIDATION | Drop validation | penalty_impact |

### `cfg_manager_kpi_weight`

**Unpivoted from Bonus Criteria / Managers criteria sheet.**

| Column | Type |
|--------|------|
| policy_key | STRING |
| kpi_code | STRING |
| weight | FLOAT64 | 0.0–1.0; row absent = N/A |

Example: `HL_SWZ_N` has no COPILOT row → not evaluated.

### `cfg_store_bonus_weight`

| Column | Type |
|--------|------|
| policy_key | STRING |
| component | STRING | `GUARANTEED`, `OIL_SHRINK`, `SHRINK_EX_OIL` |
| weight | FLOAT64 |

Angola: GUARANTEED 0.70, SHRINK_EX_OIL 0.30. Others: SHRINK_EX_OIL 1.00 (confirm during build).

### `cfg_kpi_threshold`

| Column | Type | Description |
|--------|------|-------------|
| scope_type | STRING | `POLICY_KEY`, `COUNTRY`, `STORE_SIZE` |
| scope_value | STRING | e.g. `HL_RSA_D`, `Angola`, `EXTRA-LARGE` |
| kpi_code | STRING | |
| bound_type | STRING | `LOWER`, `UPPER`, `MIN_PASS`, `MAX_PASS` |
| value | FLOAT64 | |

Oil shrink by store size; shrink-ex-oil by policy_key (from shrink lower/upper on criteria row).

### `cfg_position_bonus_potential`

Unpivoted from position columns on criteria sheet.

| Column | Type |
|--------|------|
| policy_key | STRING |
| position | STRING | Branch Manager, Assistant Manager, Junior Manager, Cluster Manager |
| monthly_amount | FLOAT64 | Local currency |
| currency | STRING | Optional |

`NA` in Sheet → no row (position not used for that policy).

### `cfg_overrider_tier`

From Overrider 105/110/115/120/+120 columns.

| Column | Type | Example |
|--------|------|---------|
| policy_key | STRING | `HL_RSA_D` |
| min_achievement_ratio | FLOAT64 | 1.00 (= 100% of target) |
| max_achievement_ratio | FLOAT64 | 1.05 |
| payout_amount | FLOAT64 | 250 |

Achievement ratio = `actual_sales / sales_target`. Open top tier: `max_achievement_ratio IS NULL`.

Countries where overrider is zero (e.g. Zimbabwe, Mauritius per legacy spec) → either no tiers or `cfg_kpi_exclusion` on overrider application.

### `cfg_global_parameter`

| param_name | example_value |
|------------|---------------|
| store_bonus_pool_pct | 0.10 |
| attendance_gate_pct | 0.80 |
| headcount_attendance_gate_pct | 0.80 |
| per_person_minimum_payout | 50 |
| cluster_manager_share_pct | 0.30 |

### `cfg_exchange_rate`

| Column | Type |
|--------|------|
| cycle_month | DATE |
| country | STRING |
| rate_to_zar | FLOAT64 |

---

## 4. Raw staging (from Sheets)

Reload each run for `cycle_month`. Suggested table names:

| Staging table | Sheet source |
|---------------|--------------|
| stg_labour_clocking | Labour clocking (shared file) |
| stg_sales | Sales |
| stg_sales_target | Sales Target / Targets |
| stg_employees_info | Employees info (headcount) |
| stg_oil_shrink | Oil shrink |
| stg_abs_unacc_variance | Absolute Unaccounted Variance |
| stg_labour_kpi | Labour |
| stg_oil_quality | Oil Quality |
| stg_delivery_performance | Delivery Stores Performance |
| stg_virtual_assistant | Virtual Assistant Adoption |
| stg_banking_rsa_zim_mau_angola | RSA, ZIM, MAU & AngolaBanking |
| stg_banking_zambia | Zambia Banking |
| stg_drop_validation | Drop Validation Impact |
| stg_blocked_drains | Blocked Drains Impact |
| stg_angola_results | Angola Results |
| stg_timecard_exceptions_individual | Timecard Exceptions Individual |
| stg_timecard_exceptions_stores | Timecard Exception Edits Stores |
| stg_extra_awol | Extra Awol |

### `stg_labour_clocking` (confirmed columns from labour clocking file)

| Column | Type | Sheet source column |
|--------|------|---------------------|
| cycle_month | DATE | Set from ctl_cycle on sync |
| employee_id | STRING | person_personNumber |
| employee_name | STRING | person_fullname |
| employment_status | STRING | Person_employmentStatus |
| store_id | STRING | PrimaryStore |
| position | STRING | PrimaryJob |
| day_primary_job | STRING | DayPrimaryJob |
| hire_date | DATE | HireDate |
| pct_of_primary_job_days | FLOAT64 | %OfPrimaryJobDays |
| awol_days | INT64 | AllAWOLDay |
| absent_days | INT64 | AllAbsentDays |
| actual_hours | FLOAT64 | ActualHours |
| days_worked | FLOAT64 | Days Worked |
| termination_reason | STRING | TerminationReason |

---

## 5. Intermediate views (calculation order)

Run in this order. Each step documents **why** it must come before the next.

### Step 1 — `int_qualifying_stores`

**Input:** `dim_store`, `ctl_cycle`  
**Output:** stores eligible for store and/or manager bonus this month.

- Apply open-date cutoffs.
- Apply country include/exclude filters (Angola late run).
- Emit `entry_type`: `STORE`, `MANAGER`, or both rows per store as today.

### Step 2 — `int_store_sales`

**Input:** `stg_sales`, `stg_sales_target`, `cfg_exchange_rate`  
**Output:** per store: target, actual, over/under %, achievement_ratio.

Needed before overrider tiers and store bonus pool.

### Step 3 — `int_kpi_results`

**Input:** qualifying stores, all KPI staging tables, config thresholds/weights  
**Output:** one row per `(store_id, kpi_code)`: `metric_value`, `threshold`, `status` (`PASS`/`FAIL`/`NA`).

**NA rule:** no row in `cfg_manager_kpi_weight` for that policy_key → status `NA`.

### Step 4 — `int_manager_bonus_store` (parallel with 5)

**Input:** Step 3, `cfg_manager_kpi_weight`, `cfg_position_bonus_potential`, `int_store_sales`  
**Output:** per store (manager entry):

- `gross_payout_pct` = sum(weight where KPI PASS)
- `blocked_drains_impact`, `drop_validation_impact` → `net_payout_pct`
- `overrider_amount` = tier lookup on `achievement_ratio` from `cfg_overrider_tier`
- Per position: `manager_bonus_base = net_payout_pct × monthly_amount`

### Step 5 — `int_store_bonus_store` (parallel with 4)

**Input:** Step 2, Step 3, `cfg_store_bonus_weight`, `cfg_global_parameter`  
**Output:** per store:

- `qualifies` (sales + shrink rules; Angola uses sales-only path)
- `pool_local` = `store_bonus_pool_pct × max(0, actual − target)`
- `payout_pct` from store bonus weight components
- `payout_amount_local` = pool × payout_pct
- `headcount` from `stg_employees_info` (≥ headcount gate %)
- `per_person_share_local` = payout_amount / headcount (before floor logic at aggregate stage)

**Why store totals before headcount:** pool is a store property; headcount only splits it.

### Step 6 — `int_cluster_manager_store`

**Input:** Step 4, `dim_cluster_manager_assignment`, `cfg_global_parameter`  
**Output:** per `(employee_id, managed_store_id)`:

- `cluster_bonus_from_store` = manager net_payout_pct × position potential × cluster_share_pct
- `cluster_overrider_share` = overrider × cluster_share_pct (where applicable)

### Step 7 — `int_assignment_enriched`

**Input:** `stg_labour_clocking`, `dim_store`, Steps 4–5, Step 3  
**Output:** one row per labour clocking line with:

- `policy_key`, `country`
- `work_share` — combine **`pct_of_primary_job_days`** and **`actual_hours`** from labour data (see [decisions-log.md](decisions-log.md)); `%OfPrimaryJobDays` drives manager/overrider proration; `ActualHours` used for store bonus split across multi-store lines
- `store_bonus_line` = per_person_share × work_share × penalty factors
- `manager_bonus_line` = only if position is manager role; prorate by `%OfPrimaryJobDays`
- `overrider_line` = manager overrider × pct_of_primary_job_days (if applicable)

### Step 8 — `int_calculation_detail`

**Input:** Step 7 + unpivot Step 3 KPIs  
**Output:** grain = `employee × store × position × kpi_code` with columns:

`metric_value`, `target`, `weight`, `score_contribution`, `pass_fail`, `amount_component`

This feeds the wide **Calculation** audit view.

### Step 9 — `int_payout_per_person`

**Input:** Step 7 aggregated by `employee_id` + Step 6 cluster rows + gates  
**Output:** manager_total, store_total, overrider_total, final_payout_local, final_payout_zar

Apply attendance, termination, timecard, AWOL, minimum floor.

### Step 10 — Result tables (materialised for Connected Sheets)

| Table | Source |
|-------|--------|
| `rpt_calculation_table` | Step 8 + cluster manager appendix rows |
| `rpt_payout_per_person` | Step 9 |
| `rpt_store_bonus_summary` | Step 5 |
| `rpt_manager_bonus_summary` | Step 4 |

---

## 6. Config change → result (worked example)

**Change:** For `HL_RSA_D`, increase Labour weight from 25% to 30%, decrease Sales from 10% to 5%.

1. Edit two cells on **Bonus Criteria** Sheet (or two rows in `cfg_manager_kpi_weight`).
2. Re-sync config staging → BigQuery.
3. Re-run pipeline for `cycle_month`.

**Effects:**

- Step 3 unchanged (same PASS/FAIL).
- Step 4: stores with Labour PASS gain 5%; stores with Sales PASS lose 5%.
- Step 7–9: manager lines and totals change for RSA delivery managers only.
- Store bonus (Step 5) **unchanged** — different weight table.

No SQL changes required.

---

## 7. Cluster manager rows in Calculation output

Append after standard labour clocking lines:

| row_type | source |
|----------|--------|
| `ASSIGNMENT` | labour clocking enrichment |
| `CLUSTER_HOME` | employee's home store manager bonus (normal path) |
| `CLUSTER_MANAGED` | Step 6 per managed store |

Sort: all `ASSIGNMENT` rows by employee, then cluster block at bottom per employee (or per your current Sheet convention).

---

## Open decisions

Decisions to confirm **before or during first SQL build** (not blockers for doc-only phase):

1. **Exact `work_share` formula** — combine `%OfPrimaryJobDays` and `ActualHours` for store bonus multi-store split (columns confirmed; formula TBD on first examples).

2. **Headcount definition** — count from Employees info with ≥80% attendance only (legacy), or derive from labour clocking distinct employees meeting gate?

3. **Sync mechanism** — BigQuery Connected Sheets (external tables) vs Apps Script batch load to native tables. Native tables recommended for predictable types and faster joins.

4. **Overrider zero countries** — confirm Zimbabwe & Mauritius still get zero overrider.

5. **Lesotho** — still mapped to South Africa policy keys (`HL_LES_D` / `HL_LES_N`) or RSA keys?

6. **Store bonus floor (50)** — applied per person after aggregation only, or also when splitting pool to lines?

Document answers in a short `docs/decisions-log.md` as you confirm each one.
