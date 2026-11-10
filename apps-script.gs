// 쭈갑 가계부 공유 저장소 (Google Apps Script)
// 스프레드시트 > 확장 프로그램 > Apps Script 에 이 내용을 통째로 붙여넣고
// 배포 > 새 배포 > 웹 앱 (실행: 나, 액세스 권한: 모든 사용자) 로 배포하세요.
//
// 'data' 시트: 1행 = 버전 정보, 2행부터 = 가계부 데이터(JSON 조각)
// 'history' 시트: 저장할 때마다 이전 내용을 한 줄씩 백업 (최근 100개)

var CHUNK = 40000;

function sheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function read_() {
  var s = sheet_('data');
  var n = s.getLastRow();
  if (!n) return { version: 0, updated: '', data: null };
  var vals = s.getRange(1, 1, n, 1).getValues();
  var meta = {};
  try { meta = JSON.parse(String(vals[0][0]).slice(1)); } catch (e) {}
  var json = vals.slice(1).map(function (r) { return String(r[0]).slice(1); }).join('');
  return { version: meta.version || 0, updated: meta.updated || '', data: json ? JSON.parse(json) : null };
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return out_(read_());
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var body = JSON.parse(e.postData.contents);
    var cur = read_();
    if (!body.force && body.version !== cur.version) {
      cur.ok = false; cur.conflict = true;
      return out_(cur);
    }
    if (!body.data || !Array.isArray(body.data.orders) || !Array.isArray(body.data.cart)) {
      return out_({ ok: false, error: 'bad data' });
    }
    // 이전 내용 백업
    if (cur.data) {
      var h = sheet_('history');
      var old = JSON.stringify(cur.data), row = [cur.updated, cur.version];
      for (var j = 0; j < old.length; j += CHUNK) row.push('x' + old.slice(j, j + CHUNK));
      h.appendRow(row);
      if (h.getLastRow() > 100) h.deleteRows(1, h.getLastRow() - 100);
    }
    var json = JSON.stringify(body.data), rows = [];
    for (var i = 0; i < json.length; i += CHUNK) rows.push(['x' + json.slice(i, i + CHUNK)]);
    var v = cur.version + 1, upd = new Date().toISOString();
    var s = sheet_('data');
    s.clear();
    s.getRange(1, 1, rows.length + 1, 1).setNumberFormat('@');
    s.getRange(1, 1).setValue('x' + JSON.stringify({ version: v, updated: upd }));
    if (rows.length) s.getRange(2, 1, rows.length, 1).setValues(rows);
    return out_({ ok: true, version: v, updated: upd });
  } finally {
    lock.releaseLock();
  }
}
