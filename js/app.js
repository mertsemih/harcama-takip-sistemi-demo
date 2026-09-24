/* Uygulama mantığı: görünümler, giriş paneli, dönem seçimi, ayarlar. */
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

  var durum = {
    donem: null,      // basla() içinde ayarlardan kurulur
    view: 'ozet',
    arama: '',
    tur: 'hepsi'
  };

  function varsayilanDonem() {
    var a = S.settings();
    return S.bugununDonemi(a.donemTipi === 'dongu' ? 'dongu' : 'ay', a.donguGunu || 15);
  }

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

  function donemKaydir(delta) {
    durum.donem = S.donemKaydir(durum.donem, delta);
    ciz();
  }

  /* ================= çizim ================= */

  function ciz() {
    $('ay-adi-metin').textContent = F.donemEtiket(durum.donem);
    // başlangıcı bugünü geçen bir döneme bakmanın anlamı yok: bir dönem ileri yeter
    $('ay-ileri').disabled = durum.donem.bas > S.todayISO();

    if (durum.view === 'ozet') cizOzet();
    else if (durum.view === 'islemler') cizIslemler();
    else cizAyarlar();
  }

  /* ---------------- ÖZET ---------------- */

  function cizOzet() {
    var d = durum.donem;
    var bugun = S.todayISO();
    var ist = S.donemIstatistik(d);
    var onceki = S.donemIstatistik(S.donemKaydir(d, -1));
    var bugunIcinde = d.bas <= bugun && bugun <= d.son;

    $('hero-etiket').textContent = bugunIcinde
      ? (d.tip === 'ay' ? 'Bu ay harcanan' : 'Bu dönemde harcanan')
      : 'Toplam harcama';
    $('hero-gider').textContent = F.para(ist.expense);

    var oncekiSoz = d.tip === 'ay' ? 'Geçen aya' : 'Önceki döneme';
    var delta = $('hero-delta');
    delta.className = 'hero-delta';
    if (!onceki.expense) {
      delta.textContent = ist.expense
        ? (d.tip === 'ay' ? 'Geçen ay kaydın yok, kıyaslama yapamıyorum.'
                          : 'Önceki dönemde kaydın yok, kıyaslama yapamıyorum.')
        : '';
    } else {
      var yuzde = F.yuzdeFark(ist.expense, onceki.expense);
      if (yuzde === 0) {
        delta.textContent = oncekiSoz + ' göre neredeyse aynı';
      } else {
        var artti = yuzde > 0;
        delta.classList.add(artti ? 'artis' : 'azalis');
        delta.innerHTML = '<span class="ok">' + (artti ? '↑' : '↓') + '</span>' +
          '<span>' + oncekiSoz + ' göre %' + Math.abs(yuzde) + ' ' +
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
    cizZamanGrafigi(ist);
    cizDonemGrafigi();
  }

  function cizSabitKart() {
    var bekleyen = S.pendingFixed(durum.donem);
    var kart = $('kart-sabit');
    if (!bekleyen.length) { kart.hidden = true; return; }
    kart.hidden = false;
    $('baslik-sabit').textContent = durum.donem.tip === 'ay'
      ? 'Bu ayın sabit kayıtları'
      : 'Bu dönemin sabit kayıtları';

    var liste = $('sabit-bekleyen');
    liste.innerHTML = '';
    bekleyen.forEach(function (x) {
      var f = x.fixed;
      var li = document.createElement('li');

      var sol = yeni('div', 'sol');
      sol.appendChild(yeni('span', 'emoji', S.cat(f.c).emoji));
      var ad = yeni('div', 'sabit-ad');
      ad.appendChild(yeni('div', null, f.name));
      ad.appendChild(yeni('div', 'sabit-tarih', F.tarihKisa(x.iso)));
      sol.appendChild(ad);
      li.appendChild(sol);

      var sag = yeni('div', 'sol');
      sag.appendChild(yeni('span', 'tutar ' + (f.t === 'i' ? 'gelir' : 'gider'),
        F.isaretliPara(f.a, f.t)));
      var kalem = yeni('button', 'satir-ikon');
      kalem.type = 'button';
      kalem.setAttribute('aria-label', f.name + ' tutarını değiştirerek ekle');
      kalem.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>';
      kalem.addEventListener('click', function () { sabitAyarla(x); });
      sag.appendChild(kalem);

      var dugme = yeni('button', 'dugme-ince', '+ Ekle');
      dugme.type = 'button';
      dugme.addEventListener('click', function () {
        S.applyFixed(f.id, x.ym);
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
    /* Bütçeler aylık tanımlı — serbest aralıkta kıyaslamak yanıltıcı olur */
    if (!butceli.length || durum.donem.tip === 'ozel') { kart.hidden = true; return; }
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
      tutar.appendChild(yeni('span', 'kat-yuzde', '/ ' + F.para(c.budget, { tamsayi: true })));
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
      kap.appendChild(yeni('p', 'chart-empty',
        'Bu dönemde harcama kaydı yok. Sağ alttaki + ile ekleyebilirsin.'));
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

  /* Dönemdeki her ay, harcaması olmasa bile sütun olarak yer alsın */
  function aylikDizi(ist) {
    var harita = {};
    ist.byAy.forEach(function (a) { harita[a.ym] = a.total; });
    var out = [];
    var ym = S.ymOf(ist.bas), sonYm = S.ymOf(ist.son), guvenlik = 0;
    while (guvenlik++ < 600) {
      out.push({ ym: ym, total: harita[ym] || 0 });
      if (ym >= sonYm) break;
      ym = S.shiftMonth(ym, 1);
    }
    return out;
  }

  /* Dönem 2 aydan uzunsa gün gün çizmek okunmaz olur; ay ay toplanır. */
  function cizZamanGrafigi(ist) {
    var gunlukMu = ist.gunSayisi <= 62 && ist.byGun.length > 0;
    $('baslik-gunluk').textContent = gunlukMu ? 'Gün gün harcama' : 'Ay ay harcama';

    var veri;
    if (gunlukMu) {
      veri = ist.byGun.map(function (g) {
        return {
          key: g.iso, label: String(g.gun), value: g.total,
          tipTitle: F.tarih(g.iso, { hamTarih: true, gunAdi: true }),
          tipValue: F.para(g.total)
        };
      });
    } else {
      veri = aylikDizi(ist).map(function (a) {
        return {
          key: a.ym, label: F.ayKisa(a.ym), value: a.total,
          tipTitle: F.ayAdi(a.ym), tipValue: F.para(a.total)
        };
      });
    }

    var g = C.sutun($('grafik-gunluk'), {
      data: veri,
      height: 168,
      ariaLabel: F.donemEtiket(durum.donem) + ' harcama dağılımı',
      empty: 'Bu dönemde henüz harcama girmemişsin.',
      /* Takvim ayında 1 ve beşin katları düzgün durur. Diğer dönemlerde gün
         numaraları ay atlayınca sıçradığı için otomatik seyreltmeye bırakılır. */
      labelEvery: (gunlukMu && durum.donem.tip === 'ay')
        ? function (x) { var n = +x.key.slice(8, 10); return n === 1 || n % 5 === 0; }
        : null
    });
    C.kaydet(g.yenidenCiz);
  }

  function cizDonemGrafigi() {
    var d = durum.donem;
    $('baslik-donemler').textContent = d.tip === 'ay' ? 'Son 6 ay' : 'Son 6 dönem';

    var veri = S.oncekiDonemler(6, d).map(function (p) {
      return {
        key: p.donem.bas,
        label: F.donemKisaEtiket(p.donem),
        value: p.expense,
        tipTitle: F.donemEtiket(p.donem),
        tipValue: F.para(p.expense)
      };
    });

    var g = C.sutun($('grafik-aylar'), {
      data: veri,
      height: 168,
      emphasisKey: d.bas,
      ariaLabel: 'Son 6 dönemin harcaması',
      empty: 'Kıyaslamak için birkaç dönemlik kayıt gerekiyor.',
      labelEvery: function () { return true; }
    });
    C.kaydet(g.yenidenCiz);
  }

  /* ---------------- İŞLEMLER ---------------- */

  function cizIslemler() {
    var hepsi = S.txForDonem(durum.donem);
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
      ? liste.length + ' işlem · ' + F.para(gider) + ' gider' +
        (gelir ? ' · ' + F.para(gelir) + ' gelir' : '')
      : '';

    var kap = $('islem-liste');
    kap.innerHTML = '';

    if (!liste.length) {
      var bos = yeni('div', 'bos-durum');
      bos.innerHTML = '<span class="buyuk">🧾</span>' +
        (hepsi.length ? 'Bu filtreye uyan işlem yok.'
                      : F.donemEtiket(durum.donem) + ' aralığında kayıt yok.<br>Sağ alttaki + ile ekle.');
      kap.appendChild(bos);
      return;
    }

    /* gün başlıklarındaki toplamlar için tek geçişte topla */
    var gunToplami = {};
    liste.forEach(function (t) {
      if (t.t === 'e') gunToplami[t.d] = (gunToplami[t.d] || 0) + t.a;
    });

    var suankiGun = null;
    liste.forEach(function (t) {
      if (t.d !== suankiGun) {
        suankiGun = t.d;
        var bas = yeni('div', 'gun-basligi');
        bas.appendChild(yeni('span', null, F.tarih(t.d, { gunAdi: true })));
        if (gunToplami[t.d]) {
          bas.appendChild(yeni('span', 'gun-toplam', F.para(gunToplami[t.d])));
        }
        kap.appendChild(bas);
      }
      kap.appendChild(islemSatiri(t));
    });
  }

  function islemSatiri(t) {
    var c = S.cat(t.c);
    var b = yeni('button', 'islem');
    b.type = 'button';

    b.appendChild(yeni('div', 'ikon', c.emoji));

    var orta = yeni('div', 'orta');
    orta.appendChild(yeni('div', 'ad', c.name));
    if (t.n && t.n !== c.name) orta.appendChild(yeni('div', 'alt', t.n));
    b.appendChild(orta);

    var tutar = yeni('div', 'tutar ' + (t.t === 'i' ? 'gelir' : 'gider'));
    tutar.textContent = F.isaretliPara(t.a, t.t);
    b.appendChild(tutar);

    b.addEventListener('click', function () { girisAc(t.id); });
    return b;
  }

  /* ---------------- AYARLAR ---------------- */

  function donemOzetMetni() {
    var d = durum.donem;
    if (d.tip === 'dongu') {
      return 'Maaş dönemi — her ayın ' + d.gun + '. günü başlıyor. Şu an: ' + F.donemEtiket(d);
    }
    if (d.tip === 'ozel') {
      return 'Özel aralık: ' + F.donemEtiket(d) + ' · ' + S.donemGunSayisi(d) + ' gün';
    }
    return 'Takvim ayı. Şu an: ' + F.donemEtiket(d);
  }

  function cizAyarlar() {
    $('donem-ayar-ozet').textContent = donemOzetMetni();

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
      orta.appendChild(yeni('div', 'alt',
        (c.type === 'i' ? 'Gelir' : 'Gider') +
        (c.budget ? ' · bütçe ' + F.para(c.budget, { tamsayi: true }) : '') +
        ' · ' + kullanim + ' işlem'));
      b.appendChild(orta);
      b.appendChild(yeni('span', 'sag', 'Düzenle'));
      b.addEventListener('click', function () { kategoriFormu(c); });
      kap.appendChild(b);
    });

    var sKap = $('ayar-sabitler');
    sKap.innerHTML = '';
    var sabitler = S.fixedList();
    if (!sabitler.length) {
      sKap.appendChild(yeni('p', 'chart-empty', 'Henüz sabit kayıt yok.'));
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
        b.appendChild(yeni('span', 'sag ' + (f.t === 'i' ? 'gelir' : 'gider'),
          F.isaretliPara(f.a, f.t, { tamsayi: true })));
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

  /* ================= dönem seçimi ================= */

  var donemTaslak = { tip: 'ay', gun: 15, bas: '', son: '' };

  function donemPaneliAc() {
    var d = durum.donem, ayar = S.settings();
    donemTaslak.tip = d.tip;
    donemTaslak.gun = d.tip === 'dongu' ? d.gun : (ayar.donguGunu || 15);
    donemTaslak.bas = d.bas;
    donemTaslak.son = d.son;
    $('donem-gun').value = donemTaslak.gun;
    $('donem-bas').value = d.bas;
    $('donem-son').value = d.son;
    donemPaneliYenile();
    panelAc('panel-donem');
  }

  function donemTaslakDonemi() {
    if (donemTaslak.tip === 'dongu') return S.donemDongu(S.todayISO(), donemTaslak.gun);
    if (donemTaslak.tip === 'ozel') {
      if (!donemTaslak.bas || !donemTaslak.son) return null;
      return S.donemOzel(donemTaslak.bas, donemTaslak.son);
    }
    return S.donemAy(S.todayISO().slice(0, 7));
  }

  function donemPaneliYenile() {
    Array.prototype.forEach.call($('donem-tip').children, function (c) {
      c.classList.toggle('chip-secili', c.dataset.tip === donemTaslak.tip);
    });
    $('donem-dongu-alan').hidden = donemTaslak.tip !== 'dongu';
    $('donem-ozel-alan').hidden = donemTaslak.tip !== 'ozel';

    var d = donemTaslakDonemi();
    $('donem-onizleme').textContent = d
      ? F.donemEtiket(d) + ' · ' + S.donemGunSayisi(d) + ' gün'
      : 'İki tarihi de seç.';
  }

  function donemUygula() {
    var d = donemTaslakDonemi();
    if (!d) { bildir('İki tarihi de seç'); return; }
    if (S.donemGunSayisi(d) > 1830) { bildir('Aralık en fazla 5 yıl olabilir'); return; }

    durum.donem = d;
    /* Takvim ayı ve maaş dönemi kalıcı tercih; özel aralık tek seferlik bakış */
    if (d.tip !== 'ozel') {
      S.setSetting('donemTipi', d.tip);
      if (d.tip === 'dongu') S.setSetting('donguGunu', d.gun);
    }
    panelKapat();
    ciz();
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

    Array.prototype.forEach.call($('giris-tur').children, function (c) {
      c.classList.toggle('chip-secili', c.dataset.tur === giris.tur);
    });

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

    /* Kayıt gösterilen dönemin dışına düştüyse onu kapsayan döneme geç.
       Özel aralıkta kullanıcının seçtiği aralığı bozmak yerine haber veririz. */
    if (giris.tarih < durum.donem.bas || giris.tarih > durum.donem.son) {
      if (durum.donem.tip === 'ozel') bildir('Kaydedildi — seçili aralığın dışında');
      else durum.donem = S.donemIceren(durum.donem, giris.tarih);
    }

    panelKapat();
    ciz();
  }

  /* ================= genel form paneli ================= */

  var formKaydet = null;

  function formAc(baslik, alanlar, kaydetFn, silFn, kaydetEtiketi) {
    $('form-baslik').textContent = baslik;
    $('form-kaydet').textContent = kaydetEtiketi || 'Kaydet';
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

  /* Tek seçimli chip satırı — şimdilik yalnız sabit kayıt tutar panelinde */
  function chipSatiri(secenekler, secili, secildi) {
    var kap = yeni('div', 'chip-satir');
    secenekler.forEach(function (p) {
      var b = yeni('button', 'chip' + (p[0] === secili ? ' chip-secili' : ''), p[1]);
      b.type = 'button';
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(kap.children, function (o) {
          o.classList.remove('chip-secili');
        });
        b.classList.add('chip-secili');
        secildi(p[0]);
      });
      kap.appendChild(b);
    });
    return kap;
  }

  /* Sabit kaydı döneme eklerken tutarı değiştirmek için.
     İki ayrı niyet var ve karıştırılırsa veri bozulur:
       "sadece bu dönem" -> tek seferlik fark, şablon aynı kalır
       "bundan sonra hep" -> zam; şablon da güncellenir */
  function sabitAyarla(x) {
    var f = x.fixed;
    var kalici = false;

    var tutarGirdi = metinGirdi('sa-tutar',
      String(f.a / 100).replace('.', ','), '0,00', 'decimal');

    var kapsam = chipSatiri(
      [['bir', 'Sadece bu dönem'], ['hep', 'Bundan sonra hep']], 'bir',
      function (v) { kalici = (v === 'hep'); });

    var alanlar = [
      alan('Tutar (₺)', tutarGirdi,
        F.tarihKisa(x.iso) + ' tarihine ' +
        (f.t === 'i' ? 'gelir' : 'gider') + ' olarak eklenecek.'),
      alan('Bu değişiklik', kapsam,
        'Maaşa zam geldiyse "Bundan sonra hep" seç, sabit kayıt da güncellensin. ' +
        'Yalnız bu aya özel bir farksa "Sadece bu dönem" bırak.')
    ];

    formAc(f.name, alanlar, function () {
      var tutar = F.metindenKurus(tutarGirdi.value);
      if (tutar <= 0) { bildir('Tutar gerekli'); return; }
      if (kalici) S.updateFixed(f.id, { a: tutar });
      S.applyFixed(f.id, x.ym, tutar);
      panelKapat();
      bildir(f.name + ' eklendi' + (kalici ? ', tutarı güncellendi' : ''));
      ciz();
    }, null, 'Ekle');
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
      taslak.budget ? String(taslak.budget / 100).replace('.', ',') : '',
      'Boş bırakılabilir', 'decimal');

    var alanlar = [alan('Kategori adı', adGirdi)];
    alanlar.push(alan('Simge', emojiSecici(taslak.emoji, function (e) { taslak.emoji = e; })));

    if (yeniMi) {
      var turSatir = yeni('div', 'chip-satir');
      [['e', 'Gider'], ['i', 'Gelir']].forEach(function (p) {
        var b = yeni('button', 'chip' + (taslak.type === p[0] ? ' chip-secili' : ''), p[1]);
        b.type = 'button';
        b.addEventListener('click', function () {
          taslak.type = p[0];
          Array.prototype.forEach.call(turSatir.children, function (x) {
            x.classList.remove('chip-secili');
          });
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
      if (!confirm('"' + mevcut.name + '" silinsin mi?\n\n' +
                   'Bu kategorideki işlemler silinmez, "Diğer" kategorisine taşınır.')) return;
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
        Array.prototype.forEach.call(turSatir.children, function (x) {
          x.classList.remove('chip-secili');
        });
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
      alan('Ayın kaçıncı günü', gunGirdi, '1–28 arası. Özet ekranından tek tuşla o döneme eklersin.')
    ];

    formAc(yeniMi ? 'Yeni sabit kayıt' : 'Sabit kaydı düzenle', alanlar, function () {
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
      if (!confirm('"' + mevcut.name + '" sabit kayıtlardan silinsin mi?\n\n' +
                   'Daha önce aylara eklenmiş işlemler silinmez.')) return;
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
            bildir(S.mergeJSON(metin) + ' yeni işlem eklendi');
          } else {
            if (!confirm('Emin misin? Şu anki ' + mevcutSayi + ' işlem silinecek.')) return;
            bildir(S.importJSON(metin) + ' işlem geri yüklendi');
          }
        } else {
          bildir(S.importJSON(metin) + ' işlem geri yüklendi');
        }
        durum.donem = varsayilanDonem();
        ciz();
      } catch (e) {
        alert('Yedek okunamadı: ' + e.message);
      }
    };
    okuyucu.readAsText(dosya);
  }

  /* ================= olay bağlama ================= */

  function bagla() {
    $('ay-geri').addEventListener('click', function () { donemKaydir(-1); });
    $('ay-ileri').addEventListener('click', function () { donemKaydir(1); });
    $('ay-adi').addEventListener('click', donemPaneliAc);

    Array.prototype.forEach.call($('tabbar').children, function (t) {
      t.addEventListener('click', function () { viewGoster(t.dataset.view); });
    });

    $('fab').addEventListener('click', function () { girisAc(null); });

    /* --- dönem paneli --- */
    $('donem-kapat').addEventListener('click', panelKapat);
    $('donem-uygula').addEventListener('click', donemUygula);
    $('donem-ayar-ac').addEventListener('click', donemPaneliAc);
    $('donem-tip').addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      donemTaslak.tip = b.dataset.tip;
      donemPaneliYenile();
    });
    $('donem-gun').addEventListener('input', function () {
      donemTaslak.gun = Math.min(28, Math.max(1, parseInt(this.value, 10) || 1));
      donemPaneliYenile();
    });
    $('donem-bas').addEventListener('change', function () {
      donemTaslak.bas = this.value;
      donemPaneliYenile();
    });
    $('donem-son').addEventListener('change', function () {
      donemTaslak.son = this.value;
      donemPaneliYenile();
    });

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
      bildir(S.applyAllFixed(durum.donem) + ' sabit kayıt eklendi');
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
      durum.donem = varsayilanDonem();
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
    durum.donem = varsayilanDonem();
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
