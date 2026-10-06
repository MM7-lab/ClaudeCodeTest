# 新辦公室平面圖

規劃搬寫字樓用嘅平面圖工具：畫房間同間隔、按真實清單（cm）擺傢俬、檢查擺唔擺得晒、睇建議方案，仲可以切換 3D 模型。

## 檔案

| 路徑 | 用途 |
|---|---|
| `floor-planner/index.html` | 工具本體（亦係 Claude Artifact 嗰個版本） |
| `docs/index.html` | 網上版（GitHub Pages），由 `floor-planner/build_pages.py` 產生 |
| `docs/plan-data.json` | 網上版一打開就載入嘅平面圖同建議方案 |
| `docs/cat/index.html` | 桌面貓貓：陪你做嘢，定時提你飲水、休息、去廁所（見下面） |

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

## 桌面貓貓（Desktop Cat）

網址：`https://<帳戶>.github.io/<repo>/cat/`（要先照上面開咗 GitHub Pages）。

- 撳 **Start ▶**，隻貓會每 30 分鐘（可以改 15–90 分鐘）輪流提你：飲水 → 休息伸展 → 飲水 → 去廁所。
- 提醒時貓貓會跳、喵兩聲、出對話框，加桌面通知（要允許通知）。撳「Done ✓」記一次，「Later」遲 5 分鐘再提；唔理佢就每 5 分鐘再喵，最多 3 次。
- **Float on top**：用 Chrome / Edge 會開一個細窗，永遠浮喺其他程式上面。個分頁要保持開住。其他瀏覽器會開一個普通細窗。
- 撳隻貓可以摸佢；佢會眨眼、郁尾、四圍望，耐咗會瞓覺。可以改名、揀毛色（橙、灰、黑、白）。
- 設定同今日紀錄只會儲喺自己部機嘅瀏覽器。
