-- Global parameters (floors, gates, cluster share, pool %)
-- Workbook: https://docs.google.com/spreadsheets/d/19do6Op70r7OkvS0u9EsyXkicxI0WzzQW3gvKOgJJbi4

CREATE OR REPLACE EXTERNAL TABLE `bidataops.Store_Bonus_Calculation.ext_parameters`
(
  param_name STRING,
  param_value STRING,
  notes STRING
)
OPTIONS (
  format = 'GOOGLE_SHEETS',
  uris = ['https://docs.google.com/spreadsheets/d/19do6Op70r7OkvS0u9EsyXkicxI0WzzQW3gvKOgJJbi4'],
  sheet_range = 'Parameters!A:C',
  skip_leading_rows = 1
);
