# 三年級第13週功能契約與驗收

2026-11-23，來源origin/main `cc0c2b0f81b46ee7e9570bb773b56be7144eff31`，新工作樹 `grade3-week13-web-20261123`。教師已採用教案並要求製作週頁、維持風格；本次先製作可檢視的本機版，不將未套用的登記或未發布候選稱正式完成。

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
- [x] 原題／換題／魔王32個桌手機行次逐字點卡，核對注音與可見亮鍵；涵蓋一聲空白、輕聲、多音長滿、英文大小寫／問號／撇號、游標中英換行與換題不殘留；查字不奪輸入焦點、不送答。完整矩陣見`.chat-mode/evidence/week13-guide/result.json`。
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
