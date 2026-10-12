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

開咗 GitHub Pages（見上面）之後，網址係 `https://<帳戶>.github.io/<repo>/japan-trip/`。建議喺手機瀏覽器「加至主畫面」。
