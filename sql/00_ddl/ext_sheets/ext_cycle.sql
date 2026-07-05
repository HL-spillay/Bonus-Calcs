-- Cycle control tab (cycle_month, country filters, date cutoffs)

CREATE OR REPLACE EXTERNAL TABLE `bidataops.Store_Bonus_Calculation.ext_cycle`
(
  cycle_month STRING,
  store_valid_through STRING,
  manager_valid_through STRING,
  include_countries STRING,
  exclude_countries STRING,
  run_notes STRING
)
OPTIONS (
  format = 'GOOGLE_SHEETS',
  uris = ['SHEET_URL_BONUS'],
  sheet_range = 'Cycle!A:F',
  skip_leading_rows = 1
);
