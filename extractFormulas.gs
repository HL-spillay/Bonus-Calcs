var LOG_SHEET_NAME = 'Execution Log';
var OUTPUT_PREFIX = 'Formulas - ';
var STATE_KEY = 'EXTRACT_FORMULAS_STATE';

/**
 * Menu entry: Extensions > Extract Formulas > Run all sheets
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Extract Formulas')
    .addItem('Run all sheets', 'extractFormulasAllSheets')
    .addItem('Resume (after timeout)', 'extractFormulasAllSheets')
    .addItem('Reset progress & run fresh', 'resetExtractProgress')
    .addToUi();
}

function resetExtractProgress() {
  PropertiesService.getDocumentProperties().deleteProperty(STATE_KEY);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  getOrCreateLogSheet(ss).appendRow([
    nowIso(),
    'INFO',
    '',
    '',
    'Progress reset by user; next run starts from sheet 0.',
  ]);
  extractFormulasAllSheets(true);
}

/**
 * Extract formulas from every sheet as text. Logs each step to LOG_SHEET_NAME.
 * Saves progress so a timed-out run can resume on the next invocation.
 *
 * @param {boolean=} forceFresh If true, ignore saved progress.
 */
function extractFormulasAllSheets(forceFresh) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logSheet = getOrCreateLogSheet(ss);
  var props = PropertiesService.getDocumentProperties();
  var state = forceFresh ? null : readState(props);

  var sheets = ss.getSheets().filter(function(s) {
    return s.getName() !== LOG_SHEET_NAME && s.getName().indexOf(OUTPUT_PREFIX) !== 0;
  });

  var startIndex = state ? state.nextSheetIndex : 0;
  var runId = state ? state.runId : Utilities.getUuid().slice(0, 8);

  if (!state || forceFresh) {
    log(logSheet, 'INFO', '', runId, 'Run started. Sheets to process: ' + sheets.length);
  } else {
    log(
      logSheet,
      'INFO',
      '',
      runId,
      'Resuming run. Starting at sheet index ' + startIndex + ' of ' + sheets.length
    );
  }

  for (var i = startIndex; i < sheets.length; i++) {
    if (getRemainingMs() < 45000) {
      saveState(props, { runId: runId, nextSheetIndex: i });
      log(
        logSheet,
        'WARN',
        sheets[i].getName(),
        runId,
        'Stopping early (~45s left). Re-run "Resume" to continue at sheet index ' + i +
          ' ("' + sheets[i].getName() + '").'
      );
      ss.toast('Paused for timeout safety. Use Extract Formulas > Resume.', 'Extract Formulas', 8);
      return;
    }

    var sheet = sheets[i];
    var sheetName = sheet.getName();

    try {
      log(logSheet, 'INFO', sheetName, runId, 'Begin sheet (' + (i + 1) + '/' + sheets.length + ')');

      var range = sheet.getDataRange();
      var numRows = range.getNumRows();
      var numCols = range.getNumColumns();
      log(
        logSheet,
        'DEBUG',
        sheetName,
        runId,
        'Data range: ' + numRows + ' rows x ' + numCols + ' cols (' + range.getA1Notation() + ')'
      );

      if (numRows === 0 || numCols === 0) {
        log(logSheet, 'INFO', sheetName, runId, 'Skipped (empty range).');
        continue;
      }

      var formulas = range.getFormulas();
      log(logSheet, 'DEBUG', sheetName, runId, 'Fetched formulas array.');

      var asText = formulas.map(function(row) {
        return row.map(function(cell) {
          return cell === '' ? '' : "'" + cell;
        });
      });

      var formulaCount = countNonEmpty(formulas);
      log(logSheet, 'DEBUG', sheetName, runId, 'Non-empty formula cells: ' + formulaCount);

      var outName = buildOutputSheetName(sheetName);
      var outSheet = ss.getSheetByName(outName);
      if (outSheet) {
        log(logSheet, 'DEBUG', sheetName, runId, 'Reusing output tab "' + outName + '".');
        outSheet.clear();
      } else {
        outSheet = ss.insertSheet(outName);
        log(logSheet, 'DEBUG', sheetName, runId, 'Created output tab "' + outName + '".');
      }

      outSheet.getRange(1, 1, asText.length, asText[0].length).setValues(asText);
      log(
        logSheet,
        'INFO',
        sheetName,
        runId,
        'Wrote ' + asText.length + 'x' + asText[0].length + ' cells to "' + outName + '".'
      );
    } catch (err) {
      log(
        logSheet,
        'ERROR',
        sheetName,
        runId,
        String(err && err.message ? err.message : err)
      );
      saveState(props, { runId: runId, nextSheetIndex: i });
      throw err;
    }
  }

  props.deleteProperty(STATE_KEY);
  log(logSheet, 'INFO', '', runId, 'Run completed. Processed ' + sheets.length + ' sheet(s).');
  ss.toast('All sheets processed.', 'Extract Formulas', 5);
}

function getOrCreateLogSheet(ss) {
  var logSheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!logSheet) {
    logSheet = ss.insertSheet(LOG_SHEET_NAME);
    logSheet.getRange(1, 1, 1, 5).setValues([['Timestamp', 'Level', 'Sheet', 'RunId', 'Message']]);
    logSheet.setFrozenRows(1);
    logSheet.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm:ss');
  }
  return logSheet;
}

function log(logSheet, level, sheetName, runId, message) {
  logSheet.appendRow([new Date(), level, sheetName, runId, message]);
  SpreadsheetApp.flush();
}

function nowIso() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function getRemainingMs() {
  try {
    return ScriptApp.getRemainingTime();
  } catch (e) {
    return 300000;
  }
}

function readState(props) {
  var raw = props.getProperty(STATE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function saveState(props, state) {
  props.setProperty(STATE_KEY, JSON.stringify(state));
}

function buildOutputSheetName(sourceName) {
  var name = OUTPUT_PREFIX + sourceName;
  return name.length > 100 ? name.slice(0, 100) : name;
}

function countNonEmpty(matrix) {
  var n = 0;
  for (var r = 0; r < matrix.length; r++) {
    for (var c = 0; c < matrix[r].length; c++) {
      if (matrix[r][c] !== '') n++;
    }
  }
  return n;
}
