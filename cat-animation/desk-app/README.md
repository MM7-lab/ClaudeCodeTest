# Overtime Kitten 桌面公仔（Windows）

透明、冇邊框、永遠喺最頂嘅細視窗，桌面上淨係見到社畜貓公仔、亞加力底座同影子。

## 用法

- **拖公仔**：轉角度
- **拖底座**：將公仔搬去桌面其他位置
- **滾輪**：放大縮細
- **右鍵**：揀版本（食煙／飲咖啡）、開關動作、自轉、大細（細／中／大）、永遠置頂、載入自己嘅 3D 模型、離開
- 公仔以外嘅透明位置撳落去會穿過去下面嘅視窗，唔會阻住你用電腦
- 會記住上次嘅位置、大細同版本

## 安裝

直接撳兩下 `OvertimeKitten-1.0.0-portable.exe` 就開到，唔使安裝。

個 exe 冇數碼簽署，第一次開 Windows 可能會彈「Windows 已保護您的電腦」：撳「其他資訊」→「仍要執行」。

需要支援 DirectX 12 嘅顯示卡（近年嘅 Intel／AMD／NVIDIA 都得）。如果開咗得一個空白視窗，先更新顯示卡驅動程式。

## 自己由原始碼整

要先裝 [Node.js](https://nodejs.org/)（LTS 版）。

```
cd cat-animation/desk-app
npm install
npm start        # 直接試
npm run dist     # 喺 dist/ 整出 portable .exe 同安裝程式
```

`npm start` 同 `npm run dist` 都會先由 `../figure/index.html` 複製最新嘅公仔頁入嚟（`figure.html`），所以改完公仔頁之後重新整就得。
