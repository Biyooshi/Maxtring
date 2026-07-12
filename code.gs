/**
 * CODE.GS - MAXTRING API
 * Untuk dijalankan di Google Apps Script (tersemat pada Matrix All Marketing)
 * Hanya me-return JSON untuk Vercel frontend.
 */

var MATRIX_SHEET_ID = '1r63LtnKfHdcGhV8t-2cGnQdNzxu98KAjya3pmRICSyU';
var CONTENT_BANK_SHEET_ID = '1qZsdjUwEvHNqh1NM6Iol2VCmFeUeDt-jvv_Hf63DDts';
var FONNTE_TOKEN = '9PkBs4SoEG15Qbw8mVBd';
var SECRET_TOKEN = 'maxtring2026'; // Token untuk otentikasi API sederhana

function getMatrixSpreadsheet() {
  return SpreadsheetApp.openById(MATRIX_SHEET_ID);
}

function getContentBankSpreadsheet() {
  return SpreadsheetApp.openById(CONTENT_BANK_SHEET_ID);
}

function setupEmailAuth() {
  MailApp.sendEmail(Session.getActiveUser().getEmail(), "Maxtring Email Setup", "Otorisasi email aktif!");
}

function doPost(e) {
  return handleRequest(e, true);
}

function doGet(e) {
  return handleRequest(e, false);
}

function handleRequest(e, isPost) {
  try {
    var params = isPost ? JSON.parse(e.postData.contents) : e.parameter;
    
    // Simple authentication check
    if (params.token !== SECRET_TOKEN) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Unauthorized" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var func = params.action;
    var result;
    
    if (func === "getMatrixData") {
      result = getMatrixData(params.month);
    } else if (func === "getContentBankData") {
      result = getContentBankData(params.month);
    } else if (func === "scheduleIdea") {
      result = scheduleIdea(params.ideaData);
    } else if (func === "updateTaskStatus") {
      result = updateTaskStatus(params.taskId, params.division, params.newStatus, params.user);
    } else if (func === "getTeamData") {
      result = getTeamData();
    } else if (func === "login") {
      result = processLogin(params.username, params.password);
    } else {
      result = { error: "Action not found" };
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function sendWhatsAppMessage(target, message) {
  try {
    var url = "https://api.fonnte.com/send";
    var payload = {
      "target": target,
      "message": message,
      "delay": "2-5"
    };
    var options = {
      "method": "post",
      "headers": {
        "Authorization": FONNTE_TOKEN
      },
      "payload": payload,
      "muteHttpExceptions": true
    };
    UrlFetchApp.fetch(url, options);
  } catch (e) {
    Logger.log("Failed to send WA: " + e.toString());
  }
}

// --- LOGIN LOGIC ---
function processLogin(username, password) {
  var roles = {
    "cwjoy": { pass: "cwjoy!!", role: "CW", type: "staff" },
    "gdjoy": { pass: "gdjoy!!", role: "GD", type: "staff" },
    "smsjoy": { pass: "smsjoy!!", role: "SMS", type: "staff" },
    "talentjoy": { pass: "talentjoy!!", role: "Talent", type: "staff" },
    "headcw": { pass: "headcw!!", role: "CW", type: "head" },
    "headgd": { pass: "headgd!!", role: "GD", type: "head" },
    "headsms": { pass: "headsms!!", role: "SMS", type: "head" },
    "cmo": { pass: "biyooshi24!!", role: "CMO", type: "cmo" }
  };
  
  var user = roles[username];
  if (user && user.pass === password) {
    return { success: true, role: user.role, type: user.type, team: getTeamByRole(user.role) };
  }
  return { success: false, message: "Kredensial tidak valid" };
}

function getTeamByRole(role) {
  var teamData = getTeamData().data;
  if (!teamData) return [];
  if (role === "CMO") return teamData;
  return teamData.filter(function(t) { return t.divisi === role; });
}

// --- DATA FETCHING ---
function getMatrixData(monthName) {
  try {
    var ss = getMatrixSpreadsheet();
    var sheet = ss.getSheetByName(monthName || "Juni"); 
    if (!sheet) return { error: "Sheet " + (monthName || "Juni") + " tidak ditemukan" };
    
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var result = [];
    
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0]) continue; 
      var row = {};
      for (var j = 0; j < headers.length; j++) {
        row[headers[j]] = data[i][j];
      }
      result.push(row);
    }
    return { success: true, data: result };
  } catch (e) {
    return { error: e.toString() };
  }
}

function getContentBankData(monthName) {
  try {
    var ss = getContentBankSpreadsheet();
    var sheet = ss.getSheetByName(monthName || "Juni"); 
    if (!sheet) return { error: "Sheet " + (monthName || "Juni") + " tidak ditemukan di Content Bank" };
    
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var result = [];
    
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      var row = {};
      for (var j = 0; j < headers.length; j++) {
        row[headers[j]] = data[i][j];
      }
      result.push(row);
    }
    return { success: true, data: result };
  } catch (e) {
    return { error: e.toString() };
  }
}

function getTeamData() {
  try {
    var ss = getMatrixSpreadsheet();
    var sheet = ss.getSheetByName("Team Data");
    if (!sheet) {
      return { success: true, data: [
        { nama: "Muhammad Nurul Qolbi", divisi: "CMO", contact: "6285233142178" },
        { nama: "Riska Stephanie", divisi: "SMS", contact: "62895352730008" },
        { nama: "Fanisa Aulia", divisi: "GD", contact: "6281357557510" },
        { nama: "Benedict Jemima", divisi: "CW", contact: "6282114887824" },
        { nama: "Refan Regika", divisi: "Talent", contact: "6285697039805" }
      ]};
    }
    
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var result = [];
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      var row = {};
      for (var j = 0; j < headers.length; j++) {
        row[headers[j].toLowerCase()] = data[i][j];
      }
      result.push(row);
    }
    return { success: true, data: result };
  } catch (e) {
    return { error: e.toString() };
  }
}

// --- ACTIONS ---
function scheduleIdea(ideaData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    
    var cbSS = getContentBankSpreadsheet();
    var cbSheet = cbSS.getSheetByName(ideaData.month || "Juni");
    var cbData = cbSheet.getDataRange().getValues();
    var foundCb = false;
    
    for (var i = 1; i < cbData.length; i++) {
      if (cbData[i][0] == ideaData.id) { 
        cbSheet.getRange(i + 1, cbData[0].indexOf('Status') + 1).setValue('Scheduled');
        foundCb = true;
        break;
      }
    }
    
    var mxSS = getMatrixSpreadsheet();
    var mxSheet = mxSS.getSheetByName(ideaData.month || "Juni");
    var newTaskId = "TASK-" + new Date().getTime();
    
    mxSheet.appendRow([
      newTaskId, 
      ideaData.date, 
      ideaData.title, 
      "Not Started", 
      "Not Started", 
      "Not Started", 
      "Not Started", 
      ideaData.id    
    ]);
    
    SpreadsheetApp.flush();
    return { success: true, taskId: newTaskId };
  } catch (e) {
    return { error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function updateTaskStatus(taskId, division, newStatus, user) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    
    var mxSS = getMatrixSpreadsheet();
    var mxSheet = mxSS.getSheetByName("Juni"); 
    var data = mxSheet.getDataRange().getValues();
    var headers = data[0];
    
    var colIndex = headers.indexOf(division + ' Status');
    if (colIndex === -1) return { error: "Kolom divisi tidak ditemukan" };
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === taskId) {
        mxSheet.getRange(i + 1, colIndex + 1).setValue(newStatus);
        
        var logSheet = mxSS.getSheetByName("Audit Log");
        if (logSheet) {
          logSheet.appendRow([new Date(), user, taskId, division, newStatus]);
        }
        
        SpreadsheetApp.flush();
        
        if (newStatus === "Approved") {
          sendWhatsAppMessage("6285233142178", "Halo CMO, Task " + taskId + " divisi " + division + " telah di-Approved oleh " + user);
        }
        
        return { success: true };
      }
    }
    return { error: "Task tidak ditemukan" };
  } catch (e) {
    return { error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
