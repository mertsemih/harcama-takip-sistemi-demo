/* Veri katmanı — tüm okuma/yazma buradan geçer.
   Tutarlar TAM SAYI kuruş olarak saklanır (0.1 + 0.2 gibi ondalık hatalarını önler).
   İleride bulut senkronu eklenirse sadece load/save değişir, geri kalan kod aynı kalır. */
(function (global) {
  'use strict';

  var KEY = 'harcama.v1';
  var listeners = [];
  var state = null;

  /* ---------- yardımcılar ---------- */

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function ymOf(iso) { return iso.slice(0, 7); }

  function daysInMonth(ym) {
    var p = ym.split('-');
    return new Date(+p[0], +p[1], 0).getDate();
  }

  function shiftMonth(ym, delta) {
    var p = ym.split('-');
    var d = new Date(+p[0], +p[1] - 1 + delta, 1);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
  }

  /* ---------- varsayılan kategoriler ---------- */

  var DEFAULT_CATS = [
    { id: 'market',   name: 'Market',      emoji: '🛒', type: 'e' },
    { id: 'yemek',    name: 'Yemek',       emoji: '🍔', type: 'e' },
    { id: 'ulasim',   name: 'Ulaşım',      emoji: '🚌', type: 'e' },
    { id: 'kira',     name: 'Kira',        emoji: '🏠', type: 'e' },
    { id: 'fatura',   name: 'Fatura',      emoji: '💡', type: 'e' },
    { id: 'abonelik', name: 'Abonelik',    emoji: '📱', type: 'e' },
    { id: 'eglence',  name: 'Eğlence',     emoji: '🎮', type: 'e' },
    { id: 'giyim',    name: 'Giyim',       emoji: '👕', type: 'e' },
    { id: 'saglik',   name: 'Sağlık',      emoji: '💊', type: 'e' },
    { id: 'egitim',   name: 'Eğitim',      emoji: '📚', type: 'e' },
    { id: 'kahve',    name: 'Kahve',       emoji: '☕',       type: 'e' },
    { id: 'diger',    name: 'Diğer',       emoji: '💳', type: 'e' },
    { id: 'maas',     name: 'Maaş',        emoji: '💼', type: 'i' },
    { id: 'ekgelir',  name: 'Ek gelir',    emoji: '💰', type: 'i' },
    { id: 'digergel', name: 'Diğer gelir', emoji: '➕',       type: 'i' }
  ];

  function freshState() {
    return {
      v: 1,
      tx: [],
      cats: DEFAULT_CATS.map(function (c, i) {
        return {
          id: c.id, name: c.name, emoji: c.emoji, type: c.type,
          budget: null, order: i, archived: false
        };
      }),
      fixed: [],
      applied: {},
      set: { theme: 'auto' }
    };
  }

  /* ---------- kalıcılık ---------- */

  function load() {
    var raw = null;
    try { raw = global.localStorage.getItem(KEY); } catch (e) { raw = null; }
    if (!raw) return freshState();
    try {
      return migrate(JSON.parse(raw));
    } catch (e) {
      console.error('Kayıtlı veri okunamadı, boş başlatılıyor.', e);
      return freshState();
    }
  }

  /* Şema sürümü ilerlerse eski kayıtlar burada yükseltilir. */
  function migrate(s) {
    if (!s || typeof s !== 'object') return freshState();
    var base = freshState();
    s.v = s.v || 1;
    s.tx = Array.isArray(s.tx) ? s.tx : [];
    s.cats = (Array.isArray(s.cats) && s.cats.length) ? s.cats : base.cats;
    s.fixed = Array.isArray(s.fixed) ? s.fixed : [];
    s.applied = (s.applied && typeof s.applied === 'object') ? s.applied : {};
    s.set = (s.set && typeof s.set === 'object') ? s.set : base.set;
    if (!s.set.theme) s.set.theme = 'auto';
    return s;
  }

  var saveErrorShown = false;

  function save() {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      if (!saveErrorShown) {
        saveErrorShown = true;
        alert('Veri kaydedilemedi. Tarayıcı depolaması dolu ya da kapalı olabilir. ' +
              'Ayarlar bölümünden yedek indirip tarayıcı verisini temizlemeyi dene.');
      }
      console.error(e);
    }
    emit();
  }

  function emit() {
    for (var i = 0; i < listeners.length; i++) listeners[i]();
  }

  /* ---------- kategoriler ---------- */

  function cats(type) {
    return state.cats
      .filter(function (c) { return !c.archived && (!type || c.type === type); })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  }

  function cat(id) {
    for (var i = 0; i < state.cats.length; i++) {
      if (state.cats[i].id === id) return state.cats[i];
    }
    return { id: id, name: 'Bilinmeyen', emoji: '❓', type: 'e', budget: null };
  }

  function addCat(data) {
    var c = {
      id: uid(),
      name: (data.name || '').trim() || 'Yeni kategori',
      emoji: data.emoji || '🏷️',
      type: data.type === 'i' ? 'i' : 'e',
      budget: data.budget != null ? data.budget : null,
      order: state.cats.length,
      archived: false
    };
    state.cats.push(c);
    save();
    return c;
  }

  function updateCat(id, patch) {
    var c = state.cats.filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    for (var k in patch) {
      if (Object.prototype.hasOwnProperty.call(patch, k)) c[k] = patch[k];
    }
    save();
  }

  /* Kategori silinince işlemleri kaybolmasın diye "Diğer"e taşınır.
     Dönüş: taşınan işlem sayısı, ya da -1 (varsayılan toplayıcı silinemez). */
  function deleteCat(id) {
    var c = state.cats.filter(function (x) { return x.id === id; })[0];
    if (!c) return 0;
    var fallbackId = c.type === 'i' ? 'digergel' : 'diger';
    if (fallbackId === id) return -1;
    var fallback = state.cats.filter(function (x) { return x.id === fallbackId; })[0];
    if (!fallback) {
      fallback = addCat({ name: 'Diğer', emoji: '💳', type: c.type });
      fallbackId = fallback.id;
    }
    var moved = 0;
    state.tx.forEach(function (t) { if (t.c === id) { t.c = fallbackId; moved++; } });
    state.fixed.forEach(function (f) { if (f.c === id) f.c = fallbackId; });
    state.cats = state.cats.filter(function (x) { return x.id !== id; });
    save();
    return moved;
  }

  /* ---------- işlemler ---------- */

  function addTx(data) {
    var t = {
      id: uid(),
      t: data.t === 'i' ? 'i' : 'e',
      a: Math.round(data.a || 0),
      c: data.c,
      d: data.d || todayISO(),
      n: (data.n || '').trim(),
      ts: Date.now()
    };
    state.tx.push(t);
    save();
    return t;
  }

  function updateTx(id, patch) {
    var t = state.tx.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    if (patch.a != null) patch.a = Math.round(patch.a);
    if (patch.n != null) patch.n = String(patch.n).trim();
    for (var k in patch) {
      if (Object.prototype.hasOwnProperty.call(patch, k)) t[k] = patch[k];
    }
    save();
  }

  function deleteTx(id) {
    state.tx = state.tx.filter(function (x) { return x.id !== id; });
    // Sabit giderden gelmişse işareti kalksın ki o ay tekrar eklenebilsin
    Object.keys(state.applied).forEach(function (ym) {
      state.applied[ym] = state.applied[ym].filter(function (e) { return e.txId !== id; });
    });
    save();
  }

  function txOf(id) {
    return state.tx.filter(function (x) { return x.id === id; })[0] || null;
  }

  /* Ayın işlemleri, en yeni tarih en üstte. */
  function txForMonth(ym) {
    return state.tx
      .filter(function (t) { return ymOf(t.d) === ym; })
      .sort(function (a, b) {
        if (a.d === b.d) return b.ts - a.ts;
        return a.d < b.d ? 1 : -1;
      });
  }

  /* ---------- istatistik ---------- */

  function monthStats(ym) {
    var list = txForMonth(ym);
    var expense = 0, income = 0;
    var byCat = {};
    var byDay = [];
    var n = daysInMonth(ym);
    for (var i = 1; i <= n; i++) byDay.push({ day: i, total: 0 });

    list.forEach(function (t) {
      if (t.t === 'i') { income += t.a; return; }
      expense += t.a;
      byCat[t.c] = (byCat[t.c] || 0) + t.a;
      var day = +t.d.slice(8, 10);
      if (byDay[day - 1]) byDay[day - 1].total += t.a;
    });

    var catList = Object.keys(byCat).map(function (id) {
      return { id: id, cat: cat(id), total: byCat[id] };
    }).sort(function (a, b) { return b.total - a.total; });

    return {
      ym: ym,
      count: list.length,
      expense: expense,
      income: income,
      net: income - expense,
      byCat: catList,
      byDay: byDay
    };
  }

  function lastMonths(n, endYm) {
    var out = [];
    for (var i = n - 1; i >= 0; i--) {
      var ym = shiftMonth(endYm, -i);
      var s = monthStats(ym);
      out.push({ ym: ym, expense: s.expense, income: s.income });
    }
    return out;
  }

  /* ---------- sabit giderler ---------- */

  function fixedList() {
    return state.fixed
      .filter(function (f) { return f.active !== false; })
      .sort(function (a, b) { return (a.day || 1) - (b.day || 1); });
  }

  function addFixed(data) {
    var f = {
      id: uid(),
      name: (data.name || '').trim() || 'Sabit gider',
      a: Math.round(data.a || 0),
      c: data.c,
      t: data.t === 'i' ? 'i' : 'e',
      day: Math.min(28, Math.max(1, +data.day || 1)),
      active: true
    };
    state.fixed.push(f);
    save();
    return f;
  }

  function updateFixed(id, patch) {
    var f = state.fixed.filter(function (x) { return x.id === id; })[0];
    if (!f) return;
    if (patch.a != null) patch.a = Math.round(patch.a);
    for (var k in patch) {
      if (Object.prototype.hasOwnProperty.call(patch, k)) f[k] = patch[k];
    }
    save();
  }

  function deleteFixed(id) {
    state.fixed = state.fixed.filter(function (x) { return x.id !== id; });
    save();
  }

  function appliedIds(ym) {
    return (state.applied[ym] || []).map(function (e) { return e.fixedId; });
  }

  /* O ay henüz eklenmemiş sabit giderler */
  function pendingFixed(ym) {
    var done = appliedIds(ym);
    return fixedList().filter(function (f) { return done.indexOf(f.id) === -1; });
  }

  function applyOne(f, ym) {
    var day = Math.min(f.day || 1, daysInMonth(ym));
    var t = {
      id: uid(), t: f.t, a: f.a, c: f.c,
      d: ym + '-' + pad2(day), n: f.name, ts: Date.now()
    };
    state.tx.push(t);
    if (!state.applied[ym]) state.applied[ym] = [];
    state.applied[ym].push({ fixedId: f.id, txId: t.id });
    return t;
  }

  function applyFixed(id, ym) {
    var f = state.fixed.filter(function (x) { return x.id === id; })[0];
    if (!f || appliedIds(ym).indexOf(id) !== -1) return null;
    var t = applyOne(f, ym);
    save();
    return t;
  }

  function applyAllFixed(ym) {
    var pend = pendingFixed(ym);
    pend.forEach(function (f) { applyOne(f, ym); });
    save();
    return pend.length;
  }

  /* ---------- yedek ---------- */

  function exportObject() {
    return { app: 'harcama-takip', exportedAt: new Date().toISOString(), data: state };
  }

  function parseBackup(text) {
    var parsed = JSON.parse(text);
    var incoming = (parsed && parsed.data) ? parsed.data : parsed;
    if (!incoming || !Array.isArray(incoming.tx)) {
      throw new Error('Bu dosya bir harcama yedeği değil.');
    }
    return incoming;
  }

  /* Mevcut veriyi tamamen değiştirir. */
  function importJSON(text) {
    state = migrate(parseBackup(text));
    save();
    return state.tx.length;
  }

  /* Yedeği mevcut verinin üstüne ekler; aynı id'ler atlanır. */
  function mergeJSON(text) {
    var incoming = parseBackup(text);
    var known = {};
    state.tx.forEach(function (t) { known[t.id] = true; });
    var added = 0;
    incoming.tx.forEach(function (t) {
      if (!known[t.id]) { state.tx.push(t); added++; }
    });
    var knownCats = {};
    state.cats.forEach(function (c) { knownCats[c.id] = true; });
    (incoming.cats || []).forEach(function (c) {
      if (!knownCats[c.id]) { c.order = state.cats.length; state.cats.push(c); }
    });
    save();
    return added;
  }

  function clearAll() {
    state = freshState();
    save();
  }

  /* ---------- dışa açılan yüzey ---------- */

  state = load();

  global.Store = {
    uid: uid, pad2: pad2, todayISO: todayISO, ymOf: ymOf,
    daysInMonth: daysInMonth, shiftMonth: shiftMonth,
    raw: function () { return state; },
    subscribe: function (fn) { listeners.push(fn); },
    cats: cats, cat: cat, addCat: addCat, updateCat: updateCat, deleteCat: deleteCat,
    addTx: addTx, updateTx: updateTx, deleteTx: deleteTx, txOf: txOf, txForMonth: txForMonth,
    monthStats: monthStats, lastMonths: lastMonths,
    fixedList: fixedList, addFixed: addFixed, updateFixed: updateFixed, deleteFixed: deleteFixed,
    pendingFixed: pendingFixed, applyFixed: applyFixed, applyAllFixed: applyAllFixed,
    exportObject: exportObject, importJSON: importJSON, mergeJSON: mergeJSON, clearAll: clearAll,
    settings: function () { return state.set; },
    setSetting: function (k, v) { state.set[k] = v; save(); }
  };
})(window);
