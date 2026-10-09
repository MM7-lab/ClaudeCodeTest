# 小動物騎士 3D 模型

頭頂細粉紅蝴蝶結、著銀色鎧甲同白披風，雙手將一把長柄大劍垂直豎喺面前（Knight Kitten 迷因）。全部用 three.js 基本形狀砌成。盔甲、劍同披風三個版本共用，頭、手、腳、尾按品種變：

| 版本 | 外觀 | 可揀顏色 |
|---|---|---|
| 小貓騎士（原圖） | 長毛貓、豎耳、鬚、蓬鬆貓尾 | 虎斑、橘貓、灰貓、黑貓 |
| 小狗騎士 | 向前凸嘅口鼻、大黑鼻、淺色面頰 | 柴犬（豎耳、捲尾）、金毛、朱古力（垂耳、大掃把尾） |
| 小雀騎士 | 圓頭、鳥喙、翼尖飛羽捲住劍柄、鱗紋雀仔腳、扇形尾羽 | 麻雀（樹麻雀：栗色頭頂、白面、黑喉）、小黃雞、虎皮鸚鵡 |

檢視頁網址後面加 `#dog` 或者 `#bird` 可以直接打開嗰個版本。

| 檔案 | 用途 |
|---|---|
| `index.html` | 3D 檢視頁：轉動、縮放、揀角色同顏色、撳「撐住！」；毛髮用 shell 技術喺網頁即時生成 |
| `model.js` | 模型本體（瀏覽器同 Node 共用），`buildKnightKitten.SPECIES` 列出品種同顏色 |
| `knight-kitten.stl`、`knight-puppy.stl`、`knight-birdie.stl` | 3D 打印用，單位 mm，連劍高 100 mm（身約 50 mm；想身 100 mm 就用 `node export.mjs 200`），唔包鬚同披風 |
| `knight-kitten.glb`、`knight-puppy.glb`、`knight-birdie.glb` | 有顏色版本（預設顏色），可放入 Blender、PowerPoint 或手機 AR 檢視器 |
| `export.mjs` | 重新產生三個版本嘅 STL／GLB |

## 改完模型之後

```
cd knight-kitten
npm install
node export.mjs 120   # 數字係打印高度（mm），預設 100
```

## 打印提示

- 長劍同橫過胸前嘅手臂需要支撐（support）。
- 劍身最薄約 1.5 mm（100 mm 高時），想耐用可以打大啲，或者用 0.2 mm 層高。
- 小雀騎士嘅腳同爪好幼，建議打 150 mm 或以上。
