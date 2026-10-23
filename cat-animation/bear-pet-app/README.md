# 熊仔桌面寵物（Windows）

透明、冇邊框、永遠喺最頂嘅細視窗，桌面上淨係見到熊仔衫人仔（同佢個影），冇背景。

## 用法

- 佢會自己決定做乜：坐定定、揮手、飲熱朱古力、聽歌、做嘢、瞓覺；閒時會周圍望、郁耳仔、推眼鏡、打喊露
- **時鐘**：右鍵揀「⏰ 睇鐘」佢會攞個鬧鐘出嚟俾你睇時間；「身邊擺個鐘」會喺佢隔籬擺個細鬧鐘一直顯示時間；自動模式下每逢正點佢會自己攞個鐘出嚟，個鐘仲會震（開咗聲效會叮一聲）
- **眼睛**：跟住滑鼠望，成個螢幕都得；滑鼠停咗佢會自己周圍望
- **拖佢**：搬去桌面其他位置（拎起嗰陣會「哇」一聲咁）
- **撳佢**：撳面＝摸頭（臉紅、出心心），撳眼鏡、耳仔、肚上熊仔、腳、尾巴各有反應；瞓緊撳佢會醒
- **右鍵**：自動開關、揀動作、摸頭、推眼鏡、大細（細／中／大）、聲效、眼跟滑鼠、永遠置頂、離開
- 熊仔以外嘅透明位置撳落去會穿過去下面嘅視窗，唔會阻住你用電腦
- 會記住上次嘅位置、大細同設定；聲效預設熄咗（右鍵可以開）

## 安裝

去 GitHub 呢個 repo 嘅 **Actions → Bear desk pet (Windows)**，揀最新一次成功嘅 run，喺底下 **Artifacts** 下載 `BearPet-windows`，解壓後：

- `BearPet-1.0.0-portable.exe`：撳兩下就開，唔使安裝
- `BearPet-1.0.0-setup.exe`：安裝版

個 exe 冇數碼簽署，第一次開 Windows 可能會彈「Windows 已保護您的電腦」：撳「其他資訊」→「仍要執行」。

## 想開機自動開

程式本身唔會改 Windows 嘅開機設定（registry），要自己加：

1. 撳 `Win + R`，輸入 `shell:startup`，撳 Enter，會開咗個「啟動」資料夾
2. 喺開始選單搵到 **Bear Pet**（要用 setup.exe 安裝版），撳右鍵 →「開啟檔案位置」，將個捷徑複製入「啟動」資料夾

想停就喺「啟動」資料夾刪咗個捷徑。

## 確認個 exe 係由呢度嘅原始碼整出嚟

個 exe 冇數碼簽署（要向認證機構買證書）。佢係 GitHub Actions 由呢個資料夾嘅原始碼自動整嘅：Actions 頁面每次 run 都列明用咗邊個 commit，Artifacts 旁邊有 SHA-256 digest，可以同你下載到嘅 zip 對比（PowerShell：`Get-FileHash 檔名.zip`）。

## 自己由原始碼整

要先裝 [Node.js](https://nodejs.org/)（LTS 版）。

```
cd cat-animation/bear-pet-app
npm install
npm start        # 直接試
npm run dist     # 喺 dist/ 整出 portable .exe 同安裝程式
```

`pet.html` 同 `../bear-onesie-studio/index.html` 用同一套動畫引擎，角色係你原本嘅畫，冇改過。
