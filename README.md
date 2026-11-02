# Robotistan Pro - Tedarik Asistanı (LCSC & KiCad BOM)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zen Browser / Firefox](https://img.shields.io/badge/Browser-Zen%20%7C%20Firefox-orange.svg)](https://zen-browser.app/)
[![Release](https://img.shields.io/github/v/release/omrfrkmll/robotistan-supply-assistant?color=green)](https://github.com/omrfrkmll/robotistan-supply-assistant/releases)

Bu WebExtension eklentisi, elektronik tasarım ve prototipleme süreçlerinde parça tedarikini hızlandırmak için geliştirilmiş kapsamlı bir tarayıcı asistanıdır. İki ana platformda sorunsuz çalışır:

1. **LCSC (`*.lcsc.com`):** Ürün listelerinde, arama sonuçlarında ve ürün detay sayfalarında gezinirken arka planda Robotistan Pro stok, fiyat (TL/USD/EUR) ve MOQ bilgilerini çeker; ürün kartlarına canlı rozetler yerleştirir ve fareyle üzerine gelindiğinde açılan bilgi kartından doğrudan **"🛒 Robotistan Sepetime Ekle"** imkanı tanır.
2. **Robotistan Pro (`robotistanpro.com`):** KiCad üzerinden alınan malzeme listelerini (**Interactive HTML BOM - `ibom.html`** veya **CSV / TSV**) içe aktararak, belirlenen hedef PCB adedine göre parça bazlı **MOQ (Minimum Sipariş Adedi)** ve **paket artış katlarını (Step)** hesaplayıp tek tıkla sepete aktarır. Sıfır stoklu ön sipariş ("Temin Edilecek") parçalarını ayrı sekmede toplayarak proforma/teklif listesini tek tıkla kopyalama olanağı sunar.

---

## 🚀 Temel Özellikler

### 1. LCSC Canlı Stok & Fiyat Entegrasyonu (`lcsc.com`)
- **Otomatik LCSC Kodu Algılama:** Arama sonuçları, kategori tabloları ve ürün sayfalarındaki LCSC parça kodlarını (`C...`) otomatik yakalar.
- **Canlı Durum Rozetleri:**
  - 🟢 **Stokta:** Robotistan Pro'daki güncel stok adedi ve seçilen para biriminde birim fiyatı.
  - ✈️ **Ön Sipariş (Temin Edilecek):** Robotistan'da kayıtlı ancak temin sürecinde olan parçalar.
  - 🔴 **Tükendi:** Robotistan'da stoku kalmamış ürünler.
  - ⚪ **Bulunamadı:** Henüz Robotistan Pro kataloğuna eklenmemiş ürünler.
- **İnteraktif Önizleme & Sepete Ekleme Kartı (Hover Portal Tooltip):**
  - Rozetin üzerine gelindiğinde ürün adı, güncel stok, MOQ ve paket katsayısı, birim fiyatı ve toplam tutarı gösteren dinamik bir kart açılır.
  - **"🛒 Robotistan Sepetime Ekle" Butonu:** LCSC sayfasından hiç ayrılmadan istediğiniz adedi belirleyip Robotistan Pro sepetinize doğrudan ekleyebilirsiniz.
- **Para Birimi Seçici:** Fiyatları popup üzerinden **TL (₺)**, **USD ($)** veya **EUR (€)** cinsinden görüntüleyebilirsiniz.

### 2. KiCad BOM'dan Sepete Aktarım (`robotistanpro.com`)
- **Kayan Yan Panel (BOM Drawer):** Sayfanın sağ alt köşesindeki butonla açılan şık ve kompakt yönetim paneli.
- **Format Desteği:**
  - **Interactive HTML BOM (`ibom.html`):** KiCad iBOM çıktısını tarayıcı içinde yerel LZString decompressor ile çözer.
  - **KiCad CSV / TSV / TXT:** Standart tablo çıktılarını kolon başlıklarını otomatik eşleyerek tanır.
- **Akıllı MOQ & Paket Katı Matematiği:**
  - PCB adedi çarpanı (1, 5, 10, 25, 50, 100 veya özel giriş).
  - SMD fire/yedek payı (%0, %5, %10).
  - Matematiksel formül:
    $$\text{Sipariş Adedi} = \max\left(\text{MOQ}, \left\lceil \frac{\text{İhtiyaç}}{\text{Paket Katı}} \right\rceil \times \text{Paket Katı}\right)$$
- **Çok Sayfalı Arama (Multi-Page Exact Matching):**
  - 4-5 haneli kısa kodlarda (örn. `C8436`) mağaza içi çoklu sayfalama yaparak tam eşleşen ürünü bulur; benzer kodları asla yanlış eklemez.
- **Ön Sipariş ("Temin Edilecek") Yönetimi:**
  - Sıfır stoklu parçaları ayrı bir sekmede listeler ve tek tıkla kurumsal satış ekibine gönderilebilecek proforma/teklif formatında panoya kopyalar.

### 3. Hızlı Arama & Araç Çubuğu Penceresi (Popup)
- Tarayıcı simgesine tıklandığında açılan popup üzerinden herhangi bir LCSC kodu doğrudan sorgulanabilir.
- Bulunan ürünün stok ve fiyat bilgisi görüntülenip doğrudan sepete eklenebilir.
- Aktif sekmeye göre akıllı butonlar (Robotistan BOM panelini açma veya LCSC'de arama yapma) sunar.

---

## 🛠️ Zen Browser / Firefox Kurulumu

### Yöntem 1: Kalıcı Kurulum (.XPI Paketi)

Tarayıcıyı kapattığınızda silinmeyen kalıcı kurulum için:

1. **Terminalden derleyip kurun:**
   ```bash
   pnpm run install:zen
   ```
   Bu komut eklentiyi derleyerek `.xpi` paketini Zen Browser profilinizin `extensions` dizinine otomatik olarak kopyalar.

2. **Manuel dosya ile kurmak isterseniz:**
   ```bash
   pnpm run build:xpi
   ```
   - Zen Browser'da `about:addons` sayfasını açın.
   - Sağ üstteki **⚙ (Çark) -> "Dosyadan Eklenti Kur..." (Install Add-on From File...)** seçeneğine tıklayın.
   - `dist/robotistan-supply-assistant.xpi` dosyasını seçip **"Ekle"** deyin.

---

### Yöntem 2: Canlı Geliştirici Modu (Geliştirme Yaparken)

1. Zen Browser veya Firefox'ta `about:debugging#/runtime/this-firefox` adresine gidin.
2. **"Geçici Eklenti Yükle..."** (Load Temporary Add-on) butonuna tıklayın.
3. Proje ana dizinindeki `manifest.json` dosyasını seçin.
4. Kod değişikliklerinden sonra aynı ekrandan **"Yeniden Yükle"** (Reload) butonuna basarak güncellemeleri anında test edin.

---

### Yöntem 3: GitHub Üzerinden Otomatik Güncellemeler

Proje, GitHub Actions (`.github/workflows/release.yml`) ve Mozilla uyumlu `updates.json` ile entegredir. Yeni bir sürüm yayınlandığında:
```bash
git tag v1.1.0
git push origin v1.1.0
```
GitHub Actions `.xpi` paketini otomatik derler ve GitHub Releases sayfasına yükler. Zen Browser `update_url` mekanizması ile yeni sürümleri otomatik olarak alır.

---

## 📖 Kullanım Adımları

### Senaryo A: LCSC'de Gezinirken Stok Takibi ve Sepete Ekleme
1. Zen Browser'da `https://www.lcsc.com` adresini açın ve komponent arayın.
2. Ürün listesinde veya detay sayfasında beliren Robotistan rozetlerini (🟢 Stokta / ✈️ Ön Sipariş vb.) inceleyin.
3. Farenizi rozetin üzerine getirip açılan kutudan istediğiniz miktarı yazın ve **"🛒 Robotistan Sepetime Ekle"** butonuna tıklayın.
4. Parça doğrudan Robotistan Pro sepetinize aktarılacaktır.

### Senaryo B: KiCad Projesini Toplu Sepete Aktarma
1. `https://robotistanpro.com` adresine gidin ve kurumsal hesabınızla oturum açın.
2. Sağ alt köşedeki **"KiCad BOM Aktar"** butonuna tıklayın.
3. KiCad'den aldığınız `ibom.html` veya `.csv` dosyasını panele sürükleyip bırakın.
4. Hedef PCB adedini belirleyin (örn. `10`).
5. **"1. Robotistan'da Sorgula ve MOQ Hesapla"** butonuna basarak fiyat ve stokları çekin.
6. **"2. Sepete Ekle"** butonuyla stokta olan tüm parçaları sepete gönderin.
7. Varsa ön sipariş parçalarını **"📋 Ön Sipariş Listesini Kopyala"** ile panoya alıp satış temsilcinize iletin.

---

## 📁 Proje Yapısı

```text
robotistan-supply-assistant/
├── manifest.json            # WebExtensions Manifest V3
├── package.json             # pnpm script ve bağımlılık tanımları
├── background.js            # Arka plan servis betiği (CORS, istek kuyruğu, sepet API)
├── updates.json             # Otomatik güncelleme manifesti
├── icons/                   # 16x16, 48x48, 128x128 ikonlar
├── lib/
│   ├── lz-string.js         # iBOM LZString çözücü
│   ├── bom-parser.js        # KiCad iBOM / CSV ayrıştırıcı
│   └── robotistan-api.js    # Hibrit API (hızlı JSON + çok sayfalı katalog + sepet)
├── content/
│   ├── lcsc/                # LCSC.com canlı rozet ve sepet ekleme betikleri
│   │   ├── content.js
│   │   └── styles.css
│   └── robotistan/          # Robotistan Pro BOM yönetim paneli ve sepet otomasyonu
│       ├── content.js
│       └── content.css
├── popup/                   # Araç çubuğu hızlı arama penceresi
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── scripts/
│   └── install-zen.js       # Otomatik Zen Browser profil kurulum betiği
├── test-parser.js           # KiCad ibom.html ayrıştırma birim testi
└── test-robotistan-api.js   # Canlı Robotistan Pro hibrit API testi
```

---

## 🧪 Terminal Komutları

```bash
# KiCad BOM Ayrıştırma Testi (ibom.html):
pnpm run test:parse

# Robotistan Pro Canlı Hibrit API Testi (C77055, C8436, C149588):
pnpm run test:api

# WebExtension Lint Denetimi:
pnpm run lint

# Zen Browser Kalıcı Kurulumu:
pnpm run install:zen

# Dağıtım XPI Paketi Oluşturma:
pnpm run build:xpi
```

---

## 📄 Lisans

MIT License - İlteray
