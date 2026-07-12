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
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
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
// ACTIONS
// ==========================================

function processLogin(username, password) {
  // Dummy Role Logic based on Blueprint
  if (password !== 'biyooshi24!!') return { error: "Password salah!" };
  
  var users = {
    'cmo': { role: 'CMO', type: 'cmo', team: [{nama: "Muhammad Nurul Qolbi"}] },
    'head-sms': { role: 'SMS', type: 'head', team: [{nama: "Zahwa"}, {nama: "Rifqi"}] },
    'staff-sms': { role: 'SMS', type: 'staff', team: [{nama: "Salsa"}, {nama: "Rara"}] },
    'head-cw': { role: 'CW', type: 'head', team: [{nama: "Ben"}, {nama: "Rida"}] },
    'staff-cw': { role: 'CW', type: 'staff', team: [{nama: "Rida"}, {nama: "Aldo"}] },
    'head-gd': { role: 'GD', type: 'head', team: [{nama: "Yuna"}, {nama: "Soni"}] },
    'staff-gd': { role: 'GD', type: 'staff', team: [{nama: "Dito"}, {nama: "Soni"}] },
    'talent': { role: 'Talent', type: 'staff', team: [{nama: "Reza"}, {nama: "Putri"}] }
  };
  
  if (users[username]) {
    var u = users[username];
    return { success: true, role: u.role, type: u.type, team: u.team };
  }
  return { error: "Role ID tidak ditemukan" };
}

function getMatrixData(month) {
  try {
    var sheet = getSheetByName(MATRIX_ID, month);
    var data = sheet.getDataRange().getDisplayValues();
    if (data.length <= 1) return { success: true, data: [] };
    
    var headers = data[0];
    var result = [];
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0]) continue; // Skip empty rows
      result.push(rowToObject(data[i], headers));
    }
    return { success: true, data: result };
  } catch(e) {
    return { error: e.toString() };
  }
}

function getContentBankData(month) {
  try {
    var sheet = getSheetByName(CONTENT_BANK_ID, month);
    var data = sheet.getDataRange().getDisplayValues();
    if (data.length <= 1) return { success: true, data: [] };
    
    var headers = data[0];
    var result = [];
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      result.push(rowToObject(data[i], headers));
    }
    return { success: true, data: result };
  } catch(e) {
    return { error: e.toString() };
  }
}

// Function to schedule an idea from Content Bank to Matrix
function scheduleIdea(ideaData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // 10 seconds timeout
    
    var cbSheet = getSheetByName(CONTENT_BANK_ID, ideaData.month);
    var mxSheet = getSheetByName(MATRIX_ID, ideaData.month);
    
    // 1. Update status in Content Bank
    var cbData = cbSheet.getDataRange().getValues();
    var cbHeaders = cbData[0];
    var cbHeaderMap = getHeaderMap(cbSheet);
    
    var idCol = cbHeaderMap["ID"];
    var statusCol = cbHeaderMap["Status"];
    var rowToUpdate = -1;
    
    if (idCol === undefined || statusCol === undefined) {
      return { error: "Kolom ID/Status tidak ditemukan di Content Bank." };
    }
    
    for (var i = 1; i < cbData.length; i++) {
      if (cbData[i][idCol] == ideaData.id) {
        rowToUpdate = i + 1;
        break;
      }
    }
    
    if (rowToUpdate === -1) return { error: "ID Content Bank tidak ditemukan" };
    cbSheet.getRange(rowToUpdate, statusCol + 1).setValue("Scheduled");
    
    // 2. Prepare data for Matrix
    var mxHeaders = mxSheet.getDataRange().getValues()[0] || ["Task ID", "Date", "Judul", "CB_Ref_ID", "Overall Status", "CW Status", "GD Status", "Talent Status"];
    
    // If matrix sheet is empty, set headers
    if (!mxSheet.getDataRange().getValues()[0]) {
       mxSheet.getRange(1, 1, 1, mxHeaders.length).setValues([mxHeaders]);
    }
    
    var mxHeaderMap = getHeaderMap(mxSheet);
    var newTaskId = "MAX-" + new Date().getTime().toString().substr(-5);
    
    var newRowObj = {};
    newRowObj["Task ID"] = newTaskId;
    newRowObj["Date"] = ideaData.date; // The H date
    newRowObj["Judul"] = ideaData.title;
    newRowObj["CB_Ref_ID"] = ideaData.id;
    newRowObj["Overall Status"] = "On Process";
    newRowObj["CW Status"] = "Not Started";
    newRowObj["GD Status"] = "Not Started";
    newRowObj["Talent Status"] = "Not Started";
    newRowObj["SMS Status"] = "Not Started";
    
    // SLA Calculation
    var d = new Date(ideaData.date);
    if (!isNaN(d.getTime())) {
      var cwDate = new Date(d); cwDate.setDate(cwDate.getDate() - 3);
      var gdDate = new Date(d); gdDate.setDate(gdDate.getDate() - 2);
      var tlDate = new Date(d); tlDate.setDate(tlDate.getDate() - 2);
      
      newRowObj["Deadline CW"] = Utilities.formatDate(cwDate, "GMT+7", "yyyy-MM-dd");
      newRowObj["Deadline GD"] = Utilities.formatDate(gdDate, "GMT+7", "yyyy-MM-dd");
      newRowObj["Deadline Talent"] = Utilities.formatDate(tlDate, "GMT+7", "yyyy-MM-dd");
    }
    
    var mxRowData = objectToRow(newRowObj, mxHeaders, mxHeaders.length);
    mxSheet.appendRow(mxRowData);
    
    SpreadsheetApp.flush();
    return { success: true, taskId: newTaskId };
    
  } catch (e) {
    return { error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function updateTaskStatus(taskId, division, newStatus, user, notes) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    
    // Assume all updates happen in 'Juni' for now as per constraints
    var mxSheet = getSheetByName(MATRIX_ID, "Juni");
    var data = mxSheet.getDataRange().getValues();
    var headers = data[0];
    var headerMap = getHeaderMap(mxSheet);
    
    var idCol = headerMap["Task ID"];
    var targetCol = headerMap[division + " Status"];
    var overallCol = headerMap["Overall Status"];
    var notesCol = headerMap["Notes"]; // If exists
    
    if (idCol === undefined) return { error: "Header Task ID tidak ditemukan." };
    if (targetCol === undefined) {
      // Add column if it doesn't exist dynamically
      targetCol = headers.length;
      mxSheet.getRange(1, targetCol + 1).setValue(division + " Status");
      headers.push(division + " Status");
    }
    
    var rowToUpdate = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][idCol] == taskId) {
        rowToUpdate = i + 1;
        break;
      }
    }
    
    if (rowToUpdate === -1) return { error: "Task tidak ditemukan" };
    
    // Update Status
    mxSheet.getRange(rowToUpdate, targetCol + 1).setValue(newStatus);
    
    // Auto-update Overall Status if Approved
    if (newStatus === "Approved" && overallCol !== undefined) {
      // Logic checks could go here to verify ALL are approved before setting Overall to Approved.
      // For now, let's keep it simple or manual.
    }
    
    // Record Notes if provided
    if (notes && notes.length > 0) {
      if (notesCol === undefined) {
        notesCol = headers.length;
        mxSheet.getRange(1, notesCol + 1).setValue("Notes");
        headers.push("Notes");
      }
      var existingNotes = mxSheet.getRange(rowToUpdate, notesCol + 1).getValue() || "";
      var newNote = "[" + Utilities.formatDate(new Date(), "GMT+7", "MM/dd HH:mm") + "] " + user + " (" + division + "): " + newStatus + " - " + notes;
      mxSheet.getRange(rowToUpdate, notesCol + 1).setValue(existingNotes + "\n" + newNote);
    }
    
    // Write to Audit Log (Hidden/Optional)
    var logSheet = getSheetByName(MATRIX_ID, "Audit Log");
    if (logSheet) {
      logSheet.appendRow([new Date(), user, taskId, division, newStatus, notes || ""]);
    }
    
    SpreadsheetApp.flush();
    
    // Notifications
    if (newStatus === "Approved" || newStatus === "Revisi") {
      var msg = "🚨 *Maxtring Update*\n\nTask: " + taskId + "\nDivisi: " + division + "\nStatus: *" + newStatus + "*\nOleh: " + user + (notes ? "\nCatatan: " + notes : "");
      sendWhatsAppMessage("6285233142178", msg); // Send to CMO (Dummy number)
    }
    
    return { success: true };
    
  } catch (e) {
    return { error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
