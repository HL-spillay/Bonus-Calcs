/**
 * Bonus Workbook Builder (Generator)
 * ----------------------------------
 * Paste this whole file into a blank Google Sheet's Apps Script editor
 * (Extensions -> Apps Script), Save, then run `buildWorkbook` once
 * (or use the "Bonus Builder" menu after reloading the sheet).
 *
 * It scaffolds the entire config-driven bonus model:
 *   - Config_*   editable parameter tabs (values pre-filled from policy.yaml)
 *   - In_*       input tabs (BigQuery connected-sheet extract / paste targets)
 *   - Engine     QualifyingStores, KPIResults, ManagerSummary, StoreSummary,
 *                Calculations, PayoutPerPerson (native formulas only)
 *   - Validation weight-block checksums + unmatched-store flags
 *   - Instructions  monthly runbook
 *
 * NO bonus math lives in this script. The script only writes formulas; the
 * sheet does the calculation. Re-running rebuilds every tab from scratch.
 *
 * Derived from docs/bonus-model-logic.md and config/policy.yaml.
 *
 * BUILDER_VERSION: 1.2.0  (shown in success alert — if you don't see this, re-paste the file)
 */

var BUILDER_VERSION = '1.2.0';
var BUILD_ANCHOR = '_BuildAnchor';
var STORE_ROWS = 1500;   // max store rows the engine formulas fill down
var EMP_ROWS = 12000;    // max employee rows (Calculations / PayoutPerPerson)

// Direct sheet refs (formulas use these — avoids named-range chicken-and-egg on rebuild)
var REF = {
  ALIASES: 'Config_CountryAliases!$A:$B',
  THRESHOLDS: 'Config_Thresholds!$A:$B',
  OILSHRINK: 'Config_OilShrink!$A:$B',
  SHRINKEXOIL: 'Config_ShrinkExOil!$A:$C',
  COUNTRYRULES: 'Config_CountryRules!$A:$F',
  FX: 'Config_FX!$A:$B',
  CYCLE: 'Config_Cycle!$A:$B'
};

var BONUS_NAMED_RANGES = ['ALIASES', 'THRESHOLDS', 'OILSHRINK', 'SHRINKEXOIL', 'COUNTRYRULES', 'FX'];

// ===========================================================================
//  CONFIG DATA (baked from config/policy.yaml + config/cycle.yaml, 2026-05)
// ===========================================================================

var CFG_CYCLE = [
  ['year', 2026],
  ['month', 5],
  ['label', '2026-05'],
  ['bonus_month_start', new Date(2026, 4, 1)],
  ['last_day_of_month', new Date(2026, 4, 31)],
  ['days_in_month', 31],
  ['manager_valid_through', new Date(2026, 3, 30)], // EOMONTH(cycle,-1)
  ['store_valid_through', new Date(2026, 2, 31)]     // EOMONTH(cycle,-2)
];

var CFG_FX = [
  ['Angola', 56.46318732],
  ['Lesotho', 1.0],
  ['Namibia', 1.0],
  ['South Africa', 1.0],
  ['Eswatini', 1.0],
  ['Zambia', 1.130678],
  ['Mauritius', 2.4602696],
  ['Zimbabwe', 0.0615475]
];

var CFG_ALIASES = [
  ['SOUTH AFRICA', 'South Africa'],
  ['NAMIBIA', 'Namibia'],
  ['ZAMBIA', 'Zambia'],
  ['ESWATINI', 'Eswatini'],
  ['SWAZILAND', 'Eswatini'],
  ['ANGOLA', 'Angola'],
  ['MAURITIUS', 'Mauritius'],
  ['ZIMBABWE', 'Zimbabwe'],
  ['LESOTHO', 'South Africa']
];

// blockKey: [country, storeType, brand, {kpi: weight}]
var MGR_BLOCKS = {
  rsa_delivery:       ['South Africa', 'delivery', '',
    { sales: 0.10, oil_shrink: 0.0, oil_quality: 0.10, shrink_ex_oil: 0.10, labour: 0.25, delivery: 0.10, copilot: 0.25, banking: 0.10 }],
  rsa_non_delivery:   ['South Africa', 'non_delivery', '',
    { sales: 0.20, oil_shrink: 0.0, oil_quality: 0.10, shrink_ex_oil: 0.10, labour: 0.25, copilot: 0.25, banking: 0.10 }],
  namibia:            ['Namibia', '', '',
    { sales: 0.20, oil_shrink: 0.0, oil_quality: 0.10, shrink_ex_oil: 0.10, labour: 0.25, copilot: 0.25, banking: 0.10 }],
  zambia_non_delivery:['Zambia', 'non_delivery', '',
    { sales: 0.20, oil_shrink: 0.0, oil_quality: 0.10, shrink_ex_oil: 0.10, labour: 0.25, copilot: 0.25, banking: 0.10 }],
  zambia_delivery:    ['Zambia', 'delivery', '',
    { sales: 0.10, oil_shrink: 0.0, oil_quality: 0.10, shrink_ex_oil: 0.10, labour: 0.25, delivery: 0.10, copilot: 0.25, banking: 0.10 }],
  eswatini:           ['Eswatini', '', '',
    { sales: 0.40, oil_shrink: 0.0, oil_quality: 0.10, shrink_ex_oil: 0.15, labour: 0.25, banking: 0.10 }],
  angola_hl:          ['Angola', '', 'HUNGRY LION',
    { sales: 0.50, oil_shrink: 0.05, shrink_ex_oil: 0.40, banking: 0.05 }],
  angola_deb_vida:    ['Angola', '', 'DEB_VIDA',
    { sales: 0.55, shrink_ex_oil: 0.40, banking: 0.05 }],
  mauritius:          ['Mauritius', '', '',
    { sales: 0.20, oil_shrink: 0.0, oil_quality: 0.10, shrink_ex_oil: 0.10, labour: 0.25, copilot: 0.25, banking: 0.10 }],
  zimbabwe:           ['Zimbabwe', '', '',
    { sales: 0.20, oil_shrink: 0.0, oil_quality: 0.10, shrink_ex_oil: 0.10, labour: 0.25, copilot: 0.25, banking: 0.10 }]
};

function mgrWeightRows_() {
  var rows = [];
  Object.keys(MGR_BLOCKS).forEach(function (key) {
    var b = MGR_BLOCKS[key];
    var kpis = b[3];
    Object.keys(kpis).forEach(function (kpi) {
      rows.push([key, b[0], b[1], b[2], kpi, kpis[kpi]]);
    });
  });
  return rows;
}

var CFG_BONUS_POTENTIAL = [
  ['Branch Manager', 'South Africa', 2083.333333],
  ['Branch Manager', 'Angola', 42253.91667],
  ['Branch Manager', 'Lesotho', 2083.333333],
  ['Branch Manager', 'Namibia', 1916.666667],
  ['Branch Manager', 'Eswatini', 2083.333333],
  ['Branch Manager', 'Zambia', 1208.333333],
  ['Branch Manager', 'Zimbabwe', 140.0],
  ['Branch Manager', 'Mauritius', 8312.5],
  ['Assistant Manager', 'South Africa', 1666.666667],
  ['Assistant Manager', 'Angola', 28405.91667],
  ['Assistant Manager', 'Lesotho', 1666.666667],
  ['Assistant Manager', 'Namibia', 1500.0],
  ['Assistant Manager', 'Eswatini', 1500.0],
  ['Assistant Manager', 'Zambia', 1083.333333],
  ['Assistant Manager', 'Zimbabwe', 81.9],
  ['Assistant Manager', 'Mauritius', 4927.0],
  ['Junior Manager', 'South Africa', 500.0],
  ['Junior Manager', 'Angola', 10501.58333],
  ['Junior Manager', 'Lesotho', 500.0],
  ['Junior Manager', 'Namibia', 500.0],
  ['Junior Manager', 'Eswatini', 500.0],
  ['Junior Manager', 'Zambia', 500.0],
  ['Junior Manager', 'Zimbabwe', 45.0],
  ['Junior Manager', 'Mauritius', 2700.0]
];

// MinPct, MaxPct (blank = open-ended), Payout
var CFG_OVERRIDER = [
  [1.00, 1.05, 250.0],
  [1.05, 1.10, 500.0],
  [1.10, 1.15, 750.0],
  [1.15, 1.20, 1000.0],
  [1.20, '', 1250.0]
];

var CFG_STORE_WEIGHTING = [
  ['default', 'guaranteed', 0.0],
  ['default', 'oil_shrink', 0.0],
  ['default', 'shrink_ex_oil', 1.0],
  ['angola', 'guaranteed', 0.70],
  ['angola', 'oil_shrink', 0.0],
  ['angola', 'shrink_ex_oil', 0.30]
];

var CFG_OIL_SHRINK = [
  ['EXTRA-LARGE', 0.0065],
  ['LARGE', -0.0835],
  ['MEDIUM', -0.196],
  ['MEDIUM-LARGE', -0.1514],
  ['MEDIUM-SMALL', -0.2175],
  ['SMALL', -0.3677]
];

// Country, Lower, Upper
var CFG_SHRINK_EX_OIL = [
  ['South Africa', 0.0, 0.06],
  ['Lesotho', 0.0, 0.06],
  ['Eswatini', 0.0, 0.06],
  ['Zambia', 0.0, 0.06],
  ['Namibia', 0.0, 0.06],
  ['Angola', -0.0075, 0.0075],
  ['Mauritius', 0.0, 0.06],
  ['Zimbabwe', 0.0, 0.06]
];

var CFG_THRESHOLDS = [
  ['attendance_gate_pct', 0.80],
  ['employee_count_gate_pct', 0.80],
  ['per_person_minimum', 50],
  ['store_pool_pct', 0.10],
  ['cluster_share', 0.30],
  ['oil_tpm_max_pct', 0.05],
  ['oil_checklist_min', 0.895],
  ['oil_stock_take_min', 0.895],
  ['oil_sub_check_weight', 0.03],
  ['oil_all_pass_weight', 0.10],
  ['delivery_online_rate_min', 0.90],
  ['delivery_availability_min', 0.985],
  ['delivery_acceptance_max', 1.0],
  ['delivery_cancellations_max', 0.001],
  ['va_thaw_plan_min', 0.85],
  ['va_drop_plan_min', 0.85],
  ['va_avg_response_max', 2.0],
  ['drop_validation_threshold', 0.745]
];

// Country, OilQualityExcluded, LabourExcluded, VAExcluded, OverriderZero, AngolaQualMode
var CFG_COUNTRY_RULES = [
  ['South Africa', false, false, false, false, 'sales_target_and_shrink'],
  ['Lesotho', false, false, false, false, 'sales_target_and_shrink'],
  ['Namibia', false, false, false, false, 'sales_target_and_shrink'],
  ['Zambia', false, false, false, false, 'sales_target_and_shrink'],
  ['Eswatini', false, false, true, false, 'sales_target_and_shrink'],
  ['Mauritius', false, false, true, true, 'sales_target_and_shrink'],
  ['Zimbabwe', false, false, true, true, 'sales_target_and_shrink'],
  ['Angola', true, true, true, true, 'sales_target_only']
];

// ===========================================================================
//  MENU
// ===========================================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Bonus Builder')
    .addItem('Build / Rebuild workbook', 'buildWorkbook')
    .addSeparator()
    .addItem('Run validation check', 'runValidation')
    .addToUi();
}

// ===========================================================================
//  MAIN BUILD
// ===========================================================================

function buildWorkbook() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  prepareForRebuild_(ss);   // drop stale engine sheets + named ranges first
  writeConfigTabs_(ss);
  writeInputTabs_(ss);
  writeEngineTabs_(ss);
  writeValidationTab_(ss);
  writeInstructionsTab_(ss);
  protectEngineTabs_(ss);
  reorderTabs_(ss);
  SpreadsheetApp.flush();

  SpreadsheetApp.getUi().alert(
    'Bonus workbook built (v' + BUILDER_VERSION + ').\n\n' +
    'Next: connect BigQuery into the In_* tabs (or paste data), then read the ' +
    'Instructions tab. Config_* tabs hold every tunable parameter.\n\n' +
    'If you still see ALIASES errors, you are running an old script — re-paste the entire file.'
  );
}

/** Wipe all sheets (except a temporary anchor) and remove stale named ranges. */
function prepareForRebuild_(ss) {
  removeAllBonusNamedRanges_(ss);

  var anchor = ss.getSheetByName(BUILD_ANCHOR);
  if (!anchor) {
    anchor = ss.insertSheet(BUILD_ANCHOR);
  }

  // Delete every other tab so no stale formula can reference ALIASES or other removed names
  var sheets = ss.getSheets();
  for (var i = sheets.length - 1; i >= 0; i--) {
    var sh = sheets[i];
    if (sh.getName() === BUILD_ANCHOR) continue;
    if (ss.getSheets().length <= 1) break;
    deleteSheetOrWipe_(ss, sh);
  }
  SpreadsheetApp.flush();
}

/** Delete a tab; if blocked (e.g. connected sheet), wipe all content instead. */
function deleteSheetOrWipe_(ss, sh) {
  try {
    ss.deleteSheet(sh);
  } catch (e) {
    try {
      sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearContent();
    } catch (e2) {}
  }
}

function removeAllBonusNamedRanges_(ss) {
  BONUS_NAMED_RANGES.forEach(function (name) {
    try { ss.removeNamedRange(name); } catch (e) {}
  });
  try {
    ss.getNamedRanges().forEach(function (nr) {
      if (BONUS_NAMED_RANGES.indexOf(nr.getName()) >= 0) {
        try { ss.removeNamedRange(nr.getName()); } catch (e) {}
      }
    });
  } catch (e) {}
}

// ===========================================================================
//  CONFIG TABS
// ===========================================================================

function writeConfigTabs_(ss) {
  writeTable_(ss, 'Config_Cycle', ['Key', 'Value'], CFG_CYCLE);
  writeTable_(ss, 'Config_FX', ['Country', 'ZARPerUnit'], CFG_FX);
  writeTable_(ss, 'Config_CountryAliases', ['RawLabelUpper', 'PolicyCountry'], CFG_ALIASES);
  writeTable_(ss, 'Config_ManagerWeights',
    ['BlockKey', 'Country', 'StoreType', 'Brand', 'KPI', 'Weight'], mgrWeightRows_());
  writeTable_(ss, 'Config_BonusPotential', ['Position', 'Country', 'MonthlyAmount'], CFG_BONUS_POTENTIAL);
  writeTable_(ss, 'Config_Overrider', ['MinPct', 'MaxPct', 'Payout'], CFG_OVERRIDER);
  writeTable_(ss, 'Config_StoreWeighting', ['CountryGroup', 'Component', 'Weight'], CFG_STORE_WEIGHTING);
  writeTable_(ss, 'Config_OilShrink', ['StoreSize', 'Threshold'], CFG_OIL_SHRINK);
  writeTable_(ss, 'Config_ShrinkExOil', ['Country', 'Lower', 'Upper'], CFG_SHRINK_EX_OIL);
  writeTable_(ss, 'Config_Thresholds', ['Key', 'Value'], CFG_THRESHOLDS);
  writeTable_(ss, 'Config_CountryRules',
    ['Country', 'OilQualityExcluded', 'LabourExcluded', 'VAExcluded', 'OverriderZero', 'AngolaQualMode'],
    CFG_COUNTRY_RULES);
}

// ===========================================================================
//  INPUT TABS  (BigQuery connected-sheet extract / paste targets)
// ===========================================================================

function writeInputTabs_(ss) {
  writeHeaders_(ss, 'In_StoreMaster',
    ['Store', 'Country', 'Region', 'Status', 'Brand', 'StoreType', 'StoreSize', 'OpeningDate']);
  writeHeaders_(ss, 'In_Sales', ['Store', 'ActualSalesLocal']);
  writeHeaders_(ss, 'In_Targets', ['Store', 'SalesTargetLocal']);
  writeHeaders_(ss, 'In_Employees',
    ['EmployeeNumber', 'Name', 'Status', 'PrimaryJob', 'PrimaryStore', 'Position',
     'PctPrimaryJobDays', 'AWOLDays', 'AbsentDays', 'DaysWorked', 'HireDate', 'TerminationReason']);
  writeHeaders_(ss, 'In_EmployeeCount', ['Store', 'EmployeeCount']);
  writeHeaders_(ss, 'In_KPIRaw',
    ['Store', 'OilShrinkPct', 'ShrinkExOilPct', 'OilTPMpct', 'OilChecklistPct', 'OilStockTakePct',
     'LabourPass', 'DeliveryAcceptancePass', 'DeliveryOnlineRate', 'VAThawPlan', 'VADropPlan',
     'VAAvgResponse', 'BankingValue', 'DropValidationScore']);
  writeHeaders_(ss, 'In_BlockedDrains', ['Store', 'Impact']);
  writeHeaders_(ss, 'In_TimecardExceptions', ['EmployeeNumber', 'LossPct']);
  writeHeaders_(ss, 'In_ExtraAwol', ['EmployeeNumber', 'AwolFlag']);
  writeHeaders_(ss, 'In_Corrections', ['EmployeeNumber', 'OldAmount', 'Reason']);
}

// ===========================================================================
//  ENGINE TABS
// ===========================================================================

function writeEngineTabs_(ss) {
  buildQualifyingStores_(ss);
  buildKpiResults_(ss);
  buildManagerSummary_(ss);
  buildStoreSummary_(ss);
  buildCalculations_(ss);
  buildPayoutPerPerson_(ss);
}

function buildQualifyingStores_(ss) {
  var headers = ['Store', 'CountryRaw', 'Country', 'Region', 'Status', 'Brand', 'StoreType',
    'StoreSize', 'OpeningDate', 'StoreValid', 'ManagerValid', 'Type', 'BlockKey'];
  var sh = writeHeaders_(ss, 'QualifyingStores', headers);
  var f = [
    '=IF(In_StoreMaster!A2="","",In_StoreMaster!A2)',
    '=IF($A2="","",In_StoreMaster!B2)',
    '=IF($A2="","",IFERROR(VLOOKUP(UPPER(TRIM($B2)),' + REF.ALIASES + ',2,FALSE),PROPER(TRIM($B2))))',
    '=IF($A2="","",In_StoreMaster!C2)',
    '=IF($A2="","",In_StoreMaster!D2)',
    '=IF($A2="","",UPPER(TRIM(In_StoreMaster!E2)))',
    '=IF($A2="","",LOWER(TRIM(In_StoreMaster!F2)))',
    '=IF($A2="","",UPPER(TRIM(In_StoreMaster!G2)))',
    '=IF($A2="","",In_StoreMaster!H2)',
    '=IF($A2="","",IF($I2="","",$I2<=VLOOKUP("store_valid_through",' + REF.CYCLE + ',2,FALSE)))',
    '=IF($A2="","",IF($I2="","",$I2<=VLOOKUP("manager_valid_through",' + REF.CYCLE + ',2,FALSE)))',
    '=IF($A2="","",IF(OR(UPPER($E2)="CLOSED",UPPER($E2)="BOTSWANA FRANCHISE"),"NA","Eligible"))',
    '=IF($A2="","",IFS(' +
      'AND($C2="Angola",REGEXMATCH($F2,"HUNGRY")),"angola_hl",' +
      'AND($C2="Angola",REGEXMATCH($F2,"VIDA")),"angola_deb_vida",' +
      '$C2="Angola","angola_hl",' +
      'AND($C2="South Africa",$G2="delivery"),"rsa_delivery",' +
      '$C2="South Africa","rsa_non_delivery",' +
      '$C2="Namibia","namibia",' +
      'AND($C2="Zambia",$G2="delivery"),"zambia_delivery",' +
      '$C2="Zambia","zambia_non_delivery",' +
      '$C2="Eswatini","eswatini",' +
      '$C2="Mauritius","mauritius",' +
      '$C2="Zimbabwe","zimbabwe",' +
      'TRUE,""))'
  ];
  fillDown_(sh, f, STORE_ROWS);
}

function buildKpiResults_(ss) {
  var headers = ['Store', 'Country', 'StoreSize', 'OilShrinkPass', 'ShrinkExOilPass',
    'OilQualityScore', 'LabourPass', 'DeliveryPass', 'VAPass', 'BankingPass',
    'SalesPass', 'DropImpact', 'BlockedImpact'];
  var sh = writeHeaders_(ss, 'KPIResults', headers);
  var raw = 'In_KPIRaw!$A:$N';
  var f = [
    '=IF(QualifyingStores!A2="","",QualifyingStores!A2)',
    '=IF($A2="","",QualifyingStores!C2)',
    '=IF($A2="","",QualifyingStores!H2)',
    // OilShrinkPass: pct > threshold(size)
    '=IF($A2="","",IF(IFERROR(VLOOKUP($A2,' + raw + ',2,FALSE),-1E15)>IFERROR(VLOOKUP($C2,' + REF.OILSHRINK + ',2,FALSE),0),1,0))',
    // ShrinkExOilPass: lower <= pct <= upper (country)
    '=IF($A2="","",IF(AND(IFERROR(VLOOKUP($A2,' + raw + ',3,FALSE),1E15)>=IFERROR(VLOOKUP($B2,' + REF.SHRINKEXOIL + ',2,FALSE),0),IFERROR(VLOOKUP($A2,' + raw + ',3,FALSE),1E15)<=IFERROR(VLOOKUP($B2,' + REF.SHRINKEXOIL + ',3,FALSE),0.06)),1,0))',
    // OilQualityScore
    '=IF($A2="","",IF(IFERROR(VLOOKUP($B2,' + REF.COUNTRYRULES + ',2,FALSE),FALSE)=TRUE,0,' +
      'IF(AND(IFERROR(VLOOKUP($A2,' + raw + ',4,FALSE),1E15)<=VLOOKUP("oil_tpm_max_pct",' + REF.THRESHOLDS + ',2,FALSE),' +
            'IFERROR(VLOOKUP($A2,' + raw + ',5,FALSE),0)>=VLOOKUP("oil_checklist_min",' + REF.THRESHOLDS + ',2,FALSE),' +
            'IFERROR(VLOOKUP($A2,' + raw + ',6,FALSE),0)>=VLOOKUP("oil_stock_take_min",' + REF.THRESHOLDS + ',2,FALSE)),' +
        'VLOOKUP("oil_all_pass_weight",' + REF.THRESHOLDS + ',2,FALSE),' +
        'VLOOKUP("oil_sub_check_weight",' + REF.THRESHOLDS + ',2,FALSE)*(' +
          'N(IFERROR(VLOOKUP($A2,' + raw + ',4,FALSE),1E15)<=VLOOKUP("oil_tpm_max_pct",' + REF.THRESHOLDS + ',2,FALSE))+' +
          'N(IFERROR(VLOOKUP($A2,' + raw + ',5,FALSE),0)>=VLOOKUP("oil_checklist_min",' + REF.THRESHOLDS + ',2,FALSE))+' +
          'N(IFERROR(VLOOKUP($A2,' + raw + ',6,FALSE),0)>=VLOOKUP("oil_stock_take_min",' + REF.THRESHOLDS + ',2,FALSE))))))',
    // LabourPass: excluded country -> default PASS
    '=IF($A2="","",IF(IFERROR(VLOOKUP($B2,' + REF.COUNTRYRULES + ',3,FALSE),FALSE)=TRUE,1,IF(IFERROR(VLOOKUP($A2,' + raw + ',7,FALSE),FALSE)=TRUE,1,0)))',
    // DeliveryPass: acceptance AND online >= min
    '=IF($A2="","",IF(AND(IFERROR(VLOOKUP($A2,' + raw + ',8,FALSE),FALSE)=TRUE,IFERROR(VLOOKUP($A2,' + raw + ',9,FALSE),0)>=VLOOKUP("delivery_online_rate_min",' + REF.THRESHOLDS + ',2,FALSE)),1,0))',
    // VAPass: excluded -> 1; else thaw>=min, drop>=min, response<=max
    '=IF($A2="","",IF(IFERROR(VLOOKUP($B2,' + REF.COUNTRYRULES + ',4,FALSE),FALSE)=TRUE,1,IF(AND(IFERROR(VLOOKUP($A2,' + raw + ',10,FALSE),0)>=VLOOKUP("va_thaw_plan_min",' + REF.THRESHOLDS + ',2,FALSE),IFERROR(VLOOKUP($A2,' + raw + ',11,FALSE),0)>=VLOOKUP("va_drop_plan_min",' + REF.THRESHOLDS + ',2,FALSE),IFERROR(VLOOKUP($A2,' + raw + ',12,FALSE),1E15)<=VLOOKUP("va_avg_response_max",' + REF.THRESHOLDS + ',2,FALSE)),1,0)))',
    // BankingPass: Zambia -> "Incentive Payout"; else "Compliant"
    '=IF($A2="","",IF($B2="Zambia",IF(IFERROR(VLOOKUP($A2,' + raw + ',13,FALSE),"")="Incentive Payout",1,0),IF(IFERROR(VLOOKUP($A2,' + raw + ',13,FALSE),"")="Compliant",1,0)))',
    // SalesPass: actual >= target
    '=IF($A2="","",IF(IFERROR(VLOOKUP($A2,In_Sales!$A:$B,2,FALSE),0)>=IFERROR(VLOOKUP($A2,In_Targets!$A:$B,2,FALSE),1E15),1,0))',
    // DropImpact: score < threshold -> 1 (full penalty)
    '=IF($A2="","",IF(IFERROR(VLOOKUP($A2,' + raw + ',14,FALSE),1E15)<VLOOKUP("drop_validation_threshold",' + REF.THRESHOLDS + ',2,FALSE),1,0))',
    // BlockedImpact
    '=IF($A2="","",IF(COUNTIF(In_BlockedDrains!$A:$A,$A2)>0,1,0))'
  ];
  fillDown_(sh, f, STORE_ROWS);
}

function buildManagerSummary_(ss) {
  var headers = ['Store', 'Country', 'BlockKey', 'TargetLocal', 'ActualLocal', 'OverUnderPct',
    'SalesPass', 'wSales', 'wOilShrink', 'wOilQuality', 'wShrinkExOil', 'wLabour', 'wDelivery',
    'wCopilot', 'wBanking', 'GrossPayoutPct', 'BlockedImpact', 'NetPayoutPct', 'Overrider'];
  var sh = writeHeaders_(ss, 'ManagerSummary', headers);
  var W = 'Config_ManagerWeights!';
  var wk = 'Config_ManagerWeights!$A:$A';
  var ck = 'Config_ManagerWeights!$E:$E';
  var wv = 'Config_ManagerWeights!$F:$F';
  function w(kpi) { return '=IF($A2="","",SUMIFS(' + wv + ',' + wk + ',$C2,' + ck + ',"' + kpi + '"))'; }
  var f = [
    '=IF(QualifyingStores!A2="","",IF(QualifyingStores!L2="Eligible",QualifyingStores!A2,""))',
    '=IF($A2="","",QualifyingStores!C2)',
    '=IF($A2="","",QualifyingStores!M2)',
    '=IF($A2="","",IFERROR(VLOOKUP($A2,In_Targets!$A:$B,2,FALSE),0))',
    '=IF($A2="","",IFERROR(VLOOKUP($A2,In_Sales!$A:$B,2,FALSE),0))',
    '=IF($A2="","",IF($D2=0,0,$E2/$D2))',
    '=IF($A2="","",IFERROR(VLOOKUP($A2,KPIResults!$A:$M,11,FALSE),0))',
    w('sales'), w('oil_shrink'), w('oil_quality'), w('shrink_ex_oil'),
    w('labour'), w('delivery'), w('copilot'), w('banking'),
    // GrossPayoutPct
    '=IF($A2="","",$H2*$G2' +
      '+$I2*IFERROR(VLOOKUP($A2,KPIResults!$A:$M,4,FALSE),0)' +
      '+IF($J2>0,IFERROR(VLOOKUP($A2,KPIResults!$A:$M,6,FALSE),0),0)' +
      '+$K2*IFERROR(VLOOKUP($A2,KPIResults!$A:$M,5,FALSE),0)' +
      '+$L2*IFERROR(VLOOKUP($A2,KPIResults!$A:$M,7,FALSE),0)' +
      '+$M2*IFERROR(VLOOKUP($A2,KPIResults!$A:$M,8,FALSE),0)' +
      '+$N2*IFERROR(VLOOKUP($A2,KPIResults!$A:$M,9,FALSE),0)' +
      '+$O2*IFERROR(VLOOKUP($A2,KPIResults!$A:$M,10,FALSE),0))',
    '=IF($A2="","",IFERROR(VLOOKUP($A2,KPIResults!$A:$M,13,FALSE),0))',
    '=IF($A2="","",IF($Q2>=$P2,0,MAX(0,$P2-$Q2)))',
    // Overrider
    '=IF($A2="","",IF(OR(IFERROR(VLOOKUP($B2,' + REF.COUNTRYRULES + ',5,FALSE),FALSE)=TRUE,$B2="Angola",IFERROR(VLOOKUP($A2,KPIResults!$A:$M,5,FALSE),0)<>1),0,IFERROR(LOOKUP($F2,Config_Overrider!$A$2:$A,Config_Overrider!$C$2:$C),0)))'
  ];
  fillDown_(sh, f, STORE_ROWS);
}

function buildStoreSummary_(ss) {
  var headers = ['Store', 'Country', 'TargetLocal', 'ActualLocal', 'ShrinkExOilPass', 'Qualified',
    'PoolLocal', 'PayoutPct', 'PayoutLocal', 'FXRate', 'PayoutRand', 'EmployeeCount',
    'PerPersonRand', 'PerPersonAfterFloor', 'PerPersonLocal'];
  var sh = writeHeaders_(ss, 'StoreSummary', headers);
  var SW = 'Config_StoreWeighting!';
  function sw(comp) {
    return 'SUMIFS(' + SW + '$C:$C,' + SW + '$A:$A,IF($B2="Angola","angola","default"),' + SW + '$B:$B,"' + comp + '")';
  }
  var f = [
    '=IF(QualifyingStores!A2="","",IF(QualifyingStores!L2="Eligible",QualifyingStores!A2,""))',
    '=IF($A2="","",QualifyingStores!C2)',
    '=IF($A2="","",IFERROR(VLOOKUP($A2,In_Targets!$A:$B,2,FALSE),0))',
    '=IF($A2="","",IFERROR(VLOOKUP($A2,In_Sales!$A:$B,2,FALSE),0))',
    '=IF($A2="","",IFERROR(VLOOKUP($A2,KPIResults!$A:$M,5,FALSE),0))',
    '=IF($A2="","",IF($B2="Angola",IF($D2>=$C2,1,0),IF(AND($D2>=$C2,$E2=1),1,0)))',
    '=IF($A2="","",IF($F2=1,VLOOKUP("store_pool_pct",' + REF.THRESHOLDS + ',2,FALSE)*MAX(0,$D2-$C2),0))',
    '=IF($A2="","",' + sw('guaranteed') + '+IF($E2=1,' + sw('shrink_ex_oil') + ',0)+IF(IFERROR(VLOOKUP($A2,KPIResults!$A:$M,4,FALSE),0)=1,' + sw('oil_shrink') + ',0))',
    '=IF($A2="","",$H2*$G2)',
    '=IF($A2="","",IFERROR(VLOOKUP($B2,' + REF.FX + ',2,FALSE),1))',
    '=IF($A2="","",$I2*$J2)',
    '=IF($A2="","",IFERROR(VLOOKUP($A2,In_EmployeeCount!$A:$B,2,FALSE),0))',
    '=IF($A2="","",IF($L2>0,$K2/$L2,0))',
    '=IF($A2="","",IF(AND($M2>1,$M2<VLOOKUP("per_person_minimum",' + REF.THRESHOLDS + ',2,FALSE)),VLOOKUP("per_person_minimum",' + REF.THRESHOLDS + ',2,FALSE),$M2))',
    '=IF($A2="","",IF($J2=0,0,$N2/$J2))'
  ];
  fillDown_(sh, f, STORE_ROWS);
}

function buildCalculations_(ss) {
  var headers = ['EmployeeNumber', 'Name', 'PrimaryJob', 'PrimaryStore', 'Country', 'Position',
    'AttendancePct', 'TerminationReason', 'IsManagerJob', 'MonthlyPotential', 'NetPayoutPct',
    'StoreOverrider', 'DropImpact', 'BlockedImpact', 'ManagerBonus', 'StorePerPersonLocal',
    'StoreBonus', 'ManagerOverrider'];
  var sh = writeHeaders_(ss, 'Calculations', headers);
  var f = [
    '=IF(In_Employees!A2="","",In_Employees!A2)',
    '=IF($A2="","",In_Employees!B2)',
    '=IF($A2="","",In_Employees!D2)',
    '=IF($A2="","",In_Employees!E2)',
    '=IF($A2="","",IFERROR(VLOOKUP($D2,QualifyingStores!$A:$M,3,FALSE),""))',
    '=IF($A2="","",In_Employees!F2)',
    '=IF($A2="","",IF(In_Employees!G2="",0,IF(In_Employees!G2>1,In_Employees!G2/100,In_Employees!G2)))',
    '=IF($A2="","",In_Employees!L2)',
    '=IF($A2="","",IF(OR($C2="Branch Manager",$C2="Assistant Manager",$C2="Junior Manager",$C2="Cluster Manager"),1,0))',
    '=IF($A2="","",IFERROR(SUMIFS(Config_BonusPotential!$C:$C,Config_BonusPotential!$A:$A,$F2,Config_BonusPotential!$B:$B,$E2),0))',
    '=IF($A2="","",IFERROR(VLOOKUP($D2,ManagerSummary!$A:$S,18,FALSE),0))',
    '=IF($A2="","",IFERROR(VLOOKUP($D2,ManagerSummary!$A:$S,19,FALSE),0))',
    '=IF($A2="","",IFERROR(VLOOKUP($D2,KPIResults!$A:$M,12,FALSE),0))',
    '=IF($A2="","",IFERROR(VLOOKUP($D2,KPIResults!$A:$M,13,FALSE),0))',
    // ManagerBonus (cluster bonus omitted - see Instructions)
    '=IF($A2="","",IF($I2=0,0,IF(OR($H2="Absconded",$H2="Discharged"),0,($K2*$J2)*$G2*(1-$M2))))',
    '=IF($A2="","",IFERROR(VLOOKUP($D2,StoreSummary!$A:$O,15,FALSE),0))',
    '=IF($A2="","",$P2*$G2*(1-$N2)*(1-$M2))',
    '=IF($A2="","",IF(IFERROR(VLOOKUP($E2,' + REF.COUNTRYRULES + ',5,FALSE),FALSE)=TRUE,0,$L2*$G2*(1-$N2)))'
  ];
  fillDown_(sh, f, EMP_ROWS);
}

function buildPayoutPerPerson_(ss) {
  var headers = ['EmployeeNumber', 'Country', 'PrimaryJob', 'AttendancePct', 'ManagerComp',
    'StoreComp', 'OverriderComp', 'TimecardLossPct', 'AwolLossPct', 'TerminationReason',
    'TotalPossible', 'PayoutLocal', 'StoreIncentive', 'ManagerIncentive'];
  var sh = writeHeaders_(ss, 'PAYOUT PER PERSON', headers);
  var gate = 'VLOOKUP("attendance_gate_pct",' + REF.THRESHOLDS + ',2,FALSE)';
  var floor = 'VLOOKUP("per_person_minimum",' + REF.THRESHOLDS + ',2,FALSE)';
  var badTerm = 'OR($J2="Misconduct",$J2="Discharged",$J2="Absconded")';
  var storeRaw = '$F2*(1-$H2)*(1-$I2)';
  var mgrRaw = '($E2+$G2)*(1-$H2)*(1-$I2)';
  var f = [
    '=IF(Calculations!A2="","",Calculations!A2)',
    '=IF($A2="","",Calculations!E2)',
    '=IF($A2="","",Calculations!C2)',
    '=IF($A2="","",Calculations!G2)',
    '=IF($A2="","",Calculations!O2)',
    '=IF($A2="","",Calculations!Q2)',
    '=IF($A2="","",Calculations!R2)',
    '=IF($A2="","",IF(IFERROR(VLOOKUP($A2,In_TimecardExceptions!$A:$B,2,FALSE),0)>1,VLOOKUP($A2,In_TimecardExceptions!$A:$B,2,FALSE)/100,IFERROR(VLOOKUP($A2,In_TimecardExceptions!$A:$B,2,FALSE),0)))',
    '=IF($A2="","",IF(OR(COUNTIF(In_ExtraAwol!$A:$A,$A2)>0,IFERROR(VLOOKUP($A2,In_Employees!$A:$L,8,FALSE),0)>0),1,0))',
    '=IF($A2="","",Calculations!H2)',
    '=IF($A2="","",IF($D2>=' + gate + ',$E2+$F2+$G2,0))',
    '=IF($A2="","",IF(' + badTerm + ',0,$K2*(1-$H2)*(1-$I2)))',
    '=IF($A2="","",IF(OR(' + badTerm + ',$D2<' + gate + '),0,IF(AND(' + storeRaw + '>1,' + storeRaw + '<' + floor + '),' + floor + ',' + storeRaw + ')))',
    '=IF($A2="","",IF(OR(' + badTerm + ',$D2<' + gate + '),0,IF(AND(' + mgrRaw + '>1,' + mgrRaw + '<' + floor + '),' + floor + ',' + mgrRaw + ')))'
  ];
  fillDown_(sh, f, EMP_ROWS);
}

// ===========================================================================
//  VALIDATION
// ===========================================================================

function writeValidationTab_(ss) {
  var sh = getOrCreate_(ss, 'Validation');
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearContent();
  sh.getRange('A1').setValue('VALIDATION').setFontWeight('bold').setFontSize(12);

  sh.getRange('A3').setValue('Weight-block checksums (each block must sum to 1.00)').setFontWeight('bold');
  sh.getRange('A4:C4').setValues([['BlockKey', 'SumOfWeights', 'Status']]).setFontWeight('bold');
  sh.getRange('A5').setFormula('=IFERROR(UNIQUE(FILTER(Config_ManagerWeights!A2:A,Config_ManagerWeights!A2:A<>"")),"")');
  sh.getRange('B5').setFormula('=ARRAYFORMULA(IF(A5:A="","",SUMIF(Config_ManagerWeights!A:A,A5:A,Config_ManagerWeights!F:F)))');
  sh.getRange('C5').setFormula('=ARRAYFORMULA(IF(A5:A="","",IF(ROUND(B5:B,4)=1,"OK","** CHECK **")))');

  sh.getRange('E3').setValue('Stores with no matching BlockKey (will pay manager 0% - fix In_StoreMaster/config)').setFontWeight('bold');
  sh.getRange('E4').setValue('Store').setFontWeight('bold');
  sh.getRange('E5').setFormula('=IFERROR(FILTER(QualifyingStores!A2:A,QualifyingStores!M2:M="",QualifyingStores!A2:A<>""),"(none)")');

  sh.getRange('G3').setValue('Eligible stores missing a Sales target').setFontWeight('bold');
  sh.getRange('G4').setValue('Store').setFontWeight('bold');
  sh.getRange('G5').setFormula('=IFERROR(FILTER(QualifyingStores!A2:A,QualifyingStores!L2:L="Eligible",QualifyingStores!A2:A<>"",ISNA(MATCH(QualifyingStores!A2:A,In_Targets!A:A,0))),"(none)")');

  sh.setColumnWidths(1, 7, 180);
}

function runValidation() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Validation');
  if (!sh) { SpreadsheetApp.getUi().alert('Run "Build / Rebuild workbook" first.'); return; }
  SpreadsheetApp.flush();
  ss.setActiveSheet(sh);
  SpreadsheetApp.getUi().alert('Validation refreshed. Review the Validation tab: any "** CHECK **" rows or listed stores need attention.');
}

// ===========================================================================
//  INSTRUCTIONS
// ===========================================================================

function writeInstructionsTab_(ss) {
  var sh = getOrCreate_(ss, 'Instructions');
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearContent();
  var lines = [
    ['Bonus Workbook - how it works'],
    [''],
    ['Layers:'],
    ['  Config_*   Editable parameters (KPI weights, bonus potential, overrider tiers, thresholds). Change values here, never in engine formulas.'],
    ['  In_*       Input data. Connect BigQuery (Data > Data connectors) and extract into these tabs, or paste. Keep the header row and column order.'],
    ['  Engine     QualifyingStores, KPIResults, ManagerSummary, StoreSummary, Calculations - all formulas, protected (warning only).'],
    ['  Output     PAYOUT PER PERSON.'],
    ['  Validation Checksums + unmatched-store flags. Check after every run.'],
    [''],
    ['Monthly runbook:'],
    ['  1. Set the cycle month + date cutoffs in Config_Cycle, and FX in Config_FX.'],
    ['  2. Refresh / paste all In_* tabs (Store master, Sales, Targets, Employees, EmployeeCount, KPIRaw, BlockedDrains, TimecardExceptions, ExtraAwol).'],
    ['  3. Open Validation. Resolve any "** CHECK **" weight blocks and any listed unmatched / missing-target stores.'],
    ['  4. Read PAYOUT PER PERSON. Columns M (StoreIncentive) and N (ManagerIncentive) are the per-person payouts; L (PayoutLocal) is the combined amount.'],
    [''],
    ['Brand / store-type / country handling:'],
    ['  Each store gets ONE BlockKey (QualifyingStores col M) from Country + Brand + StoreType. That is the only place country branching lives.'],
    ['  Config_ManagerWeights is keyed by BlockKey, so adding a country/brand/delivery variant = add weight rows + extend the BlockKey formula if a new branch is needed.'],
    [''],
    ['Known simplifications in this scaffold (confirm against the live model):'],
    ['  - Cluster Manager bonus is not yet added into Calculations!ManagerBonus (set to 0). Wire In_ClusterManager + share when ready.'],
    ['  - Oil Quality contributes its computed score (0..0.10) where the block has an oil_quality weight > 0.'],
    ['  - QualifyingStores uses a single eligibility flag (Type=Eligible/NA); split Store vs Manager entries if the live model requires distinct rows.'],
    ['  - Manager monthly potential is matched on In_Employees.Position + Country (Config_BonusPotential).'],
    [''],
    ['Re-running "Build / Rebuild workbook" deletes ALL existing tabs and rebuilds from scratch (export In_* data first).']
  ];
  sh.getRange(1, 1, lines.length, 1).setValues(lines);
  sh.getRange('A1').setFontWeight('bold').setFontSize(12);
  sh.setColumnWidth(1, 900);
}

// ===========================================================================
//  PROTECTION / ORDER
// ===========================================================================

function protectEngineTabs_(ss) {
  ['QualifyingStores', 'KPIResults', 'ManagerSummary', 'StoreSummary', 'Calculations', 'PAYOUT PER PERSON']
    .forEach(function (name) {
      var sh = ss.getSheetByName(name);
      if (!sh) return;
      sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function (p) { p.remove(); });
      var p = sh.protect().setDescription('Engine formulas - edit config tabs instead');
      p.setWarningOnly(true);
    });
}

function reorderTabs_(ss) {
  var order = ['Instructions', 'PAYOUT PER PERSON', 'Validation',
    'Config_Cycle', 'Config_FX', 'Config_CountryAliases', 'Config_ManagerWeights',
    'Config_BonusPotential', 'Config_Overrider', 'Config_StoreWeighting', 'Config_OilShrink',
    'Config_ShrinkExOil', 'Config_Thresholds', 'Config_CountryRules',
    'In_StoreMaster', 'In_Sales', 'In_Targets', 'In_Employees', 'In_EmployeeCount', 'In_KPIRaw',
    'In_BlockedDrains', 'In_TimecardExceptions', 'In_ExtraAwol', 'In_Corrections',
    'QualifyingStores', 'KPIResults', 'ManagerSummary', 'StoreSummary', 'Calculations'];
  var pos = 1;
  order.forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (sh) { ss.setActiveSheet(sh); ss.moveActiveSheet(pos++); }
  });
  var def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) { try { ss.deleteSheet(def); } catch (e) {} }
  var anchor = ss.getSheetByName(BUILD_ANCHOR);
  if (anchor && ss.getSheets().length > 1) { try { ss.deleteSheet(anchor); } catch (e) {} }
}

// ===========================================================================
//  LOW-LEVEL HELPERS
// ===========================================================================

function getOrCreate_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function writeHeaders_(ss, name, headers) {
  var sh = getOrCreate_(ss, name);
  // clearContent() only — avoids spreadsheet-wide recalc errors from sh.clear()
  // when other tabs still hold stale formula refs during a rebuild
  var maxRows = sh.getMaxRows();
  var maxCols = Math.max(sh.getMaxColumns(), headers.length);
  if (maxRows > 0 && maxCols > 0) {
    sh.getRange(1, 1, maxRows, maxCols).clearContent();
  }
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sh.setFrozenRows(1);
  return sh;
}

function writeTable_(ss, name, headers, rows) {
  var sh = writeHeaders_(ss, name, headers);
  if (rows && rows.length) {
    sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  sh.autoResizeColumns(1, headers.length);
  return sh;
}

/**
 * Write row-2 formulas (one per column) then copy them down to numRows.
 * @param {Sheet} sh
 * @param {string[]} formulas  formula text per column, using row "2" relative refs
 * @param {number} numRows     total data rows to fill
 */
function fillDown_(sh, formulas, numRows) {
  for (var c = 0; c < formulas.length; c++) {
    sh.getRange(2, c + 1).setFormula(formulas[c]);
  }
  if (numRows > 1) {
    sh.getRange(2, 1, 1, formulas.length)
      .copyTo(sh.getRange(3, 1, numRows - 1, formulas.length), { contentsOnly: false });
  }
}
