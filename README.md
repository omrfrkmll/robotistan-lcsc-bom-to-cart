# Robotistan Pro - KiCad BOM to Cart (Zen Browser / Firefox Eklentisi)

Bu WebExtension eklentisi, KiCad üzerinden oluşturulan malzeme listelerini (**Interactive HTML BOM - `ibom.html`** veya **CSV / TSV**) doğrudan **Robotistan Pro** (`robotistanpro.com`) üzerinde açarak; belirlenen hedef PCB adedine, parça bazlı **MOQ (Minimum Sipariş Adedi)** ve **paket artış katlarına (Step)** göre otomatik hesaplayıp tek tıkla sepete eklemenizi sağlar.

Ayrıca Robotistan Pro mağaza kataloğundaki **çok sayfalı arama sonuçlarını tam kod eşleşmesiyle çözer** ve online sepete eklenemeyen **0-stoklu ön sipariş ("Temin Edilecek") ürünlerini ayrı bir listede toplayarak proforma/teklif için tek tıkla kopyalama imkanı sunar**.

---

## 🚀 Temel Özellikler

1. **Doğrudan Robotistan Pro Entegrasyonu (CORS & Oturum Güvenliği):**
   - Eklenti doğrudan `robotistanpro.com` üzerinde WebExtension Content Script olarak çalışır.
   - Sayfanın sağ alt köşesinde şık, akıcı ve kapatılabilir bir **"KiCad BOM Aktar"** kayan yan paneli (drawer) sunar.
   - Kullanıcının oturum çerezlerini ve mağazanın güncel `CART_CSRF_TOKEN` anahtarını kullanarak güvenli şekilde işlem yapar.

2. **KiCad BOM Formatları:**
   - **Interactive HTML BOM (`ibom.html`):** KiCad'in Interactive HTML BOM çıktısını doğrudan okur; dahili sıfır bağımlılıklı LZString decompressor ile dosyayı tarayıcı içinde yerel olarak çözer.
   - **KiCad CSV / TSV / TXT:** Standart KiCad dışa aktarılan parça tablolarını ve sekmeyle ayrılmış listeleri destekler.

3. **Çok Sayfalı Arama & Tam Kod Doğrulaması (Multi-Page Exact Matching):**
   - 4 veya 5 haneli kısa LCSC kodlarında (örneğin `C8436`) mağaza aramasında onlarca ön-ek eşleşmesi çıksa dahi, arama sayfalarını (`&ps=2`, `&ps=3`) tarayarak tam eşleşen ürünü bulur. Asla hatalı veya benzer kodlu parça eklemez.

4. **Ön Sipariş ("Temin Edilecek") & Stok Yönetimi:**
   - Robotistan Pro'da tanımlı olan ancak tedarikçi stoğu 0 olan veya sitede "Temin Edilecek" rozetine sahip ürünleri otomatik tespit eder.
   - Bu parçalar tabloda turuncu `✈️ Ön Sipariş (Temin Edilecek)` rozetiyle ve özel **"✈️ Ön Sipariş"** sekmesinde ayrıştırılır.
   - **Tek Tıkla Kopyalama:** Online mağaza sepeti sıfır stoklu ürünlerin sepete eklenmesini engellediğinden, bu parçaları LCSC kodu, parça açıklaması, talep adedi ve devre pozisyonlarıyla panoya kopyalayarak Robotistan Pro kurumsal satış ekibine veya BOM teklif sistemine tek tıkla iletebilmenizi sağlar.

5. **Hedef PCB Miktarı, MOQ & Paket Katı Hesaplama:**
   - **PCB Çarpanı:** 1, 5, 10, 25, 50, 100 hazır butonları veya serbest giriş ile üretilecek kart sayısı belirlenir.
   - **MOQ & Paket Artışı (Step):** Robotistan Pro'dan çekilen `min` (MOQ) ve `step` değerlerine göre ihtiyaç adedi yukarı yuvarlanır:
     $$\text{Sipariş Adedi} = \max(\text{MOQ}, \lceil \frac{\text{İhtiyaç}}{\text{Paket Katı}} \rceil \times \text{Paket Katı})$$
   - **SMD Fire / Yedek Payı (%0, %5, %10):** Seri dizgi hatları için önerilen yedek komponent payı eklenebilir.

6. **Boş / LCSC Kodsuz Satır Yönetimi:**
   - Montaj delikleri (mounting holes), fiducial işaretçileri veya henüz LCSC kodu atanmamış komponentler ayrı sekmede ("Kodsuz / Boş Satırlar") gösterilir ve varsayılan olarak sepetten muaf tutulur. İstenirse tablo üzerinden satır içi (inline) anında kod atanabilir.

---

## 🛠️ Zen Browser / Firefox'a Yükleme

Zen Browser, Firefox (Gecko) tabanlı modern bir tarayıcıdır. Eklentiyi Zen Browser veya Firefox'a yüklemek için:

1. Zen Browser'ı açın.
2. Adres çubuğuna şunu yazıp Enter'a basın:
   ```text
   about:debugging#/runtime/this-firefox
   ```
3. Açılan sayfada **"Geçici Eklenti Yükle..."** (Load Temporary Add-on...) butonuna tıklayın.
4. Proje dizinindeki [`manifest.json`](file:///home/ilteray/ILTERAY/robotistan-lcsc-bom-to-cart/manifest.json) dosyasını seçin.
5. Eklenti anında yüklenecektir.

---

## 📖 Kullanım Kılavuzu

1. **Robotistan Pro'yu Açın:**  
   Zen Browser'da `https://robotistanpro.com` adresine gidin (ve kurumsal hesabınıza giriş yapın).
2. **BOM Panelini Açın:**  
   Sayfanın sağ alt köşesindeki **"KiCad BOM Aktar"** butonuna (veya tarayıcı araç çubuğundaki eklenti simgesine) tıklayın.
3. **BOM Dosyasını Yükleyin:**  
   Sürükle-bırak alanına KiCad'den aldığınız `ibom.html` veya `.csv` dosyasını bırakın.
4. **Hedef PCB Adedini Belirleyin:**  
   Üretmek istediğiniz PCB adedini seçin (örneğin `10`).
5. **Robotistan'da Bilgileri Sorgulayın:**  
   **"1. Robotistan'da Sorgula ve MOQ Hesapla"** butonuna tıklayın. Parçaların stok durumları, güncel TL fiyatları, MOQ katları ve ön sipariş durumları çekilecektir.
6. **Sepete Ekleyin:**  
   **"2. Sepete Ekle"** butonuna basın. Stokta olan tüm parçalar güvenli aralıklarla sepete aktarılır.
7. **Ön Sipariş Parçalarını İletin:**  
   Stokta bulunmayan ön sipariş parçaları varsa, **"📋 Ön Sipariş Listesini Kopyala"** butonuna tıklayarak teklif listesini panoya alıp satış temsilcinize iletebilirsiniz.

---

## 📁 Proje Dizin Yapısı

```text
robotistan-lcsc-bom-to-cart/
├── manifest.json            # WebExtensions Manifest V3 yapılandırması
├── package.json             # pnpm bağımlılık ve script tanımları
├── background.js            # Arka plan servis betiği (Action click & message handler)
├── icons/                   # 16x16, 48x48, 128x128 PNG ve SVG vektör simgeler
├── lib/
│   ├── lz-string.js         # KiCad ibom.html LZString decompressor kütüphanesi
│   ├── bom-parser.js        # KiCad ibom/CSV ayrıştırıcı ve MOQ hesaplayıcı
│   └── robotistan-api.js    # Multi-page arama, MOQ, stok ve sepet API istemcisi
├── content/
│   ├── content.js           # Robotistan Pro sayfasına enjekte edilen kullanıcı arayüzü
│   └── content.css          # Kayan yan panel, tablo ve buton stilleri
├── popup/
│   ├── popup.html           # Eklenti buton popup penceresi
│   ├── popup.css
│   └── popup.js
├── test-parser.js           # KiCad ibom.html ayrıştırma ve MOQ birim testi
└── test-robotistan-api.js   # Canlı Robotistan Pro çok sayfalı arama ve ön sipariş testi
```

---

## 🧪 Terminal Test Komutları

```bash
# KiCad BOM Ayrıştırma Testi (ibom.html):
pnpm run test:parse

# Robotistan Pro Canlı Arama, Çoklu Sayfa ve Ön Sipariş Testi:
pnpm run test:api

# WebExtension Lint Kontrolü:
pnpm run lint

# Eklentiyi Dağıtım ZIP'i Olarak Paketleme:
pnpm run package
```

---

## 📄 Lisans

MIT License - İlteray
