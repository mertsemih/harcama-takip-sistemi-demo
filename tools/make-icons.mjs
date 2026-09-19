/* PNG ikon üretici — bağımlılık yok, sadece Node'un kendi zlib'i.
   Çalıştırma:  node tools/make-icons.mjs
   icons/ klasörüne PNG dosyalarını yazar. SVG kaynak icons/icon.svg. */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const IKON_KLASOR = join(KOK, 'icons');

/* ---------- PNG kodlama ---------- */

const CRC_TABLO = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLO[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function parca(tur, veri) {
  const uzunluk = Buffer.alloc(4);
  uzunluk.writeUInt32BE(veri.length, 0);
  const govde = Buffer.concat([Buffer.from(tur, 'ascii'), veri]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(govde), 0);
  return Buffer.concat([uzunluk, govde, crc]);
}

function pngYaz(genislik, yukseklik, rgba) {
  const ham = Buffer.alloc((genislik * 4 + 1) * yukseklik);
  for (let y = 0; y < yukseklik; y++) {
    const hedef = y * (genislik * 4 + 1);
    ham[hedef] = 0; // filtre: yok
    rgba.copy(ham, hedef + 1, y * genislik * 4, (y + 1) * genislik * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(genislik, 0);
  ihdr.writeUInt32BE(yukseklik, 4);
  ihdr[8] = 8;  // bit derinliği
  ihdr[9] = 6;  // renk tipi: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    parca('IHDR', ihdr),
    parca('IDAT', deflateSync(ham, { level: 9 })),
    parca('IEND', Buffer.alloc(0))
  ]);
}

/* ---------- çizim ---------- */

/* Yuvarlak köşeli dikdörtgenin işaretli mesafesi (merkez orijinde) */
function yuvarlakKutuSDF(px, py, yariG, yariY, r) {
  const qx = Math.abs(px) - yariG + r;
  const qy = Math.abs(py) - yariY + r;
  const dx = Math.max(qx, 0), dy = Math.max(qy, 0);
  return Math.sqrt(dx * dx + dy * dy) + Math.min(Math.max(qx, qy), 0) - r;
}

/* 1 piksellik yumuşak kenar */
function kaplama(d) {
  return Math.min(1, Math.max(0, 0.5 - d));
}

function karistir(alt, ust, a) {
  return alt + (ust - alt) * a;
}

/* Arka plan degradesi: üstte mavi, altta mor */
const UST = [0x2a, 0x78, 0xd6];
const ALT = [0x4a, 0x3a, 0xa7];

function ciz(boyut, { koseOrani, icerikOrani }) {
  const rgba = Buffer.alloc(boyut * boyut * 4);
  const merkez = boyut / 2;
  const zeminYari = boyut / 2;
  const zeminR = boyut * koseOrani;

  /* üç çubuk: genişlik, yükseklik oranları ve taban hizası */
  const icerik = boyut * icerikOrani;
  const tabanY = merkez + icerik / 2;
  const cubukG = icerik * 0.175;
  const bosluk = icerik * 0.11;
  const toplamG = cubukG * 3 + bosluk * 2;
  const ilkX = merkez - toplamG / 2 + cubukG / 2;
  const yukseklikler = [0.42, 0.68, 1.0];

  for (let y = 0; y < boyut; y++) {
    for (let x = 0; x < boyut; x++) {
      const px = x + 0.5 - merkez;
      const py = y + 0.5 - merkez;

      const zeminA = kaplama(yuvarlakKutuSDF(px, py, zeminYari, zeminYari, zeminR));
      const t = y / (boyut - 1);
      let r = karistir(UST[0], ALT[0], t);
      let g = karistir(UST[1], ALT[1], t);
      let b = karistir(UST[2], ALT[2], t);

      let cubukA = 0;
      for (let i = 0; i < 3; i++) {
        const h = icerik * yukseklikler[i];
        const cx = ilkX + i * (cubukG + bosluk);
        const cy = tabanY - h / 2;
        const d = yuvarlakKutuSDF(px - (cx - merkez), py - (cy - merkez),
                                  cubukG / 2, h / 2, cubukG * 0.34);
        cubukA = Math.max(cubukA, kaplama(d));
      }

      r = karistir(r, 255, cubukA);
      g = karistir(g, 255, cubukA);
      b = karistir(b, 255, cubukA);

      const i4 = (y * boyut + x) * 4;
      rgba[i4] = Math.round(r);
      rgba[i4 + 1] = Math.round(g);
      rgba[i4 + 2] = Math.round(b);
      rgba[i4 + 3] = Math.round(zeminA * 255);
    }
  }
  return pngYaz(boyut, boyut, rgba);
}

/* ---------- üret ---------- */

mkdirSync(IKON_KLASOR, { recursive: true });

const isler = [
  ['icon-192.png',          192, { koseOrani: 0.22, icerikOrani: 0.52 }],
  ['icon-512.png',          512, { koseOrani: 0.22, icerikOrani: 0.52 }],
  // maskable: platform kendi maskesini uygular, kenar boşluğu içeride bırakılır
  ['icon-maskable-512.png', 512, { koseOrani: 0.00, icerikOrani: 0.40 }],
  // iOS ana ekran ikonu: köşeleri iOS yuvarlar, kare verilir
  ['apple-touch-icon.png',  180, { koseOrani: 0.00, icerikOrani: 0.50 }]
];

for (const [ad, boyut, secenek] of isler) {
  const png = ciz(boyut, secenek);
  writeFileSync(join(IKON_KLASOR, ad), png);
  console.log('yazıldı:', ad, boyut + 'x' + boyut, (png.length / 1024).toFixed(1) + ' KB');
}
