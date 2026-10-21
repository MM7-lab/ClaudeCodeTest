# 第三方程式庫

兩個都係 MIT 授權，原封不動複製自 npm（唔係自己改過、唔係由 CDN 載入），所以網頁運行時唔會再從第三方下載任何程式碼。

| 檔案 | 來源 | 授權 | SHA-256 |
|---|---|---|---|
| `mqtt.min.js` | [mqtt@5.16.0](https://github.com/mqttjs/MQTT.js)（`dist/mqtt.min.js`） | MIT | `f3cbeae580d3010048938ee370f2db0c15d16e6f7fc147cb32ae5510e571b387` |
| `qrcode.js` | [qrcode-generator@1.4.4](https://github.com/kazuhikoarase/qrcode-generator)（Copyright (c) 2009 Kazuhiko Arase） | MIT | `18ae399f81182bc9de916e9c77b195df20cc58d6f2d55a62b085a299f1bf1780` |

核對方法：`npm pack mqtt@5.16.0`，解壓後對比 `dist/mqtt.min.js` 嘅 SHA-256（`sha256sum`）。更新程式庫時，記得連同校驗碼一齊改。
