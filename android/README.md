# 日常記帳 Android App

`docs/ledger/` 嗰個記帳網頁 App 嘅 Android 版本，額外加咗自動記帳（參考 Ching）：

| 功能 | 點做 |
|---|---|
| 自動擷取付款通知 | `PaymentListener`（Android NotificationListenerService）讀八達通、PayMe、銀行／信用卡 App 嘅通知，用 `PaymentParser` 搵金額、收定支、商戶 |
| 背景持續運作 | 申請電池最佳化豁免；斷線會 `requestRebind`。小米、OPPO、vivo、華為等仲要自己開「自動啟動」 |
| 一鍵確認 | `Notifier` 彈通知，有「記低／略過」掣（自動模式就係「復原」）；冇撳嘅留喺 App 入面「待確認」 |

## 私隱

- **冇 INTERNET 權限**：App 喺系統層面已經冇辦法上網，資料傳唔出手機。
- 唔讀：手機預設短訊 App、WhatsApp／Telegram／Signal 等通訊 App、Gmail／Outlook（見 `PaymentParser.EXCLUDED`）。
- 有驗證碼（OTP）、推廣、增值字眼嘅通知一律略過。
- 只儲金額、收支、商戶、App 名同時間；通知原文唔會儲。
- 記帳資料喺 App 自己嘅 WebView localStorage，`allowBackup=false`。解除安裝會清走，記得用「備份 JSON」。

## 安裝

1. 用 Android 手機打開：`https://github.com/MM7-lab/ClaudeCodeTest/releases/download/android-latest/ledger.apk`
2. 下載完撳開，系統會問「允許安裝不明來源 App」，喺瀏覽器嗰度允許一次。
3. 打開「日常記帳」→「更多 → 自動記帳」，逐項撳「啟用」。
4. 由網頁版轉過嚟：網頁版「更多 → 備份 JSON」，App 入面「更多 → 匯入備份」。

## 編譯

GitHub Actions（`.github/workflows/android.yml`）每次改 `android/` 或者 `docs/ledger/` 都會：

1. 將 `docs/ledger/` 抄入 APK（`copyWeb` task），
2. 跑 `PaymentParserTest`，
3. 編譯 `app-release.apk`，放上 `android-latest` release（固定下載網址）同 Actions artifact。

本機編譯：`cd android && ./gradlew assembleRelease`（要 Android SDK 同 JDK 17）。

## 簽名 key

`app/ledger-shared.keystore`（密碼 `mm7ledger`）放咗喺 repo，等每次 CI 編譯都用同一條 key，新版先可以直接覆蓋舊版。代價係：任何睇到呢個 repo 嘅人都可以用同一條 key 簽 App。所以**只係由上面嗰條官方 release 網址下載安裝**。想收緊嘅話，可以將 keystore 搬去 GitHub Secrets，再改 `app/build.gradle.kts` 嘅 `signingConfigs`。

## 調校通知解析

每間銀行同 App 嘅通知寫法唔同，而 `PaymentParserTest` 入面嘅樣本係按香港常見寫法作出嚟，唔係真實通知。遇到認唔到或者認錯嘅通知：將通知文字（遮咗卡號同個人資料）加入 `PaymentParserTest`，再調校 `PaymentParser` 嘅規則。
