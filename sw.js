/* Çevrimdışı çalışma için servis çalışanı.
   HTML'de önce ağ denenir (yeni sürüm hemen gelsin diye),
   diğer dosyalarda önbellekten verilip arkada tazelenir. */

var SURUM = 'harcama-v4';
var KABUK = [
  './',
  './index.html',
  './css/style.css',
  './js/store.js',
  './js/format.js',
  './js/charts.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon.svg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(SURUM)
      .then(function (c) { return c.addAll(KABUK); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (adlar) {
      return Promise.all(adlar.map(function (a) {
        if (a !== SURUM) return caches.delete(a);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var istek = e.request;
  if (istek.method !== 'GET') return;

  var url = new URL(istek.url);
  if (url.origin !== self.location.origin) return;

  // Sayfanın kendisi: önce ağ, olmazsa önbellek
  if (istek.mode === 'navigate') {
    e.respondWith(
      fetch(istek)
        .then(function (yanit) {
          var kopya = yanit.clone();
          caches.open(SURUM).then(function (c) { c.put('./index.html', kopya); });
          return yanit;
        })
        .catch(function () {
          return caches.match('./index.html').then(function (v) {
            return v || caches.match('./');
          });
        })
    );
    return;
  }

  // Diğer dosyalar: önbellekten ver, arkada tazele
  e.respondWith(
    caches.match(istek).then(function (onbellek) {
      var ag = fetch(istek).then(function (yanit) {
        if (yanit && yanit.status === 200) {
          var kopya = yanit.clone();
          caches.open(SURUM).then(function (c) { c.put(istek, kopya); });
        }
        return yanit;
      }).catch(function () { return onbellek; });
      return onbellek || ag;
    })
  );
});
