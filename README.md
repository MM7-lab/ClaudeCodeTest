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
| `cat-animation/bear-rig/index.html` | 熊仔衫人仔桌面寵物動畫（將來做桌面寵物用）：造型跟參考角色圖（粗黑線、平塗陰影、連帽熊耳、眼鏡、肚上熊仔），全部用向量畫，手腳係骨架，Q 版比例（大頭、短手短腳）；表情有眨眼、開心彎眼、臉紅、笑、張口。每個關節用有速度同加速度上限嘅跟隨器，手以膊頭為圓心擺動，所以動作慢入慢出、冇瞬移；頭會跟身體輕輕彈、耳仔會郁。企定時左右腳輪流輕輕搖，間中做小動作（望吓、跳一跳、扭屁股、舉起雙手、怕醜、拍肚、推眼鏡、搲頭、伸懶腰、篤腳）；坐低時會擺腳、拍手。仲有揮手、坐低／企返起身、攞杯麵出嚟食、攞電腦出嚟做嘢、捲埋一舊瞓覺／起身；撳一下佢會開心到舉高雙手；可以用滑鼠拎起、掟落地；自動模式會自己決定做乜（唔會行嚟行去） |
| `cat-animation/bear-onesie-studio/index.html` | Cozy Bear Onesie Studio：你嘅熊仔衫人仔角色（造型一筆都冇改），換咗新嘅動畫系統：唔使網絡都用得（冇 CSS framework）、喺 60／120／144Hz 螢幕速度一樣、轉模式時動作同道具會漸變（杯、電腦、耳筒會長出嚟／收返）、自己眨眼、閒時會周圍望／郁耳仔／篤腳／推眼鏡／打喊露；Auto 模式好似桌面寵物咁自己決定做乜（飲可可、寫 code、聽歌、揮手、瞓覺），瞓緊撳佢會醒；設定會記低 |

重新產生（需要 Python Pillow、numpy 同 ffmpeg）：

```
python3 cat-animation/make_animation.py
```

重新匯出 3D 模型：

```
cd cat-animation/3d && npm install && npm run export-glb
```
