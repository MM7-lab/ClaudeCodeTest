# 新辦公室平面圖

規劃搬寫字樓用嘅平面圖工具：畫房間同間隔、按真實清單（cm）擺傢俬、檢查擺唔擺得晒、睇建議方案，仲可以切換 3D 模型。

## 檔案

| 路徑 | 用途 |
|---|---|
| `floor-planner/index.html` | 工具本體（亦係 Claude Artifact 嗰個版本） |
| `docs/index.html` | 網上版（GitHub Pages），由 `floor-planner/build_pages.py` 產生 |
| `docs/plan-data.json` | 網上版一打開就載入嘅平面圖同建議方案 |
| `plush-octopus/index.html` | 獨立 WebGPU 示範：可以拉、揸、掟嘅 3D 毛公仔八爪魚（直接用 Chrome／Edge／Safari 26+ 開） |
| `turbo-granny/index.html` | 同一個引擎嘅「高速婆婆」毛公仔版本：拉、揸、掟、壓扁都得 |
| `moomin/index.html` | 同一個引擎嘅姆明毛公仔（非官方 fan art）：拉、揸、掟、壓扁，條尾會擺 |
| `baby-bear/index.html` | 同一個引擎嘅「熊啤啤」原創 BB 熊毛公仔：口水肩、縫線鼻、肉球腳掌 |
| `desktop/` | Windows 桌面版「Plush Toy Box」：四隻毛公仔放埋一個視窗。`npm run pack:edge` 出細 zip（用 Edge 開獨立視窗）；`npm run pack:win` 出完整 Electron 版 |

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
