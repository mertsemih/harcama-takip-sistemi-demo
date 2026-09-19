/* Arayüz hareket katmanı — kayan segment göstergeleri, sayı animasyonu,
   kart giriş sıralaması. Hepsi "az hareket" tercihine saygı duyar.
   Bağımlılık yok; her şey requestAnimationFrame ve CSS geçişleriyle. */
(function (global) {
  'use strict';

  var azHareketSorgu = global.matchMedia
    ? global.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  function azHareket() { return !!(azHareketSorgu && azHareketSorgu.matches); }

  /* ---------- kayan segment göstergesi ---------- */
  /* Yapı:  <div class="segment"><span class="segment-ind"></span>
              <button class="segment-op secili">…</button> … </div>
     Gösterge seçili düğmenin altına kayar. Kap gizliyken ölçüm 0 döneceği
     için panel açıldığında yeniden çağrılması gerekir. */

  function segment(kap, animasyonlu) {
    if (!kap) return;
    var ind = kap.querySelector('.segment-ind');
    if (!ind) return;
    var secili = kap.querySelector('.segment-op.secili');

    if (!secili || !kap.offsetWidth) {
      ind.style.opacity = '0';
      return;
    }

    /* İlk yerleşimde kaydırma animasyonu istemeyiz, yoksa soldan fırlar */
    var ilkKez = ind.dataset.yerlesti !== '1';
    if (ilkKez || animasyonlu === false || azHareket()) {
      ind.style.transition = 'none';
    } else {
      ind.style.transition = '';
    }

    ind.style.opacity = '1';
    ind.style.width = secili.offsetWidth + 'px';
    ind.style.height = secili.offsetHeight + 'px';
    ind.style.transform = 'translate3d(' + secili.offsetLeft + 'px,' +
                          secili.offsetTop + 'px,0)';

    if (ilkKez) {
      ind.dataset.yerlesti = '1';
      /* bir sonraki karede geçişi geri aç */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { ind.style.transition = ''; });
      });
    }
  }

  /* Sayfadaki tüm segmentleri tazele (yeniden boyutlanma, panel açılışı) */
  function tumSegmentler(animasyonlu) {
    var hepsi = document.querySelectorAll('.segment');
    for (var i = 0; i < hepsi.length; i++) segment(hepsi[i], animasyonlu);
  }

  /* Seçimi değiştirir ve göstergeyi kaydırır */
  function segmentSec(kap, dugme) {
    if (!kap || !dugme) return;
    var ops = kap.querySelectorAll('.segment-op');
    for (var i = 0; i < ops.length; i++) {
      ops[i].classList.toggle('secili', ops[i] === dugme);
      ops[i].setAttribute('aria-selected', ops[i] === dugme ? 'true' : 'false');
    }
    segment(kap, true);
  }

  /* Seçimi değere göre ayarlar (data-<ad> eşleşmesi) */
  function segmentDeger(kap, ad, deger) {
    if (!kap) return;
    var ops = kap.querySelectorAll('.segment-op');
    for (var i = 0; i < ops.length; i++) {
      var esit = ops[i].dataset[ad] === String(deger);
      ops[i].classList.toggle('secili', esit);
      ops[i].setAttribute('aria-selected', esit ? 'true' : 'false');
    }
    segment(kap, true);
  }

  /* ---------- sayı animasyonu ---------- */
  /* Para değeri olduğu için animasyon bittiğinde KESİN değere oturur;
     ara kareler yuvarlanmış tahminlerdir, son kare gerçek rakamdır. */

  function sayi(el, hedef, bicimle) {
    if (!el) return;
    var onceki = el.dataset.deger === undefined ? null : +el.dataset.deger;
    el.dataset.deger = hedef;

    if (el._sayiId) { cancelAnimationFrame(el._sayiId); el._sayiId = 0; }

    /* ilk çizim, değişmemiş değer ya da az hareket: doğrudan yaz */
    if (onceki === null || onceki === hedef || azHareket()) {
      el.textContent = bicimle(hedef);
      return;
    }

    var fark = Math.abs(hedef - onceki);
    var sure = fark > 5000000 ? 620 : fark > 100000 ? 500 : 340;
    var t0 = 0;

    function adim(t) {
      if (!t0) t0 = t;
      var p = Math.min(1, (t - t0) / sure);
      var e = 1 - Math.pow(1 - p, 3);            // easeOutCubic
      if (p < 1) {
        el.textContent = bicimle(Math.round(onceki + (hedef - onceki) * e));
        el._sayiId = requestAnimationFrame(adim);
      } else {
        el.textContent = bicimle(hedef);          // kesin değer
        el._sayiId = 0;
      }
    }
    el._sayiId = requestAnimationFrame(adim);
  }

  /* ---------- giriş animasyonu ---------- */
  /* Görünüm değişiminde kartlar sırayla belirir. Her yeniden çizimde
     tekrarlanmaz — yalnızca sekme değiştirince çağrılır. */

  function kartlariGetir(kap) {
    if (!kap || azHareket()) return;
    var kartlar = kap.querySelectorAll(':scope > .kart, :scope > .kpi-satir, :scope > .filtre-cubugu');
    for (var i = 0; i < kartlar.length; i++) {
      var k = kartlar[i];
      k.style.animation = 'none';
      /* düzeni yeniden hesaplat ki animasyon baştan başlasın */
      void k.offsetWidth;
      k.style.animation = '';
      k.style.animationDelay = Math.min(i * 45, 320) + 'ms';
      k.classList.add('gelis');
    }
  }

  /* ---------- dokunsal geri bildirim ---------- */
  /* Destekleyen cihazlarda kısa titreşim; desteklemeyen sessizce geçer. */

  function titret(sure) {
    if (azHareket()) return;
    try {
      if (navigator.vibrate) navigator.vibrate(sure || 8);
    } catch (e) { /* tarayıcı izin vermiyor olabilir */ }
  }

  /* pencere boyu değişince göstergeler kaymasın */
  var zamanlayici = null;
  global.addEventListener('resize', function () {
    clearTimeout(zamanlayici);
    zamanlayici = setTimeout(function () { tumSegmentler(false); }, 120);
  });

  global.UI = {
    azHareket: azHareket,
    segment: segment,
    tumSegmentler: tumSegmentler,
    segmentSec: segmentSec,
    segmentDeger: segmentDeger,
    sayi: sayi,
    kartlariGetir: kartlariGetir,
    titret: titret
  };
})(window);
