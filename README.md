# Robotistan Pro - KiCad BOM to Cart (Zen Browser / Firefox Eklentisi)

Bu eklenti, KiCad üzerinden oluşturulan malzeme listelerini (**ibom.html** veya **CSV**) doğrudan **Robotistan Pro** (`robotistanpro.com`) üzerinde açarak, belirlenen hedef PCB adedine, parça bazlı **MOQ (Minimum Sipariş Adedi)** ve **paket artış katlarına (Step)** göre otomatik hesaplayıp tek tıkla sepete eklemenizi sağlar.

---

## 🚀 Temel Özellikler

1. **Doğrudan Robotistan Pro Entegrasyonu (CORS & Oturum Sorunsuz):**
   - Eklenti doğrudan `robotistanpro.com` sayfasında content script olarak çalışır.
   - Sayfada sağ altta şık ve rahatsız etmeyen bir **"KiCad BOM Aktar"** butonu ve kayan yan panel (drawer) sunar.
   - Giriş yapılmış kurumsal/bireysel sepet oturumunu ve CSRF token'ı kullanarak sepete güvenle ekleme yapar.

2. **KiCad BOM Formatları Desteği:**
   - **Interactive HTML BOM (`ibom.html`):** KiCad'in popüler interactive HTML BOM çıktısını doğrudan okur, LZString algoritmasıyla veriyi tarayıcıda çözer.
   - **KiCad CSV / TSV:** Standart KiCad veya özel dışa aktarılan parça tablolarını ayrıştırır.

3. **Boş / LCSC Kodsuz Satır Yönetimi:**
   - Montaj delikleri (mounting holes), fiducial işaretçileri veya henüz LCSC kodu girilmemiş parçalar tespit edilir.
   - Kodsuz satırlar sarı renkle ayrı sekmede ("Kodsuz / Boş Satırlar") gösterilir; varsayılan olarak sepete ekleme seçiminden çıkarılır.
   - İstenirse arayüz üzerinden eksik olan kod satır içi (inline) anında girilebilir.

4. **Hedef PCB Miktarı & MOQ / Paket Katı Hesaplama:**
   - **PCB Çarpanı:** 1, 5, 10, 25, 50, 100 hazır butonları veya manuel giriş ile üretilecek kart sayısı belirlenir.
   - **Otomatik MOQ & Paket Artışı:** Robotistan Pro'dan çekilen `min` (MOQ) ve `step` değerlerine göre ihtiyaç adedi yukarı yuvarlanır:
     $$\text{Sipariş Adedi} = \max(\text{MOQ}, \lceil \frac{\text{İhtiyaç}}{\text{Paket Katı}} \rceil \times \text{Paket Katı})$$
   - Örneğin bir kartta 19 adet direnç varsa ve 10 kart üretilecekse: İhtiyaç = 190. Robotistan'da MOQ ve paket artışı 50 ise, sipariş adedi otomatik olarak **200 adet** olarak belirlenir.
   - **SMD Fire / Yedek Payı (%0, %5, %10):** Seri dizgi için tavsiye edilen SMD fire toleransı eklenebilir.

5. **Toplu Sorgulama & Güvenli Sepete Ekleme:**
   - **Adım 1:** Seçili parçaların anlık stok, birim fiyat, KDV dahil fiyat ve MOQ bilgileri Robotistan Pro'dan taranır.
   - **Adım 2:** Parçalar mağazanın oturum mekanizmasına uygun bir zaman aralığıyla (throttled) sepete aktarılır. Canlı ilerleme çubuğu ile süreç izlenir.

---

## 🛠️ Zen Browser'a Yükleme Adımları

Zen Browser, Firefox (Gecko) tabanlı modern bir tarayıcıdır. Eklentiyi Zen Browser'a yüklemek için:

1. Zen Browser'ı açın.
2. Adres çubuğuna şunu yazıp Enter'a basın:
   ```text
   about:debugging#/runtime/this-firefox
   ```
3. Açılan sayfada **"Geçici Eklenti Yükle..."** (Load Temporary Add-on...) butonuna tıklayın.
4. Dosya seçicide şu yolu açıp içindeki `manifest.json` dosyasını seçin:
   ```text
   /home/ilteray/ILTERAY/robotistan-lcsc-bom-to-cart/manifest.json
   ```
5. Eklenti anında Zen Browser'a yüklenecektir!

---

## 📖 Kullanım Kılavuzu

1. **Robotistan Pro'ya gidin:**  
   Zen Browser'da `https://robotistanpro.com` adresini açın (ve gerekirse hesabınıza giriş yapın).
2. **BOM Panelini Açın:**  
   Sayfanın sağ alt köşesinde beliren turuncu logolu **"KiCad BOM Aktar"** butonuna (veya tarayıcı araç çubuğundaki eklenti simgesine) tıklayın.
3. **BOM Dosyasını Yükleyin:**  
   Sürükle-bırak alanına KiCad'den aldığınız `ibom.html` veya `.csv` dosyasını bırakın:
   - Örnek dosya: `/home/ilteray/ILTERAY/Dairy-Tank-Controller/hardware/Dairy-Tank-Controller/bom/ibom.html`
4. **Hedef PCB Adedini Belirleyin:**  
   Üretmek istediğiniz PCB adedini seçin (örneğin `10`).
5. **Robotistan'da Bilgileri Sorgulayın:**  
   Alttaki **"1. Robotistan'da Sorgula ve MOQ Hesapla"** butonuna tıklayın. Parçaların stok durumları, güncel TL fiyatları ve MOQ katları çekilecektir.
6. **Sepete Ekleyin:**  
   **"2. Sepete Ekle"** butonuna basın. Parçalar sırayla sepete aktarılacak ve işlem bitiminde doğrudan **"Sepete Git"** butonu belirecektir.

---

## 📁 Proje Dizin Yapısı

```text
robotistan-lcsc-bom-to-cart/
├── manifest.json            # WebExtensions Manifest V3 yapılandırması
├── package.json             # Bağımlılık ve script tanımları
├── background.js            # Arka plan servis betiği
├── icons/                   # 16x16, 48x48, 128x128 ve SVG eklenti simgeleri
├── lib/
│   ├── lz-string.js         # ibom.html decompressor kütüphanesi
│   ├── bom-parser.js        # KiCad ibom & CSV ayrıştırıcı + MOQ hesaplayıcı
│   └── robotistan-api.js    # Robotistan Pro arama ve sepet istemci API'si
├── content/
│   ├── content.js           # Robotistan Pro sayfasına enjekte edilen kullanıcı arayüzü
│   └── content.css          # Kayan yan panel ve buton stilleri
├── popup/
│   ├── popup.html           # Eklenti buton popup arayüzü
│   ├── popup.css
│   └── popup.js
├── test-parser.js           # Dairy-Tank BOM testi
└── test-robotistan-api.js   # Canlı Robotistan Pro sorgulama testi
```

---

## 🧪 Terminal Test Komutları

Eklenti mantığını terminalde denemek için:

```bash
# KiCad BOM Ayrıştırma Testi (ibom.html):
pnpm test:parse

# Robotistan Pro Canlı Arama ve MOQ Testi:
node test-robotistan-api.js
```
