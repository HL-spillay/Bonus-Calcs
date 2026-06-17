/**
 * Bonus Workbook Auditor
 * ----------------------
 * Reverse-engineers the current bonus workbook so it can be rebuilt as a
 * clean, config-driven model. It walks every sheet and produces:
 *
 *   1. "Audit - Sheet Summary"   one row per sheet (size, #formulas, in/out links)
 *   2. "Audit - Formula Inventory" one row per formula cell (formula + decoded parts)
 *   3. "Audit - Connections"     edge list of which sheet feeds which (the "wiring")
 *   4. "Audit - Parameters"      hardcoded numbers + labeled constants = config candidates
 *   5. "Audit - Functions"       which spreadsheet functions are used, and how often
 *   6. "Audit Log"               step-by-step execution log for debugging
 *
 * Resumable: if it approaches the Apps Script time limit it stops cleanly,
 * saves progress, and can be continued via the menu.
 *
 * NOTE: Apps Script allows only ONE onOpen() per project. If you keep this in
 * the same project as extractFormulas.gs, delete one onOpen() and merge the
 * menu items, or put this file in its own Apps Script project.
 */

var AUDIT_LOG_SHEET = 'Audit Log';
var AUDIT_PREFIX = 'Audit - ';
var AUDIT_STATE_KEY = 'AUDIT_WORKBOOK_STATE';
var AUDIT_TIME_BUDGET_MS = 45000; // stop with this much time left
var AUDIT_MAX_FORMULAS_PER_SHEET = 50; // sample only the first N formula cells per sheet

var AUDIT_OUTPUTS = {
  summary: 'Audit - Sheet Summary',
  inventory: 'Audit - Formula Inventory',
  connections: 'Audit - Connections',
  parameters: 'Audit - Parameters',
  functions: 'Audit - Functions',
};

var AUDIT_HEADERS = {
  summary: ['Sheet', 'Rows', 'Cols', 'Formula Cells', 'Cross-Sheet Refs',
            'Feeds These Sheets', 'Distinct Functions', 'Hardcoded Numbers'],
  inventory: ['Sheet', 'Cell', 'Formula', 'References Sheets', 'Functions Used',
              'Hardcoded Numbers', 'Cell/Range Refs', 'Notes'],
  connections: ['From Sheet', 'To Sheet', 'Reference Count', 'Example Cell'],
  parameters: ['Sheet', 'Type', 'Value', 'Count / Location', 'Label / Context'],
  functions: ['Sheet', 'Function', 'Count'],
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Bonus Audit')
    .addItem('Run full audit', 'auditRunAll')
    .addItem('Resume (after timeout)', 'auditResume')
    .addItem('Reset & run fresh', 'auditResetAndRun')
    .addToUi();
}

function auditResume() {
  auditRunAll(false);
}

function auditResetAndRun() {
  PropertiesService.getDocumentProperties().deleteProperty(AUDIT_STATE_KEY);
  auditRunAll(true);
}

/**
 * Main entry. Walks every source sheet and appends analysis to the output tabs.
 * @param {boolean=} forceFresh If true, ignore saved progress and rebuild outputs.
 */
function auditRunAll(forceFresh) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logSheet = auditGetOrCreateSheet(ss, AUDIT_LOG_SHEET,
    ['Timestamp', 'Level', 'Sheet', 'RunId', 'Message']);
  var props = PropertiesService.getDocumentProperties();
  var state = forceFresh ? null : auditReadState(props);

  var sourceSheets = ss.getSheets().filter(function(s) {
    var n = s.getName();
    return n !== AUDIT_LOG_SHEET && n.indexOf(AUDIT_PREFIX) !== 0;
  });

  var runId = state ? state.runId : Utilities.getUuid().slice(0, 8);
  var startIndex = state ? state.nextSheetIndex : 0;

  if (!state) {
    // Fresh run: (re)create output tabs with headers.
    auditInitOutputs(ss);
    auditLog(logSheet, 'INFO', '', runId,
      'Fresh audit started. Source sheets: ' + sourceSheets.length);
  } else {
    auditLog(logSheet, 'INFO', '', runId,
      'Resuming audit at sheet index ' + startIndex + ' of ' + sourceSheets.length);
  }

  for (var i = startIndex; i < sourceSheets.length; i++) {
    if (auditRemainingMs() < AUDIT_TIME_BUDGET_MS) {
      auditSaveState(props, { runId: runId, nextSheetIndex: i });
      auditLog(logSheet, 'WARN', sourceSheets[i].getName(), runId,
        'Paused (~' + Math.round(auditRemainingMs() / 1000) + 's left). ' +
        'Resume to continue at index ' + i + ' ("' + sourceSheets[i].getName() + '").');
      ss.toast('Paused for timeout safety. Use Bonus Audit > Resume.', 'Bonus Audit', 8);
      return;
    }

    var sheet = sourceSheets[i];
    var name = sheet.getName();
    try {
      auditLog(logSheet, 'INFO', name, runId,
        'Begin sheet (' + (i + 1) + '/' + sourceSheets.length + ')');
      auditProcessSheet(ss, sheet, runId, logSheet);
      auditSaveState(props, { runId: runId, nextSheetIndex: i + 1 });
    } catch (err) {
      auditLog(logSheet, 'ERROR', name, runId,
        String(err && err.message ? err.message : err));
      auditSaveState(props, { runId: runId, nextSheetIndex: i });
      throw err;
    }
  }

  props.deleteProperty(AUDIT_STATE_KEY);
  auditLog(logSheet, 'INFO', '', runId,
    'Audit complete. Processed ' + sourceSheets.length + ' sheet(s).');
  ss.toast('Audit complete. See the "Audit - ..." tabs.', 'Bonus Audit', 6);
}

/**
 * Analyze a single sheet and append rows to every output tab.
 */
function auditProcessSheet(ss, sheet, runId, logSheet) {
  var name = sheet.getName();
  var range = sheet.getDataRange();
  var numRows = range.getNumRows();
  var numCols = range.getNumColumns();
  auditLog(logSheet, 'DEBUG', name, runId,
    'Range ' + range.getA1Notation() + ' (' + numRows + 'x' + numCols + ')');

  if (numRows === 0 || numCols === 0) {
    auditLog(logSheet, 'INFO', name, runId, 'Empty sheet, skipped.');
    auditAppend(ss, AUDIT_OUTPUTS.summary,
      [[name, 0, 0, 0, 0, '', 0, 0]]);
    return;
  }

  var formulas = range.getFormulas();
  var values = range.getValues();

  var inventoryRows = [];
  var connectionMap = {};      // toSheet -> { count, example }
  var functionCounts = {};     // fn -> count
  var numberCounts = {};       // number -> count
  var paramRows = [];          // labeled constants
  var formulaCellCount = 0;
  var crossRefCount = 0;
  var formulaCapHit = false;

  scan:
  for (var r = 0; r < formulas.length; r++) {
    for (var c = 0; c < formulas[r].length; c++) {
      var f = formulas[r][c];
      var a1 = auditA1(r + 1, c + 1);

      if (f && f.charAt(0) === '=') {
        if (formulaCellCount >= AUDIT_MAX_FORMULAS_PER_SHEET) {
          formulaCapHit = true;
          break scan;
        }
        formulaCellCount++;
        var refsSheets = auditParseSheetRefs(f);
        var fns = auditParseFunctions(f);
        var nums = auditParseConstants(f);
        var cellRefs = auditParseCellRefs(f);

        for (var s = 0; s < refsSheets.length; s++) {
          var to = refsSheets[s];
          if (to === name) continue; // self-reference, not a cross-sheet link
          crossRefCount++;
          if (!connectionMap[to]) connectionMap[to] = { count: 0, example: a1 };
          connectionMap[to].count++;
        }
        for (var fi = 0; fi < fns.length; fi++) {
          functionCounts[fns[fi]] = (functionCounts[fns[fi]] || 0) + 1;
        }
        for (var ni = 0; ni < nums.length; ni++) {
          numberCounts[nums[ni]] = (numberCounts[nums[ni]] || 0) + 1;
        }

        inventoryRows.push([
          name, a1, f,
          refsSheets.join(', '),
          fns.join(', '),
          nums.join(', '),
          cellRefs.join(', '),
          '',
        ]);
      } else {
        // Non-formula cell: capture labeled numeric constants as config candidates.
        var v = values[r][c];
        if (typeof v === 'number' && v !== '' && !isNaN(v)) {
          var label = auditNearestLabel(values, r, c);
          if (label) {
            paramRows.push([name, 'Labeled constant', v, a1, label]);
          }
        }
      }
    }
  }

  // ---- Write Formula Inventory ----
  if (inventoryRows.length) {
    if (formulaCapHit) {
      inventoryRows[inventoryRows.length - 1][7] =
        'Sampled first ' + AUDIT_MAX_FORMULAS_PER_SHEET +
        ' formula cells; remaining cells on this sheet were not scanned.';
    }
    auditAppend(ss, AUDIT_OUTPUTS.inventory, inventoryRows);
  }

  // ---- Write Connections ----
  var connRows = [];
  var feedsList = [];
  Object.keys(connectionMap).forEach(function(to) {
    connRows.push([name, to, connectionMap[to].count, connectionMap[to].example]);
    feedsList.push(to);
  });
  if (connRows.length) auditAppend(ss, AUDIT_OUTPUTS.connections, connRows);

  // ---- Write Functions ----
  var fnRows = Object.keys(functionCounts).sort().map(function(fn) {
    return [name, fn, functionCounts[fn]];
  });
  if (fnRows.length) auditAppend(ss, AUDIT_OUTPUTS.functions, fnRows);

  // ---- Write Parameters (magic numbers + labeled constants) ----
  var numRowsOut = Object.keys(numberCounts).sort(function(a, b) {
    return numberCounts[b] - numberCounts[a];
  }).map(function(n) {
    return [name, 'Hardcoded number', n, numberCounts[n] + ' in formulas', ''];
  });
  var allParamRows = numRowsOut.concat(paramRows);
  if (allParamRows.length) auditAppend(ss, AUDIT_OUTPUTS.parameters, allParamRows);

  // ---- Write Sheet Summary ----
  auditAppend(ss, AUDIT_OUTPUTS.summary, [[
    name, numRows, numCols, formulaCellCount, crossRefCount,
    feedsList.join(', '),
    Object.keys(functionCounts).length,
    Object.keys(numberCounts).length,
  ]]);

  auditLog(logSheet, formulaCapHit ? 'WARN' : 'INFO', name, runId,
    'Done: ' + formulaCellCount + ' formulas' +
    (formulaCapHit ? ' (capped at ' + AUDIT_MAX_FORMULAS_PER_SHEET + ')' : '') +
    ', ' + crossRefCount + ' cross-sheet refs, ' +
    Object.keys(functionCounts).length + ' fns, ' +
    Object.keys(numberCounts).length + ' distinct numbers.');
}

/* ----------------------------- Formula parsing ---------------------------- */

/** Sheet names referenced by a formula (handles 'Quoted Name'! and PlainName!). */
function auditParseSheetRefs(formula) {
  var out = [];
  var seen = {};
  var re = /(?:'((?:[^']|'')+)'|([A-Za-z_][A-Za-z0-9_.]*))\s*!/g;
  var m;
  while ((m = re.exec(formula)) !== null) {
    var name = m[1] ? m[1].replace(/''/g, "'") : m[2];
    if (name && !seen[name]) { seen[name] = true; out.push(name); }
  }
  return out;
}

/** Spreadsheet function names used, e.g. SUM, VLOOKUP, IF. */
function auditParseFunctions(formula) {
  var out = [];
  var seen = {};
  var re = /([A-Z][A-Z0-9_.]*)\s*\(/g;
  var m;
  while ((m = re.exec(formula)) !== null) {
    var fn = m[1];
    if (!seen[fn]) { seen[fn] = true; out.push(fn); }
  }
  return out;
}

/** Numeric literals that are NOT part of a cell reference (the "magic numbers"). */
function auditParseConstants(formula) {
  var f = formula
    .replace(/"(?:[^"]|"")*"/g, ' ')                                  // strings
    .replace(/(?:'(?:[^']|'')+'|[A-Za-z_][A-Za-z0-9_.]*)\s*!\s*\$?[A-Z]+\$?[0-9]+(?:\s*:\s*\$?[A-Z]+\$?[0-9]+)?/g, ' ') // sheet!A1[:B2]
    .replace(/\$?[A-Z]{1,3}\$?[0-9]+/g, ' ');                         // plain A1 / ranges
  var nums = f.match(/-?\d+(?:\.\d+)?/g) || [];
  var out = [];
  var seen = {};
  for (var i = 0; i < nums.length; i++) {
    if (!seen[nums[i]]) { seen[nums[i]] = true; out.push(nums[i]); }
  }
  return out;
}

/** Cell/range references inside a formula (local + sheet-qualified). */
function auditParseCellRefs(formula) {
  var noStr = formula.replace(/"(?:[^"]|"")*"/g, ' ');
  var re = /(?:'(?:[^']|'')+'|[A-Za-z_][A-Za-z0-9_.]*)?\s*!?\s*\$?[A-Z]{1,3}\$?[0-9]+(?:\s*:\s*\$?[A-Z]{1,3}\$?[0-9]+)?/g;
  var matches = noStr.match(re) || [];
  var out = [];
  var seen = {};
  for (var i = 0; i < matches.length; i++) {
    var t = matches[i].replace(/\s+/g, '');
    if (t && /[A-Z]\$?[0-9]/.test(t) && !seen[t]) { seen[t] = true; out.push(t); }
  }
  return out;
}

/** Nearest text label to the left, then above, of a numeric cell (for config context). */
function auditNearestLabel(values, r, c) {
  for (var cc = c - 1; cc >= 0; cc--) {
    var left = values[r][cc];
    if (typeof left === 'string' && left.trim() !== '') return left.trim();
    if (left !== '' && typeof left !== 'string') break;
  }
  for (var rr = r - 1; rr >= 0; rr--) {
    var up = values[rr][c];
    if (typeof up === 'string' && up.trim() !== '') return up.trim();
    if (up !== '' && typeof up !== 'string') break;
  }
  return '';
}

/* ------------------------------- Utilities -------------------------------- */

function auditInitOutputs(ss) {
  Object.keys(AUDIT_OUTPUTS).forEach(function(key) {
    var sheetName = AUDIT_OUTPUTS[key];
    var sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      sheet.clear();
    } else {
      sheet = ss.insertSheet(sheetName);
    }
    var headers = AUDIT_HEADERS[key];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  });
}

function auditAppend(ss, sheetName, rows) {
  if (!rows || !rows.length) return;
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  var startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
}

function auditGetOrCreateSheet(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm:ss');
  }
  return sheet;
}

function auditLog(logSheet, level, sheetName, runId, message) {
  logSheet.appendRow([new Date(), level, sheetName, runId, message]);
  SpreadsheetApp.flush();
}

function auditRemainingMs() {
  try {
    return ScriptApp.getRemainingTime();
  } catch (e) {
    return 300000;
  }
}

function auditReadState(props) {
  var raw = props.getProperty(AUDIT_STATE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function auditSaveState(props, state) {
  props.setProperty(AUDIT_STATE_KEY, JSON.stringify(state));
}

/** Convert (row, col) 1-based to A1 column letter + row. */
function auditA1(row, col) {
  var letters = '';
  var n = col;
  while (n > 0) {
    var rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters + row;
}
