# 沙灘小島桌面擺設（Beach Diorama）

一個浮喺 Windows 桌面最上層嘅 3D low-poly 卡通沙灘小島：海浪、泡沫、棕櫚樹、行街同游水嘅小人、海鷗、帆船、太陽傘同營火，全部用 Three.js 即時生成，冇用任何外部模型檔。用 Electron 包住，視窗約 300×300 px，背景透明，透明位置嘅點擊會穿透去底下嘅程式。

## 需要咩

- **Node.js 22.12 或以上**（本專案用 Electron 45，佢要求 Node ≥ 22.12）。
  用 `node -v` 同 `npm -v` 檢查。未裝或者版本太舊嘅話，去 <https://nodejs.org> 下載**目前嘅 LTS 版本**安裝（LTS 係邊個大版本號會隨時間轉，請以網站顯示為準）。
- Windows 10 / 11。

## 點樣行

```
cd beach-diorama
npm install
npm start
```

- `npm install` 好快，但 Electron 45 嘅執行檔係**第一次 `npm start` 先會下載**，所以第一次會慢少少、需要上網。
- 視窗會出現喺主螢幕工作區嘅**右下角**（喺工作列上面，留 20 px 邊距）。
- 想閂：右鍵撳小島 →「結束 (Quit)」。

## 操作

| 動作 | 效果 |
|---|---|
| 左鍵拖曳 | 旋轉鏡頭（有慣性；唔會去到島底下） |
| 滑鼠滾輪 | 縮放（最近距離係剛好見到成個島；最遠大約縮到 60%） |
| 右鍵撳小島 | 開選單 |
| 撳透明位置 | 穿透去底下嘅視窗，唔會擋住你 |

唔可以平移（pan），亦唔可以將鏡頭轉去島底下。

## 右鍵選單

| 項目 | 做咩 |
|---|---|
| 日間 (Day) | 預設。藍天色調、暖色陽光、見到太陽 |
| 日落 (Sunset) | 橙粉紅光線、低角度長影、金黃至粉紫嘅海水，太陽喺島後面落山 |
| 夜晚 (Night) | 深藍光線、月亮、閃爍星星、沙灘上有營火 |
| 移動位置 (Move position) | 視窗頂部出現一個**拖曳控點**（同埋白色外框），按住控點就可以搬視窗。移動期間成個視窗會接收滑鼠（唔穿透），搬好再揀「鎖定位置」 |
| 鎖定位置 (Lock position) | 移動模式中先出現（取代「移動位置」）。收起控點、恢復穿透，並**記住位置** |
| 重設視角 (Reset view) | 鏡頭角度同縮放回到預設（有短短動畫） |
| 結束 (Quit) | 閂 app |

- 三個光線模式之間會用約 **2 秒**平滑過渡。
- **上次揀嘅光線模式**同**視窗位置**會記住，下次開機自動還原。
- 如果記住嘅位置喺已拔走嘅螢幕外面，會自動跳返去右下角預設位置。

設定檔喺 Electron 嘅 userData 資料夾，Windows 通常係 `%APPDATA%\beach-diorama\settings.json`（內容好簡單：`{ "mode": "day", "position": { "x": …, "y": … } }`）。刪咗佢就會還原預設。

## 效能

- 渲染上限約 **30 fps**，像素比最多 2（`Math.min(devicePixelRatio, 2)`）。
- 全場約 100 個 mesh、約 7,000 個三角形，幾何同物料盡量共用；頁面被判定為隱藏（`document.hidden`）時會暫停渲染。
- 想睇 CPU：開工作管理員 →「詳細資料」→ 搵 `electron.exe`（會有幾個程序：主程序、renderer、GPU），加返「GPU」欄一齊睇。主要成本喺 GPU 程序，真 GPU 上應該好輕；如果見到 GPU 程序 CPU 好高，多數係 Chromium 退回咗軟件渲染（例如 GPU 驅動黑名單）。

## 疑難排解

**透明位置撳唔穿／島上面撳唔到**

預設用 `setIgnoreMouseEvents(true, { forward: true })`，由頁面用射線偵測（raycast）判斷游標係咪喺小島上面。如果喺你部機唔可靠，可以轉用備用方案「輪詢（poll）」：主程序每 40 ms 讀取游標位置，再叫頁面判斷。

```
npm start -- --click-through=poll
```

或者（PowerShell）：

```
$env:DIORAMA_CLICK_THROUGH = 'poll'; npm start
```

仲有 `off`：成個 300×300 視窗永遠接收滑鼠，唔穿透（最穩陣，但會擋住底下少少地方）。

**其他**

- `DIORAMA_DEBUG=1` 係開發／測試用嘅除錯模式（會開放測試用 hook 同 DevTools 權限），平時唔需要。
- 視窗被其他「最上層」程式蓋住：Windows 嘅「螢幕保護程式」層級已經係 Electron 提供最高嘅一級，但全螢幕獨佔遊戲仍然可能蓋過佢。

## 檔案結構

```
package.json      npm start
main.js           視窗、穿透、右鍵選單、設定儲存（Electron 主程序）
preload.js        contextBridge，只開放最少嘅 IPC
index.html        載入 Three.js（import map 指去 node_modules）、CSP
styles.css        透明背景、拖曳控點
renderer.js       場景組裝、相機、30 fps 迴圈、穿透用嘅 raycast
scene/
  util.js         共用物料、合併幾何、極座標網格
  layout.js       棕櫚樹、道具、營火位置
  island.js       沙灘島 + 圓柱托盤
  sea.js          海面（逐頂點波浪）+ 泡沫環
  palms.js        棕櫚樹
  people.js       行街嘅人 + 游水嘅人
  birds.js        海鷗
  boat.js         帆船
  props.js        太陽傘、毛巾、石頭
  night.js        星星、營火
  lighting.js     日間／日落／夜晚 + 2 秒過渡、太陽同月亮
tools/csp-hash.js 改咗 import map 之後用嚟重新計 CSP hash
```

安全設定：`contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`，頁面有 Content-Security-Policy，唔准導航同開新視窗。

**改 `index.html` 入面嘅 import map 之後**，要行 `node tools/csp-hash.js`，將輸出嘅 hash 貼返入 `<meta http-equiv="Content-Security-Policy">` 嘅 `script-src`，否則頁面會被 CSP 擋住而成片空白。

## 唔包括

聲音、其他地點、按真實時間自動轉光線、開機自動啟動、打包成安裝檔。
