-- Exchange rates (ZAR per local currency)
-- Workbook: https://docs.google.com/spreadsheets/d/19do6Op70r7OkvS0u9EsyXkicxI0WzzQW3gvKOgJJbi4

CREATE OR REPLACE EXTERNAL TABLE `bidataops.Store_Bonus_Calculation.ext_exchange_info`
(
  country STRING,
  rate_to_zar STRING,
  as_of_date STRING
)
OPTIONS (
  format = 'GOOGLE_SHEETS',
  uris = ['https://docs.google.com/spreadsheets/d/19do6Op70r7OkvS0u9EsyXkicxI0WzzQW3gvKOgJJbi4'],
  sheet_range = 'Exchange info!A:C',
  skip_leading_rows = 1
);
