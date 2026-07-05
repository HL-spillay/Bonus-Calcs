-- Cycle control (cycle_month, cutoffs, country filters)
-- Workbook: https://docs.google.com/spreadsheets/d/19do6Op70r7OkvS0u9EsyXkicxI0WzzQW3gvKOgJJbi4

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
  uris = ['https://docs.google.com/spreadsheets/d/19do6Op70r7OkvS0u9EsyXkicxI0WzzQW3gvKOgJJbi4'],
  sheet_range = 'Cycle!A:F',
  skip_leading_rows = 1
);
