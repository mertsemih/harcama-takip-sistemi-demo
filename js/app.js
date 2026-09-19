/* Uygulama mantığı: görünümler, giriş paneli, ayarlar. */
(function (global) {
  'use strict';

  var S = global.Store, F = global.Fmt, C = global.Charts;

  function $(id) { return document.getElementById(id); }
  function yeni(etiket, sinif, metin) {
    var e = document.createElement(etiket);
    if (sinif) e.className = sinif;
    if (metin != null) e.textContent = metin;
    return e;
  }

  var buAy = S.todayISO().slice(0, 7);
  var durum = {
    ym: buAy,
    view: 'ozet',
    arama: '',
    tur: 'hepsi'
  };

  /* ================= bildirim ================= */

  var bildirimZaman = null;
  function bildir(metin) {
    var b = $('bildirim');
    b.textContent = metin;
    b.hidden = false;
    requestAnimationFrame(function () { b.classList.add('acik'); });
    clearTimeout(bildirimZaman);
    bildirimZaman = setTimeout(function () {
      b.classList.remove('acik');
      setTimeout(function () { b.hidden = true; }, 220);
    }, 2200);
  }

  /* ================= tema ================= */

  function temaUygula() {
    var t = S.settings().theme || 'auto';
    if (t === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
    Array.prototype.forEach.call($('tema-secim').children, function (c) {
      c.classList.toggle('chip-secili', c.dataset.tema === t);
    });
  }

  /* ================= gezinme ================= */

  function viewGoster(ad) {
    durum.view = ad;
    ['ozet', 'islemler', 'ayarlar'].forEach(function (v) {
      $('view-' + v).hidden = v !== ad;
    });
    Array.prototype.forEach.call($('tabbar').children, function (t) {
      t.classList.toggle('tab-secili', t.dataset.view === ad);
    });
    $('app-bar').hidden = (ad === 'ayarlar');
    $('fab').hidden = (ad === 'ayarlar');
    global.scrollTo(0, 0);
    ciz();
  }

  function ayDegistir(delta) {
    durum.ym = S.shiftMonth(durum.ym, delta);
    ciz();
  }

  /* ================= çizim ================= */

  function ciz() {
    $('ay-adi').textContent = F.ayAdi(durum.ym);
    // gelecek aya sınırsız gitmenin anlamı yok: bir ay ileriye izin ver
    $('ay-ileri').disabled = S.shiftMonth(durum.ym, -1) >= buAy;

    if (durum.view === 'ozet') cizOzet();
    else if (durum.view === 'islemler') cizIslemler();
    else cizAyarlar();
  }

  /* ---------------- ÖZET ---------------- */

  function cizOzet() {
    var ist = S.monthStats(durum.ym);
    var oncekiYm = S.shiftMonth(durum.ym, -1);
    var onceki = S.monthStats(oncekiYm);

    $('hero-gider').textContent = F.para(ist.expense);

    var delta = $('hero-delta');
    delta.className = 'hero-delta';
    if (!onceki.expense) {
      delta.textContent = ist.expense ? 'Geçen ay kaydın yok, kıyaslama yapamıyorum.' : '';
    } else {
      var yuzde = F.yuzdeFark(ist.expense, onceki.expense);
      if (yuzde === 0) {
        delta.textContent = 'Geçen ayla neredeyse aynı';
      } else {
        var artti = yuzde > 0;
        delta.classList.add(artti ? 'artis' : 'azalis');
        delta.innerHTML = '<span class="ok">' + (artti ? '↑' : '↓') + '</span>' +
          '<span>Geçen aya göre %' + Math.abs(yuzde) + ' ' +
          (artti ? 'daha fazla' : 'daha az') + '</span>';
      }
    }

    $('kpi-gelir').textContent = F.para(ist.income);
    var kalan = $('kpi-kalan');
    kalan.textContent = F.para(ist.net, { isaret: ist.net > 0 });
    kalan.className = 'kpi-deger ' + (ist.net < 0 ? 'eksi' : ist.net > 0 ? 'arti' : '');

    cizSabitKart();
    cizButceKart(ist);
    cizKategoriListe(ist);

    C.temizleKayit();

    /* gün gün harcama */
    var gunVeri = ist.byDay.map(function (g) {
      var iso = durum.ym + '-' + S.pad2(g.day);
      return {
        key: g.day, label: String(g.day), value: g.total,
        tipTitle: F.tarih(iso, { hamTarih: true, gunAdi: true }),
        tipValue: F.para(g.total)
      };
    });
    var g1 = C.sutun($('grafik-gunluk'), {
      data: gunVeri,
      height: 168,
      ariaLabel: F.ayAdi(durum.ym) + ' ayının günlük harcaması',
      empty: 'Bu ay henüz harcama girmemişsin.',
      // 1 ve beşin katları: bitişik etiketlerin üst üste binmesini engeller
      labelEvery: function (d) { return d.key === 1 || d.key % 5 === 0; }
    });
    C.kaydet(g1.yenidenCiz);

    /* son 6 ay */
    var aylar = S.lastMonths(6, durum.ym).map(function (m) {
      return {
        key: m.ym, label: F.ayKisa(m.ym), value: m.expense,
        tipTitle: F.ayAdi(m.ym), tipValue: F.para(m.expense)
      };
    });
    var g2 = C.sutun($('grafik-aylar'), {
      data: aylar,
      height: 168,
      emphasisKey: durum.ym,
      ariaLabel: 'Son 6 ayın harcaması',
      empty: 'Kıyaslamak için birkaç aylık kayıt gerekiyor.',
      labelEvery: function () { return true; }
    });
    C.kaydet(g2.yenidenCiz);
  }

  function cizSabitKart() {
    var bekleyen = S.pendingFixed(durum.ym);
    var kart = $('kart-sabit');
    if (!bekleyen.length) { kart.hidden = true; return; }
    kart.hidden = false;

    var liste = $('sabit-bekleyen');
    liste.innerHTML = '';
    bekleyen.forEach(function (f) {
      var li = document.createElement('li');
      var sol = yeni('div', 'sol');
      sol.appendChild(yeni('span', 'emoji', S.cat(f.c).emoji));
      sol.appendChild(yeni('span', null, f.name));
      li.appendChild(sol);

      var sag = yeni('div', 'sol');
      sag.appendChild(yeni('span', 'tutar', F.para(f.a)));
      var dugme = yeni('button', 'dugme-ince', '+ Ekle');
      dugme.type = 'button';
      dugme.addEventListener('click', function () {
        S.applyFixed(f.id, durum.ym);
        bildir(f.name + ' eklendi');
      });
      sag.appendChild(dugme);
      li.appendChild(sag);
      liste.appendChild(li);
    });
  }

  function cizButceKart(ist) {
    var butceli = S.cats('e').filter(function (c) { return c.budget; });
    var kart = $('kart-butce');
    if (!butceli.length) { kart.hidden = true; return; }
    kart.hidden = false;

    var kap = $('butce-liste');
    kap.innerHTML = '';
    var harcanan = {};
    ist.byCat.forEach(function (x) { harcanan[x.id] = x.total; });

    butceli.forEach(function (c) {
      var harcama = harcanan[c.id] || 0;
      var oran = harcama / c.budget;
      var yuzde = Math.round(oran * 100);
      var seviye = oran > 1 ? 'kritik' : oran >= 0.7 ? 'uyari' : 'iyi';
      var soz = oran > 1 ? 'bütçe aşıldı' : oran >= 0.7 ? 'sınıra yaklaştın' : 'bütçe içinde';

      var satir = yeni('div', 'kat-satir olcer ' + seviye);

      var ust = yeni('div', 'kat-ust');
      var ad = yeni('div', 'kat-ad');
      ad.appendChild(yeni('span', 'emoji', c.emoji));
      ad.appendChild(yeni('span', 'metin', c.name));
      ust.appendChild(ad);
      var tutar = yeni('div', 'kat-tutar');
      tutar.textContent = F.para(harcama, { tamsayi: true });
      var bolu = yeni('span', 'kat-yuzde', '/ ' + F.para(c.budget, { tamsayi: true }));
      tutar.appendChild(bolu);
      ust.appendChild(tutar);
      satir.appendChild(ust);

      var ray = yeni('div', 'kat-ray');
      var dolgu = yeni('div', 'kat-dolgu');
      dolgu.style.width = Math.min(100, yuzde) + '%';
      ray.appendChild(dolgu);
      satir.appendChild(ray);

      /* durum rengi tek başına anlam taşımasın diye nokta + yazı birlikte */
      var d = yeni('div', 'olcer-durum');
      d.appendChild(yeni('span', 'olcer-nokta'));
      d.appendChild(yeni('span', null, '%' + yuzde + ' — ' + soz +
        (oran > 1 ? ' (' + F.para(harcama - c.budget, { tamsayi: true }) + ' fazla)' : '')));
      satir.appendChild(d);

      kap.appendChild(satir);
    });
  }

  function cizKategoriListe(ist) {
    var kap = $('kategori-liste');
    kap.innerHTML = '';
    $('kategori-sayi').textContent = ist.count ? ist.count + ' işlem' : '';

    if (!ist.byCat.length) {
      var bos = yeni('p', 'chart-empty', 'Bu ay harcama kaydı yok. Sağ alttaki + ile ekleyebilirsin.');
      kap.appendChild(bos);
      return;
    }

    var enBuyuk = ist.byCat[0].total;
    ist.byCat.forEach(function (x) {
      var satir = yeni('div', 'kat-satir');

      var ust = yeni('div', 'kat-ust');
      var ad = yeni('div', 'kat-ad');
      ad.appendChild(yeni('span', 'emoji', x.cat.emoji));
      ad.appendChild(yeni('span', 'metin', x.cat.name));
      ust.appendChild(ad);

      var tutar = yeni('div', 'kat-tutar');
      tutar.textContent = F.para(x.total, { tamsayi: true });
      tutar.appendChild(yeni('span', 'kat-yuzde',
        '%' + Math.round((x.total / ist.expense) * 100)));
      ust.appendChild(tutar);
      satir.appendChild(ust);

      var ray = yeni('div', 'kat-ray');
      var dolgu = yeni('div', 'kat-dolgu');
      dolgu.style.width = Math.max(2, (x.total / enBuyuk) * 100) + '%';
      ray.appendChild(dolgu);
      satir.appendChild(ray);

      kap.appendChild(satir);
    });
  }

  /* ---------------- İŞLEMLER ---------------- */

  function cizIslemler() {
    var hepsi = S.txForMonth(durum.ym);
    var q = durum.arama.toLocaleLowerCase('tr');

    var liste = hepsi.filter(function (t) {
      if (durum.tur !== 'hepsi' && t.t !== durum.tur) return false;
      if (!q) return true;
      var c = S.cat(t.c);
      return (t.n || '').toLocaleLowerCase('tr').indexOf(q) > -1 ||
             c.name.toLocaleLowerCase('tr').indexOf(q) > -1;
    });

    var gider = 0, gelir = 0;
    liste.forEach(function (t) { if (t.t === 'i') gelir += t.a; else gider += t.a; });
    $('liste-ozet').textContent = liste.length
      ? liste.length + ' işlem · ' + F.para(gider) + ' gider' + (gelir ? ' · ' + F.para(gelir) + ' gelir' : '')
      : '';

    var kap = $('islem-liste');
    kap.innerHTML = '';

    if (!liste.length) {
      var bos = yeni('div', 'bos-durum');
      bos.innerHTML = '<span class="buyuk">🧾</span>' +
        (hepsi.length ? 'Bu filtreye uyan işlem yok.'
                      : F.ayAdi(durum.ym) + ' ayına ait kayıt yok.<br>Sağ alttaki + ile ekle.');
      kap.appendChild(bos);
      return;
    }

    var suankiGun = null;
    liste.forEach(function (t) {
      if (t.d !== suankiGun) {
        suankiGun = t.d;
        var gunToplam = liste.reduce(function (s, x) {
          return s + (x.d === t.d && x.t === 'e' ? x.a : 0);
        }, 0);
        var bas = yeni('div', 'gun-basligi');
        bas.appendChild(yeni('span', null, F.tarih(t.d, { gunAdi: true })));
        if (gunToplam) bas.appendChild(yeni('span', 'gun-toplam', F.para(gunToplam)));
        kap.appendChild(bas);
      }
      kap.appendChild(islemSatiri(t));
    });
  }

  function islemSatiri(t) {
    var c = S.cat(t.c);
    var b = yeni('button', 'islem');
    b.type = 'button';

    var ikon = yeni('div', 'ikon', c.emoji);
    b.appendChild(ikon);

    var orta = yeni('div', 'orta');
    orta.appendChild(yeni('div', 'ad', c.name));
    if (t.n && t.n !== c.name) orta.appendChild(yeni('div', 'alt', t.n));
    b.appendChild(orta);

    var tutar = yeni('div', 'tutar' + (t.t === 'i' ? ' gelir' : ''));
    tutar.textContent = (t.t === 'i' ? '+' : '−') + F.para(t.a).replace('-', '');
    b.appendChild(tutar);

    b.addEventListener('click', function () { girisAc(t.id); });
    return b;
  }

  /* ---------------- AYARLAR ---------------- */

  function cizAyarlar() {
    var kap = $('ayar-kategoriler');
    kap.innerHTML = '';
    var ham = S.raw();

    S.cats().forEach(function (c) {
      var kullanim = ham.tx.filter(function (t) { return t.c === c.id; }).length;
      var b = yeni('button', 'ayar-satir');
      b.type = 'button';
      b.appendChild(yeni('span', 'emoji', c.emoji));
      var orta = yeni('div', 'orta');
      orta.appendChild(yeni('div', 'ad', c.name));
      var altMetin = (c.type === 'i' ? 'Gelir' : 'Gider') +
        (c.budget ? ' · bütçe ' + F.para(c.budget, { tamsayi: true }) : '') +
        ' · ' + kullanim + ' işlem';
      orta.appendChild(yeni('div', 'alt', altMetin));
      b.appendChild(orta);
      b.appendChild(yeni('span', 'sag', 'Düzenle'));
      b.addEventListener('click', function () { kategoriFormu(c); });
      kap.appendChild(b);
    });

    var sKap = $('ayar-sabitler');
    sKap.innerHTML = '';
    var sabitler = S.fixedList();
    if (!sabitler.length) {
      sKap.appendChild(yeni('p', 'chart-empty', 'Henüz sabit gider yok.'));
    } else {
      sabitler.forEach(function (f) {
        var b = yeni('button', 'ayar-satir');
        b.type = 'button';
        b.appendChild(yeni('span', 'emoji', S.cat(f.c).emoji));
        var orta = yeni('div', 'orta');
        orta.appendChild(yeni('div', 'ad', f.name));
        orta.appendChild(yeni('div', 'alt',
          'Her ayın ' + f.day + '. günü · ' + (f.t === 'i' ? 'gelir' : 'gider')));
        b.appendChild(orta);
        b.appendChild(yeni('span', 'sag', F.para(f.a, { tamsayi: true })));
        b.addEventListener('click', function () { sabitFormu(f); });
        sKap.appendChild(b);
      });
    }

    var boyut = 0;
    try { boyut = (localStorage.getItem('harcama.v1') || '').length; } catch (e) { boyut = 0; }
    $('veri-durum').textContent = ham.tx.length + ' işlem · ' + S.cats().length +
      ' kategori · yaklaşık ' + Math.max(1, Math.round(boyut / 1024)) + ' KB';

    temaUygula();
  }

  /* ================= alt panel altyapısı ================= */

  var acikPanel = null;

  function panelAc(id) {
    var p = $(id);
    var perde = $('perde');
    perde.hidden = false;
    p.hidden = false;
    requestAnimationFrame(function () {
      perde.classList.add('acik');
      p.classList.add('acik');
    });
    acikPanel = p;
    document.body.style.overflow = 'hidden';
  }

  function panelKapat() {
    if (!acikPanel) return;
    var p = acikPanel, perde = $('perde');
    p.classList.remove('acik');
    perde.classList.remove('acik');
    acikPanel = null;
    document.body.style.overflow = '';
    setTimeout(function () {
      p.hidden = true;
      if (!acikPanel) perde.hidden = true;
    }, 260);
  }

  /* ================= giriş paneli ================= */

  var giris = null;

  function bosGiris() {
    var t = S.settings().sonTur === 'i' ? 'i' : 'e';
    return {
      id: null, tur: t, tam: '', ondalik: null,
      cat: S.settings()['sonKat_' + t] || null,
      tarih: S.todayISO(), not: ''
    };
  }

  function girisAc(txId) {
    if (txId) {
      var t = S.txOf(txId);
      if (!t) return;
      var lira = Math.floor(t.a / 100), kurus = t.a % 100;
      giris = {
        id: t.id, tur: t.t,
        tam: String(lira),
        ondalik: kurus ? S.pad2(kurus) : null,
        cat: t.c, tarih: t.d, not: t.n || ''
      };
    } else {
      giris = bosGiris();
    }
    $('giris-sil').hidden = !txId;
    $('giris-not').value = giris.not;
    $('giris-tarih').value = giris.tarih;
    girisYenile();
    panelAc('panel-giris');
  }

  function girisTutar() {
    var lira = parseInt(giris.tam || '0', 10) || 0;
    var kurus = giris.ondalik == null ? 0 : parseInt((giris.ondalik + '00').slice(0, 2), 10);
    return lira * 100 + kurus;
  }

  function girisYenile() {
    /* tutar göstergesi */
    var g = $('tutar-goster');
    var bos = giris.tam === '' && giris.ondalik == null;
    g.classList.toggle('bos', bos);
    if (bos) {
      g.textContent = '0';
    } else {
      var lira = parseInt(giris.tam || '0', 10) || 0;
      var metin = new Intl.NumberFormat('tr-TR').format(lira);
      if (giris.ondalik != null) metin += ',' + giris.ondalik;
      g.textContent = metin;
    }

    /* tür seçimi */
    Array.prototype.forEach.call($('giris-tur').children, function (c) {
      c.classList.toggle('chip-secili', c.dataset.tur === giris.tur);
    });

    /* kategoriler */
    var izgara = $('giris-kategoriler');
    izgara.innerHTML = '';
    var liste = S.cats(giris.tur);
    if (giris.cat && !liste.some(function (c) { return c.id === giris.cat; })) giris.cat = null;
    liste.forEach(function (c) {
      var b = yeni('button', 'kat-dugme' + (giris.cat === c.id ? ' secili' : ''));
      b.type = 'button';
      b.appendChild(yeni('span', 'emoji', c.emoji));
      b.appendChild(yeni('span', 'ad', c.name));
      b.addEventListener('click', function () {
        giris.cat = c.id;
        girisYenile();
      });
      izgara.appendChild(b);
    });

    /* hızlı tarih */
    var fark = gunFarki(giris.tarih);
    Array.prototype.forEach.call($('giris-tarih-hizli').children, function (c) {
      c.classList.toggle('chip-secili', +c.dataset.gun === fark);
    });
    $('giris-tarih').value = giris.tarih;
  }

  function gunFarki(iso) {
    var b = new Date(), d = new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
    var b0 = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((b0 - d) / 86400000);
  }

  function tusBas(tus) {
    if (tus === 'sil') {
      if (giris.ondalik) giris.ondalik = giris.ondalik.slice(0, -1);
      else if (giris.ondalik === '') giris.ondalik = null;
      else giris.tam = giris.tam.slice(0, -1);
    } else if (tus === ',') {
      if (giris.ondalik == null) giris.ondalik = '';
    } else {
      if (giris.ondalik != null) {
        if (giris.ondalik.length < 2) giris.ondalik += tus;
      } else {
        if (giris.tam.length >= 9) return;
        giris.tam = (giris.tam === '0' ? '' : giris.tam) + tus;
      }
    }
    girisYenile();
  }

  function girisKaydet() {
    var tutar = girisTutar();
    if (tutar <= 0) { bildir('Önce tutarı gir'); return; }
    if (!giris.cat) { bildir('Bir kategori seç'); return; }

    var veri = {
      t: giris.tur, a: tutar, c: giris.cat,
      d: giris.tarih, n: $('giris-not').value
    };

    if (giris.id) {
      S.updateTx(giris.id, veri);
      bildir('Güncellendi');
    } else {
      S.addTx(veri);
      bildir(F.para(tutar) + ' kaydedildi');
    }

    S.setSetting('sonTur', giris.tur);
    S.setSetting('sonKat_' + giris.tur, giris.cat);

    /* kaydedilen ay görüntülenen aydan farklıysa oraya geç */
    var hedefAy = giris.tarih.slice(0, 7);
    if (hedefAy !== durum.ym) durum.ym = hedefAy;

    panelKapat();
    ciz();
  }

  /* ================= genel form paneli ================= */

  var formKaydet = null;

  function formAc(baslik, alanlar, kaydetFn, silFn) {
    $('form-baslik').textContent = baslik;
    var govde = $('form-govde');
    govde.innerHTML = '';
    alanlar.forEach(function (a) { govde.appendChild(a); });

    formKaydet = kaydetFn;
    var silDugme = $('form-sil');
    silDugme.hidden = !silFn;
    silDugme.onclick = silFn || null;

    panelAc('panel-form');
  }

  function alan(etiketMetni, kontrol, ipucu) {
    var d = yeni('div', 'form-alan');
    if (etiketMetni) {
      var l = yeni('label', null, etiketMetni);
      if (kontrol.id) l.htmlFor = kontrol.id;
      d.appendChild(l);
    }
    d.appendChild(kontrol);
    if (ipucu) d.appendChild(yeni('p', 'form-ipucu', ipucu));
    return d;
  }

  function metinGirdi(id, deger, yerTutucu, mod) {
    var i = document.createElement('input');
    i.type = 'text';
    i.id = id;
    i.className = 'girdi';
    i.value = deger || '';
    i.placeholder = yerTutucu || '';
    i.autocomplete = 'off';
    if (mod) i.inputMode = mod;
    return i;
  }

  var EMOJILER = ['🛒', '🍔', '☕', '🚌', '⛽', '🏠', '💡', '📱', '🎮', '👕',
                  '💊', '📚', '🎁', '✈️', '🐾', '💳', '🧾', '🍺', '💇', '🏋️',
                  '🚗', '🧼', '🎬', '🌐', '💼', '💰', '➕', '🎓', '👶', '🔧',
                  '🏥', '🎵'];

  function emojiSecici(secili, degisti) {
    var g = yeni('div', 'emoji-izgara');
    EMOJILER.forEach(function (e) {
      var b = yeni('button', 'emoji-dugme' + (e === secili ? ' secili' : ''), e);
      b.type = 'button';
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(g.children, function (x) { x.classList.remove('secili'); });
        b.classList.add('secili');
        degisti(e);
      });
      g.appendChild(b);
    });
    return g;
  }

  function kategoriFormu(mevcut) {
    var yeniMi = !mevcut;
    var taslak = {
      name: mevcut ? mevcut.name : '',
      emoji: mevcut ? mevcut.emoji : '🛒',
      type: mevcut ? mevcut.type : 'e',
      budget: mevcut ? mevcut.budget : null
    };

    var adGirdi = metinGirdi('f-ad', taslak.name, 'Örn. Market');
    var butceGirdi = metinGirdi('f-butce',
      taslak.budget ? String(taslak.budget / 100).replace('.', ',') : '', 'Boş bırakılabilir', 'decimal');

    var alanlar = [alan('Kategori adı', adGirdi)];

    alanlar.push(alan('Simge', emojiSecici(taslak.emoji, function (e) { taslak.emoji = e; })));

    if (yeniMi) {
      var turSatir = yeni('div', 'chip-satir');
      [['e', 'Gider'], ['i', 'Gelir']].forEach(function (p) {
        var b = yeni('button', 'chip' + (taslak.type === p[0] ? ' chip-secili' : ''), p[1]);
        b.type = 'button';
        b.addEventListener('click', function () {
          taslak.type = p[0];
          Array.prototype.forEach.call(turSatir.children, function (x) { x.classList.remove('chip-secili'); });
          b.classList.add('chip-secili');
        });
        turSatir.appendChild(b);
      });
      alanlar.push(alan('Tür', turSatir));
    }

    if (taslak.type === 'e') {
      alanlar.push(alan('Aylık bütçe (₺)', butceGirdi,
        'Girersen özet ekranında bu kategori için çubuk çıkar.'));
    }

    formAc(yeniMi ? 'Yeni kategori' : 'Kategoriyi düzenle', alanlar, function () {
      var ad = adGirdi.value.trim();
      if (!ad) { bildir('Kategori adı gerekli'); return; }
      var butce = F.metindenKurus(butceGirdi.value);
      var veri = { name: ad, emoji: taslak.emoji, budget: butce > 0 ? butce : null };
      if (yeniMi) {
        veri.type = taslak.type;
        S.addCat(veri);
        bildir(ad + ' eklendi');
      } else {
        S.updateCat(mevcut.id, veri);
        bildir('Kaydedildi');
      }
      panelKapat();
      ciz();
    }, yeniMi ? null : function () {
      var sonuc = confirm('"' + mevcut.name + '" silinsin mi?\n\n' +
        'Bu kategorideki işlemler silinmez, "Diğer" kategorisine taşınır.');
      if (!sonuc) return;
      var tasinan = S.deleteCat(mevcut.id);
      if (tasinan === -1) { bildir('Bu kategori silinemez'); return; }
      panelKapat();
      bildir(tasinan ? tasinan + ' işlem Diğer\'e taşındı' : 'Silindi');
      ciz();
    });
  }

  function sabitFormu(mevcut) {
    var yeniMi = !mevcut;
    var taslak = { t: mevcut ? mevcut.t : 'e', c: mevcut ? mevcut.c : null };

    var adGirdi = metinGirdi('s-ad', mevcut ? mevcut.name : '', 'Örn. Kira');
    var tutarGirdi = metinGirdi('s-tutar',
      mevcut ? String(mevcut.a / 100).replace('.', ',') : '', '0,00', 'decimal');

    var secim = document.createElement('select');
    secim.id = 's-kat';
    secim.className = 'girdi';
    function secimDoldur() {
      secim.innerHTML = '';
      S.cats(taslak.t).forEach(function (c) {
        var o = document.createElement('option');
        o.value = c.id;
        o.textContent = c.emoji + '  ' + c.name;
        if (taslak.c === c.id) o.selected = true;
        secim.appendChild(o);
      });
      if (!taslak.c && secim.options.length) taslak.c = secim.options[0].value;
    }
    secimDoldur();
    secim.addEventListener('change', function () { taslak.c = secim.value; });

    var gunGirdi = document.createElement('input');
    gunGirdi.type = 'number';
    gunGirdi.id = 's-gun';
    gunGirdi.className = 'girdi';
    gunGirdi.min = '1';
    gunGirdi.max = '28';
    gunGirdi.value = mevcut ? mevcut.day : 1;

    var turSatir = yeni('div', 'chip-satir');
    [['e', 'Gider'], ['i', 'Gelir']].forEach(function (p) {
      var b = yeni('button', 'chip' + (taslak.t === p[0] ? ' chip-secili' : ''), p[1]);
      b.type = 'button';
      b.addEventListener('click', function () {
        taslak.t = p[0];
        taslak.c = null;
        Array.prototype.forEach.call(turSatir.children, function (x) { x.classList.remove('chip-secili'); });
        b.classList.add('chip-secili');
        secimDoldur();
      });
      turSatir.appendChild(b);
    });

    var alanlar = [
      alan('Adı', adGirdi),
      alan('Tutar (₺)', tutarGirdi),
      alan('Tür', turSatir),
      alan('Kategori', secim),
      alan('Ayın kaçıncı günü', gunGirdi, '1–28 arası. Özet ekranından tek tuşla o aya eklersin.')
    ];

    formAc(yeniMi ? 'Yeni sabit gider' : 'Sabit gideri düzenle', alanlar, function () {
      var ad = adGirdi.value.trim();
      var tutar = F.metindenKurus(tutarGirdi.value);
      if (!ad) { bildir('Ad gerekli'); return; }
      if (tutar <= 0) { bildir('Tutar gerekli'); return; }
      var veri = { name: ad, a: tutar, c: taslak.c, t: taslak.t, day: +gunGirdi.value || 1 };
      if (yeniMi) S.addFixed(veri); else S.updateFixed(mevcut.id, veri);
      panelKapat();
      bildir('Kaydedildi');
      ciz();
    }, yeniMi ? null : function () {
      if (!confirm('"' + mevcut.name + '" sabit giderlerden silinsin mi?\n\n' +
                   'Daha önce aylara eklenmiş kayıtlar silinmez.')) return;
      S.deleteFixed(mevcut.id);
      panelKapat();
      bildir('Silindi');
      ciz();
    });
  }

  /* ================= yedekleme ================= */

  function yedekIndir() {
    var metin = JSON.stringify(S.exportObject(), null, 2);
    var adi = 'harcama-yedek-' + S.todayISO() + '.json';
    var blob = new Blob([metin], { type: 'application/json' });

    /* Telefonda paylaş menüsü daha kullanışlı; yoksa normal indirmeye düşer. */
    if (global.navigator.canShare) {
      try {
        var dosya = new File([blob], adi, { type: 'application/json' });
        if (navigator.canShare({ files: [dosya] })) {
          navigator.share({ files: [dosya], title: adi })
            .then(function () { bildir('Yedek paylaşıldı'); })
            .catch(function () { /* kullanıcı vazgeçti */ });
          return;
        }
      } catch (e) { /* paylaşım desteklenmiyor, indirmeye düş */ }
    }

    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = adi;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    bildir('Yedek indirildi');
  }

  function yedekYukle(dosya) {
    var okuyucu = new FileReader();
    okuyucu.onload = function () {
      var metin = String(okuyucu.result);
      var mevcutSayi = S.raw().tx.length;
      try {
        if (mevcutSayi > 0) {
          var birlestir = confirm(
            'Şu an ' + mevcutSayi + ' işlem kayıtlı.\n\n' +
            'TAMAM: yedekteki kayıtları mevcutların üstüne EKLE\n' +
            'İPTAL: her şeyi yedekle DEĞİŞTİR (mevcut veriler silinir)');
          if (birlestir) {
            var eklenen = S.mergeJSON(metin);
            bildir(eklenen + ' yeni işlem eklendi');
          } else {
            if (!confirm('Emin misin? Şu anki ' + mevcutSayi + ' işlem silinecek.')) return;
            var sayi = S.importJSON(metin);
            bildir(sayi + ' işlem geri yüklendi');
          }
        } else {
          var n = S.importJSON(metin);
          bildir(n + ' işlem geri yüklendi');
        }
        durum.ym = buAy;
        ciz();
      } catch (e) {
        alert('Yedek okunamadı: ' + e.message);
      }
    };
    okuyucu.readAsText(dosya);
  }

  /* ================= olay bağlama ================= */

  function bagla() {
    $('ay-geri').addEventListener('click', function () { ayDegistir(-1); });
    $('ay-ileri').addEventListener('click', function () { ayDegistir(1); });
    $('ay-adi').addEventListener('click', function () {
      durum.ym = buAy;
      ciz();
      bildir(F.ayAdi(buAy) + ' ayına dönüldü');
    });

    Array.prototype.forEach.call($('tabbar').children, function (t) {
      t.addEventListener('click', function () { viewGoster(t.dataset.view); });
    });

    $('fab').addEventListener('click', function () { girisAc(null); });

    /* --- giriş paneli --- */
    $('giris-kapat').addEventListener('click', panelKapat);
    $('perde').addEventListener('click', panelKapat);
    $('giris-kaydet').addEventListener('click', girisKaydet);

    $('giris-sil').addEventListener('click', function () {
      if (!giris.id) return;
      if (!confirm('Bu işlem silinsin mi?')) return;
      S.deleteTx(giris.id);
      panelKapat();
      bildir('Silindi');
      ciz();
    });

    $('tuslar').addEventListener('click', function (e) {
      var b = e.target.closest('.tus');
      if (b) tusBas(b.dataset.tus);
    });

    $('giris-tur').addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      giris.tur = b.dataset.tur;
      giris.cat = S.settings()['sonKat_' + giris.tur] || null;
      girisYenile();
    });

    $('giris-tarih-hizli').addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      var d = new Date();
      d.setDate(d.getDate() - (+b.dataset.gun));
      giris.tarih = d.getFullYear() + '-' + S.pad2(d.getMonth() + 1) + '-' + S.pad2(d.getDate());
      girisYenile();
    });

    $('giris-tarih').addEventListener('change', function () {
      if (this.value) { giris.tarih = this.value; girisYenile(); }
    });

    /* --- form paneli --- */
    $('form-kapat').addEventListener('click', panelKapat);
    $('form-kaydet').addEventListener('click', function () { if (formKaydet) formKaydet(); });

    /* --- işlemler --- */
    $('arama').addEventListener('input', function () {
      durum.arama = this.value.trim();
      cizIslemler();
    });
    $('filtre-tur').addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      durum.tur = b.dataset.tur;
      Array.prototype.forEach.call(this.children, function (x) {
        x.classList.toggle('chip-secili', x === b);
      });
      cizIslemler();
    });

    /* --- ayarlar --- */
    $('tema-secim').addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      S.setSetting('theme', b.dataset.tema);
      temaUygula();
    });
    $('kategori-ekle').addEventListener('click', function () { kategoriFormu(null); });
    $('sabit-ekle').addEventListener('click', function () { sabitFormu(null); });
    $('sabit-hepsi').addEventListener('click', function () {
      var n = S.applyAllFixed(durum.ym);
      bildir(n + ' sabit gider eklendi');
    });

    $('yedek-indir').addEventListener('click', yedekIndir);
    $('yedek-yukle').addEventListener('click', function () { $('yedek-dosya').click(); });
    $('yedek-dosya').addEventListener('change', function () {
      if (this.files && this.files[0]) yedekYukle(this.files[0]);
      this.value = '';
    });

    $('hepsini-sil').addEventListener('click', function () {
      if (!confirm('BÜTÜN veriler silinecek. Emin misin?')) return;
      if (!confirm('Son kez soruyorum: geri alınamaz. Önce yedek indirmek ister misin?\n\n' +
                   'TAMAM dersen her şey silinir.')) return;
      S.clearAll();
      durum.ym = buAy;
      bildir('Her şey silindi');
      ciz();
    });

    /* Escape ile panel kapansın (masaüstü) */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && acikPanel) panelKapat();
    });

    S.subscribe(function () {
      if (!acikPanel) ciz();
      else if (durum.view === 'ozet') cizSabitKart();
    });
  }

  /* ================= başlangıç ================= */

  function basla() {
    temaUygula();
    bagla();
    viewGoster('ozet');

    /* Tarayıcıya "bu verileri kendiliğinden silme" de (destekleyen yerlerde) */
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persisted().then(function (kalici) {
        if (!kalici) navigator.storage.persist();
      }).catch(function () { /* önemli değil */ });
    }

    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(function () { /* çevrimdışı olmadan da çalışır */ });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', basla);
  } else {
    basla();
  }
})(window);
