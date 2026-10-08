# 小貓騎士 3D 模型

長毛虎斑貓、頭頂細粉紅蝴蝶結、著銀色鎧甲同白披風，雙手將長劍垂直豎喺面前（Knight Kitten 迷因）。全部用 three.js 基本形狀砌成。

| 檔案 | 用途 |
|---|---|
| `index.html` | 3D 檢視頁：轉動、縮放、換毛色、撳「撐住！」；毛髮用 shell 技術喺網頁即時生成 |
| `model.js` | 模型本體（瀏覽器同 Node 共用） |
| `knight-kitten.stl` | 3D 打印用，單位 mm，連劍高 100 mm（貓身約 60 mm），唔包鬚同披風 |
| `knight-kitten.glb` | 有顏色版本，可放入 Blender、PowerPoint 或手機 AR 檢視器 |
| `export.mjs` | 重新產生 STL／GLB |

## 改完模型之後

```
cd knight-kitten
npm install
node export.mjs 120   # 數字係打印高度（mm），預設 100
```

## 打印提示

- 長劍同橫過胸前嘅手臂需要支撐（support）。
- 劍身最薄約 1.5 mm（100 mm 高時），想耐用可以打大啲，或者用 0.2 mm 層高。
