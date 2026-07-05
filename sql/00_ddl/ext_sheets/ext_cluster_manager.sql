-- Cluster manager assignments (home store + managed stores)
-- Workbook: https://docs.google.com/spreadsheets/d/19do6Op70r7OkvS0u9EsyXkicxI0WzzQW3gvKOgJJbi4

CREATE OR REPLACE EXTERNAL TABLE `bidataops.Store_Bonus_Calculation.ext_cluster_manager`
(
  employee_id STRING,
  employee_name STRING,
  home_store_id STRING,
  managed_store_id STRING,
  notes STRING
)
OPTIONS (
  format = 'GOOGLE_SHEETS',
  uris = ['https://docs.google.com/spreadsheets/d/19do6Op70r7OkvS0u9EsyXkicxI0WzzQW3gvKOgJJbi4'],
  sheet_range = 'Cluster Manager!A:E',
  skip_leading_rows = 1
);
