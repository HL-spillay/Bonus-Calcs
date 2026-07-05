-- Labour clocking — primary fact source (separate workbook if needed)

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
  uris = ['SHEET_URL_LABOUR'],
  sheet_range = 'Labour Clocking!A:M',
  skip_leading_rows = 1
);

-- View maps OfPrimaryJobDays column (%OfPrimaryJobDays in sheet — rename header in sheet
-- to OfPrimaryJobDays if BQ rejects % in column names, or use SELECT * and alias in v_stg_labour_clocking)
