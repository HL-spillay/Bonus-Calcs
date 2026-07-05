-- Employees info (headcount source)
-- Workbook: https://docs.google.com/spreadsheets/d/19do6Op70r7OkvS0u9EsyXkicxI0WzzQW3gvKOgJJbi4

CREATE OR REPLACE EXTERNAL TABLE `bidataops.Store_Bonus_Calculation.ext_employees_info`
(
  store_id STRING,
  employee_id STRING,
  employee_name STRING,
  attendance_pct STRING,
  notes STRING
)
OPTIONS (
  format = 'GOOGLE_SHEETS',
  uris = ['https://docs.google.com/spreadsheets/d/19do6Op70r7OkvS0u9EsyXkicxI0WzzQW3gvKOgJJbi4'],
  sheet_range = 'Employees info!A:E',
  skip_leading_rows = 1
);
