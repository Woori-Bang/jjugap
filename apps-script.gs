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

function doGet(e) {
  if (e && e.parameter && e.parameter.store === 'trips') return out_({ trips: readTrips_() });
  return out_(read_());
}

/* ---- 방울 쭈갑 카운터: 'trips' 시트 (id, start, end, total, counts JSON) ---- */
var TRIP_HEAD = ['id', 'start', 'end', 'total', 'counts'];
var SAME_TRIP_MS = 5 * 60 * 1000;

function tripsSheet_() {
  var s = sheet_('trips');
  if (!s.getLastRow()) s.appendRow(TRIP_HEAD);
  return s;
}

function readTrips_() {
  var s = tripsSheet_(), n = s.getLastRow();
  if (n < 2) return [];
  return s.getRange(2, 1, n - 1, 5).getValues().map(function (r) {
    var c = {};
    try { c = JSON.parse(String(r[4]).replace(/^x/, '')) || {}; } catch (err) {}
    return { id: String(r[0]), start: Number(r[1]), end: Number(r[2]), total: Number(r[3]) || 0, counts: c };
  }).filter(function (t) { return t.id && t.start; });
}

function tripPost_(body) {
  var s = tripsSheet_();
  var list = readTrips_();
  if (body.op === 'put') {
    var t = body.trip || {};
    var start = Number(t.start), end = Number(t.end) || start;
    if (!start) return { ok: false, error: 'bad trip' };
    var counts = {}, total = 0;
    Object.keys(t.counts || {}).forEach(function (k) {
      var v = Math.max(0, Math.floor(Number(t.counts[k]) || 0));
      counts[String(k).slice(0, 20)] = v; total += v;
    });
    var id = String(t.id || ('t' + Math.floor(start / 60000)));
    // 같은 id, 또는 시작 시각이 5분 안쪽이면 같은 출조로 보고 덮어써요
    var idx = -1;
    list.forEach(function (x, i) { if (idx < 0 && (x.id === id || Math.abs(x.start - start) <= SAME_TRIP_MS)) idx = i; });
    if (idx >= 0) id = list[idx].id;
    var row = [id, start, end, total, 'x' + JSON.stringify(counts)];
    s.getRange(1, 1, Math.max(s.getLastRow(), 2), 5).setNumberFormat('@');
    if (idx >= 0) s.getRange(idx + 2, 1, 1, 5).setValues([row]);
    else s.appendRow(row);
    return { ok: true, id: id, trip: { id: id, start: start, end: end, total: total, counts: counts } };
  }
  if (body.op === 'delete') {
    var ids = (body.ids || []).map(String);
    for (var j = list.length - 1; j >= 0; j--) if (ids.indexOf(list[j].id) >= 0) s.deleteRow(j + 2);
    return { ok: true };
  }
  return { ok: false, error: 'bad op' };
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.store === 'trips') return out_(tripPost_(body));
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
