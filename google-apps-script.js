/**
 * =====================================================
 * Golden Sea Laksa POS — Google Apps Script Backend
 * =====================================================
 * 
 * 使用指南 / Setup Guide:
 * 
 * 1. 打开 Google Drive → 新建 Google Sheet → 命名为 "Golden Sea Laksa POS"
 * 2. 确保 Sheet 有一个名为 "Orders" 的工作表（默认 Sheet1 改名即可）
 * 3. 在 Orders 表第一行添加以下表头：
 *    A: order_id | B: local_order_id | C: timestamp | D: order_type | E: table_no
 *    F: items_summary | G: total_qty | H: total_amount | I: status
 *    J: paid | K: payment_method | L: synced_at
 * 
 * 4. 点击菜单 Extensions → Apps Script
 * 5. 删除默认的 myFunction 代码，粘贴本文件所有内容
 * 6. 点击 Deploy → New deployment → 选 "Web app"
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 7. 点击 Deploy → 复制 Web App URL
 * 8. 将 URL 粘贴到项目中的 .env.local 文件：
 *    VITE_GAS_URL=https://script.google.com/macros/s/YOUR_ID/exec
 * 
 * =====================================================
 */

// ==================== POST Handler ====================
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action || 'addOrder';
    
    if (action === 'addOrder') {
      return addOrder(data);
    } else if (action === 'updateStatus') {
      return updateOrderStatus(data);
    }
    
    return jsonResponse({ success: false, error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ==================== GET Handler ====================
function doGet(e) {
  try {
    var action = e.parameter.action || 'getOrders';
    
    if (action === 'getOrders') {
      var date = e.parameter.date || getTodayString();
      return getOrders(date);
    } else if (action === 'getStats') {
      var from = e.parameter.from;
      var to = e.parameter.to;
      return getStats(from, to);
    } else if (action === 'ping') {
      return jsonResponse({ success: true, message: 'Golden Sea Laksa POS API is running!' });
    }
    
    return jsonResponse({ success: false, error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ==================== Add New Order ====================
function addOrder(data) {
  var sheet = getOrdersSheet();
  
  // Check if order already exists (avoid duplicates)
  var existingRow = findOrderRow(sheet, data.local_order_id);
  if (existingRow > 0) {
    return jsonResponse({ success: true, message: 'Order already exists', duplicate: true });
  }
  
  sheet.appendRow([
    data.order_id || '',
    data.local_order_id || '',
    data.timestamp || '',
    data.order_type || '',
    data.table_no || '',
    data.items_summary || '',
    data.total_qty || 0,
    data.total_amount || 0,
    data.status || 'Pending',
    data.paid ? 'TRUE' : 'FALSE',
    data.payment_method || '',
    new Date().toISOString()
  ]);
  
  return jsonResponse({ success: true, message: 'Order added' });
}

// ==================== Update Order Status ====================
function updateOrderStatus(data) {
  var sheet = getOrdersSheet();
  var row = findOrderRow(sheet, data.local_order_id);
  
  if (row <= 0) {
    return jsonResponse({ success: false, error: 'Order not found: ' + data.local_order_id });
  }
  
  // Update status (column I = 9)
  if (data.status) {
    sheet.getRange(row, 9).setValue(data.status);
  }
  // Update paid (column J = 10)
  if (data.paid !== undefined) {
    sheet.getRange(row, 10).setValue(data.paid ? 'TRUE' : 'FALSE');
  }
  // Update payment_method (column K = 11)
  if (data.payment_method) {
    sheet.getRange(row, 11).setValue(data.payment_method);
  }
  // Update synced_at (column L = 12)
  sheet.getRange(row, 12).setValue(new Date().toISOString());
  
  return jsonResponse({ success: true, message: 'Order updated' });
}

// ==================== Get Orders by Date ====================
function getOrders(date) {
  var sheet = getOrdersSheet();
  var data = sheet.getDataRange().getValues();
  var orders = [];
  
  for (var i = 1; i < data.length; i++) { // Skip header row
    var row = data[i];
    var timestamp = String(row[2]); // column C = timestamp
    
    // Filter by date (YYYY-MM-DD prefix match)
    if (date && !timestamp.startsWith(date)) continue;
    
    orders.push({
      order_id: row[0],
      local_order_id: row[1],
      timestamp: row[2],
      order_type: row[3],
      table_no: row[4],
      items_summary: row[5],
      total_qty: Number(row[6]),
      total_amount: Number(row[7]),
      status: row[8],
      paid: String(row[9]) === 'TRUE',
      payment_method: row[10] || '',
      synced: true
    });
  }
  
  return jsonResponse({ success: true, orders: orders });
}

// ==================== Get Stats (Date Range) ====================
function getStats(from, to) {
  var sheet = getOrdersSheet();
  var data = sheet.getDataRange().getValues();
  var dailyStats = {};
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var timestamp = String(row[2]);
    var date = timestamp.substring(0, 10); // YYYY-MM-DD
    var status = String(row[8]);
    
    // Skip cancelled orders
    if (status === 'Cancelled') continue;
    
    // Filter by date range
    if (from && date < from) continue;
    if (to && date > to) continue;
    
    if (!dailyStats[date]) {
      dailyStats[date] = { date: date, bowls: 0, revenue: 0, orders: 0 };
    }
    
    // Only count completed/preparing/pending (not cancelled)
    dailyStats[date].bowls += Number(row[6]) || 0;
    dailyStats[date].revenue += Number(row[7]) || 0;
    dailyStats[date].orders += 1;
  }
  
  // Convert to array sorted by date
  var stats = Object.values(dailyStats);
  stats.sort(function(a, b) { return a.date > b.date ? -1 : 1; });
  
  // Calculate totals
  var totalBowls = 0, totalRevenue = 0, totalOrders = 0;
  stats.forEach(function(s) {
    totalBowls += s.bowls;
    totalRevenue += s.revenue;
    totalOrders += s.orders;
  });
  
  return jsonResponse({
    success: true,
    totals: { bowls: totalBowls, revenue: totalRevenue, orders: totalOrders },
    daily: stats
  });
}

// ==================== Helpers ====================
function getOrdersSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Orders');
  if (!sheet) {
    sheet = ss.insertSheet('Orders');
    sheet.appendRow([
      'order_id', 'local_order_id', 'timestamp', 'order_type', 'table_no',
      'items_summary', 'total_qty', 'total_amount', 'status',
      'paid', 'payment_method', 'synced_at'
    ]);
  }
  return sheet;
}

function findOrderRow(sheet, localOrderId) {
  if (!localOrderId) return -1;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(localOrderId)) {
      return i + 1; // 1-indexed row number
    }
  }
  return -1;
}

function getTodayString() {
  var now = new Date();
  var y = now.getFullYear();
  var m = String(now.getMonth() + 1).padStart(2, '0');
  var d = String(now.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
