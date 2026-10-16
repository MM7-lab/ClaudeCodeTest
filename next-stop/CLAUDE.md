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
- 風格跟參考圖：**環境寫實、人物係柔和上色嘅風格化 3D**（跟 Tommy 畀嘅示意圖，唔係動漫大眼）。環境用 MeshStandardMaterial（PBR）、ACES 色調映射（曝光 0.75）、用 PMREMGenerator 由自製燈箱場景生成反射環境（不銹鋼扶手同長櫈會反光）；冇描邊；每個人腳下有一塊柔和陰影（`BLOB`）
- 人物用程式砌成，頭身比約 1:6.5（`neck` 群組縮細 0.84）：身軀、盆骨、四肢用 LatheGeometry 曲線（`latheGeo`／`limbGeo`／`tubeGeo`，接縫喺背後）；有手掌同手指公、鞋底、耳仔、下巴收窄嘅頭（`headGeo`）；短袖衫袖去到上臂一半；衫褲係平塗卡通色（`makePerson` 入面 `cloth`／`toon` 已改成指向 `anime()`，布紋 `FAB` 唔再用喺人物）
- 人物上色：`anime()`（MeshToonMaterial，3 格線性過渡嘅柔和明暗，衫 `cloth`／皮膚 `skin`／面 `face` 三種深淺，皮膚同面最光只到 232 免得變白），色碼要 `convertSRGBToLinear()`；`addOutlines()` 幼描邊（0.0042），只畫喺離鏡頭 5 米內嘅人；頭髮係一整塊球殼（`hairShellMat`），用 `hairMask(style)` 透明遮罩剪出髮線同面部（女：Fbang 齊陰／Fpart 中分；男：Mside 側分／Mshort），長髮後面再加 `STRANDS` 剪尖嘅髮片
- 人臉：`faceTex(skin,mood,age)` 畫示意圖風格五官：正常大細嘅杏仁眼、深色瞳孔加一點反光、粗眉、細鼻（立體鼻戴口罩就唔加）、細嘴；`age:1`（婆婆、伯伯）加額紋、魚尾紋、法令紋；唔好再改返動漫大眼
- 車廂：淺灰牆身、有少少反光嘅斑點膠地板、白色 LED 燈條、不銹鋼長櫈、座位尾玻璃擋板，關愛座係紅色；車門頂有橙色 LED 報站牌（`setLED()`）
- 婆婆手推車：上車時婆婆左手拉住車柄（`pullTrolley()`），架車斜住喺佢身後碌；到位後放手，架車斜斜哋卡喺車門邊（`settleTrolley()`）
- 固定電影式鏡頭：`overview()`、`shotPerson()`、`setShot()`；`updateOccluders()` 會隱藏擋住鏡頭嘅乘客（身體或者頭部接近視線，或者離鏡頭 0.85m 以內）
- 電腦橫向畫面打開右邊面板（`#insp`／`#cards`）時，用 `camera.setViewOffset` 將畫面向左移半個面板闊，被睇嘅乘客唔會俾面板遮住
- 孕婦：`bellyTorsoGeo()` 由件衫前面推出順滑嘅肚；`drapeCoatGeo()` 係領口近乎合埋、肚位散開嘅長褸；BB 襟章喺褸邊露出一半
- 窗外係雨夜城市（大廈、燈光 sprite、雨絲 LineSegments），到站時會滑入露天月台
- 版面適用於電腦投影同手機（手機版面：`@media (max-width:760px),(max-height:500px)`，橫向手機都用；窄過 1180px 會收起左上角標題牌，避免頂部列轉行）
- 左下角提示（`#hint`）會跟住對話框高度（`--dlg-h`）向上移，而且唔攔截點擊，唔好再放返喺 bottom:18px，否則喺 1024 闊嘅投影機會遮住對話框按鈕

- 人物類型：`uniform` 學生（白恤衫、領呔、深藍裙或灰褲、書包，冇真實學校校徽）、`jacket` 短外套、`sling` 斜孭袋、`build` 肥瘦；婆婆洋紅色冷衫、駝背（spine 0.3、neck -0.3）、有皺紋；孕婦身體向後挨少少；坐低嘅人座位上有接觸陰影（`seatBlob`）
- 生活感（第二批）：每人有 `act`（phone 低頭睇電話、read 睇書、news 伯伯睇報紙、doze 瞌眼耷頭、music 跟節奏郁頭、chat 轉頭同隔籬傾偈、up 望報站牌、kid 媽媽望住個仔、look 周圍望，有時望向有需要嘅人）；`updateGaze()` 平滑轉頸；`blink()` 用 `faceOpen`／`faceShut` 材質眨眼（換面部材質時要同時更新 `faceOpen`）；呼吸（`spineX` 加細微起伏）、重心慢慢轉移；`swayPerson()` 跟 `trainAcc` 由腳踝向前後傾，再加左右搖；`gripIK()` 兩節反向運動學，令舉高嘅手真係握住 `RINGS` 吊環或者 `POLES` 企柱（包括座位尾擋板支柱，婆婆就係揸住佢），夠唔到就用返原本姿勢；手插袋 `pocket`；坐低有機會拎住摺遮（`umbrella`）
- 面形：`headGeo(shape)`，`FACE_SHAPES` 有 oval／long／square／round（細路仔用 round），由球體拉長面、削平面頰、收窄下顎（`low` 越大，收窄越集中喺下面，就越有下顎角而唔會變尖下巴）、下巴向前；面部陰影 `CEL.face` 暗位 152，唔好再調淡，否則面形只睇到輪廓、全部變返圓面
- 頭髮殼放大（1.03×1.13×1.06）同埋頭頂升高，劉海用 `hairMask` 嘅幾個闊圓弧做成一撮撮，唔好用高頻鋸齒

## 約束
- 介面文字一律用香港繁體中文（廣東話口語）
- 唔用港鐵商標；站名同綫名（東灣綫）都係虛構
- 六步曲名稱同 4F 內容來自明愛課程 A、B 教材，唔好改動用字

## 可以再做嘅方向
- 載入現成 glTF 動漫角色模型，取代用簡單形狀砌成嘅人物
- VRoid（.vrm）角色：`@pixiv/three-vrm` 由 0.6.x 到 3.x 都要求 Three.js ≥ 0.137，要用就要離開 r128、改寫成 ES module，光暈嗰 6 個 examples/js 檔都要換
- 真正鏡面反射（Reflector）、窗玻璃反映車廂入面
- 老師模式：可以直接跳去指定步驟
