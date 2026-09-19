# Harcama Takip

Telefondan kullanmak için yapılmış kişisel harcama takip uygulaması.
Kurulum gerektirmez, sunucusu yoktur, **veriler yalnızca senin telefonunda durur**.

- Tek tuşla tutar gir, kategori seç, kaydet
- **Kendi dönemin:** takvim ayı, maaş dönemi (ör. her ayın 15'i) ya da serbest tarih aralığı
- Dönem dönem özet: ne kadar harcadın, nereye gitti, önceki döneme göre ne oldu
- Kategori bazlı aylık bütçe ve uyarı çubukları
- Kira / fatura / abonelik gibi sabit giderleri tek tuşla o döneme ekleme
- Gelir de girilebilir, dönem sonunda "kalan" görünür
- Açık / koyu tema, internetsiz çalışma, ana ekrana eklenince uygulama gibi açılma

---

## Dönem — takvim ayına mahkûm değilsin

Üstteki başlığa (ör. *15 Eyl – 14 Eki*) dokununca dönem seçici açılır. Üç seçenek var:

| Seçenek | Ne yapar |
|---|---|
| **Takvim ayı** | Klasik: ayın 1'i – ayın sonu |
| **Maaş dönemi** | Maaşının yattığı günü (1–28) verirsin; dönemler o günde başlar, bir sonraki ayın bir önceki gününde biter. 15 dersen: *15 Eylül – 14 Ekim* |
| **Özel aralık** | İki tarih seçersin, sadece o aralığa bakarsın |

Seçtiğin sonrasında her şey o döneme göre hesaplanır: toplamlar, kategori dağılımı,
bütçe çubukları, işlem listesi. Baştaki **‹ ›** okları bir önceki / bir sonraki
döneme geçirir — özel aralıkta da aynı uzunlukta kaydırır (30 günlük aralık
seçtiysen ok bir önceki 30 güne götürür).

Takvim ayı ve maaş dönemi tercihi **kalıcıdır**, uygulamayı kapatıp açınca hatırlanır.
Özel aralık tek seferlik bir bakıştır.

Birkaç ince nokta:

- **Sabit giderler dönemi takip eder.** 15 Eylül – 14 Ekim dönemindeysen ve kiran
  ayın 5'iyse, kart sana **5 Ekim** kirasını gösterir — 5 Eylül'ünkini değil, o
  önceki döneme aitti.
- **Bütçe çubukları özel aralıkta gizlenir.** Bütçeler aylık tanımlı; 81 günlük bir
  aralıkla kıyaslamak yanıltıcı olurdu. Takvim ayı ve maaş döneminde çalışır.
- **Uzun aralıklarda grafik ay ay toplar.** 62 günü geçince "Gün gün harcama" yerine
  "Ay ay harcama" çizilir, yoksa 200 tane sütun okunmaz olurdu.

---

## 1. Önce kendi bilgisayarında dene

Basit bir yerel sunucu yeter (dosyaya çift tıklamak da çalışır ama çevrimdışı
özelliği devreye girmez):

```bash
npx serve .
```

Çıkan adresi tarayıcıda aç. Tarayıcının geliştirici araçlarından telefon
görünümüne geçersen mobilde nasıl duracağını görürsün.

---

## 2. GitHub'a yükle

Depo zaten hazır ve ilk commit atılmış durumda. Yapman gereken:

1. GitHub'da **yeni ve boş** bir depo aç (README ekleme seçeneğini işaretleme).
   İstersen **Private** yap — Vercel özel depoları da ücretsiz yayınlıyor.
2. Bu klasörde şunu çalıştır (`KULLANICI_ADIN` ve `DEPO_ADI` yerine kendininkini yaz):

```bash
git remote add origin https://github.com/KULLANICI_ADIN/DEPO_ADI.git
git branch -M main
git push -u origin main
```

---

## 3. Vercel'e bağla

1. [vercel.com](https://vercel.com) → GitHub hesabınla giriş yap
2. **Add New → Project** → az önceki depoyu seç → **Import**
3. Framework Preset: **Other**. Build ve Output ayarlarına dokunma, boş bırak.
   (Derleme adımı yok, dosyalar olduğu gibi yayınlanıyor.)
4. **Deploy**

Bir dakika içinde `https://depo-adi.vercel.app` gibi bir adres verir.
Bundan sonra `git push` yaptığın her an site kendiliğinden güncellenir.

> GitHub Pages da olur: **Settings → Pages → Source: main / (root)**.
> Vercel'i öneriyorum, adres daha kısa ve güncelleme daha hızlı.

---

## 4. Telefona kur

Vercel'in verdiği adresi telefonda aç, sonra:

- **iPhone (Safari):** Paylaş düğmesi → *Ana Ekrana Ekle*
- **Android (Chrome):** Sağ üstteki ⋮ → *Uygulamayı yükle* / *Ana ekrana ekle*

Artık adres çubuğu olmadan, uygulama gibi açılır ve internetsiz de çalışır.

**Önemli:** "Ana ekrana ekle" aynı zamanda verinin kalıcılığını artırır.
Tarayıcılar, uzun süre açılmayan sıradan siteleri temizleyebiliyor;
yüklenmiş uygulamalara dokunmuyor.

---

## 5. Yedek al (bunu atlama)

Veriler tarayıcının kendi deposunda tutuluyor. Yani:

- Telefon değiştirirsen **gitmez, ama yeni telefona kendiliğinden gelmez**
- Tarayıcı verisini / site verilerini silersen **gider**

Bunun için **Ayarlar → Yedek indir** var. Ayda bir bas, çıkan `.json` dosyasını
kendine WhatsApp'tan yolla ya da Drive'a at. Yeni cihazda **Yedekten yükle** ile geri
alırsın. Yükleme sırasında iki seçenek sunulur:

- **Ekle:** yedekteki kayıtları mevcutların üstüne ekler (aynı kayıtları iki kez eklemez)
- **Değiştir:** her şeyi silip yedektekiyle değiştirir

---

## Gizlilik

Sunucu, hesap, analitik, çerez, dış servis — hiçbiri yok. Girdiğin hiçbir rakam
cihazından çıkmıyor. Site herkese açık bir adreste dursa bile, adresi bilen biri
yalnızca **boş** bir uygulama görür; senin verin onun tarayıcısında değil, seninkinde.

---

## Dosya yapısı

```
index.html                 ekran iskeleti
css/style.css              tüm stiller, renk jetonları, açık/koyu tema
js/store.js                veri katmanı — okuma/yazma/istatistik (tek sorumlu)
js/format.js               Türkçe para, tarih, ay biçimlendirme
js/charts.js               SVG sütun grafiği
js/app.js                  ekranlar, giriş paneli, ayarlar
sw.js                      çevrimdışı çalışma
manifest.webmanifest       ana ekrana eklenince kullanılan bilgiler
icons/                     uygulama ikonları
tools/make-icons.mjs       ikon üretici (node tools/make-icons.mjs)
```

### Bilmekte fayda var

- **Tutarlar kuruş cinsinden tam sayı olarak saklanır.** Ondalıklı sayılarla
  para tutmak `0.1 + 0.2 = 0.30000000000000004` gibi hatalara yol açıyor.
  Ekrana basarken 100'e bölünüyor.
- **Tüm okuma/yazma `store.js` üzerinden geçer.** İleride veriyi buluta taşımak
  istersen yalnızca o dosyadaki `load`/`save` değişir, ekran kodu aynı kalır.
- İkonları değiştirmek istersen `icons/icon.svg`'yi düzenle, sonra
  `node tools/make-icons.mjs` ile PNG'leri yeniden üret.
