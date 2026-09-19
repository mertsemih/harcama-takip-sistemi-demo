/* Türkçe biçimlendirme yardımcıları. Tutarlar her yerde kuruş (tam sayı) gelir. */
(function (global) {
  'use strict';

  var AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
               'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  var AYLAR_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
                    'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  var GUNLER = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

  var grup = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var grupTam = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });

  /* 125050 -> "1.250,50 ₺" */
  function para(kurus, opts) {
    opts = opts || {};
    var neg = kurus < 0;
    var v = Math.abs(kurus) / 100;
    var s = opts.tamsayi ? grupTam.format(Math.round(v)) : grup.format(v);
    return (neg ? '-' : (opts.isaret ? '+' : '')) + s + ' ₺';
  }

  /* Eksen ve rozet gibi dar yerler için: 12450000 -> "124,5B" */
  function kisa(kurus) {
    var v = Math.abs(kurus) / 100;
    var neg = kurus < 0 ? '-' : '';
    if (v >= 1000000) return neg + tek(v / 1000000) + 'Mn';
    if (v >= 1000) return neg + tek(v / 1000) + 'B';
    return neg + grupTam.format(Math.round(v));
  }

  function tek(n) {
    var s = (n >= 100 ? Math.round(n) : Math.round(n * 10) / 10);
    return String(s).replace('.', ',');
  }

  /* "2026-09" -> "Eylül 2026" */
  function ayAdi(ym, kisaMi) {
    var p = ym.split('-');
    var liste = kisaMi ? AYLAR_KISA : AYLAR;
    return liste[+p[1] - 1] + ' ' + p[0];
  }

  /* "2026-09" -> "Eyl" */
  function ayKisa(ym) {
    return AYLAR_KISA[+ym.split('-')[1] - 1];
  }

  /* "2026-09-19" -> "19 Eylül Cumartesi" / bugün ve dün özel yazılır */
  function tarih(iso, opts) {
    opts = opts || {};
    var bugun = new Date();
    var d = new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
    var farkGun = Math.round((strip(bugun) - strip(d)) / 86400000);
    if (!opts.hamTarih) {
      if (farkGun === 0) return 'Bugün';
      if (farkGun === 1) return 'Dün';
    }
    var metin = +iso.slice(8, 10) + ' ' + AYLAR[+iso.slice(5, 7) - 1];
    if (opts.gunAdi) metin += ' ' + GUNLER[d.getDay()];
    if (opts.yil) metin += ' ' + iso.slice(0, 4);
    return metin;
  }

  function strip(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }

  function gunAdi(iso) {
    var d = new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
    return GUNLER[d.getDay()];
  }

  /* "2026-09-15" -> "15 Eyl" */
  function tarihKisa(iso) {
    return +iso.slice(8, 10) + ' ' + AYLAR_KISA[+iso.slice(5, 7) - 1];
  }

  /* Dönem başlığı: takvim ayıysa "Eylül 2026", değilse "15 Eyl – 14 Eki" */
  function donemEtiket(d, kisaMi) {
    if (d.tip === 'ay') return ayAdi(d.ym, kisaMi);
    var metin = tarihKisa(d.bas) + ' – ' + tarihKisa(d.son);
    // Aralık yıl atlıyorsa bitiş yılını da yaz, yoksa kafa karıştırır
    if (d.bas.slice(0, 4) !== d.son.slice(0, 4)) metin += ' ' + d.son.slice(0, 4);
    return metin;
  }

  /* Grafik ekseni gibi dar yerler için tek başlangıç: "15 Eyl" ya da "Eyl" */
  function donemKisaEtiket(d) {
    return d.tip === 'ay' ? ayKisa(d.ym) : tarihKisa(d.bas);
  }

  /* Yüzde değişimi: "%12 daha fazla" gibi cümleler için ham sayı üretir */
  function yuzdeFark(simdi, once) {
    if (!once) return null;
    return Math.round(((simdi - once) / once) * 100);
  }

  /* Kullanıcının yazdığı "1.250,50" / "1250.5" / "1250" -> kuruş */
  function metindenKurus(s) {
    if (s == null) return 0;
    var t = String(s).trim().replace(/\s/g, '').replace(/₺/g, '');
    if (!t) return 0;
    // Son ayırıcı ondalık kabul edilir
    var sonVirgul = t.lastIndexOf(',');
    var sonNokta = t.lastIndexOf('.');
    var ondalikPos = Math.max(sonVirgul, sonNokta);
    var tamKisim, ondalik = '';
    if (ondalikPos > -1 && t.length - ondalikPos - 1 <= 2) {
      tamKisim = t.slice(0, ondalikPos).replace(/[^\d]/g, '');
      ondalik = t.slice(ondalikPos + 1).replace(/[^\d]/g, '');
    } else {
      tamKisim = t.replace(/[^\d]/g, '');
    }
    ondalik = (ondalik + '00').slice(0, 2);
    var lira = parseInt(tamKisim || '0', 10);
    return lira * 100 + parseInt(ondalik, 10);
  }

  global.Fmt = {
    AYLAR: AYLAR, AYLAR_KISA: AYLAR_KISA, GUNLER: GUNLER,
    para: para, kisa: kisa, ayAdi: ayAdi, ayKisa: ayKisa,
    tarihKisa: tarihKisa, donemEtiket: donemEtiket, donemKisaEtiket: donemKisaEtiket,
    tarih: tarih, gunAdi: gunAdi, yuzdeFark: yuzdeFark, metindenKurus: metindenKurus
  };
})(window);
