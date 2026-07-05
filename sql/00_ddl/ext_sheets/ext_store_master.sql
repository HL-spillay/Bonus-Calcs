-- Store Master + policy_key column
-- Workbook: https://docs.google.com/spreadsheets/d/19do6Op70r7OkvS0u9EsyXkicxI0WzzQW3gvKOgJJbi4
-- Widen sheet_range / add columns once Store Master layout is confirmed

CREATE OR REPLACE EXTERNAL TABLE `bidataops.Store_Bonus_Calculation.ext_store_master`
(
  store_id STRING,
  store_name STRING,
  country STRING,
  brand STRING,
  is_delivery STRING,
  store_size_category STRING,
  region STRING,
  status STRING,
  original_open_date STRING,
  policy_key STRING
)
OPTIONS (
  format = 'GOOGLE_SHEETS',
  uris = ['https://docs.google.com/spreadsheets/d/19do6Op70r7OkvS0u9EsyXkicxI0WzzQW3gvKOgJJbi4'],
  sheet_range = 'Store master!A:J',
  skip_leading_rows = 1
);
