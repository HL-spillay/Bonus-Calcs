-- Typed staging view over ext_labour_clocking (Labour_Data tab, V2 workbook)
-- Join cycle_month from ext_cycle (same V2 workbook).

CREATE OR REPLACE VIEW `bidataops.Store_Bonus_Calculation.v_stg_labour_clocking` AS
SELECT
  DATE(c.cycle_month) AS cycle_month,
  TRIM(person_personNumber) AS employee_id,
  TRIM(person_fullname) AS employee_name,
  TRIM(Person_employmentStatus) AS employment_status,
  TRIM(PrimaryStore) AS store_id,
  TRIM(PrimaryJob) AS position,
  TRIM(DayPrimaryJob) AS day_primary_job,
  COALESCE(
    SAFE.PARSE_DATE('%Y-%m-%d', HireDate),
    SAFE.PARSE_DATE('%d/%m/%Y', HireDate)
  ) AS hire_date,
  SAFE_CAST(OfPrimaryJobDays AS FLOAT64) AS pct_of_primary_job_days,
  SAFE_CAST(AllAWOLDay AS INT64) AS awol_days,
  SAFE_CAST(AllAbsentDays AS INT64) AS absent_days,
  SAFE_CAST(ActualHours AS FLOAT64) AS actual_hours,
  SAFE_CAST(Days_Worked AS FLOAT64) AS days_worked,
  TRIM(TerminationReason) AS termination_reason
FROM `bidataops.Store_Bonus_Calculation.ext_labour_clocking` lc
CROSS JOIN (
  SELECT cycle_month
  FROM `bidataops.Store_Bonus_Calculation.ext_cycle`
  LIMIT 1
) c
WHERE TRIM(person_personNumber) IS NOT NULL
  AND TRIM(person_personNumber) != '';
