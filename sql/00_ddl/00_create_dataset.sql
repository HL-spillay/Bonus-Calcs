-- Create dataset (run once)
CREATE SCHEMA IF NOT EXISTS `bidataops.Store_Bonus_Calculation`
OPTIONS (
  location = 'US',
  description = 'Monthly store and manager bonus calculation — single cycle per run'
);
