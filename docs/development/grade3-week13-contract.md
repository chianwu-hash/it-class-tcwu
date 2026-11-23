# 三年級第13週功能契約與驗收

> 本輪追加驗證：移除帳號卡後固定基準與新頁1280／390對照、8張任務卡的圖示／版面通過，截圖已檢視；完整合成Auth／RPC保存、失敗重試、接續、六組換題、登出、努力樹返回等全過，pageerror／正式學生寫入0。錯字測試改依新魔王第3行產生，不再硬寫舊red題字。教案SOP第4.1節及檢核表已加入去重／第5、6關加難規則，本週教案附6列新進度核對表。證據`.chat-mode/evidence/week13-style/`與`week13-browser/`。

> 2026-11-23英文新進度與帳號卡移除：fresh main `9841811d`／`grade3-week13-boss-english-20261123`。魔王中文沿已核遠望／收穫兩句；英文原題改Unit4 Story Time p.55、57四行，換題改p.60下午招呼與p.54故事臺詞四行。八行英文彼此不同、未出現在前五關或第11／12週，原題107、換題93字元，仍五行。已目視備課PDF內嵌學生頁p.54、55、57、60；私有來源與桌手機新20行次逐字注音／亮鍵結果在`.chat-mode/evidence/boss-english/`，全部通過。移除`#login`大卡及`course-identity-status`，保留navbar與共用Google本人／進度流程，錯誤訊息改寫入快手`progress-status`，不改活動鍵／花葉、不重設學生紀錄。下方舊雙重顏色問答與83／92字元是歷程。

> 魔王去重已正式發布：main `6b806c7d`、`dpl_FMJpZfESoJz97SvR3otdqZGDHm86`。正式四檔讀回一致；在正式URL以合成Auth重跑完整桌手機20行次逐字注音亮鍵全過，pageerror／正式學生寫入0。正式與候選證據見repo外`20261123-grade3-week13-unique/`及[發布收據](grade3-week13-release-20261123.md)。

> 2026-11-23魔王去重修正：教師指出第6關中文重複第5關。從最新main `4ac2abd6`新工作樹修改；原題改p.87「走上去，站在最高處往四面遠望，可以看到美麗的風光。」；換題改同頁「這次的參觀，我看到寶貴的文物，也認識了安平古堡的故事，收穫真的好多！」。兩句與注音逐字目視原PDF第4頁；原題83、換題92字元，各五行，不重複前五關中文原題／換題。新注音映射、桌手機原題／換題20行次逐字亮鍵已通過，證據`.chat-mode/evidence/boss-unique/guide/`；新題完整合成保存／失敗重試／重整接續／六組換題不回寫亦全過，pageerror與正式學生寫入皆0（`week13-browser/synthetic-checks.json`）。前五關、活動鍵、保存與花葉規則保持，不重設已完成進度；資產版本更新為`20261123-unique-boss`。下方83／83與重複長句記錄保留為歷程。

> 2026-11-23後續正式發布：教師已核准，PR440合併與兩筆正式登記完成；103筆目錄一致、完整檔案樹比對及50檔正式讀回通過，正式本人身分接回已驗。真實逐關保存／首次領獎留教師測試。詳[正式收據](grade3-week13-release-20261123.md)；下列「本機／未套用」為製作階段歷程。

2026-11-23，來源origin/main `cc0c2b0f81b46ee7e9570bb773b56be7144eff31`，新工作樹 `grade3-week13-web-20261123`。教師已採用教案並要求製作週頁、維持風格；本次先製作可檢視的本機版，不將未套用的登記或未發布候選稱正式完成。

完整功能驗收程式來源提交：`c1efac20`；[草稿PR #440](https://github.com/chianwu-hash/it-class-tcwu/pull/440)。後續局部圖示修改另列下方；主線互動、身分與進度程式保持。預覽服務3143持續提供本工作樹，未合併main、未部署。

2026-11-23教師圖示修訂：表情面板快捷鍵的Windows文字改為既有Font Awesome品牌圖示鍵帽，保留螢幕閱讀文字「Windows 鍵」及title；builder與HTML同步、CSS版本更新。1280／390實際字型與glyph載入、44px鍵帽及無水平溢出通過，已檢視手機圖；證據`.chat-mode/evidence/win-icon.json`及兩張截圖。沒有改動主線或打字服務。

2026-11-23教師進度提示：基礎英打快手區加上本週建議練到第1大關「手指的暖身運動」→「無名指加入」（S、L），補左無名指S／右無名指L及從個人進度續練、已完成者可繼續往後的說明。已核現行curriculum第3小關title與focus `sl`；同步builder、HTML與教案，不改必做標準或進度資料。

2026-11-23教師魔王加難：第6關原題／換題均由三行短語改為五行「完整中文句＋兩組英文顏色問答」，各83字元；換題交換red／white回答順序，來源均沿已核p.87與Unit4句型。輸入框增為7列、更新提示／鼓勵語與資產版本，仍是快手延伸、既有六關獎勵保持。新魔王原題／換題桌手機20行次逐字注音與可見亮鍵通過（`week13-guide-hard-boss/result.json`），前五關沿用未變動證據；資料／builder檢查通過。以新五行題完整重跑合成Auth／RPC：首關／魔王保存失敗重試、六關保存／重整接回、六組換題不回寫、草稿、精準行次與缺換行提示、努力樹返回及首頁同步全過，pageerror 0、正式學生寫入0（`week13-browser/synthetic-checks.json`）。

## 開發前契約

- [x] 已重讀dev-sop、shared-modules、page-types、new-page-checklist、high-risk-changes、agent-handoff、prompt-template、lesson-to-web-sop、三年級風格與每週圖卡規範。
- [x] 三年級115-1，C類：主線是無評分、無保存的當堂操作；六關中英打全部快手、無全班時段／最低關數。所有可保存快手活動維持本人Google名冊驗證。
- [x] 功能參考第12週：`initGoogleCourseAuth()`內含`initNavbarAuth()`；`createGoogleCourseProgress()`接正式RPC；`initTypingChallenge()`逐關保存／接續，原生手動草稿、換題、保存失敗重試及防貼上邊界。無測驗、無課堂即時開關、無作業／閱讀繳交。
- [x] 身分與進度：`grade3-115-1`／`13`／`typing_task_6`／6關／`five-then-flower`；未登入、非本人或讀取失敗保持鎖定；不重寫進度、不用localStorage、不直接upsert。
- [x] 視覺固定基準`grade3/week20.html`，同學期第09／10週；藍綠頁首、黃色徽章、彩色圓形圖示、白底圓角彩框、分色標題與清楚實心按鈕；功能參考不取代視覺基準。
- [x] 主線四操作：Shift、Windows＋句號、Tab／Shift＋Tab與Enter、Alt＋Tab及留言卡。網頁自由區原生編輯、三個相鄰標籤欄位、第三欄多行；Tab不被困住；作業系統面板／視窗不做假按鈕或假過關。
- [x] 原題／換題皆取已核國語第八課與英語Unit4。`{id,ans}`；中文行完整固定注音與亮鍵，不用猜讀音繞過防護；教材不提交。
- [x] 每週圖卡：附三年級第01週參考，UTF-8 prompt與原始metadata保留；已目視圖文、1920×1080 WebP q80／173,192 bytes、Cloudinary回讀SHA一致，頁面使用共用同頁燈箱。完整手勢驗收另見下方。
- [x] 首頁唯一最新徽章、navbar第13週、教師後台週卡預設、努力樹設定及本週登記SQL一致；正式庫尚未套用，不能當成已正式開放。

## 必驗項目

- [x] 主線Shift原生鍵盤輸入、三欄Tab／Shift返回／第三欄Enter換行、Tab可離開、自由區允許剪貼及當頁狀態；主線不因未登入而被誤鎖。Windows實體面板與Alt＋Tab另列人工界線。
- [x] 合成Auth／RPC：匿名鎖定與OAuth回跳入口、名冊失敗／讀取失敗鎖定、首關／魔王保存失敗重試、六關保存、重整接回、六組換題不回寫、草稿、登出、TOKEN_REFRESHED後續存。不是正式Google OAuth或真實多帳號驗收。
- [x] 初版原題／換題／魔王32個桌手機行次逐字點卡通過；後續加難後只補新魔王20行次、前五關沿用未變動證據。涵蓋一聲空白、輕聲、多音長滿、英文大小寫／問號／撇號、游標中英換行與換題不殘留；查字不奪輸入焦點、不送答。初版矩陣見`.chat-mode/evidence/week13-guide/result.json`，新版魔王見`week13-guide-hard-boss/result.json`。
- [x] 11項資料／隔離SQL及舊注音回歸通過：本人RPC、匿名／跨人拒絕、0～4無花葉／5一葉／6一葉一花、冪等登記與舊baseline／seen／活動保持；正式函式未修改。
- [x] 1280／390與第20週固定基準、本學期第10週同尺寸截圖，已目視圖示／卡片／按鈕，9個彩色圓形圖示實際字型載入，無標題重疊與水平溢出。圖卡完整手勢另記結果。
- [ ] 正式資料庫登記、真教師後台可見性、正式本人保存與發布：未執行時必須明列，不以合成驗證取代。

## 交付邊界

主線自由練習不是測驗，不自動寫分數或發花葉；操作成效由教師觀察。Windows面板及Alt＋Tab須課堂實體鍵盤操作，瀏覽器合成事件只驗頁面相容性。新增SQL只登記活動及獎勵兩列，不修改正式函式或學生資料；尚未套用正式庫。

## 本輪證據

- `.chat-mode/evidence/week13-browser/synthetic-checks.json`：完整保存／接回／換題／草稿與首頁同步；pageerror 0，正式學生寫入0。
- `.chat-mode/evidence/week13-guide/result.json`：32行次逐字注音及鍵盤矩陣與主線鍵盤操作，pageerror 0。
- `.chat-mode/evidence/week13-style/result.json`：固定風格參考／新頁1280與390，另有Tab與快手區截圖；pageerror 0。
- `grade3/115-1/images/week13/infographic.json`：公開圖卡URL／尺寸／bytes／SHA；原圖、生成及上傳收據在ignored image證據區。
- 圖卡新UI下載問題與本次同筆blob回收界線見`chatgpt-image-current-ui-20261123.md`，沒有重送已接受的提示詞。
- `.chat-mode/evidence/infographic/result.json`：1280／390圖卡與燈箱，真實mouse拖曳／滾輪／雙擊、縮放百分比、重設／置中、CDP雙指、Esc／關閉／焦點與捲動恢復、再開100%，以及auth模組不可用時仍可開圖；全數通過。CDP雙指是瀏覽器手勢驗收，不冒稱實體手機雙指人工測試。
