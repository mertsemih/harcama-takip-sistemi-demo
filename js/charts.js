/* Sütun grafiği (SVG). Tek seri olduğu için lejant yok, tek renk kullanılır;
   değer etiketi yalnız en yüksek sütuna ve vurgulanan sütuna konur.
   Renkler CSS değişkenlerinden gelir, böylece koyu tema tek yerden döner. */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  function el(ad, ozellikler) {
    var e = document.createElementNS(NS, ad);
    for (var k in ozellikler) {
      if (Object.prototype.hasOwnProperty.call(ozellikler, k)) {
        e.setAttribute(k, ozellikler[k]);
      }
    }
    return e;
  }

  /* Ekseni 1 / 2 / 2,5 / 5 x 10^n basamağına yuvarlar. */
  function guzelTavan(max) {
    if (max <= 0) return 1;
    var us = Math.pow(10, Math.floor(Math.log(max) / Math.LN10));
    var oran = max / us;
    var carpan = oran <= 1 ? 1 : oran <= 2 ? 2 : oran <= 2.5 ? 2.5 : oran <= 5 ? 5 : 10;
    return carpan * us;
  }

  /* Üstü yuvarlak, tabanı düz sütun yolu (ölçü rehberi: 4px veri ucu). */
  function sutunYolu(x, y, g, y2, r) {
    var h = y2 - y;
    r = Math.max(0, Math.min(r, g / 2, h));
    return 'M' + x + ' ' + y2 +
           'L' + x + ' ' + (y + r) +
           'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y +
           'L' + (x + g - r) + ' ' + y +
           'Q' + (x + g) + ' ' + y + ' ' + (x + g) + ' ' + (y + r) +
           'L' + (x + g) + ' ' + y2 + 'Z';
  }

  function sutun(kap, secenekler) {
    var o = secenekler || {};
    var veri = o.data || [];

    function ciz() {
      kap.innerHTML = '';
      var W = kap.clientWidth || 320;
      if (W < 40) return;
      var H = o.height || 170;

      var toplam = veri.reduce(function (t, d) { return t + d.value; }, 0);
      if (!veri.length || toplam === 0) {
        var bos = document.createElement('p');
        bos.className = 'chart-empty';
        bos.textContent = o.empty || 'Bu ay için gösterilecek veri yok.';
        kap.appendChild(bos);
        return;
      }

      var padUst = 24, padAlt = 22, padSol = 40, padSag = 6;
      var alanG = W - padSol - padSag;
      var alanY = H - padUst - padAlt;
      var taban = padUst + alanY;

      var enBuyuk = veri.reduce(function (m, d) { return Math.max(m, d.value); }, 0);
      var tavan = guzelTavan(enBuyuk);
      var yOf = function (v) { return taban - (v / tavan) * alanY; };

      var svg = el('svg', {
        width: W, height: H, viewBox: '0 0 ' + W + ' ' + H,
        role: 'img', 'aria-label': o.ariaLabel || 'Sütun grafiği'
      });

      /* Izgara: kılcal, düz, geri planda */
      var kademe = [0, 0.5, 1];
      kademe.forEach(function (k) {
        var deger = tavan * k;
        var y = yOf(deger);
        svg.appendChild(el('line', {
          x1: padSol, x2: W - padSag, y1: y, y2: y,
          class: k === 0 ? 'ax-base' : 'ax-grid'
        }));
        var etiket = el('text', { x: padSol - 7, y: y + 4, class: 'ax-tick', 'text-anchor': 'end' });
        etiket.textContent = k === 0 ? '0' : global.Fmt.kisa(deger);
        svg.appendChild(etiket);
      });

      /* Sütunlar: yuva genişliğinin tamamı doldurulmaz, 2px yüzey boşluğu bırakılır */
      var yuva = alanG / veri.length;
      var g = Math.max(3, Math.min(24, yuva - 2));
      var kutular = [];

      veri.forEach(function (d, i) {
        var x = padSol + i * yuva + (yuva - g) / 2;
        var y = d.value > 0 ? yOf(d.value) : taban;
        var vurgu = o.emphasisKey != null && d.key === o.emphasisKey;

        if (d.value > 0) {
          svg.appendChild(el('path', {
            d: sutunYolu(x, y, g, taban, 4),
            class: 'bar' + (vurgu ? ' bar-vurgu' : (o.emphasisKey != null ? ' bar-soluk' : ''))
          }));
        }

        /* Görünmez, geniş dokunma hedefi (parmak için sütunun kendisi dar kalıyor) */
        var hedef = el('rect', {
          x: padSol + i * yuva, y: padUst, width: yuva, height: alanY,
          fill: 'transparent', class: 'bar-hit'
        });
        svg.appendChild(hedef);
        kutular.push({ d: d, x: padSol + i * yuva + yuva / 2, y: y });
      });

      /* Seçici doğrudan etiket: en yüksek sütun, ayrıca vurgulanan sütun */
      var etiketlenecek = [];
      var enBuyukIdx = 0;
      veri.forEach(function (d, i) { if (d.value > veri[enBuyukIdx].value) enBuyukIdx = i; });
      etiketlenecek.push(enBuyukIdx);
      if (o.emphasisKey != null) {
        veri.forEach(function (d, i) { if (d.key === o.emphasisKey && etiketlenecek.indexOf(i) === -1) etiketlenecek.push(i); });
      }
      etiketlenecek.forEach(function (i) {
        var d = veri[i];
        if (!d.value) return;
        var merkez = kutular[i].x;
        var t = el('text', {
          x: Math.max(padSol + 14, Math.min(W - padSag - 14, merkez)),
          y: kutular[i].y - 7, class: 'bar-etiket', 'text-anchor': 'middle'
        });
        t.textContent = global.Fmt.kisa(d.value);
        svg.appendChild(t);
      });

      /* Alt eksen: her sütuna yazı sığmaz, seyreltilir */
      /* Eşit aralıklı seyreltme: sona zorla etiket koymak komşusuyla çakışıyordu */
      var sigan = Math.max(1, Math.floor(alanG / 26));
      var adim = Math.max(1, Math.ceil(veri.length / sigan));
      veri.forEach(function (d, i) {
        var goster = o.labelEvery ? o.labelEvery(d, i, veri.length) : (i % adim === 0);
        if (!goster) return;
        var t = el('text', { x: kutular[i].x, y: H - 6, class: 'ax-tick', 'text-anchor': 'middle' });
        t.textContent = d.label;
        svg.appendChild(t);
      });

      kap.appendChild(svg);

      /* ---- ipucu katmanı ---- */
      var ipucu = document.createElement('div');
      ipucu.className = 'chart-tip';
      ipucu.hidden = true;
      kap.appendChild(ipucu);

      function goster(i) {
        if (i < 0 || i >= kutular.length) return;
        var k = kutular[i];
        ipucu.innerHTML = '<b>' + k.d.tipTitle + '</b><span>' + k.d.tipValue + '</span>';
        ipucu.hidden = false;
        ipucu.style.left = Math.max(44, Math.min(W - 44, k.x)) + 'px';
        ipucu.style.top = Math.max(4, k.y - 12) + 'px';
      }
      function gizle() { ipucu.hidden = true; }

      function indexBul(olay) {
        var kutu = svg.getBoundingClientRect();
        return Math.floor((olay.clientX - kutu.left - padSol) / yuva);
      }

      svg.addEventListener('pointermove', function (e) { goster(indexBul(e)); });
      svg.addEventListener('pointerdown', function (e) { goster(indexBul(e)); });
      svg.addEventListener('pointerleave', gizle);
      svg.addEventListener('pointercancel', gizle);
      kap.addEventListener('pointerleave', gizle);
    }

    ciz();
    return { yenidenCiz: ciz };
  }

  /* Pencere boyu değişince tüm grafikleri yeniden çizmek için basit kayıt */
  var kayit = [];
  function kaydet(fn) { kayit.push(fn); }
  var zamanlayici = null;
  global.addEventListener('resize', function () {
    clearTimeout(zamanlayici);
    zamanlayici = setTimeout(function () {
      kayit.forEach(function (f) { try { f(); } catch (e) { /* grafik kapanmış olabilir */ } });
    }, 150);
  });

  global.Charts = { sutun: sutun, kaydet: kaydet, temizleKayit: function () { kayit = []; } };
})(window);
