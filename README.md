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

# 社畜貓動畫（`cat-animation/`）

用三張 AI 生成嘅貓貓圖砌成嘅 22 秒短片（1080×1350，IG 4:5）：鏡頭推移、咖啡蒸氣、煙霧粒子、煙頭發光、時鐘標籤同廣東話字幕。

| 路徑 | 用途 |
|---|---|
| `cat-animation/shachu-cat.mp4` | 成品 |
| `cat-animation/images/` | 原圖 |
| `cat-animation/make_animation.py` | 產生影片嘅程式（改字幕、時間線喺檔案入面嘅 `SUBS`、`CLOCKS`） |
| `cat-animation/3d/index.html` | 卡通 3D 躺平貓網頁（拖曳旋轉，有呼吸、擺尾同煙霧動畫） |
| `cat-animation/3d/cat-model.js` | 3D 模型本體（網頁同匯出共用） |
| `cat-animation/3d/lying-office-cat.glb` | 匯出嘅 3D 模型檔（Blender 等軟件開到，冇動畫） |

重新產生（需要 Python Pillow、numpy 同 ffmpeg）：

```
python3 cat-animation/make_animation.py
```

重新匯出 3D 模型：

```
cd cat-animation/3d && npm install && npm run export-glb
```
