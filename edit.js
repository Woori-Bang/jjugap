/* 쭈갑 가계부 편집 기능: 공유 저장소(Google Apps Script)에서 불러오고 저장해요. */
(function () {
  'use strict';
  var API = (window.JJUGAP_CONFIG || {}).api || '';
  var KINDS_O = ['장비', '소모품', '선비'], KINDS_C = ['장비', '소모품'];

  function clone(x) { return JSON.parse(JSON.stringify(x == null ? null : x)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function won(n) { return (Number(n) || 0).toLocaleString('ko-KR') + '원'; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function isData(u) { return /^data:/.test(u || ''); }

  /* ---- 사진: 큰 사진(내장)은 이 페이지에만 두고, 저장소에는 사진 표식(imgKey)만 보내요 ---- */
  var imgMap = {};
  function keyOf(i) { return (i.link || '') + '|' + (i.name || ''); }
  function collect(list) {
    (list || []).forEach(function (o) {
      (o.items || []).forEach(function (i) {
        if (isData(i.img)) { i.imgKey = i.imgKey || keyOf(i); imgMap[i.imgKey] = i.img; }
      });
    });
  }
  collect(window.__ORDERS__); collect(window.__CART__);
  var BASE = { orders: clone(window.__ORDERS__ || []), cart: clone(window.__CART__ || []) };

  function strip(list) {
    return clone(list).map(function (o) {
      (o.items || []).forEach(function (i) { if (isData(i.img)) i.img = ''; });
      return o;
    });
  }
  function restore(list) {
    (list || []).forEach(function (o) {
      (o.items || []).forEach(function (i) {
        if (!i.img) { var k = i.imgKey || keyOf(i); if (imgMap[k]) i.img = imgMap[k]; }
      });
    });
    return list;
  }

  var st = { version: 0, updated: '', ready: false, busy: false };
  function cur() { return { orders: clone(window.__ORDERS__ || []), cart: clone(window.__CART__ || []) }; }
  function apply(data) {
    window.__ORDERS__ = restore(clone(data.orders || []));
    window.__CART__ = restore(clone(data.cart || []));
    if (window.__jjugapRender) window.__jjugapRender();
  }

  function apiGet() { return fetch(API, { cache: 'no-store' }).then(function (r) { return r.json(); }); }
  function apiPost(body) {
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); });
  }

  function save(data, opts) {
    opts = opts || {};
    if (!API) { alert('아직 공유 저장소가 연결되지 않았어요.'); return Promise.resolve(false); }
    st.busy = true; setStatus('저장하는 중…');
    return apiPost({ version: st.version, force: !!opts.force, data: { orders: strip(data.orders), cart: strip(data.cart) } })
      .then(function (res) {
        st.busy = false;
        if (res.ok) { st.version = res.version; st.updated = res.updated; apply(data); setStatus('저장했어요 · ' + when(res.updated)); return true; }
        if (res.conflict) {
          alert('그 사이에 다른 사람이 먼저 고쳤어요. 최신 내용을 불러올게요. 다시 한 번 고쳐 주세요.');
          st.version = res.version; st.updated = res.updated; if (res.data) apply(res.data);
          setStatus('최신 내용을 불러왔어요 · ' + when(res.updated)); return false;
        }
        alert('저장하지 못했어요: ' + (res.error || '알 수 없는 오류')); setStatus('저장 실패'); return false;
      })
      .catch(function (e) { st.busy = false; alert('저장하지 못했어요. 인터넷 연결을 확인해 주세요.'); setStatus('저장 실패'); return false; });
  }

  function load() {
    if (!API) { setStatus('공유 저장소 연결 전이에요 (보기 전용)'); return; }
    setStatus('공유 가계부를 불러오는 중…');
    apiGet().then(function (res) {
      st.version = res.version || 0; st.updated = res.updated || '';
      if (!res.data) {
        // 처음 한 번: 지금 페이지의 내용으로 공유 저장소를 채워요
        return save(clone(BASE)).then(function () { st.ready = true; });
      }
      apply(res.data); st.ready = true; setStatus('공유 가계부 · 마지막 저장 ' + when(st.updated));
    }).catch(function () { setStatus('공유 가계부를 불러오지 못했어요 (저장된 사본을 보여 주는 중)'); });
  }
  function when(iso) {
    if (!iso) return '';
    var d = new Date(iso); if (isNaN(d)) return iso;
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  /* ---- 화면 ---- */
  var css = '' +
    '.je-fab{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:50;border:0;border-radius:999px;padding:12px 18px;font:inherit;font-weight:700;background:var(--sea,#0f6e74);color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.25);cursor:pointer}' +
    '.je-back{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center}' +
    '@media(min-width:700px){.je-back{align-items:center}}' +
    '.je-panel{background:var(--sheet,#fff);color:var(--ink,#17232b);width:100%;max-width:640px;max-height:92vh;overflow:auto;border-radius:16px 16px 0 0;padding:16px;box-sizing:border-box}' +
    '@media(min-width:700px){.je-panel{border-radius:16px}}' +
    '.je-h{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.je-h h3{margin:0;font-size:18px}' +
    '.je-x{border:0;background:none;font-size:22px;cursor:pointer;color:inherit}' +
    '.je-tabs{display:flex;gap:6px;margin:8px 0}.je-tabs button,.je-btn{font:inherit;border:1px solid var(--rule,#d9e0df);background:var(--paper,#f3f5f4);color:inherit;border-radius:8px;padding:7px 12px;cursor:pointer}' +
    '.je-tabs button[aria-pressed=true]{background:var(--sea,#0f6e74);color:#fff;border-color:transparent}' +
    '.je-btn.pri{background:var(--sea,#0f6e74);color:#fff;border-color:transparent;font-weight:700}.je-btn.del{color:var(--squid,#b2426c)}' +
    '.je-row{display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--rule,#d9e0df)}.je-row .t{flex:1;min-width:0}.je-row small{display:block;color:var(--muted,#5d6b73)}' +
    '.je-row .acts{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}.je-row .acts .je-btn{padding:5px 9px;font-size:13px}' +
    '.je-st{font-size:12px;color:var(--muted,#5d6b73);margin:6px 0 0}' +
    '.je-f{display:grid;grid-template-columns:1fr 1fr;gap:8px}.je-f label{display:flex;flex-direction:column;font-size:13px;color:var(--muted,#5d6b73);gap:3px}.je-f label.w{grid-column:1/-1}' +
    '.je-f input,.je-f select,.je-f textarea{font:inherit;font-size:16px;color:var(--ink,#17232b);background:var(--paper,#f3f5f4);border:1px solid var(--rule,#d9e0df);border-radius:8px;padding:7px 9px;width:100%;box-sizing:border-box}' +
    '.je-it{border:1px solid var(--rule,#d9e0df);border-radius:10px;padding:10px;margin:10px 0}.je-it .ih{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-weight:700}' +
    '.je-ph{display:flex;align-items:center;gap:8px}.je-ph img{width:48px;height:48px;object-fit:cover;border-radius:6px}' +
    '.je-foot{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:12px;position:sticky;bottom:-16px;background:var(--sheet,#fff);padding:10px 0}' +
    '.je-note{font-size:13px;color:var(--muted,#5d6b73)}';
  var styleEl = document.createElement('style'); styleEl.textContent = css; document.head.appendChild(styleEl);

  var fab = document.createElement('button');
  fab.type = 'button'; fab.className = 'je-fab'; fab.textContent = '✏️ 편집';
  document.body.appendChild(fab);
  var statusText = '';
  function setStatus(t) { statusText = t; var el = document.querySelector('.je-st'); if (el) el.textContent = t; }

  var back = null, tab = 'orders';
  function close() { if (back) { back.remove(); back = null; } }
  function open(html) {
    close();
    back = document.createElement('div'); back.className = 'je-back';
    back.innerHTML = '<div class="je-panel" role="dialog" aria-modal="true">' + html + '</div>';
    back.addEventListener('click', function (e) { if (e.target === back) close(); });
    document.body.appendChild(back);
    back.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', close); });
    return back.querySelector('.je-panel');
  }
  fab.addEventListener('click', function () {
    var cartOpen = !document.getElementById('cartView').hidden;
    tab = cartOpen ? 'cart' : 'orders';
    showList();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

  function sortOrders(list) { return list.map(function (o, i) { return { o: o, i: i }; }).sort(function (a, b) { return (b.o.date || '').localeCompare(a.o.date || '') || (b.o.seq || 0) - (a.o.seq || 0); }); }
  function sortCart(list) { return list.map(function (o, i) { return { o: o, i: i }; }).sort(function (a, b) { return (b.o.added || '').localeCompare(a.o.added || '') || (b.o.seq || 0) - (a.o.seq || 0); }); }
  function cartTotal(c) { return (c.items || []).reduce(function (s, i) { return s + (+i.price || 0); }, 0) + (+c.shipping || 0); }
  function names(o) { return (o.items || []).map(function (i) { return i.short || i.name; }).join(', '); }

  function showList() {
    var d = cur(), isO = tab === 'orders', rows = isO ? sortOrders(d.orders) : sortCart(d.cart);
    var h = '<div class="je-h"><h3>✏️ 가계부 편집</h3><button class="je-x" data-close aria-label="닫기">✕</button></div>' +
      (API ? '' : '<p class="je-note">⚠️ 아직 공유 저장소가 연결되지 않아서 저장할 수 없어요.</p>') +
      '<div class="je-tabs"><button type="button" data-tab="orders" aria-pressed="' + isO + '">📒 가계부 (' + d.orders.length + ')</button>' +
      '<button type="button" data-tab="cart" aria-pressed="' + !isO + '">🛒 장바구니 (' + d.cart.length + ')</button></div>' +
      '<button type="button" class="je-btn pri" data-new>+ ' + (isO ? '구매 기록 추가' : '장바구니에 담기') + '</button>';
    if (!rows.length) h += '<p class="je-note">아직 비어 있어요.</p>';
    rows.forEach(function (r) {
      var o = r.o;
      h += '<div class="je-row"><div class="t"><b>' + esc(o.store || '(구매처 없음)') + '</b> · ' + (isO ? won(o.total) : won(cartTotal(o))) +
        '<small>' + esc(isO ? o.date : (o.added ? o.added + ' 담음' : '')) + ' · ' + esc(o.kind) + ' · ' + esc(names(o)) + '</small></div><div class="acts">' +
        '<button type="button" class="je-btn" data-edit="' + r.i + '">수정</button>' +
        (isO ? '' : '<button type="button" class="je-btn" data-buy="' + r.i + '">구매 완료</button>') +
        '<button type="button" class="je-btn del" data-del="' + r.i + '">삭제</button></div></div>';
    });
    h += '<p class="je-st">' + esc(statusText) + '</p>' +
      '<p class="je-note">링크가 있는 사람은 누구나 고칠 수 있어요. 저장할 때마다 이전 내용이 스프레드시트에 백업돼요.</p>' +
      '<div class="je-foot"><button type="button" class="je-btn" data-reset>원본 가계부로 되돌리기</button><button type="button" class="je-btn" data-close>닫기</button></div>';
    var p = open(h);
    p.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { tab = b.dataset.tab; showList(); }); });
    p.querySelector('[data-new]').addEventListener('click', function () { showForm(-1); });
    p.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { showForm(+b.dataset.edit); }); });
    p.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d2 = cur(), list = isO ? d2.orders : d2.cart, o = list[+b.dataset.del];
        if (!confirm('"' + (o.store || '') + ' · ' + names(o) + '"을(를) 지울까요?')) return;
        list.splice(+b.dataset.del, 1);
        save(d2).then(showList);
      });
    });
    p.querySelectorAll('[data-buy]').forEach(function (b) { b.addEventListener('click', function () { moveToOrders(+b.dataset.buy); }); });
    p.querySelector('[data-reset]').addEventListener('click', function () {
      if (!confirm('웹에서 고친 내용을 모두 지우고, 마지막으로 올린 원본 가계부(Claude가 만든 것)로 되돌릴까요?\n(지워지는 내용은 스프레드시트 백업에 남아요.)')) return;
      save(clone(BASE), { force: true }).then(showList);
    });
  }

  function nextSeq(list, field, val) {
    return list.filter(function (o) { return field ? o[field] === val : true; })
      .reduce(function (m, o) { return Math.max(m, Math.floor(+o.seq || 0)); }, 0) + 1;
  }

  function moveToOrders(idx) {
    var d = cur(), c = d.cart[idx];
    var date = prompt('언제 결제했나요? (예: ' + today() + ')', today()); if (date == null) return;
    var tot = prompt('실제로 결제한 금액(원)은요? 쿠폰·배송비 반영', String(cartTotal(c))); if (tot == null) return;
    var o = { date: date.trim(), store: c.store, kind: c.kind, items: c.items, note: c.note || '', total: +String(tot).replace(/[^\d]/g, '') || 0 };
    o.seq = nextSeq(d.orders, 'date', o.date);
    d.orders.push(o); d.cart.splice(idx, 1);
    save(d).then(function (ok) { if (ok) { tab = 'orders'; } showList(); });
  }

  var ITEM_FIELDS = [
    ['name', '상품명', 'w'], ['short', '짧은 이름 (표에 표시)', ''], ['brand', '브랜드', ''],
    ['category', '세부 분류 (예: 에기, 릴)', ''], ['qty', '수량 (예: 2, 2팩(4개))', ''],
    ['price', '가격 (원)', '', 'num'], ['unit', '개당 가격 (원)', '', 'num'],
    ['spec', '설명', 'w', 'area'], ['link', '구매링크 (https://…)', 'w']
  ];

  function itemHtml(i, n) {
    var ph = i.img ? '<img src="' + esc(i.img) + '" alt="">' : '';
    var h = '<div class="je-it" data-item><div class="ih"><span>물건 ' + n + '</span><button type="button" class="je-btn del" data-rmitem>빼기</button></div><div class="je-f">';
    ITEM_FIELDS.forEach(function (f) {
      var v = i[f[0]] == null ? '' : i[f[0]];
      h += '<label class="' + f[2] + '">' + f[1] + (f[3] === 'area'
        ? '<textarea rows="2" data-f="' + f[0] + '">' + esc(v) + '</textarea>'
        : '<input ' + (f[3] === 'num' ? 'inputmode="numeric" ' : '') + 'data-f="' + f[0] + '" value="' + esc(v) + '">') + '</label>';
    });
    h += '<label class="w">사진 주소 (https://… 이미지 링크)<span class="je-ph">' + ph +
      '<input data-f="img" value="' + esc(isData(i.img) ? '' : (i.img || '')) + '" placeholder="' + (isData(i.img) ? '지금 사진 그대로 두기' : '비워 두면 사진 없음') + '"></span></label>' +
      (isData(i.img) ? '<label class="w" style="flex-direction:row;align-items:center;gap:6px"><input type="checkbox" data-f="noimg" style="width:auto"> 사진 지우기</label>' : '') +
      '</div></div>';
    return h;
  }

  function showForm(idx) {
    var d = cur(), isO = tab === 'orders', list = isO ? d.orders : d.cart;
    var o = idx >= 0 ? clone(list[idx]) : (isO ? { date: today(), kind: '장비', items: [{}] } : { added: today(), kind: '장비', shipping: 0, items: [{}] });
    var kinds = isO ? KINDS_O : KINDS_C;
    var h = '<div class="je-h"><h3>' + (idx >= 0 ? '수정' : (isO ? '구매 기록 추가' : '장바구니에 담기')) + '</h3><button class="je-x" data-close aria-label="닫기">✕</button></div><div class="je-f">' +
      (isO ? '<label>결제한 날<input type="date" data-o="date" value="' + esc(o.date) + '"></label>'
           : '<label>담은 날<input type="date" data-o="added" value="' + esc(o.added) + '"></label>') +
      '<label>분류<select data-o="kind">' + kinds.map(function (k) { return '<option' + (o.kind === k ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select></label>' +
      '<label class="w">구매처<input data-o="store" value="' + esc(o.store) + '"></label>' +
      (isO ? '<label class="w">실제 결제 금액 (원) — 비우면 물건 가격 합계<input inputmode="numeric" data-o="total" value="' + esc(o.total == null ? '' : o.total) + '"></label>'
           : '<label class="w">배송비 (원)<input inputmode="numeric" data-o="shipping" value="' + esc(o.shipping == null ? '' : o.shipping) + '"></label>') +
      '<label class="w">메모<textarea rows="2" data-o="note">' + esc(o.note) + '</textarea></label></div>' +
      '<div data-items>' + (o.items || []).map(function (i, n) { return itemHtml(i, n + 1); }).join('') + '</div>' +
      '<button type="button" class="je-btn" data-additem>+ 물건 추가</button>' +
      '<div class="je-foot"><button type="button" class="je-btn" data-cancel>취소</button><button type="button" class="je-btn pri" data-save>저장</button></div>';
    var p = open(h);
    var box = p.querySelector('[data-items]');
    function renumber() { box.querySelectorAll('[data-item] .ih span').forEach(function (s, n) { s.textContent = '물건 ' + (n + 1); }); }
    function bindRm(el) { el.querySelector('[data-rmitem]').addEventListener('click', function () { el.remove(); renumber(); }); }
    box.querySelectorAll('[data-item]').forEach(bindRm);
    p.querySelector('[data-additem]').addEventListener('click', function () {
      box.insertAdjacentHTML('beforeend', itemHtml({}, box.children.length + 1)); bindRm(box.lastElementChild);
    });
    p.querySelector('[data-cancel]').addEventListener('click', showList);
    p.querySelector('[data-save]').addEventListener('click', function () {
      if (st.busy) return;
      var num = function (v) { v = String(v).replace(/[^\d.-]/g, ''); return v === '' ? undefined : Number(v); };
      p.querySelectorAll('[data-o]').forEach(function (el) {
        var k = el.dataset.o, v = el.value.trim();
        if (k === 'total' || k === 'shipping') { var n = num(v); if (n === undefined) delete o[k]; else o[k] = n; }
        else o[k] = v;
      });
      var olds = o.items || [];
      o.items = [].map.call(box.querySelectorAll('[data-item]'), function (el, n) {
        var i = clone(idx >= 0 && el.dataset.orig != null ? olds[+el.dataset.orig] : {}) || {};
        el.querySelectorAll('[data-f]').forEach(function (f) {
          var k = f.dataset.f, v = f.type === 'checkbox' ? f.checked : f.value.trim();
          if (k === 'noimg') { if (v) { i.img = ''; i.imgKey = 'none'; } return; }
          if (k === 'img') { if (v) { i.img = v; i.imgKey = 'none'; } else if (!isData(i.img)) { delete i.img; } return; }
          if (k === 'price' || k === 'unit') { var n2 = num(v); if (n2 === undefined) delete i[k]; else i[k] = n2; return; }
          if (k === 'qty') { i.qty = /^\d+$/.test(v) ? +v : v; if (v === '') delete i.qty; return; }
          if (v === '') delete i[k]; else i[k] = v;
        });
        return i;
      }).filter(function (i) { return i.name || i.short; });
      if (!o.store) { alert('구매처를 적어 주세요.'); return; }
      if (!o.items.length) { alert('물건을 하나 이상 적어 주세요 (상품명).'); return; }
      if (isO && o.total == null) o.total = o.items.reduce(function (s, i) { return s + (+i.price || 0); }, 0);
      if (isO && !/^\d{4}-\d{2}-\d{2}$/.test(o.date || '')) { alert('결제한 날을 골라 주세요.'); return; }
      var d2 = cur(), list2 = isO ? d2.orders : d2.cart;
      if (idx >= 0) list2[idx] = o;
      else { o.seq = isO ? nextSeq(list2, 'date', o.date) : nextSeq(list2); list2.push(o); }
      save(d2).then(function (ok) { if (ok) showList(); });
    });
    // 기존 물건과 화면의 칸을 연결해 두면, 화면에 없는 값(예: 사진, card)도 지켜져요
    box.querySelectorAll('[data-item]').forEach(function (el, n) { el.dataset.orig = n; });
  }

  load();
})();
