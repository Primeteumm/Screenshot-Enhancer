# Screenshot Enhancer

Windows için tepside çalışan küçük bir ekran görüntüsü yardımcısı. Görüntüyü aldığın anda yanında bir önizleme kutucuğu belirir; onu fareyle tutup WhatsApp'a, bir yükleme alanına ya da herhangi bir klasöre **sürükleyip bırakabilirsin**. Dosyayı bulmak, açmak, yeniden adlandırmak yok.

macOS'taki ekran görüntüsü önizlemesinin ve Dropover'ın yaptığı işi Windows'ta yapar.

---

## Ne yapar

- **Her ekran görüntüsünü yakalar** — `PrtSc`, `Alt+PrtSc`, `Win+Shift+S`, Ekran Alıntısı Aracı ve `Win+PrtSc` ile diske kaydedilenler.
- **Kendisi de görüntü alır** — `Ctrl+Shift+A` ile bölge seçerek, `Ctrl+Shift+F` ile tüm ekranı.
- **Sürükle-bırak** — kutucuğu tutup bırak, dosya oraya gider. Birden fazla kutucuğu seçip birlikte de sürükleyebilirsin.
- **Metni kopyala (OCR)** — görüntüdeki yazıyı panoya alır. Windows'un yerleşik motoru; ağa çıkmaz.
- **Kutucuğun üstünde** kopyala, farklı kaydet, aç, klasörde göster, sabitle düğmeleri.
- **Yolundan çekilir** — odağı çalmaz, kutucuk dışında kalan her yer tıklama geçirgendir, süresi dolunca kendiliğinden kaybolur.

Görünüm, konum, animasyon, ses, kısayollar — hepsi ayarlardan değiştirilebilir.

---

## Kurulum

**Hazır sürüm:** [Releases](https://github.com/Primeteumm/Screenshot-Enhancer/releases) sayfasından kurulum dosyasını indir ve çalıştır.

Uygulama imzalanmadığı için Windows SmartScreen uyarı gösterebilir: *Daha fazla bilgi → Yine de çalıştır*.

**Kaynaktan:**

```bash
npm install
```

```bash
npm start
```

Kurulum dosyası üretmek için:

```bash
npm run dist
```

---

## Kısayollar

| Kısayol | Ne yapar |
| --- | --- |
| `Ctrl+Shift+A` | Bölge seçerek yakala |
| `Ctrl+Shift+F` | Tüm ekranı yakala |
| `Ctrl+Shift+V` | Son görüntüyü tekrar göster |
| `Ctrl+Shift+P` | Yakalamayı duraklat / sürdür |

Hepsi ayarlardan değiştirilebilir: alana tıkla, istediğin kombinasyona bas. `Backspace` kısayolu kaldırır. Başka bir uygulama kısayolu tutuyorsa ayarlarda uyarı görünür.

Bölge seçiminde `Esc` vazgeçirir. Yakalama kısayolları duraklatmadan etkilenmez — duraklatma yalnızca dışarıyı izleyen kısmı kapatır.

---

## Kutucuk

| İşlem | Nasıl |
| --- | --- |
| Dosyayı sürükle | Kutucuğun gövdesinden tutup çek |
| Kutucuğu taşı | Üst kenarın ortasındaki tutamaçtan çek |
| Birlikte sürükle | Sol üstteki onay düğmesiyle birkaçını seç, sonra sürükle |
| Görüntüyü aç | Çift tıkla |
| Diğer işlemler | Üstüne gel, alttaki düğmeler belirir |

Alt kenardaki ince çizgi ekranda kalma sayacıdır; fare üstündeyken, sürüklerken ve bir işlem sürerken durur. Sabitlersen hiç kaybolmaz.

---

## Ayarlar

Tepsi simgesine tıklayınca açılır. Değişiklikler anında uygulanır, kaydet düğmesi yoktur.

| Bölüm | Neler var |
| --- | --- |
| Genel | Windows açılışında başlat, açılışta pencereyi gizle |
| Yakalama | Pano izleme ve modu, kontrol sıklığı, klasör izleme, ek klasörler |
| Görünüm | Nerede belirsin (alındığı yerde / sabit konumda), 8 yönlü konum ızgarası, boyut, kenar boşluğu, aynı anda kaç kutucuk, ekranda kalma süresi, saydamlık, hangi monitör, tema, araç çubuğu |
| Kısayollar | Global kısayollar ve dört kısayolun ataması |
| Ses | Yakalama sesi, ses düzeyi, dinleme düğmesi |
| Animasyon | Tür (kayarak / yandan / büyüyerek / soluklaşarak), yumuşatma eğrisi, giriş-çıkış süreleri, kayma mesafesi |
| Depolama | Dosya adı öneki, saklama süresi, klasörü aç / temizle |

"Önizlemeyi test et" düğmesi sahte bir görüntüyle animasyonu tetikler; ayarları ekran görüntüsü almadan denemek için.

---

## Nasıl çalışır

**Yakalama** iki kanaldan olur. *Pano izleme*, panoya kopyalayan her yöntemi kapsar; varsayılan modda panoda metin/HTML de varsa yok sayılır, böylece tarayıcıdan resim kopyaladığında kutucuk çıkmaz. *Klasör izleme*, `Pictures\Screenshots`, `Pictures\Ekran Görüntüleri` ve OneDrive karşılıklarını izler; ayarlardan klasör eklenebilir. `Win+PrtSc` ikisini birden tetiklediği için aynı kare iki kez gösterilmez: geçici kopya atılıp kutucuk diskteki gerçek dosyaya bağlanır, sürüklediğinde asıl dosya gider.

**Konumlandırma** varsayılan olarak imlecin bittiği noktanın yanındadır; yığın ekranın içine doğru büyür. Sabit konum seçilirse sekiz yönden biri kullanılır. Her iki durumda da kutucuk görüntünün alındığı ekranda çıkar (ayarlardan sabitlenebilir).

**Sürükle-bırak**, Electron'un yerel dosya sürüklemesini kullanır; karşı uygulama bunu normal bir dosya bırakma işlemi olarak görür.

**OCR**, Windows'un yerleşik `Windows.Media.Ocr` motorunu PowerShell üzerinden çağırır (`scripts/ocr.ps1`). Harici bağımlılık ya da ağ trafiği yoktur, diller Windows dil ayarlarından gelir.

**Yakalama sesi** dosya yerine Web Audio ile sentezlenir (`src/renderer/shared/chime.js`) — ek varlık ya da CSP izni gerekmez.

---

## Ölçerek çözülen üç Windows davranışı

Bu üçü belgelenmemiş ve deneyerek bulunması zor olduğu için not düşülmüştür.

**1. `setIgnoreMouseEvents(ignore, { forward: true })` mousemove olaylarını renderer'a iletmiyor.** İki bağımsız ölçümde de sıfır olay geldi, `focusable` durumundan bağımsız olarak. Bu yüzden isabet testi renderer'da değil ana süreçte yapılır: renderer kart dikdörtgenlerini bildirir, ana süreç imleç konumunu ~24 ms'de bir yoklar. Araç çubuğunun görünürlüğü de CSS `:hover` yerine bu testten gelen `.hot` sınıfıyla sürülür.

**2. Önizleme penceresini `hide()` edip yeniden göstermek girdi durumunu kalıcı bozuyor.** Sonrasında `setIgnoreMouseEvents(false)` çağrılsa bile fare olayları renderer'a ulaşmıyor, kartın düğmeleri ölü kalıyor. Pencere artık gizlenmiyor; son kart kapanınca yalnızca boşaltılıyor. Kartsızken tamamen şeffaf ve tıklama geçirgen olduğu için maliyeti yok, `skipTaskbar` sayesinde Alt+Tab listesinde de görünmüyor.

**3. Katmanın tamamı tıklanabilir olursa dosya sürüklemesi kırılıyor.** Sürüklemenin kaynağı `draggable` karttır; üstünü kaplayan katman mousedown'ı yutarsa sürükleme hiç başlamaz. Bu yüzden katman `pointer-events: none` kalır, yalnızca düğmeler ve taşıma tutamacı fare olayı alır.

Bir de OCR tarafında: tanıma doğrudan yazının piksel yüksekliğine bağlı, ekrandaki 12–13 px'lik metin ham hâliyle verildiğinde harfler karışıyor. Görüntü OCR'a verilmeden önce büyütülüyor — 560×200 terminal metninde ölçüm: ham %94, 4 kat büyütülmüş %100. Ölçek 4 katla ve ~8 MP bütçesiyle sınırlı.

Hata ayıklamak için `SE_DEBUG=1` ile başlatıldığında kart dikdörtgenleri, imleç konumu ve geçirgenlik durumu konsola yazılır.

---

## Dosyalar

Geçici PNG'ler `%APPDATA%\screenshot-enhancer\captures` altına yazılır ve seçilen süre dolunca temizlenir. Temizlik yalnızca bu klasöre dokunur — kendi `Ekran Görüntüleri` klasörüne yazılan dosyalar hiçbir zaman silinmez. Ayarlar `%APPDATA%\screenshot-enhancer\settings.json` dosyasındadır.

---

## Yapı

```
src/main/            ana süreç
  index.js           yaşam döngüsü, yakalama akışı, kısayollar, IPC
  config.js          ayarlar (şema doğrulamalı birleştirme ve göç)
  store.js           yakalama kayıtları ve disk temizliği
  clipboardWatcher.js  pano yoklama + ucuz parmak izi
  folderWatcher.js   ekran görüntüsü klasörleri
  capture.js         ekran yakalama ve bölge seçimi
  previewManager.js  önizleme penceresi, geometri, imleç isabet testi
  tray.js, settingsWindow.js
src/preload/         contextBridge köprüleri
src/renderer/
  preview/           önizleme kutucuğu
  region/            bölge seçim katmanı
  settings/          ayarlar arayüzü
  shared/chime.js    yakalama sesinin sentezi
scripts/             ikon üreteci, OCR betiği
```

İkonlar harici bağımlılık olmadan kodla üretilir:

```bash
npm run icons
```

---

## Lisans

MIT
