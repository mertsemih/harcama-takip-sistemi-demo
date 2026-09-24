/* Veri katmanı — tüm okuma/yazma buradan geçer.
   Tutarlar TAM SAYI kuruş olarak saklanır (0.1 + 0.2 gibi ondalık hatalarını önler).
   İleride bulut senkronu eklenirse sadece load/save değişir, geri kalan kod aynı kalır.

   DÖNEM: uygulama artık takvim ayına sabit değil. Bir dönem {tip, bas, son} nesnesidir:
     'ay'    takvim ayı
     'dongu' maaş dönemi — ayın N'i, bir sonraki ayın N-1'ine kadar
     'ozel'  kullanıcının seçtiği serbest tarih aralığı
   bas ve son her zaman dahildir. */
(function (global) {
  'use strict';

  var KEY = 'harcama.v1';
  var listeners = [];
  var state = null;

  /* byGun dizisinin kaçabileceği üst sınır — çok uzun aralıklarda belleği korur */
  var MAKS_GUN = 3700;

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

  /* Gün aritmetiği UTC üzerinden yapılır: yerel saat kaymalarından etkilenmez. */
  function isoUTC(iso) {
    return Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  }

  function utcIso(t) {
    var d = new Date(t);
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }

  function gunEkle(iso, n) { return utcIso(isoUTC(iso) + n * 86400000); }

  function gunFarki(a, b) { return Math.round((isoUTC(b) - isoUTC(a)) / 86400000); }

  /* ---------- dönemler ---------- */

  function donemAy(ym) {
    return { tip: 'ay', ym: ym, bas: ym + '-01', son: ym + '-' + pad2(daysInMonth(ym)) };
  }

  /* gun: ayın kaçında yeni dönem başlıyor (1-28 arası tutulur ki her ayda var olsun) */
  function donemDongu(iso, gun) {
    gun = Math.min(28, Math.max(1, parseInt(gun, 10) || 1));
    var ym = ymOf(iso);
    var basYm = (+iso.slice(8, 10) >= gun) ? ym : shiftMonth(ym, -1);
    var bas = basYm + '-' + pad2(gun);
    var son = gunEkle(shiftMonth(basYm, 1) + '-' + pad2(gun), -1);
    return { tip: 'dongu', gun: gun, bas: bas, son: son };
  }

  function donemOzel(bas, son) {
    if (bas > son) { var t = bas; bas = son; son = t; }
    return { tip: 'ozel', bas: bas, son: son };
  }

  function donemGunSayisi(d) { return gunFarki(d.bas, d.son) + 1; }

  function donemKaydir(d, delta) {
    if (!delta) return d;
    if (d.tip === 'ay') return donemAy(shiftMonth(d.ym, delta));
    if (d.tip === 'dongu') {
      return donemDongu(shiftMonth(ymOf(d.bas), delta) + '-' + pad2(d.gun), d.gun);
    }
    var uzunluk = donemGunSayisi(d);
    return donemOzel(gunEkle(d.bas, delta * uzunluk), gunEkle(d.son, delta * uzunluk));
  }

  /* Verilen tarihi kapsayan, aynı türden dönem. 'ozel' için değişiklik yapmaz. */
  function donemIceren(sablon, iso) {
    if (sablon.tip === 'dongu') return donemDongu(iso, sablon.gun);
    if (sablon.tip === 'ay') return donemAy(ymOf(iso));
    return sablon;
  }

  function bugununDonemi(tip, gun) {
    var b = todayISO();
    return tip === 'dongu' ? donemDongu(b, gun) : donemAy(ymOf(b));
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
      set: { theme: 'auto', donemTipi: 'ay', donguGunu: 15 }
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
    /* dönem ayarları sonradan eklendi: eski yedekler takvim ayıyla açılsın */
    if (s.set.donemTipi !== 'dongu') s.set.donemTipi = 'ay';
    s.set.donguGunu = Math.min(28, Math.max(1, parseInt(s.set.donguGunu, 10) || 15));
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

  function sirala(liste) {
    return liste.sort(function (a, b) {
      if (a.d === b.d) return b.ts - a.ts;
      return a.d < b.d ? 1 : -1;
    });
  }

  /* Aralıktaki işlemler (iki uç dahil), en yeni tarih en üstte. */
  function txForRange(bas, son) {
    return sirala(state.tx.filter(function (t) { return t.d >= bas && t.d <= son; }));
  }

  function txForMonth(ym) {
    var d = donemAy(ym);
    return txForRange(d.bas, d.son);
  }

  function txForDonem(d) { return txForRange(d.bas, d.son); }

  /* ---------- istatistik ---------- */

  function aralikIstatistik(bas, son) {
    var list = txForRange(bas, son);
    var expense = 0, income = 0;
    var byCat = {};
    var byAy = {};

    var gunSayisi = gunFarki(bas, son) + 1;
    var byGun = [];
    var indeks = {};
    if (gunSayisi > 0 && gunSayisi <= MAKS_GUN) {
      for (var i = 0; i < gunSayisi; i++) {
        var iso = gunEkle(bas, i);
        indeks[iso] = i;
        byGun.push({ iso: iso, gun: +iso.slice(8, 10), total: 0 });
      }
    }

    list.forEach(function (t) {
      if (t.t === 'i') { income += t.a; return; }
      expense += t.a;
      byCat[t.c] = (byCat[t.c] || 0) + t.a;
      byAy[ymOf(t.d)] = (byAy[ymOf(t.d)] || 0) + t.a;
      var gi = indeks[t.d];
      if (gi != null) byGun[gi].total += t.a;
    });

    var catList = Object.keys(byCat).map(function (id) {
      return { id: id, cat: cat(id), total: byCat[id] };
    }).sort(function (a, b) { return b.total - a.total; });

    var ayList = Object.keys(byAy).sort().map(function (ym) {
      return { ym: ym, total: byAy[ym] };
    });

    return {
      bas: bas, son: son, gunSayisi: gunSayisi,
      count: list.length,
      expense: expense, income: income, net: income - expense,
      byCat: catList, byGun: byGun, byAy: ayList
    };
  }

  function donemIstatistik(d) {
    var s = aralikIstatistik(d.bas, d.son);
    s.donem = d;
    return s;
  }

  /* Takvim ayı kısayolu — byDay, byGun'un aynısıdır (ay içinde gün no sıralı gelir). */
  function monthStats(ym) {
    var d = donemAy(ym);
    var s = aralikIstatistik(d.bas, d.son);
    s.ym = ym;
    s.byDay = s.byGun;
    return s;
  }

  /* Bu dönem dahil, geriye doğru n dönem. */
  function oncekiDonemler(n, d) {
    var out = [];
    for (var i = n - 1; i >= 0; i--) {
      var p = donemKaydir(d, -i);
      var s = aralikIstatistik(p.bas, p.son);
      out.push({ donem: p, expense: s.expense, income: s.income });
    }
    return out;
  }

  function lastMonths(n, endYm) {
    return oncekiDonemler(n, donemAy(endYm)).map(function (x) {
      return { ym: x.donem.ym, expense: x.expense, income: x.income };
    });
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

  /* Dönemin kapsadığı takvim ayları — sabit giderler aya bağlı tanımlı olduğu için gerek. */
  function donemAylari(d) {
    var aylar = [ymOf(d.bas)];
    var sonYm = ymOf(d.son);
    var guvenlik = 0;
    while (aylar[aylar.length - 1] < sonYm && guvenlik++ < 600) {
      aylar.push(shiftMonth(aylar[aylar.length - 1], 1));
    }
    return aylar;
  }

  /* Döneme düşen sabit gider tekrarları: [{fixed, ym, iso, eklendi}] */
  function fixedOlaylari(d) {
    var aylar = donemAylari(d);
    var out = [];
    fixedList().forEach(function (f) {
      aylar.forEach(function (ym) {
        var gun = Math.min(f.day || 1, daysInMonth(ym));
        var iso = ym + '-' + pad2(gun);
        if (iso < d.bas || iso > d.son) return;
        out.push({ fixed: f, ym: ym, iso: iso, eklendi: appliedIds(ym).indexOf(f.id) !== -1 });
      });
    });
    return out.sort(function (a, b) { return a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0; });
  }

  /* O dönemde henüz eklenmemiş sabit giderler. Dize verilirse takvim ayı sayılır. */
  function pendingFixed(d) {
    if (typeof d === 'string') d = donemAy(d);
    return fixedOlaylari(d).filter(function (x) { return !x.eklendi; });
  }

  /* tutar verilirse yalnız bu kayda uygulanır; sabit kaydın kendisi değişmez */
  function applyOne(f, ym, tutar) {
    var day = Math.min(f.day || 1, daysInMonth(ym));
    var t = {
      id: uid(), t: f.t,
      a: (tutar != null && tutar > 0) ? Math.round(tutar) : f.a,
      c: f.c,
      d: ym + '-' + pad2(day), n: f.name, ts: Date.now()
    };
    state.tx.push(t);
    if (!state.applied[ym]) state.applied[ym] = [];
    state.applied[ym].push({ fixedId: f.id, txId: t.id });
    return t;
  }

  function applyFixed(id, ym, tutar) {
    var f = state.fixed.filter(function (x) { return x.id === id; })[0];
    if (!f || appliedIds(ym).indexOf(id) !== -1) return null;
    var t = applyOne(f, ym, tutar);
    save();
    return t;
  }

  function applyAllFixed(d) {
    if (typeof d === 'string') d = donemAy(d);
    var pend = pendingFixed(d);
    pend.forEach(function (x) { applyOne(x.fixed, x.ym); });
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
    gunEkle: gunEkle, gunFarki: gunFarki,

    donemAy: donemAy, donemDongu: donemDongu, donemOzel: donemOzel,
    donemKaydir: donemKaydir, donemIceren: donemIceren,
    donemGunSayisi: donemGunSayisi, bugununDonemi: bugununDonemi,

    raw: function () { return state; },
    subscribe: function (fn) { listeners.push(fn); },
    cats: cats, cat: cat, addCat: addCat, updateCat: updateCat, deleteCat: deleteCat,
    addTx: addTx, updateTx: updateTx, deleteTx: deleteTx, txOf: txOf,
    txForMonth: txForMonth, txForRange: txForRange, txForDonem: txForDonem,
    monthStats: monthStats, aralikIstatistik: aralikIstatistik, donemIstatistik: donemIstatistik,
    lastMonths: lastMonths, oncekiDonemler: oncekiDonemler,
    fixedList: fixedList, addFixed: addFixed, updateFixed: updateFixed, deleteFixed: deleteFixed,
    fixedOlaylari: fixedOlaylari, pendingFixed: pendingFixed,
    applyFixed: applyFixed, applyAllFixed: applyAllFixed,
    exportObject: exportObject, importJSON: importJSON, mergeJSON: mergeJSON, clearAll: clearAll,
    settings: function () { return state.set; },
    setSetting: function (k, v) { state.set[k] = v; save(); }
  };
})(window);
