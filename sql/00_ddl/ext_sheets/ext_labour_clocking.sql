-- Labour data — PRIMARY FACT TABLE (employee x store x position)
-- Workbook: Espy 2026-06 Bonus Calc Sheet V2
-- https://docs.google.com/spreadsheets/d/19do6Op70r7OkvS0u9EsyXkicxI0WzzQW3gvKOgJJbi4
-- Tab: Labour_Data

CREATE OR REPLACE EXTERNAL TABLE `bidataops.Store_Bonus_Calculation.ext_labour_clocking`
(
  person_personNumber STRING,
  person_fullname STRING,
  Person_employmentStatus STRING,
  PrimaryJob STRING,
  PrimaryStore STRING,
  DayPrimaryJob STRING,
  HireDate STRING,
  OfPrimaryJobDays STRING,
  AllAWOLDay STRING,
  AllAbsentDays STRING,
  ActualHours STRING,
  Days_Worked STRING,
  TerminationReason STRING
)
OPTIONS (
  format = 'GOOGLE_SHEETS',
  uris = ['https://docs.google.com/spreadsheets/d/19do6Op70r7OkvS0u9EsyXkicxI0WzzQW3gvKOgJJbi4'],
  sheet_range = 'Labour_Data!A:M',
  skip_leading_rows = 1
);

-- Column A header in sheet is likely %OfPrimaryJobDays; BQ schema uses OfPrimaryJobDays (position 8).
-- v_stg_labour_clocking maps OfPrimaryJobDays -> pct_of_primary_job_days.
