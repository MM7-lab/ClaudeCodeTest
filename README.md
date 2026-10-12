# 新辦公室平面圖

規劃搬寫字樓用嘅平面圖工具：畫房間同間隔、按真實清單（cm）擺傢俬、檢查擺唔擺得晒、睇建議方案，仲可以切換 3D 模型。

## 檔案

| 路徑 | 用途 |
|---|---|
| `floor-planner/index.html` | 工具本體（亦係 Claude Artifact 嗰個版本） |
| `docs/index.html` | 網上版（GitHub Pages），由 `floor-planner/build_pages.py` 產生 |
| `docs/plan-data.json` | 網上版一打開就載入嘅平面圖同建議方案 |

## 放上網（GitHub Pages）

1. Repo 嘅 **Settings → Pages**。
2. **Source** 揀 **Deploy from a branch**，branch 揀放咗呢啲檔案嗰條，folder 揀 **`/docs`**，撳 Save。
3. 一兩分鐘後，網址會係 `https://<帳戶>.github.io/<repo>/`。

注意：免費 GitHub 帳戶只可以喺 **public repo** 開 Pages，即係任何人都睇到個網頁同 `plan-data.json`。

## 網上版點樣儲資料

- 每個人嘅改動只會儲喺自己部機嘅瀏覽器。
- 想交換版本：撳「備份」匯出 JSON，對方撳「匯入」。
- 撳「重設」會返回 `docs/plan-data.json` 入面嘅版本。
- 想更新網上預設平面圖：喺工具撳「備份」，再用匯出嘅檔案取代 `docs/plan-data.json`（要保留 `schemes` 部分）。

## 方案

- 左邊「方案」入面，每個方案都係一張獨立平面圖：揀咗就可以直接改，自動儲存，唔會影響其他方案。第一次打開會揀方案 B，之後會記住你上次揀嘅方案。
- 喺方案入面撳「備份」，會將嗰個方案下載做獨立 JSON 檔；「匯入」會匯入去而家揀緊嘅方案。
- 網上版嘅「重設」只會還原而家揀緊嗰張圖。

## 改完工具之後

```
python3 floor-planner/build_pages.py
```

會重新產生 `docs/index.html`。

---

# 日本旅程記帳

`docs/japan-trip/index.html`：去日本旅行時記低每筆支出嘅工具，手機用得。

- **記一筆**：輸入金額，揀日圓（¥）或港幣（HK$），再揀類別（餐飲、交通、住宿、購物、藥妝、門票景點、其他）、付款方式、日期同備註。
- **切換顯示貨幣**：右上角撳「¥ 日圓」或「HK$ 港幣」，總數、每日明細同類別統計會一齊轉。
- **匯率**：撳「攞最新匯率」會由 open.er-api.com 攞市場參考價；冇網絡時可以自己輸入（例如兌換店牌價）。所有換算都用同一個匯率。
- **修改／刪除**：撳明細入面任何一筆就可以改；刪除要撳兩次確認。
- **匯出**：「匯出 CSV」有日圓同港幣兩欄，Excel 或 Google Sheets 直接開到；「複製文字總結」可以貼去 WhatsApp；「備份 JSON」同「匯入備份」用嚟換手機或者還原。
- 資料只會儲喺你部手機嘅瀏覽器（localStorage）。清除瀏覽器資料會清走記錄，所以旅程中間記得間中撳「備份 JSON」。

### 私隱

- 記錄只儲喺你部手機嘅瀏覽器，唔會上載去任何伺服器，亦冇任何追蹤或分析。
- 網頁只會連去兩個地方：Google Fonts（載入字型，Google 會見到你嘅 IP）同 open.er-api.com（只喺你撳「攞最新匯率」嗰陣）。兩個都唔會收到你嘅記錄，亦唔會收到來源網址。
- 網頁設定咗 Content Security Policy，就算有問題，都唔可以將資料傳去其他網站。
- 匯入嘅備份檔會先清理先用，偽造嘅檔案唔可以喺網頁度執行程式碼；匯出嘅 CSV 已防止 Excel 公式注入。
- GitHub Pages 上同一個帳戶嘅所有網頁共用同一個瀏覽器儲存空間，所以唔好喺同一個帳戶放唔信得過嘅網頁。
- 匯出嘅 CSV／JSON 檔案有齊你嘅消費記錄，分享之前諗清楚。

### 裝落手機（當 App 用）

呢個工具係 PWA：裝咗之後主畫面有自己嘅圖示，打開係全螢幕，冇網絡都用得（記帳、睇總數、匯出都得；只有「攞最新匯率」要上網）。

- **iPhone**：用 Safari 打開網址 → 撳下面「分享」掣 → 「加至主畫面」。
- **Android**：用 Chrome 打開，撳頁面頂嘅「安裝」，或者 Chrome 選單 →「安裝應用程式」。
- iPhone 上，Safari 同主畫面 App 嘅記錄係分開儲。裝好之後就喺 App 入面記帳；之前喺 Safari 記咗嘢，先「備份 JSON」再喺 App「匯入備份」。

網址：`https://mm7-lab.github.io/ClaudeCodeTest/japan-trip/`

App 檔案：`index.html`、`manifest.webmanifest`（名稱同圖示）、`sw.js`（離線快取）、`icon-*.png`。改咗任何檔案之後，要將 `sw.js` 入面嘅 `VERSION` 加一，手機先會攞新版本。

---

# 自動記帳（Android App）

`trip-android/`：Android 版，入面係同一個記帳頁面（`docs/japan-trip`），再加自動讀取付款通知。

- **自動擷取付款通知**：讀取八達通、PayMe、信用卡／銀行 App、Google Wallet、PayPay、AlipayHK、WeChat Pay 等嘅通知，讀出 HKD 或 JPY 金額。
- **一鍵確認**：偵測到付款就彈通知，撳「記帳」記低，撳「略過」唔記；亦可以喺 App 入面「待確認」度處理。
- **背景持續運作**：要求唔受省電限制。小米／紅米手機要喺「App 資料」開「自動啟動」。
- 喺「讀取邊啲 App 嘅通知」揀要讀邊啲 App；付款同銀行 App 會自動剔。

### 私隱同安全

- 所有處理都喺手機上做。App 本身唔會上載任何資料，亦唔會讀短訊。
- 有一次性密碼（OTP）、驗證碼、密碼字眼嘅通知會即刻略過，唔會儲存。收款、退款、增值唔會當支出。
- 冇金額嘅通知唔會儲存；只記低邊個 App 彈過通知（App 名，唔包內容），方便你揀。
- 關閉咗 Android 雲端備份，記錄唔會上傳去 Google。換手機請用「備份 JSON」。
- 簽署金鑰唔放喺 repo。正式金鑰放喺 GitHub Secrets：`TRIP_KEYSTORE_B64`、`TRIP_KEYSTORE_PASSWORD`、`TRIP_KEY_ALIAS`。冇設定嘅話，每次打包都用臨時金鑰，新版本要先移除舊版先裝到。

### 打包同安裝

GitHub Actions（`.github/workflows/trip-android.yml`）會跑測試、打包 APK，再喺 Android 模擬器試讀付款通知。APK 喺該次 Actions 執行頁面嘅「AutoLedger-APK」。

Android 13 或以上安裝咗網上下載嘅 App 之後，開通知權限前可能要：設定 → 應用程式 → 自動記帳 → 右上角 ⋮ →「允許受限制的設定」。
