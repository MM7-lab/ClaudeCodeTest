# Pet kit：用同一套系統整新角色

熊仔衫人仔（Cozy Bear Studio 網頁版 + Windows 桌面寵物）背後嘅動畫系統，同埋整新角色嘅方法。

## 檔案

| 檔案 | 係乜 |
|---|---|
| `characters/polar-bear/character.svg.html` | 熊仔嘅畫（一個 `<svg>`，所有會郁嘅部位都有 id） |
| `characters/yo-jie/` | Yo 姐（企喺度嘅角色）：畫、`rig.js`（自己嘅關節、手臂同動作）、`build.json` |
| `src/engine.js` | 動畫引擎：動作（idle、wave、cocoa、vibe、sleep、code、clock）、漸變、彈簧、眨眼、粒子、自動模式、時鐘 |
| `src/input.js` | 撳角色各部位嘅反應 |
| `src/studio.html` + `src/ui-studio.js` | 網頁版（有控制面板） |
| `src/desk.html` + `src/ui-desk.js` | 桌面寵物版（透明、冇背景） |
| `build.py` | 將角色同引擎砌成兩個網頁 |
| `../bear-pet-app/` | Windows 桌面寵物（Electron）；GitHub Actions 自動整 `.exe` |
| `../yo-jie-studio/`、`../yo-jie-pet-app/` | Yo 姐嘅網頁版同桌面寵物（workflow：`.github/workflows/yo-jie-pet-app.yml`） |

```
python3 build.py                 # 熊仔 → ../bear-onesie-studio/index.html 同 ../bear-pet-app/pet.html
python3 build.py <角色名>        # characters/<角色名>/character.svg.html（有 rig.js 就一齊砌入去）
python3 build.py yo-jie          # Yo 姐 → ../yo-jie-studio/index.html 同 ../yo-jie-pet-app/pet.html
```

每個角色可以喺 `characters/<角色名>/build.json` 指定輸出位置，例如：

```json
{ "studio": "../cat-studio/index.html", "pet": "../cat-pet-app/pet.html" }
```

`build.json` 仲可以加 `"replace"`，將網頁入面熊仔嘅字眼（標題、說明、按鈕）換成新角色嘅，例如 `{"<title>熊仔</title>": "<title>Yo 姐</title>"}`；每句都一定要搵到，搵唔到 build 會停。`characters/yo-jie/build.json` 有完整例子。

## 新角色要符合嘅「骨架」

引擎靠 id 搵部位，再喺固定嘅關節位置轉動佢哋。新角色最簡單嘅做法係**沿用熊仔嘅畫布同關節位置**，只係換外表。

**畫布**：`<svg id="character-svg" viewBox="0 0 600 630">`，角色坐喺地上，地面接觸點 (304, 586)。

**一定要有嘅 id**（冇嘅部位可以放一個空嘅 `<g>`）：

| 部位 | id | 關節／原點（引擎寫死咗） |
|---|---|---|
| 影 | `rig-shadow`（ellipse） | |
| 成個角色 | `rig-root` | 以 (304, 586) 做縮放中心 |
| 尾 | `rig-tail` | (452, 512) |
| 肚（呼吸） | `rig-belly-content` | |
| 拉鍊頭 | `rig-zipper` | (301, 322) |
| 肚上公仔 | `rig-belly-bear`，入面 `belly-eyes-open`、`belly-eyes-wink` | |
| 腳 | `rig-leg-left`、`rig-foot-left` (176, 566)；`rig-leg-right`、`rig-foot-right` (242, 560) | |
| 左手 | `rig-arm-left`：`sleeve-left-fill/outer/inner/crease` + `rig-paw-left` (208, 492) | |
| 右手 | `rig-arm-right`：`sleeve-right-fill/shadow/upper/lower/crease` + `rig-paw-right` (318, 496) | |
| 頭 | `rig-head` (308, 298) | |
| 耳 | `rig-ear-left` (248, 134)、`rig-ear-right` (390, 136) | |
| 眼 | `rig-eyes`，入面 `eyes-open`、`eyes-closed`、`eyes-happy` | |
| 口 | `mouth-deadpan`、`mouth-smile`、`mouth-cat`、`mouth-o` | |
| 面紅 | `face-blush` | |
| 眼鏡 | `rig-glasses`，入面 `glasses-shine` | |
| 道具 | `prop-laptop`、`prop-mug`（喺右手掌入面）、`prop-headphones`（喺頭入面） | |
| 粒子層 | `particles-layer`（放最後） | |

隱藏嘅部位用 `class="hidden"`。

**手袖係程式畫嘅**：`src/engine.js` 嘅 `updateLeftSleeveGeometry` 同 `updateRightSleeveGeometry` 會按手掌位置重畫手袖，入面嘅數字跟熊仔嘅膊頭位置。新角色膊頭位置唔同，就喺佢自己嘅 `rig.js` 重新定義呢兩個 function（唔使改引擎）。

**位置唔同點算**：喺 `characters/<角色名>/rig.js` 改 `JOINT`（引擎預設係熊仔嘅關節位置），唔好改引擎，咁熊仔就照舊行。`rig.js` 會喺引擎之後、撳部位反應之前執行，所以可以：

- `Object.assign(JOINT, { head: [304, 174], pawR: [384, 354], … })`：搬關節（仲有 `reach` 推眼鏡時手去邊、`gaze` 眼望滑鼠嘅中心）
- 重新定義 `updateLeftSleeveGeometry`／`updateRightSleeveGeometry`：自己畫手臂
- 換 `MODES.<動作>.pose`／`emit`：例如企喺度嘅角色要自己嘅動作同粒子位置
- 重新定義 `twitchEar`、`wiggleToes`、`triggerGlassesPush`、`headPat`、`fidget` 等反應
- 加 pose 欄位：`REST.x = 0; KEYS.push("x")`，佢會同其他欄位一樣喺動作之間漸變

`characters/yo-jie/rig.js` 係完整例子：企喺度、兩節手臂、Hooray 跳、托住個鐘介紹時間。

## 喺另一個 chat 整新角色

開新 chat 時揀返呢個 repo（MM7-lab/ClaudeCodeTest），然後貼呢段（改返你嘅角色描述）：

> 讀 `cat-animation/pet-kit/README.md`，用同一套動畫系統整一個新角色：**（角色描述，或者附上圖片／參考 HTML）**。
> 角色放喺 `cat-animation/pet-kit/characters/<名>/`，沿用熊仔嘅畫布同關節位置同所有 id，令引擎唔使改；如果真係要改關節位置，就改引擎時保持熊仔照樣行到。
> 用 `build.py <名>` 砌網頁版同桌面寵物版，輸出去新資料夾（`build.json`），桌面寵物照 `../bear-pet-app/` 抄一份新 app（改 appId、productName、圖示），再加一個 GitHub Actions workflow 整 Windows `.exe`。
> 唔好改動熊仔嘅檔案。
