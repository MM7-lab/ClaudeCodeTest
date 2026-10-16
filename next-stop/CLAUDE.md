# 下一站，有人需要你

這是一個供「賽馬會眾心行善 – 義工推廣校園夥伴計劃」（香港明愛）課程 A 課堂使用的 3D 互動網頁遊戲。所有內容都在單一檔案 `next-stop.html` 內，包括 HTML、CSS 同 JavaScript。

## 目標
學生喺星期日雨夜嘅車廂入面，由頭到尾行一次「構思．服務．領悟（Plan-Serve-Reflect）」六步曲：

1. 生活中探索各人的需要（一開始車廂已經坐滿；列車到花園街，婆婆、孕婦同幾位乘客一齊上車）
2. WHO 確認需要幫助的群體（固定 10 位有號碼嘅乘客；用 ◀ ▶ 或鍵盤 ← → 切換，撳「返回全景」都唔會收起面板；只可以揀呢 10 位）
3. WHY 觀察及了解他們的需要（影近婆婆嘅三個困難，配對需要）
4. HOW 找出自己的強項
5. HOW 計劃實際的善幸（要先問意願；可以請關愛座乘客讓座、幫手拎餸、扶穩手推車）
6. 善幸的經驗反思（4F：Fact、Feeling、Finding、Future，最後出善幸卡，畀學生截圖交 LMS）

需要幫助嘅三個乘客：婆婆（主線）、孕婦（褸遮住 BB 襟章）、腳受傷嘅男仔。其餘都係干擾角色。

## 技術
- Three.js r128 UMD，由 cdnjs 載入；光暈（UnrealBloomPass 等 6 個 examples/js 檔）由 jsdelivr 載入，載入失敗就自動用返普通渲染
- 後期：EffectComposer 畫落 HDR（WebGL2 用 HalfFloat＋多重取樣）render target → UnrealBloomPass → 自己寫嘅 ACES＋sRGB ShaderPass（因為 render target 唔會套用 renderer 嘅 tone mapping）；LED 燈條、月台燈、窗外燈光故意調到大過 1，等佢哋發光
- 寫實風格：MeshStandardMaterial（PBR）、ACES 色調映射、用 PMREMGenerator 由自製燈箱場景生成反射環境（不銹鋼扶手同長櫈會反光）；冇描邊；每個人腳下有一塊柔和陰影（`BLOB`）
- 人物用程式砌成，頭身比約 1:7（`neck` 群組縮細 0.8）：身軀、盆骨、四肢用 LatheGeometry 曲線（`latheGeo`／`limbGeo`／`tubeGeo`，接縫喺背後）；有手掌同手指公、鞋底、耳仔、立體鼻（戴口罩就冇）、下巴收窄嘅頭（`headGeo`）；短袖衫袖去到上臂一半；衫褲同頭髮用 `cloth()` 加布紋／牛仔斜紋／髮絲紋理
- 人臉用 canvas texture 畫寫實五官（細眼、眉、鼻、唇），唔好加返動漫式大眼同腮紅；男仔髮線較高、側分，女仔有六成機會有齊陰；企姿有少少重心側向一邊（`lean`）
- 車廂：淺灰牆身、有少少反光嘅斑點膠地板、白色 LED 燈條、不銹鋼長櫈、座位尾玻璃擋板，關愛座係紅色；車門頂有橙色 LED 報站牌（`setLED()`）
- 婆婆手推車：上車時婆婆左手拉住車柄（`pullTrolley()`），架車斜住喺佢身後碌；到位後放手，架車斜斜哋卡喺車門邊（`settleTrolley()`）
- 固定電影式鏡頭：`overview()`、`shotPerson()`、`setShot()`；`updateOccluders()` 會隱藏擋住鏡頭嘅乘客（身體或者頭部接近視線，或者離鏡頭 0.85m 以內）
- 電腦橫向畫面打開右邊面板（`#insp`／`#cards`）時，用 `camera.setViewOffset` 將畫面向左移半個面板闊，被睇嘅乘客唔會俾面板遮住
- 孕婦：`bellyTorsoGeo()` 由件衫前面推出順滑嘅肚；`drapeCoatGeo()` 係領口近乎合埋、肚位散開嘅長褸；BB 襟章喺褸邊露出一半
- 窗外係雨夜城市（大廈、燈光 sprite、雨絲 LineSegments），到站時會滑入露天月台
- 版面適用於電腦投影同手機（手機版面：`@media (max-width:760px),(max-height:500px)`，橫向手機都用；窄過 1180px 會收起左上角標題牌，避免頂部列轉行）
- 左下角提示（`#hint`）會跟住對話框高度（`--dlg-h`）向上移，而且唔攔截點擊，唔好再放返喺 bottom:18px，否則喺 1024 闊嘅投影機會遮住對話框按鈕

## 約束
- 介面文字一律用香港繁體中文（廣東話口語）
- 唔用港鐵商標；站名同綫名（東灣綫）都係虛構
- 六步曲名稱同 4F 內容來自明愛課程 A、B 教材，唔好改動用字

## 可以再做嘅方向
- 載入現成 glTF 動漫角色模型，取代用簡單形狀砌成嘅人物
- 真正鏡面反射（Reflector）、窗玻璃反映車廂入面
- 老師模式：可以直接跳去指定步驟
