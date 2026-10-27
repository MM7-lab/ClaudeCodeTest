# Yo 姐桌面寵物（Windows）

透明、冇邊框、永遠喺最頂嘅細視窗，桌面上淨係見到 Yo 姐（同佢個影），冇背景。

## 用法

- 佢會自己決定做乜：企定定、揮手、飲杯嘢、戴耳筒聽歌、拎住手提電腦做嘢、企住瞌眼瞓；閒時會眨眼、擰吓頭、打喊露，間中仲會「Hooray!」跳起
- 樣子同動作直接用佢嘅角色設定稿（`../pet-kit/characters/yo-jie/source/sheet/`）
- **時鐘**：右鍵揀「⏰ 介紹時間」佢會一隻手放心口、另一隻手托住個鬧鐘介紹時間俾你睇；「身邊擺個鐘」會喺佢隔籬擺個細鬧鐘一直顯示時間（預設熄咗，右鍵剔返就有）；自動模式下每逢正點佢會自己攞個鐘出嚟，個鐘仲會震（開咗聲效會叮一聲）
- **眼睛**：跟住滑鼠望，成個螢幕都得；滑鼠停咗佢會自己周圍望
- **拖佢**：搬去桌面其他位置
- **撳佢**：撳面＝摸頭（臉紅、出心心、笑到瞇埋眼）；撳耳環或者散頭髮＝閃一閃；撳褲頭鈕＝出心心；撳腳＝「Hooray!」跳起；瞓緊撳佢會醒
- **右鍵**：自動開關、揀動作、摸頭、撥頭髮、Hooray 跳、大細（細／中／大）、聲效、眼跟滑鼠、永遠置頂、離開
- Yo 姐以外嘅透明位置撳落去會穿過去下面嘅視窗，唔會阻住你用電腦
- 會記住上次嘅位置、大細同設定；聲效預設熄咗（右鍵可以開）

## 安裝

去 GitHub 呢個 repo 嘅 **Actions → Yo Jie desk pet (Windows)**，揀最新一次成功嘅 run，喺底下 **Artifacts** 下載 `YoJiePet-windows`，解壓後：

- `YoJiePet-1.0.0-portable.exe`：撳兩下就開，唔使安裝
- `YoJiePet-1.0.0-setup.exe`：安裝版

個 exe 冇數碼簽署，第一次開 Windows 可能會彈「Windows 已保護您的電腦」：撳「其他資訊」→「仍要執行」。

## 想開機自動開

程式本身唔會改 Windows 嘅開機設定（registry），要自己加：

1. 撳 `Win + R`，輸入 `shell:startup`，撳 Enter，會開咗個「啟動」資料夾
2. 喺開始選單搵到 **Yo Jie Pet**（要用 setup.exe 安裝版），撳右鍵 →「開啟檔案位置」，將個捷徑複製入「啟動」資料夾

想停就喺「啟動」資料夾刪咗個捷徑。

## 確認個 exe 係由呢度嘅原始碼整出嚟

個 exe 冇數碼簽署（要向認證機構買證書）。佢係 GitHub Actions 由呢個資料夾嘅原始碼自動整嘅：Actions 頁面每次 run 都列明用咗邊個 commit，Artifacts 旁邊有 SHA-256 digest，可以同你下載到嘅 zip 對比（PowerShell：`Get-FileHash 檔名.zip`）。

## 安全設定

同熊仔桌面寵物一樣：

- 程式唔會上網、唔會讀你嘅檔案、唔會改 registry，亦唔會開其他程式；只會喺自己嘅設定資料夾寫一個 `pet-state.json`（位置、大細）
- 畫面喺 sandbox 入面行，冇權限用檔案或者系統功能；唔會開連結或者新視窗；鏡頭、咪、位置等權限一律拒絕
- 視窗傳俾主程式嘅訊息會先核對來源同數值
- Electron 用緊有安全更新嘅版本，並關閉咗「當 Node.js 用」、除錯參數等其他程式可以借用嘅功能（Electron fuses），亦會核對 app 檔案冇被改過
- GitHub 整嘅時候用 `package-lock.json` 鎖死每個套件版本，並跑 `npm audit`，有高風險漏洞就唔會整出 exe

## 自己由原始碼整

要先裝 [Node.js](https://nodejs.org/)（LTS 版）。

```
cd cat-animation/yo-jie-pet-app
npm install
npm start        # 直接試
npm run dist     # 喺 dist/ 整出 portable .exe 同安裝程式
```

`pet.html` 同 `../yo-jie-studio/index.html` 係由 `../pet-kit` 砌出嚟（`python3 build.py yo-jie`），角色喺 `../pet-kit/characters/yo-jie/`。
