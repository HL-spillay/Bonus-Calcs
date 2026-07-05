-- Bonus Criteria wide config tab → external table
-- Replace SHEET_URL_BONUS and sheet_range to match your workbook.

CREATE OR REPLACE EXTERNAL TABLE `bidataops.Store_Bonus_Calculation.ext_bonus_criteria`
(
  Key STRING,
  Detail STRING,
  Country STRING,
  Brand STRING,
  Delivery STRING,
  KPI STRING,
  Percentage_Contibution STRING,
  Blocked_Drains_Impact STRING,
  Drop_Validation_Impact STRING,
  Sales STRING,
  Shrinkage_excluding_oil STRING,
  Banking STRING,
  CoPilot_Adoption STRING,
  Labour_Management STRING,
  Oil_quality STRING,
  Oil_shrinkage STRING,
  Delivery_Performance STRING,
  Cluster_Manager STRING,
  Branch_Manager STRING,
  Assistant_Manager STRING,
  Junior_Manager STRING,
  shrinkage_lower_limit STRING,
  shrinkage_upper_limit STRING,
  Overrider_105 STRING,
  Overrider_110 STRING,
  Overrider_115 STRING,
  Overrider_120 STRING,
  Overrider_120_plus STRING,
  Viable_Minimum_Bonus STRING
)
OPTIONS (
  format = 'GOOGLE_SHEETS',
  uris = ['SHEET_URL_BONUS'],
  sheet_range = 'Bonus Criteria!A:AB',
  skip_leading_rows = 1
);
