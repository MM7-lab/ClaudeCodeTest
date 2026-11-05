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
- 人臉：`faceTex(skin,mood,age,fem)`（女仔有睫毛、幼弧眉、唇色同較明顯腮紅；男仔粗直眉；鼻係細小立體鼻加鼻底陰影） 畫示意圖風格五官：正常大細嘅杏仁眼、深色瞳孔加一點反光、粗眉、細鼻（立體鼻戴口罩就唔加）、細嘴；`age:1`（婆婆、伯伯）加額紋、魚尾紋、法令紋；唔好再改返動漫大眼
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
- 面形：`headGeo(shape)`，`FACE_SHAPES` 有 oval／long／square／round（細路仔用 round）。下顎只係溫和收窄（jaw 0.06–0.12，收到一半就停），下巴底再壓平少少，所以冇尖下巴；Tommy 明確講過唔要尖面，唔好再加大 jaw；面部陰影 `CEL.face` 暗位 152
- 頭髮殼放大（1.03×1.13×1.06）同埋頭頂升高，劉海用 `hairMask` 嘅幾個闊圓弧做成一撮撮，唔好用高頻鋸齒
- 第四輪（跟 Tommy 第二批示意圖）：頭大啲（`neck` 縮放 0.95）、四肢粗約兩成半、身軀厚啲；`mergeGeo()` 自己合併幾何體（r128 冇 BufferGeometryUtils）；`hairClumpGeo(style,len)` 每個髮型一個合併嘅髮束 mesh（男仔頭頂有蓬鬆感、劉海；女仔側邊髮束遮耳、長髮幾條垂喺背後；婆婆 `perm` 係十二嚿細捲），用冇紋理嘅 `hairPlainMat`，唔好再用 HAIRBAND 條紋，否則似曲髮；`handGeo(curl,sd)` 一隻手一個 mesh（手掌＋四指＋手指公），`setCurl()` 握吊環／扶手／拎嘢時換成握拳形狀，連描邊一齊換
- 顏色校正（同示意圖量度）：示意圖皮膚受光面約 (200,167,155)、背光面 (171,132,112)；而家 `SKINS` 同暖色 `HemisphereLight(0xfff4ea,0x4a4448)` 量到約 (193,170,149)／(173,146,126)；`CEL.skin` 最光 206、`CEL.face` 226，再光向上嘅手臂會變白
- 六個日常乘客（`EXTRAS`，id xA–xF，跟 Tommy 嘅角色設定圖）：攰到耷頭嘅上班族（西裝、公事包、遮）、藝術系學生（彩虹冷衫、吊帶褲、頸掛耳筒、腳邊畫具袋）、夜班醫護（醫院制服、連帽外套、職員證、飯盒袋、睇手錶）、便利店職員（間條背心、兩袋嘢、會打喊路 `yawns`）、外賣員（螢光外套、迷彩帽、保溫袋、手機地圖）、夜校生（深色校服、耳筒、書包、生字簿）。佢哋都唔需要幫助，用嚟教學生「攰唔等於需要即時幫助」；第二步嘅 10 位乘客入面，3 個額外位會優先揀佢哋（每次隨機 3 個）。populate 會預留孕婦同婆婆上車企嘅位，避免撞埋一齊
- 腳受傷嘅男仔：紗布（有紗布紋）包喺右腳（`legs[0]`；模型面向 +z，所以 `legs[0]`／`arms[0]` 係佢嘅右邊），右腳屈起、重心喺左腳；左手撐住腋下拐杖（`makeCrutch()`，喺佢左邊，即受傷腳嘅對面），右手用 IK 拉吊環；第二步第一次睇佢時用 `'injury'` 鏡頭（腰到腳，距離 2.0），答啱之後先影近隻腳
- 便利店職員嘅線索加咗「兩隻腳企得好穩」，因為佢打喊路、拎住嘢，學生容易誤會佢需要幫助
- 關愛座後生仔用兩隻手玩手提遊戲機（`arm:'game'`，紅藍手掣、有畫面；掛喺 `spine`，`p.console`，第五步佢讓座時 `arm` 變咗就自動收起）；其他人睇電話只用一隻手（`arm:'phone'` 只舉 `arms[1]`，另一隻手放低／坐低放膝頭），電話係黑色機身加光屏；耳機放大咗，戴喺頭髮外面
- 遮擋：跟住某人嘅鏡頭會揀擋住最少人嘅角度（`followTarget` 嘅 `blockers()`，有 `f.ci` 防跳來跳去）；`updateOccluders()` 喺螢幕空間判斷：凡係比目標近鏡頭、而且喺畫面上同目標重疊嘅人，或者離鏡頭 1 米內嘅人，都會收埋
- 方法三試行（插畫人物）：六個日常乘客（xA–xF）而家用 Tommy 角色設定圖剪出嚟嘅插畫（`CARDS`，WebP data URI，每張 20–60 KB），`makeCard()` 將佢企喺隱藏咗嘅 3D 身體上面（`p.root.visible=false`，身體照樣用嚟揀人、對焦、遮擋判斷），每格只沿垂直軸轉向鏡頭；號碼牌掛喺 `p.g` 張卡上面；顏色用 `CARD_TINT` 調暗少少，同 3D 人物光暗夾。插畫係企嘅靜態圖，所以佢哋一律企、冇動作，線索已經改成配合張圖。重新剪圖用 `tools/cut_cards.py`（numpy、pillow、scipy；入面有每張設定圖嘅剪裁範圍同要挖空嘅手挽位）。主線角色（婆婆、孕婦、腳傷男仔等）仍然係 3D，因為第三、五步要影近佢哋嘅細節同埋行、坐
- 婆婆插畫（Tommy 用 prompt 生成）：`GRANNY_ART.panel`（第三步三張困難卡入面嘅細節圖：勒紅手指、震緊嘅膝頭、卡喺門邊嘅手推車轆，撳一下可以放大）；`GRANNY_ART.face`（tired／worried／surprised／smile 頭像：第二步睇婆婆時用 tired；`say(who,text,btns,face)` 第四個參數顯示頭像——直接攞袋嗰條路 surprised、先問意願 worried、結果有讓座 smile、冇讓座 tired）。用 `tools/cut_granny.py` 剪。
- 婆婆已經全部換成插畫：`GRANNY_CARDS` 有 walk（拖手推車拎住餸袋行）、walkfree（餸袋俾人拎咗，拖手推車行）、stand（一隻手撐住後腰、拎住餸袋企）、standafter（放鬆咗，餸袋放喺手推車上面）、sit（坐低）、sitprops（坐低時放喺佢前面地下嘅手推車同餸袋，分開一張免得穿過隔籬座位）。`updateGrannyCard()` 每格按 `pose`（walk／stand／sit）同 `bagsTaken`（第五步揀咗幫拎袋就設定）自動揀用邊張；向畫面左邊行會鏡像，企嗰陣保持最後方向；行路時有少少上下彈。3D 身體隱藏但照用嚟揀人、對焦同行路；3D 手推車同餸袋一直隱藏。第三步嘅 🔍 改為放大細節圖。剪圖用 `tools/cut_granny.py`（細節圖、頭像、walk、sit）同 `tools/cut_granny_stand.py`（walkfree、stand、standafter）。已知唔夾：只揀扶正手推車（冇拎袋、冇讓座）時插畫冇變；坐低插畫嘅手推車永遠企直；Tommy 生咗一張冇手推車冇餸袋企嘅圖，暫時冇用

## 約束
- 介面文字一律用香港繁體中文（廣東話口語）
- 唔用港鐵商標；站名同綫名（東灣綫）都係虛構
- 六步曲名稱同 4F 內容來自明愛課程 A、B 教材，唔好改動用字

## 可以再做嘅方向
- 載入現成 glTF 動漫角色模型，取代用簡單形狀砌成嘅人物
- VRoid（.vrm）角色：`@pixiv/three-vrm` 由 0.6.x 到 3.x 都要求 Three.js ≥ 0.137，要用就要離開 r128、改寫成 ES module，光暈嗰 6 個 examples/js 檔都要換
- 真正鏡面反射（Reflector）、窗玻璃反映車廂入面
- 老師模式：可以直接跳去指定步驟
