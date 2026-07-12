var FONNTE_TOKEN = "9PkBs4SoEG15Qbw8mVBd";
var MATRIX_ID = "1r63LtnKfHdcGhV8t-2cGnQdNzxu98KAjya3pmRICSyU";
var CONTENT_BANK_ID = "1qZsdjUwEvHNqh1NM6Iol2VCmFeUeDt-jvv_Hf63DDts";
var SECRET_TOKEN = "maxtring2026";

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
function getSheetByName(spreadsheetId, sheetName) {
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    // NEVER auto-create — sheets are created manually by SMS team.
    // Throw a clear error so the frontend can display a useful message.
    throw new Error("Tab '" + sheetName + "' tidak ditemukan di spreadsheet. Periksa nama tab (huruf besar/kecil harus persis sama).");
  }
  return sheet;
}

// ==========================================
// HEADER DETECTION UTILITIES
// ==========================================
// Finds the first row & column containing "No" within maxScanRows.
// Used for Matrix (single table) header detection.
function findHeaderPosition(values, maxScanRows) {
  var scanLimit = Math.min(values.length, maxScanRows || 20);
  for (var r = 0; r < scanLimit; r++) {
    var row = values[r];
    for (var c = 0; c < row.length; c++) {
      var cell = String(row[c]).trim();
      if (cell === 'No') {
        return { rowIndex: r, colIndex: c };
      }
    }
  }
  return null;
}

// Finds ALL columns containing "No" in the same row within maxScanRows.
// Used for Content Bank (5 pillar blocks side-by-side) — each block starts with "No".
function findAllHeaderBlockPositions(values, maxScanRows) {
  var scanLimit = Math.min(values.length, maxScanRows || 20);
  for (var r = 0; r < scanLimit; r++) {
    var row = values[r];
    var positions = [];
    for (var c = 0; c < row.length; c++) {
      var cell = String(row[c]).trim();
      if (cell === 'No') positions.push(c);
    }
    if (positions.length >= 2) { // Must have at least 2 blocks to be multi-block row
      return { rowIndex: r, colPositions: positions };
    }
  }
  // Fallback: accept even a single "No" (Content Bank might have only 1 pillar filled)
  for (var r2 = 0; r2 < scanLimit; r2++) {
    var row2 = values[r2];
    var positions2 = [];
    for (var c2 = 0; c2 < row2.length; c2++) {
      if (String(row2[c2]).trim() === 'No') positions2.push(c2);
    }
    if (positions2.length >= 1) return { rowIndex: r2, colPositions: positions2 };
  }
  return null;
}

function sendWhatsAppMessage(target, message) {
  var options = {
    'method': 'post',
    'headers': {
      'Authorization': FONNTE_TOKEN
    },
    'payload': {
      'target': target,
      'message': message,
      'delay': '1',
      'countryCode': '62'
    }
  };
  
  try {
    UrlFetchApp.fetch('https://api.fonnte.com/send', options);
  } catch(e) {
    console.error("Fonnte Error:", e);
  }
}

// Map headers to column index
function getHeaderMap(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length === 0) return {};
  var headers = data[0];
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    map[headers[i]] = i;
  }
  return map;
}

// Convert Array row to Object using header map
function rowToObject(row, headers) {
  var obj = {};
  for (var i = 0; i < headers.length; i++) {
    obj[headers[i]] = row[i];
  }
  return obj;
}

// Convert Object to Array row using header map
function objectToRow(obj, headers, currentLength) {
  var row = new Array(Math.max(headers.length, currentLength || 0));
  for (var i = 0; i < headers.length; i++) {
    if (obj.hasOwnProperty(headers[i])) {
      row[i] = obj[headers[i]];
    } else {
      row[i] = ""; // Keep empty string for missing
    }
  }
  return row;
}

// ==========================================
// WEB APP ENDPOINT
// ==========================================
function doPost(e) {
  var response = { success: false };
  try {
    var body = e.postData.contents;
    var data = JSON.parse(body);
    
    // Auth Check
    if (data.token !== SECRET_TOKEN) {
      return ContentService.createTextOutput(JSON.stringify({error: "Invalid Token"})).setMimeType(ContentService.MimeType.JSON);
    }
    
    switch(data.action) {
      case 'login':
        response = processLogin(data.username, data.password);
        break;
      case 'getMatrixData':
        response = getMatrixData(data.month);
        break;
      case 'getContentBankData':
        response = getContentBankData(data.month);
        break;
      case 'scheduleIdea':
        response = scheduleIdea(data.ideaData);
        break;
      case 'updateTaskStatus':
        response = updateTaskStatus(data.taskId, data.division, data.newStatus, data.user, data.notes);
        break;
      default:
        response.error = "Unknown action";
    }
    
  } catch (err) {
    response.error = err.toString();
  }
  
  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// PIC DATA — Hardcoded from Morpest (do NOT live-sync)
// ==========================================
function getPICData() {
  return {
    "sms": [
      { name: "Riska Stephanie",          nickname: "Ika",    phone: "62895352730008",  email: "riskastphnie28@gmail.com" },
      { name: "Naya Azani",               nickname: "Naya",   phone: "62895391527014",  email: "nayaazani13@gmail.com" },
      { name: "Meitia Kurniawati",        nickname: "Mei",    phone: "6282247765358",   email: "meitiakurniawati@gmail.com" },
      { name: "Muhamad Farhan",           nickname: "Aan",    phone: "6289531974196",   email: "aan.hans12@gmail.com" },
      { name: "Kladya Khoirunisa' Hapsari", nickname: "Kladya", phone: "6285645111043", email: "kladyakhoirunisakh@gmail.com" },
      { name: "Shellbitav Azazel",        nickname: "Shelby", phone: "6285172283505",   email: "ch3llb14z@gmail.com" }
    ],
    "gd": [
      { name: "Fanisa Aulia Nur Hakmalia",   nickname: "Fanisa", phone: "6281357557510",  email: "fanisaanh@gmail.com" },
      { name: "Dita Dara",                   nickname: "Dita",   phone: "6289665060586",  email: "dd.is.ditadara@gmail.com" },
      { name: "Yusmita Alya Melanie",        nickname: "Alya",   phone: "6285792300256",  email: "yusmitaalya@gmail.com" },
      { name: "Syafa Salsabila",             nickname: "Syafa",  phone: "62882003120378", email: "syafasalsabila226@gmail.com" },
      { name: "Lidia Siregar",               nickname: "Lidia",  phone: "6281316207014",  email: "kembaroktober06@gmail.com" },
      { name: "Mulqy Azzam",                 nickname: "Azzam",  phone: "6281770094378",  email: "mulqyazzam41@gmail.com" },
      { name: "Fiorentina Auvillia Oenang",  nickname: "Fio",    phone: "6282181777228",  email: "Fiorentinaauvillia3@gmail.com" },
      { name: "Muhammad Ramadhani",          nickname: "Dhani",  phone: "6282325795876",  email: "muhammadramadhani030909@gmail.com" }
    ],
    "cw": [
      { name: "Benedict Jemima Cecilia Pietersz", nickname: "Ben",   phone: "6282114887824",  email: "bjcpietersz47@gmail.com" },
      { name: "Ridatasa Nadiawati",               nickname: "Rida",  phone: "6289656144248",  email: "Ridatasa@gmail.com" },
      { name: "Sidik Permana",                    nickname: "Sidik", phone: "6285321200416",  email: "sidiksipengelana@gmail.com" },
      { name: "Sevia Rahmadani",                  nickname: "Via",   phone: "6285709598764",  email: "seviarahmadani9@gmail.com" },
      { name: "Mayang Anggraini",                 nickname: "Mayang",phone: "628812756505",   email: "mayanganggraini242@gmail.com" },
      { name: "Sri Rahayu Mulyaningsih",          nickname: "Ayu",   phone: "62895414845637", email: "srirahayuuu2937@gmail.com" }
    ],
    "talent": [], // Diisi manual oleh CMO berkala — jangan dihapus strukturnya
    "cc": [],
    "cmo": [
      { name: "Muhammad Nurul Qolbi", nickname: "Obi", phone: "6285233142178", email: "qolbi@joy.internal" }
    ]
  };
}

function processLogin(username, password) {
  if (password !== 'biyooshi24!!') return { error: "Password salah!" };
  
  var pic = getPICData();
  
  // Build team list from PIC data (using nickname for dropdown)
  function makeTeam(divKey) {
    return (pic[divKey] || []).map(function(p) { return { nama: p.nickname, phone: p.phone }; });
  }
  
  // Normalize to lowercase
  var role = (username || '').toLowerCase().trim();
  
  var roleMap = {
    'sms':       { role: 'SMS',    type: 'staff', teamKey: 'sms' },
    'head-sms':  { role: 'SMS',    type: 'head',  teamKey: 'sms' },
    'cw':        { role: 'CW',     type: 'staff', teamKey: 'cw' },
    'head-cw':   { role: 'CW',     type: 'head',  teamKey: 'cw' },
    'gd':        { role: 'GD',     type: 'staff', teamKey: 'gd' },
    'head-gd':   { role: 'GD',     type: 'head',  teamKey: 'gd' },
    'talent':    { role: 'Talent', type: 'staff', teamKey: 'talent' },
    'head-talent': { role: 'Talent', type: 'head', teamKey: 'talent' },
    'cmo':       { role: 'CMO',    type: 'cmo',   teamKey: 'cmo' }
  };
  
  if (!roleMap[role]) return { error: "Role ID tidak ditemukan. Gunakan: sms, cw, gd, talent, head-sms, head-cw, head-gd, head-talent, atau cmo" };
  
  var u = roleMap[role];
  return {
    success: true,
    role:    u.role,
    type:    u.type,
    team:    makeTeam(u.teamKey)
  };
}


// ==========================================
// MATRIX DATA
// ==========================================
// Tab name alias — spreadsheet uses "Content JUNI" not "Juni"
// We try both so the system works if either tab name is used.
var MATRIX_TAB_ALIAS = {
  "Juni":  ["Content JUNI", "Juni", "JUNI"],
  "Juli":  ["Content JULI", "Juli", "JULI"],
  "Agustus": ["Content AGUSTUS", "Agustus", "AGUSTUS"]
};

function getMatrixSheet(spreadsheetId, month) {
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var candidates = MATRIX_TAB_ALIAS[month] || [month];
  for (var i = 0; i < candidates.length; i++) {
    var s = ss.getSheetByName(candidates[i]);
    if (s) return s;
  }
  // Fallback: return first sheet that contains month string (case-insensitive)
  var all = ss.getSheets();
  for (var j = 0; j < all.length; j++) {
    if (all[j].getName().toLowerCase().indexOf(month.toLowerCase()) !== -1) return all[j];
  }
  return null;
}

function getMatrixData(month) {
  try {
    var sheet = getMatrixSheet(MATRIX_ID, month);
    if (!sheet) return { error: "Tab '" + month + "' tidak ditemukan di Matrix. Cek nama tab spreadsheet." };
    
    var allValues = sheet.getDataRange().getDisplayValues();
    if (allValues.length === 0) return { success: true, data: [] };
    
    // ---- DYNAMIC HEADER DETECTION ----
    // Spreadsheet Matrix has title/band rows ABOVE the actual header row.
    // We scan the first 20 rows to find the row containing "No" column.
    var headerPos = findHeaderPosition(allValues, 20);
    if (!headerPos) {
      Logger.log('getMatrixData: Header ("No" column) not found in first 20 rows. Tab: ' + (sheet ? sheet.getName() : 'null'));
      return { error: "Header row ('No' column) tidak ditemukan dalam 20 baris pertama tab '" + month + "'. Cek struktur sheet." };
    }
    
    // Slice headers starting from the column where "No" was found
    var headers = allValues[headerPos.rowIndex].slice(headerPos.colIndex);
    Logger.log('getMatrixData: Header found at row=' + headerPos.rowIndex + ', col=' + headerPos.colIndex);
    Logger.log('getMatrixData: Headers = ' + JSON.stringify(headers.slice(0, 10)));
    
    var result = [];
    for (var i = headerPos.rowIndex + 1; i < allValues.length; i++) {
      var row = allValues[i].slice(headerPos.colIndex);
      // Skip rows where the "No" column (first col of the slice) is empty
      if (!row[0] || String(row[0]).trim() === '') continue;
      var obj = rowToObject(row, headers);
      // Unified alias for pillar/jenis content field
      obj['_jenisContent'] = obj['Jenis Content'] || obj['Jenis Konten'] || '';
      result.push(obj);
    }
    
    Logger.log('getMatrixData: Total rows returned = ' + result.length);
    if (result.length > 0) Logger.log('getMatrixData: First row sample = ' + JSON.stringify(result[0]));
    
    return { success: true, data: result };
  } catch(e) {
    Logger.log('getMatrixData ERROR: ' + e.toString());
    return { error: e.toString() };
  }
}

// ==========================================
// CONTENT BANK DATA — Multi-pillar block structure
// ==========================================
// IMPORTANT: Content Bank has 5 separate pillar tables arranged side-by-side.
// Coordinates below MUST be verified manually against the actual spreadsheet.
// Format: { startRow: <1-indexed>, startCol: <1-indexed, A=1> }
// These are best-guess defaults — update after manual verification.
var CONTENT_BANK_PILLAR_MAP = {
  "Tips Karir":        { startRow: 5, startCol: 2  },  // Col B area
  "Karir Indonesia":   { startRow: 5, startCol: 17 },  // Col Q area — VERIFY
  "Karir Internasional": { startRow: 60, startCol: 2  }, // Below first two — VERIFY
  "Info Loker":        { startRow: 60, startCol: 17 },  // VERIFY
  "Lainnya":           { startRow: 115, startCol: 2 }   // Bottom block — VERIFY
};

// Column headers within each pillar block (0-indexed offsets from startCol)
var CB_COLS = {
  "No":                0,
  "Submit Date":       1,
  "Reference Link":    2,
  "Submitter":         3,
  "Content Ideas":     4,
  "Content Type":      5,   // REELS / IGF
  "Content Info":      6,   // Education / Promoting / For Fun / dst (tone)
  "SMS Brief Direction": 7,
  "Reviewer":          8,
  "Ideas Status":      9,
  "Tanggal Konten Up": 10,
  "Reviewer Notes":    11
};

// Known pillar order in Content Bank (left-to-right as they appear in the sheet)
var CONTENT_BANK_PILLAR_NAMES = [
  'Tips Karir',
  'Karir Indonesia',
  'Karir Internasional',
  'Info Loker',
  'Lainnya'
];

// Column header names within each pillar block (left to right, exact order in sheet)
// These are read dynamically from the header row — this list is a fallback label map.
var CB_HEADER_LABELS = [
  'No', 'Submit Date', 'Reference Link', 'Submitter',
  'Content Ideas', 'Content Type', 'Content Info',
  'SMS Brief Direction', 'Reviewer', 'Ideas Status',
  'Tanggal Konten Up', 'Reviewer Notes'
];

function getContentBankData(month) {
  try {
    var ss = SpreadsheetApp.openById(CONTENT_BANK_ID);
    var sheet = ss.getSheetByName(month);
    // Fallback variations
    if (!sheet) sheet = ss.getSheetByName(month.toUpperCase());
    if (!sheet) {
      var allSheets = ss.getSheets();
      for (var k = 0; k < allSheets.length; k++) {
        if (allSheets[k].getName().toLowerCase() === month.toLowerCase()) {
          sheet = allSheets[k]; break;
        }
      }
    }
    if (!sheet) return { error: "Tab '" + month + "' tidak ditemukan di Content Bank." };
    
    var allValues = sheet.getValues();
    if (allValues.length === 0) return { success: true, data: [] };
    
    // ---- DYNAMIC MULTI-BLOCK HEADER DETECTION ----
    // Content Bank has 5 pillar tables side by side.
    // Each pillar table starts with a "No" column header.
    // We scan rows to find the row that has the most "No" occurrences.
    var headerInfo = findAllHeaderBlockPositions(allValues, 20);
    if (!headerInfo) {
      Logger.log('getContentBankData: No header blocks found. Tab: ' + sheet.getName());
      return { error: "Tidak ada header block ('No' column) ditemukan di Content Bank tab '" + month + "'." };
    }
    
    var headerRowIndex = headerInfo.rowIndex;
    var blockStarts    = headerInfo.colPositions; // e.g. [1, 13, 25, 37, 49]
    
    Logger.log('getContentBankData: Header row = ' + headerRowIndex + ', block starts = ' + JSON.stringify(blockStarts));
    
    // Determine block end columns (each block ends where next starts, or end of data)
    var totalCols = allValues[0].length;
    var blockEndCols = [];
    for (var b = 0; b < blockStarts.length; b++) {
      blockEndCols.push(b + 1 < blockStarts.length ? blockStarts[b + 1] : totalCols);
    }
    
    var result = [];
    
    for (var p = 0; p < blockStarts.length; p++) {
      var pillarName = CONTENT_BANK_PILLAR_NAMES[p] || ('Pillar ' + (p + 1));
      var startC     = blockStarts[p];
      var endC       = blockEndCols[p];
      
      // Extract headers for this block from the header row
      var blockHeaders = [];
      for (var hc = startC; hc < endC; hc++) {
        var hVal = String(allValues[headerRowIndex][hc]).trim();
        blockHeaders.push(hVal || CB_HEADER_LABELS[hc - startC] || ('Col' + hc));
      }
      
      Logger.log('getContentBankData: Pillar "' + pillarName + '" headers = ' + JSON.stringify(blockHeaders));
      
      // Build header map for this block
      var blockHeaderMap = {};
      for (var bh = 0; bh < blockHeaders.length; bh++) {
        blockHeaderMap[blockHeaders[bh]] = bh; // relative offset from startC
      }
      
      // Helper to get value by header name with fallback to positional index
      function getField(row, name, fallbackIdx) {
        var idx = blockHeaderMap[name];
        if (idx !== undefined && startC + idx < row.length) return row[startC + idx];
        if (fallbackIdx !== undefined && startC + fallbackIdx < row.length) return row[startC + fallbackIdx];
        return '';
      }
      
      var emptyCount = 0;
      for (var r = headerRowIndex + 1; r < allValues.length; r++) {
        var rowData = allValues[r];
        var noVal = String(getField(rowData, 'No', 0)).trim();
        
        if (!noVal || noVal === '') {
          emptyCount++;
          if (emptyCount >= 5) break; // 5 consecutive empty No = end of block
          continue;
        }
        emptyCount = 0;
        
        var ideaId = noVal + '-' + pillarName;
        result.push({
          '_id':               ideaId,
          'Pillar':            pillarName,
          'No':                noVal,
          'Submit Date':       getField(rowData, 'Submit Date',       1)  || '',
          'Reference Link':    getField(rowData, 'Reference Link',    2)  || '',
          'Submitter':         getField(rowData, 'Submitter',         3)  || '',
          'Content Ideas':     getField(rowData, 'Content Ideas',     4)  || '',
          'Content Type':      getField(rowData, 'Content Type',      5)  || '',
          'Content Info':      getField(rowData, 'Content Info',      6)  || '',
          'SMS Brief Direction': getField(rowData, 'SMS Brief Direction', 7) || '',
          'Reviewer':          getField(rowData, 'Reviewer',          8)  || '',
          'Ideas Status':      getField(rowData, 'Ideas Status',      9)  || '',
          'Tanggal Konten Up': getField(rowData, 'Tanggal Konten Up', 10) || '',
          'Reviewer Notes':    getField(rowData, 'Reviewer Notes',    11) || ''
        });
      }
    }
    
    Logger.log('getContentBankData: Total ideas returned = ' + result.length);
    if (result.length > 0) Logger.log('getContentBankData: First idea = ' + JSON.stringify(result[0]));
    
    return { success: true, data: result };
  } catch(e) {
    Logger.log('getContentBankData ERROR: ' + e.toString());
    return { error: e.toString() };
  }
}

// Function to schedule an idea from Content Bank to Matrix
function scheduleIdea(ideaData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); 
    
    var cbSheet = getSheetByName(CONTENT_BANK_ID, ideaData.month);
    var mxSheet = getSheetByName(MATRIX_ID, ideaData.month);
    
    // 1. Update status in Content Bank
    var cbData = cbSheet.getDataRange().getValues();
    var cbHeaders = cbData[0];
    var cbHeaderMap = getHeaderMap(cbSheet);
    
    var cbNoCol = cbHeaderMap["No"];
    var cbPillarCol = cbHeaderMap["Jenis konten"]; // Pillar
    var statusCol = cbHeaderMap["Status Review"];
    var rowToUpdate = -1;
    
    // Find row by parsing ideaData.id which is "No-Pillar" (e.g. "1-TIPS KARIR")
    var parts = ideaData.id.split("-");
    var noVal = parts[0];
    
    if (cbNoCol !== undefined && statusCol !== undefined) {
      for (var i = 1; i < cbData.length; i++) {
        if (cbData[i][cbNoCol] == noVal) {
          rowToUpdate = i + 1;
          break;
        }
      }
      if (rowToUpdate !== -1) {
        cbSheet.getRange(rowToUpdate, statusCol + 1).setValue("Scheduled");
      }
    }
    
    // 2. Append new row to Matrix
    // Column names MUST match exact headers in actual spreadsheet:
    // No | Upload Deadline | Day Upload | Time Upload | Content Ideas | References
    // | SMS Ideas Direction | Jenis Content | Brief CW | PJ CW | Design GD | PJ GD
    // | LINK VIDEO | PJ TALENT | Status Upload SMS | PJ SMS
    
    var mxData = mxSheet.getDataRange().getValues();
    var mxHeaders = mxData[0];
    var mxHeaderMap = getHeaderMap(mxSheet);
    
    // Calculate new row number (find max existing No)
    var mxNoCol = mxHeaderMap['No'] !== undefined ? mxHeaderMap['No'] : 0;
    var maxNo = 0;
    for (var j = 1; j < mxData.length; j++) {
      var currentNo = parseInt(mxData[j][mxNoCol], 10);
      if (!isNaN(currentNo) && currentNo > maxNo) {
        maxNo = currentNo;
      }
    }
    var newNo = maxNo + 1;
    
    // Build minimal row object using actual column names
    var newRowObj = {};
    newRowObj['No']             = newNo;
    newRowObj['Upload Deadline'] = ideaData.date;
    newRowObj['Content Ideas']  = ideaData.title;
    newRowObj['SMS Ideas Direction'] = ideaData.smsDirection || '';
    newRowObj['Jenis Content']  = ideaData.jenisContent || '';
    
    // Day of week
    var d = new Date(ideaData.date);
    if (!isNaN(d.getTime())) {
      var days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
      newRowObj['Day Upload'] = days[d.getDay()];
    }
    
    var mxRowData = objectToRow(newRowObj, mxHeaders, mxHeaders.length);
    mxSheet.appendRow(mxRowData);
    
    SpreadsheetApp.flush();
    return { success: true, taskId: newNo };
    
  } catch (e) {
    return { error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function updateTaskStatus(taskId, division, newStatus, user, notes, month) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    
    var targetMonth = month || "Juni";
    var mxSheet = getMatrixSheet(MATRIX_ID, targetMonth);
    if (!mxSheet) return { error: "Tab '" + targetMonth + "' tidak ditemukan di Matrix." };
    
    var data      = mxSheet.getDataRange().getValues();
    var headers   = data[0];
    var headerMap = getHeaderMap(mxSheet);
    
    var idCol = headerMap["No"];
    if (idCol === undefined) return { error: "Header 'No' tidak ditemukan di Matrix. Pastikan spreadsheet sudah punya kolom 'No'." };
    
    // === STATUS COLUMN MAPPING (actual spreadsheet column names) ===
    // Division "SMS"    -> col "Status Upload SMS"
    // Division "CW"     -> col "Status CW"
    // Division "GD"     -> col "Status GD"
    // Division "Talent" -> col "Status Talent"
    var statusColName;
    if      (division === 'SMS')    statusColName = 'Status Upload SMS';
    else if (division === 'CW')     statusColName = 'Status CW';
    else if (division === 'GD')     statusColName = 'Status GD';
    else if (division === 'Talent') statusColName = 'Status Talent';
    else return { error: "Divisi tidak dikenal: " + division };
    
    // Add tracking columns dynamically if not yet present in spreadsheet
    var trackingCols = ['Status CW', 'Status GD', 'Status Talent', 'Status Upload SMS', 'Overall Status'];
    for (var t = 0; t < trackingCols.length; t++) {
      if (headerMap[trackingCols[t]] === undefined) {
        var newColIdx = headers.length;
        mxSheet.getRange(1, newColIdx + 1).setValue(trackingCols[t]);
        headers.push(trackingCols[t]);
        headerMap[trackingCols[t]] = newColIdx;
      }
    }
    
    var targetCol  = headerMap[statusColName];
    var overallCol = headerMap["Overall Status"];
    
    // Find row by No
    var rowToUpdate = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idCol]) === String(taskId)) {
        rowToUpdate = i + 1;
        break;
      }
    }
    if (rowToUpdate === -1) return { error: "Task No " + taskId + " tidak ditemukan di Matrix." };
    
    // Update status for this division
    mxSheet.getRange(rowToUpdate, targetCol + 1).setValue(newStatus);
    
    // Update Overall Status
    if (overallCol !== undefined) {
      if (division === 'SMS' && newStatus === 'Posted') {
        mxSheet.getRange(rowToUpdate, overallCol + 1).setValue('Posted');
      } else if (newStatus === 'Approved') {
        mxSheet.getRange(rowToUpdate, overallCol + 1).setValue('Approved by ' + division);
      } else if (newStatus === 'Revisi') {
        mxSheet.getRange(rowToUpdate, overallCol + 1).setValue('Revisi di ' + division);
      } else {
        mxSheet.getRange(rowToUpdate, overallCol + 1).setValue('On Process');
      }
    }
    
    // === ASSET LINK (Rich Text / Ctrl+K style) ===
    // Column names match actual spreadsheet headers:
    //   CW link    -> "Brief CW" (the result/submitted text link)
    //   GD link    -> "Design GD"
    //   Talent link-> "LINK VIDEO"
    if (notes && (notes.indexOf('http://') === 0 || notes.indexOf('https://') === 0)) {
      var assetColName;
      if      (division === 'CW')     assetColName = 'Brief CW';
      else if (division === 'GD')     assetColName = 'Design GD';
      else if (division === 'Talent') assetColName = 'LINK VIDEO';
      
      var assetCol = headerMap[assetColName];
      if (assetCol !== undefined) {
        var richValue = SpreadsheetApp.newRichTextValue()
          .setText('Lihat ' + division)
          .setLinkUrl(notes)
          .build();
        mxSheet.getRange(rowToUpdate, assetCol + 1).setRichTextValue(richValue);
      }
    }
    
    // === PIC COLUMN (actual names: "PJ CW", "PJ GD", "PJ TALENT", "PJ SMS") ===
    var picColName;
    if      (division === 'CW')     picColName = 'PJ CW';
    else if (division === 'GD')     picColName = 'PJ GD';
    else if (division === 'Talent') picColName = 'PJ TALENT';
    else if (division === 'SMS')    picColName = 'PJ SMS';
    
    var picCol = headerMap[picColName];
    if (picCol !== undefined && user) {
      mxSheet.getRange(rowToUpdate, picCol + 1).setValue(user);
    }
    
    SpreadsheetApp.flush();
    
    // WA Notification for review-required events
    if (newStatus === 'Approved' || newStatus === 'Revisi') {
      var msg = '🚨 *Maxtring Update*\n\nTask No: ' + taskId +
                '\nDivisi: ' + division +
                '\nStatus: *' + newStatus + '*' +
                '\nOleh: ' + user +
                (notes && notes.indexOf('http') !== 0 ? '\nCatatan: ' + notes : '');
      sendWhatsAppMessage('6285233142178', msg); // CMO Obi
    }
    
    return { success: true };
    
  } catch (e) {
    return { error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

