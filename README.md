# Screenshot Enhancer

Windows için tepside (system tray) çalışan küçük bir verimlilik uygulaması. Ekran görüntüsü aldığın anda, görüntünün alındığı yerin yanında animasyonlu bir önizleme kutucuğu belirir. Kutucuğu fareyle tutup WhatsApp'a, tarayıcıdaki bir yükleme alanına ya da herhangi bir klasöre sürükleyip bırakabilirsin — dosya doğrudan oraya gider.

## Nasıl çalışır

**Kendi yakalaması** — uygulama artık ekran görüntüsünü kendisi de alabilir. `Ctrl+Shift+A` ekranı dondurup alan seçtirir, `Ctrl+Shift+F` imlecin bulunduğu ekranın tamamını alır. Sonuç doğrudan kutucuk olur ve panoya da yazılır. Seçim sırasında `Esc` vazgeçirir. Bu iki kısayol duraklatmadan etkilenmez: açıkça istenen bir işlemdir.

**Dışarıdan yakalama** iki yoldan olur, ikisi de aynı anda açık olabilir:

- **Pano izleme** — `PrtSc`, `Alt+PrtSc`, `Win+Shift+S` ve Ekran Alıntısı Aracı gibi panoya kopyalayan her yöntem. Varsayılan "Sadece ekran görüntüleri" modunda, panoda metin/HTML de varsa yok sayılır; böylece tarayıcıdan resim kopyaladığında kutucuk çıkmaz.
- **Klasör izleme** — `Win+PrtSc` ile diske kaydedilen görüntüler. `Pictures\Screenshots`, `Pictures\Ekran Görüntüleri` ve OneDrive karşılıkları otomatik bulunur; ayarlardan ek klasör eklenebilir.

`Win+PrtSc` hem panoya kopyalayıp hem dosyaya yazdığı için aynı kare iki kez gösterilmez: uygulama geçici kopyayı atıp kutucuğu diskteki gerçek dosyaya bağlar, böylece sürüklediğinde asıl dosya gider.

**Konumlandırma** iki modda çalışır. Varsayılan "alındığı yerde" modunda kutucuk imlecin bittiği noktanın hemen yanında belirir ve yığın ekranın içine doğru büyür: imleç ekranın alt yarısındaysa yukarı, üst yarısındaysa aşağı açılır. "Sabit konumda" modunda ise sekiz yönden biri seçilir — sol üst, orta üst, sağ üst, sol, sağ, sol alt, orta alt, sağ alt. Her iki modda da kutucuk, görüntünün alındığı ekranda çıkar.

**Sürükle-bırak** Electron'un yerel dosya sürüklemesini kullanır, yani karşı uygulama bunu normal bir dosya bırakma işlemi olarak görür.

**Fare geçirgenliği** ana süreçte çözülür. Önizleme penceresi varsayılan olarak tıklamaları altındaki uygulamaya geçirir; imleç bir kartın üstüne geldiğinde geçici olarak etkileşime açılır. İsabet testi renderer'da değil ana süreçte yapılır: Windows'ta `setIgnoreMouseEvents(true, { forward: true })` mousemove olaylarını renderer'a **iletmiyor** (ölçüldü: sıfır olay), bu yüzden kart dikdörtgenleri renderer'dan bildirilir ve ana süreç imleç konumunu ~24 ms'de bir yoklayarak karşılaştırır.

Araç çubuğunun görünürlüğü de CSS `:hover` yerine bu isabet testinden gelen `.hot` sınıfıyla sürülür — odak almayan ve tıklama geçirgenliği sürekli değişen bir pencerede Chromium'un hover takibi güvenilmez. Katmanın kendisi `pointer-events: none` kalır, yalnızca düğmeler ve taşıma tutamacı fare olayı alır; aksi halde katman kartı kaplar ve sürüklemenin kaynağı olan `draggable` kart mousedown almaz.

Son kart da kapandığında pencere **gizlenmez**, yalnızca boşaltılır. Windows'ta bu pencereyi `hide()` edip yeniden göstermek girdi durumunu kalıcı olarak bozuyor: sonrasında `setIgnoreMouseEvents(false)` çağrılsa bile fare olayları renderer'a ulaşmıyor ve kartın düğmeleri ölü kalıyor (ölçüldü). Kartsızken pencere tamamen şeffaf ve tıklama geçirgen olduğu için açık kalmasının maliyeti yok; `skipTaskbar` sayesinde Alt+Tab listesinde de görünmez. Pencereyi her yakalamada yeniden yaratmak ise ilk kartın gecikmesine yol açardı.

Sorun ayıklamak için `SE_DEBUG=1` ile başlatıldığında kart dikdörtgenleri, imleç konumu ve geçirgenlik durumu konsola yazılır.

Kutucuğun üstüne gelince kopyala / farklı kaydet / aç / **metni kopyala (OCR)** / klasörde göster / sabitle düğmeleri belirir. Sol üstteki onay düğmesiyle birden fazla kutucuğu seçip **tek seferde birlikte sürükleyebilirsin**. Kopyalama ve kaydetme sonrasında kartın ortasında kısa bir onay balonu çıkar. "Farklı kaydet" sistem diyaloğu açtığı sürece otomatik gizleme sayacı duraklatılır — yoksa siz diyalogla uğraşırken kart kaybolur ve işlem yapılmamış gibi görünürdü. Üst kenarın ortasındaki küçük tutamaçtan çekerek kutucuğu istediğin yere taşıyabilirsin — gövdesinden çekmek dosyayı sürükler, tutamaçtan çekmek pencereyi taşır. Alt kenardaki ince çizgi otomatik gizlenme sayacıdır; fare üstündeyken ve sürükleme sırasında durur. Çift tıklamak görüntüyü açar.

**Metni kopyala (OCR)**, Windows'un yerleşik `Windows.Media.Ocr` motorunu PowerShell üzerinden çağırır (`scripts/ocr.ps1`): harici bağımlılık ya da ağ trafiği yok, diller Windows dil ayarlarından gelir.

Tanıma doğrudan yazının piksel yüksekliğine bağlı olduğu için görüntü OCR'a verilmeden önce büyütülür. Ekrandaki 12-13 px'lik yazı ham hâliyle verildiğinde hatalı okunuyordu; ölçüm: 560x200 terminal metninde ham görüntü %94, 4 kat büyütülmüş görüntü %100 doğruluk. Ölçek 4 katla ve ~8 MP bütçesiyle sınırlanıyor (motorun kenar sınırı 10000 px), böylece büyük ekran görüntülerinde işlem yavaşlamıyor — uçtan uca ~1,2 saniye. Renk ters çevirme aynı testte büyütmenin üzerine bir katkı sağlamadığı için yapılmıyor. Büyütülmüş kopya geçici bir dosyaya yazılır; asıl yakalama dosyası hiç değişmez.

**Global kısayollar** uygulama arka plandayken de çalışır: bölge seçerek yakala (`Ctrl+Shift+A`), tüm ekranı yakala (`Ctrl+Shift+F`), son görüntüyü tekrar göster (`Ctrl+Shift+V`) ve yakalamayı duraklat/sürdür (`Ctrl+Shift+P`). Ayarlardan kombinasyona basarak değiştirilir; `Backspace` kısayolu kaldırır. Başka bir uygulama kısayolu tutuyorsa ayarlarda uyarı görünür.

**Yakalama sesi** dosya yerine Web Audio ile sentezlenir — ne ek varlık ne de CSP izni gerekir. Yumuşak, iki notalı kısa bir blip (188 ms): zarf 12 ms'lik girişle başlayıp üstel söner, alçak geçirgen süzgeçten geçer. Başlangıç ve bitiş genliği sıfır olduğu için hoparlörde tık/pat sesi oluşmaz. Sentez `src/renderer/shared/chime.js` içinde; ayarlardaki "Çal" düğmesi ekran görüntüsü almadan dinlemeyi sağlar.

Önizleme penceresi odağı çalmaz ve kutucukların dışında kalan alan tıklama geçirgendir — altındaki uygulamayla çalışmaya devam edebilirsin.

## Çalıştırma

```bash
npm install
```

```bash
npm start
```

Kurulabilir sürüm (NSIS):

```bash
npm run dist
```

İkonlar `scripts/generate-icons.js` ile kodla üretilir, harici bağımlılık yoktur:

```bash
npm run icons
```

## Ayarlar

Tepsi simgesine tıklayınca açılır. Tüm değişiklikler anında uygulanır, kaydet düğmesi yoktur.

| Bölüm | Neler var |
| --- | --- |
| Genel | Windows açılışında başlat, açılışta pencereyi gizle |
| Yakalama | Pano izleme ve modu, kontrol sıklığı, klasör izleme, ek klasörler |
| Görünüm | Nerede belirsin (alındığı yerde / sabit konumda), 8 yönlü konum ızgarası, kutucuk boyutu, kenar boşluğu, aynı anda gösterilecek kutucuk sayısı, ekranda kalma süresi, saydamlık, hangi monitörde çıkacağı, tema, araç çubuğu |
| Kısayollar | Global kısayollar açık/kapalı, bölge seçerek yakala, tüm ekranı yakala, son görüntüyü göster, yakalamayı duraklat |
| Ses | Yakalama sesi açık/kapalı, ses düzeyi, dinleme düğmesi |
| Animasyon | Açık/kapalı, tür (kayarak / yandan kayarak / büyüyerek / soluklaşarak), yumuşatma eğrisi (yaylı / yumuşak / keskin / akıcı / giriş-çıkış / doğrusal), giriş ve çıkış süreleri, kayma mesafesi |
| Depolama | Dosya adı öneki, geçici dosyaların saklanma süresi, klasörü aç / temizle |

"Önizlemeyi test et" düğmesi sahte bir ekran görüntüsüyle animasyonu tetikler; ayarları ekran görüntüsü almadan denemek için.

## Dosyalar

Geçici PNG'ler `%APPDATA%\screenshot-enhancer\captures` altına yazılır ve seçilen süre dolunca temizlenir. Temizlik yalnızca bu klasöre dokunur — kendi `Ekran Görüntüleri` klasörüne yazılan dosyalar hiçbir zaman silinmez.

Ayarlar `%APPDATA%\screenshot-enhancer\settings.json` dosyasında tutulur.

## Yapı

```
src/main/          ana süreç
  index.js         yaşam döngüsü, yakalama akışı, IPC
  config.js        ayarlar (şema doğrulamalı birleştirme)
  store.js         yakalama kayıtları ve disk temizliği
  clipboardWatcher.js  pano yoklama + ucuz parmak izi
  folderWatcher.js     ekran görüntüsü klasörleri
  previewManager.js    önizleme penceresi ve geometri
  capture.js       ekran yakalama ve bölge seçimi
  tray.js, settingsWindow.js
src/preload/       contextBridge köprüleri
src/renderer/      önizleme kutucuğu, bölge seçimi ve ayarlar arayüzü
  shared/chime.js  yakalama sesinin sentezi (iki pencere de kullanır)
scripts/           ikon üreteci, OCR betiği
```
