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
    'sms': { role: 'SMS', type: 'staff', team: [{nama: "Ika"}, {nama: "Naya"}, {nama: "Mei"}, {nama: "Aan"}, {nama: "Kladya"}, {nama: "Shelby"}] },
    'head-sms': { role: 'SMS', type: 'head', team: [{nama: "Ika"}] }, // Assuming Ika is Head for example, or we can just leave it if there's no specific head
    'gd': { role: 'GD', type: 'staff', team: [{nama: "Fanisa"}, {nama: "Dita"}, {nama: "Alya"}, {nama: "Syafa"}, {nama: "Lidia"}, {nama: "Azzam"}, {nama: "Fio"}, {nama: "Dhani"}] },
    'head-gd': { role: 'GD', type: 'head', team: [{nama: "Fanisa"}] },
    'cw': { role: 'CW', type: 'staff', team: [{nama: "Ben"}, {nama: "Rida"}, {nama: "Sidik"}, {nama: "Via"}, {nama: "Mayang"}, {nama: "Ayu"}] },
    'head-cw': { role: 'CW', type: 'head', team: [{nama: "Ben"}] },
    'talent': { role: 'Talent', type: 'staff', team: [{nama: "Reza"}, {nama: "Putri"}] }, // Dummy for now since cc was empty in Morpest data
    'cmo': { role: 'CMO', type: 'cmo', team: [{nama: "Obi"}] }
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
    
    // 2. Prepare data for Matrix
    // Target headers based on Morpest Matrix All-Marketing
    var targetHeaders = ["No", "Upload Deadline", "Day Upload", "Time Upload", "Content Ideas", "References", "SMS Ideas Creation", "Jenis Content", "Brief CW", "PIC CW", "HASIL TULISAN (CHECK DISINI)", "PIC GD", "HASIL DESIGN (CEK DISINI)", "PIC Talent", "LINK VIDEO DISINI", "PIC SMS", "STATUS UPLOAD SMS", "Status CW", "Status GD", "Status Talent", "Overall Status"];
    
    var mxData = mxSheet.getDataRange().getValues();
    if (!mxData[0] || mxData[0].length < 2) {
       mxSheet.getRange(1, 1, 1, targetHeaders.length).setValues([targetHeaders]);
       mxData = [targetHeaders];
    }
    var mxHeaders = mxData[0];
    
    // Ensure new Status columns exist
    var requiredCols = ["Status CW", "Status GD", "Status Talent", "Overall Status"];
    for(var c=0; c<requiredCols.length; c++) {
      if(mxHeaders.indexOf(requiredCols[c]) === -1) {
        mxHeaders.push(requiredCols[c]);
        mxSheet.getRange(1, mxHeaders.length).setValue(requiredCols[c]);
      }
    }
    
    var mxHeaderMap = getHeaderMap(mxSheet);
    
    // Calculate new "No" for Matrix
    var mxNoCol = mxHeaderMap["No"] !== undefined ? mxHeaderMap["No"] : 0;
    var maxNo = 0;
    for (var j = 1; j < mxData.length; j++) {
      var currentNo = parseInt(mxData[j][mxNoCol], 10);
      if (!isNaN(currentNo) && currentNo > maxNo) {
        maxNo = currentNo;
      }
    }
    var newNo = maxNo + 1;
    
    var newRowObj = {};
    newRowObj["No"] = newNo;
    newRowObj["Upload Deadline"] = ideaData.date; // H Date
    
    // Day String
    var d = new Date(ideaData.date);
    if (!isNaN(d.getTime())) {
      var days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      newRowObj["Day Upload"] = days[d.getDay()];
      
      // SLA Calculation / Deadlines
      var cwDate = new Date(d); cwDate.setDate(cwDate.getDate() - 3);
      var gdDate = new Date(d); gdDate.setDate(gdDate.getDate() - 2);
      
      // We can insert deadline notes in Brief CW or other places if needed, but per original Matrix, they just use Upload Deadline.
      // So we will just trust the dates for now or append it to references.
    }
    
    newRowObj["Content Ideas"] = ideaData.title;
    newRowObj["Jenis Content"] = parts[1] || ""; // The pillar
    
    newRowObj["Overall Status"] = "On Process";
    newRowObj["Status CW"] = "Not Started";
    newRowObj["Status GD"] = "Not Started";
    newRowObj["Status Talent"] = "Not Started";
    newRowObj["STATUS UPLOAD SMS"] = "Not Started";
    
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

function updateTaskStatus(taskId, division, newStatus, user, notes) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    
    var mxSheet = getSheetByName(MATRIX_ID, "Juni");
    var data = mxSheet.getDataRange().getValues();
    var headers = data[0];
    var headerMap = getHeaderMap(mxSheet);
    
    var idCol = headerMap["No"];
    
    var targetStatusColName = (division === 'SMS') ? "STATUS UPLOAD SMS" : "Status " + division;
    var targetCol = headerMap[targetStatusColName];
    var overallCol = headerMap["Overall Status"];
    
    if (idCol === undefined) return { error: "Header 'No' tidak ditemukan di Matrix." };
    
    // Add columns dynamically if missing
    if (targetCol === undefined) {
      targetCol = headers.length;
      mxSheet.getRange(1, targetCol + 1).setValue(targetStatusColName);
      headers.push(targetStatusColName);
    }
    
    var rowToUpdate = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][idCol] == taskId) {
        rowToUpdate = i + 1;
        break;
      }
    }
    
    if (rowToUpdate === -1) return { error: "Task tidak ditemukan" };
    
    // Update Status Division
    mxSheet.getRange(rowToUpdate, targetCol + 1).setValue(newStatus);
    
    // Auto-update Overall Status if everything is moving
    if (overallCol !== undefined) {
      if (newStatus === "Approved") {
        mxSheet.getRange(rowToUpdate, overallCol + 1).setValue("Approved by " + division);
      } else if (division === 'SMS' && newStatus === 'Posted') {
        mxSheet.getRange(rowToUpdate, overallCol + 1).setValue("Posted");
      } else {
        mxSheet.getRange(rowToUpdate, overallCol + 1).setValue("On Process");
      }
    }
    
    // Handle Asset Links (Ctrl+K format)
    if (notes && (notes.startsWith("http://") || notes.startsWith("https://"))) {
      var assetCol = -1;
      if (division === 'CW') assetCol = headerMap["HASIL TULISAN (CHECK DISINI)"];
      if (division === 'GD') assetCol = headerMap["HASIL DESIGN (CEK DISINI)"];
      if (division === 'Talent') assetCol = headerMap["LINK VIDEO DISINI"];
      
      if (assetCol !== undefined && assetCol !== -1) {
        // Set Rich Text Link (Ctrl+K style)
        var richValue = SpreadsheetApp.newRichTextValue()
          .setText("Link " + division)
          .setLinkUrl(notes)
          .build();
        mxSheet.getRange(rowToUpdate, assetCol + 1).setRichTextValue(richValue);
      }
    }
    
    // Log PIC Name (e.g. who worked on it)
    var picCol = headerMap["PIC " + division];
    if (picCol !== undefined) {
      mxSheet.getRange(rowToUpdate, picCol + 1).setValue(user);
    }
    
    SpreadsheetApp.flush();
    
    // Notifications (Dummy)
    if (newStatus === "Approved" || newStatus === "Revisi") {
      var msg = "🚨 *Maxtring Update*\n\nTask No: " + taskId + "\nDivisi: " + division + "\nStatus: *" + newStatus + "*\nOleh: " + user;
      sendWhatsAppMessage("6285233142178", msg); 
    }
    
    return { success: true };
    
  } catch (e) {
    return { error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
