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
| `cat-animation/figure/index.html` | WebGPU 收藏公仔版（單一 HTML，程序生成 PVC 公仔、亞加力底座、剛體物理、可擺姿勢、飲咖啡／食煙動作；撳「Load model」可以載入自己嘅 .glb/.gltf/.obj/.stl，自動套用同一套 PVC 效果；要支援 WebGPU 嘅瀏覽器） |
| `cat-animation/desk-app/` | Windows 桌面公仔 app（Electron）：透明視窗淨係顯示公仔，詳情睇入面嘅 README |
| `cat-animation/bear-figure/index.html` | 熊仔衫人仔 Q 版 3D 公仔（WebGPU，toon 三級光影＋粗描邊）：發呆（眨眼、推眼鏡）、瞓覺、食杯麵、用手提電腦做嘢；撳肚上隻熊仔會出心心 |
| `cat-animation/bear-2d/index.html` | 熊仔衫人仔 2D 版（直接用原圖做底，貼足原畫；WebGL 網格令頭、耳仔、眼鏡、尾巴、腳板、熊掌郁得）：發呆（眨眼、望兩邊、歪頭、耳仔郁、推眼鏡、搖尾）、瞓覺（Zzz＋鼻涕泡）、食杯麵（夾麵吸麵）、做嘢（手提電腦＋螢幕光）；撳肚上隻熊仔會出心心 |
| `cat-animation/bear-2d-standing/index.html` | 熊仔衫人仔 2D 企起身版：上半身保留原圖（剪走背景同盤住嘅腳），下半身、腳板同尾巴用同款粗線重畫；動作同 2D 版一樣，再加踮腳、企住瞌眼眉搖下搖下、撳肚熊仔會跳 |
| `cat-animation/bear-rig/index.html` | 熊仔衫人仔骨架動畫：頭用原圖，身同四肢改做有骨架（IK）嘅向量木偶，身形收窄。頭、身、左右手、左右腳各有一組獨立動作可以逐個試（揮手、舉手、推眼鏡、叉腰、踏步、踢腳、跳等），企住有發呆、踏步、揮手、企住瞌四套全身動作；坐低有坐低（伸懶腰、郁腳趾、搲頭）、瞓覺（打喊露、攞枕頭、側身瞓）、攞杯麵出嚟食（攞杯麵、撕蓋、等、夾麵食、拍肚）、攞電腦出嚟做嘢（攞電腦、開蓋、打字、諗嘢、推眼鏡、伸懶腰、收電腦）四段劇情，轉換時順滑過渡 |

重新產生（需要 Python Pillow、numpy 同 ffmpeg）：

```
python3 cat-animation/make_animation.py
```

重新匯出 3D 模型：

```
cd cat-animation/3d && npm install && npm run export-glb
```
