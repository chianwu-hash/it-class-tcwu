# 六年級第11週網頁：功能契約與驗收紀錄

> 2026-11-13 追補：教師要求補充Ctrl＋D，並明確授權「先給Claude複核，沒問題就上線」。本輪從最新origin/main ecf8d776建立全新工作樹 `grade6-week11-ctrl-d-20261113`，帶入尚未合併的PR218，不在舊工作樹修改。下方「尚未發布」為前階段狀態，正式結果由本輪收據更新。

## Ctrl＋D 補充與複核範圍

- 依 [Canva官方新增／再製／刪除元素](https://www.canva.com/en_gb/help/add-elements/) 的「Duplicate an element」核對Windows為Ctrl＋D；選取畫布中的星星後直接再製，拖開再做第二次，共三顆。課本Ctrl＋C、Ctrl＋V保留為另一種方法，左右水平複製仍教Shift＋Alt。
- 教案、星星操作步驟與任務圖卡下方的可讀補充同步；原圖卡保留課本兩步法，無須為正確的原有內容重生圖，不改圖像本體或正式圖卡URL。
- 同時修正原網頁「複製三次」會得到四顆的語意，改成「再製兩次」；未改打字題目、獎勵、進度、資料庫或收件設定。
- Claude本輪複核範圍是整份PR218，包括六關與兩魔王、來源／獎勵、登入／保存／草稿、讀取失敗opt-in、四項快手、圖卡、概念示範、三處週卡、正式目錄SQL及驗證限制；不只看Ctrl＋D文案。

### Claude首輪與修正

- chat-mode唯讀CLI supervisor，Claude Code2.1.323／subscription OAuth；session `20261113-g6w11-full-review`，31內部turns／203.5秒，status completed，viewer啟動且Git前後一致。Claude無shell／寫入／網路／憑證／部署權限；未自行執行測試。
- 首輪結論無P0／P1阻擋；提出慢保存連點會提前慶祝、重讀失敗不能救草稿、示例「按鈕／物件」和時間表快捷鍵用詞四項建議。Codex逐檔確認後全部先修，沒有直接以「非阻擋」略過。
- 新增同關檢查防重入，包含第一次await之前；保存成功前不能靠連點走readOnly慶祝，失敗會解除防重入供重試。舊版單關魔王也同步驗證。
- 讀取失敗仍鎖正式送出，但僅同一使用者曾讀取成功、有既有輸入時可手動存草稿；初次讀取失敗和換人仍鎖，不能透過此路寫正式進度或替別人存草稿。
- 瀏覽器補「TOKEN_REFRESHED後讀取失敗→存草稿→換人拒絕→原使用者重整回復」、「延遲末關保存→連續兩次check→單一POST／無慶祝→失敗無慶祝→重試成功」，新六關及舊第09週單關魔王均通過，pageerror0、12次合成POST、0真學生寫入。7項模型／隔離DB仍通過。
- `#mine`／`#past-exams`不是靜態DOM id，而由`shared/quiz-library.mjs:39～56`解析hash切換view；已核原程式，不更改有效連結。圖卡／Ctrl＋D桌手機本輪檢查通過。

## 來源、範圍與檔案責任

- 使用者 2026-11-13 核定教案後要求依 SOP 製作；補四項快手說明、任務圖卡與 p.50 概念說明。本次由 Codex 單一寫入，不委派子代理。
- 新工作樹 `D:/projects/it-class-tcwu-worktrees/grade6-week11-web-20261113`，分支 `codex/grade6-week11-web-20261113`，fetch 後由 `origin/main` `6903f35` 建立；主工作區不修改，前回合教案複製進本樹。
- 頁型 C，六年級 115-1；參考 week09.js／typing.js 的登入、本人進度、草稿、精準提示與獨立魔王；week10.html／css 的班徽操作、共用作業／閱讀入口和視覺。
- 使用 `navbar.js`、`initNavbarAuth()`、`initTypingChallenge()`、`initTypingTools()`、`initImageLightbox()`；不直接綁 navbar 按鈕、不重寫進度、不以 localStorage 存進度。

## 功能契約 Checklist

- [x] 課程 `grade6-115-1`；週碼 `11`；普通 `typing_task_6` 六關，`five-then-flower`；兩魔王 `typing_boss_zh_1`／`typing_boss_en_1` 各一關，`boss`。不重用舊週進度、不更改舊活動設定。
- [x] 完整文本依教案已目視核對的原頁固定供應，`{ id, ans }`，不即時 AI；英文直撇號、印刷折行合併及來源有說明。
- [x] 正式闖關需登入；本人進度保存成功才解鎖。手動草稿只進 `typing_drafts`，草稿不算過關；重整接續、重練不重領，失敗保留可修正狀態。
- [x] 第1～4關不給葉，前五關合計一葉，全六關保留一葉加一花；每個獨立魔王首次完成各一花。
- [x] 班徽主線 p.48～52、最終 PNG、上傳成功判準與透明背景備援；只連共用作業，不建頁面上傳表單、不硬寫 assignment ID。
- [x] 四項快手用途、入口、保存及完成規則齊備；考前練功坊只稱「部分期中後範圍」，依現行清單與任課進度選用，不承諾點進就給獎。
- [x] p.50 示範四狀態，對齊只改 x、平均分配只改 y，邊緣空隙以數值顯示；純觀察不計分／保存，不仿造正式測驗。
- [x] 六年級固定第09／10週風格；紫／靛／藍綠漸層、黃色重點、半透明卡、4px彩框、圓形編號／圖示、900字重、清楚焦點與減少動態效果。
- [x] 每週任務圖卡：實際附同年級參考、ChatGPT 工作瀏覽器生圖、逐字逐圖 QA、1920×1080 q80 WebP、Cloudinary 原檔回讀及同頁燈箱桌手機驗收。
- [x] 教師專用測試帳號本人正式 `student_progress` 八次保存逐筆讀回、第三關後重整接第四關、兩魔王分開保存。六關邊界及舊週回歸另以隔離 PostgreSQL／模型驗證；沒有借用真實學生帳號。
- [x] 首頁／navbar／後台週卡三處同步；教師帳號真實隱藏→新來源首頁隱藏→恢復顯示→首頁恢復，課程限定六年級115-1第11週。使用同正式 origin 的受控本機來源覆寫，不代表已發布。
- [x] 前端三活動與正式 `garden_reward_catalog` 一致；受保護 SQL `supabase/grade6-week11-catalog.sql` 已套用，98項無缺漏／差異／額外項；不改函式、RLS或既有學生紀錄。
- [x] 已核教師後台原本只有第2、5週作業，無最終完成作業；建立第11週603、604各一份同名「我們的班徽（完成）」並開放收件，各班只會收到自己的作業。教師回讀已確認，未代學生上傳或評閱。
- [x] 第11週閱讀 period（11/09～11/15）原本不存在，已建立且提供分享；專用測試帳號學生入口確認可見，未代寫閱讀內容。
- [x] 桌機1280／手機390截圖與第10週對照、字型／圖示／分色／無溢出，燈箱縮放、滾輪、真實pointer拖曳、雙擊、重設、置中、關閉與焦點／再開100%，概念按鈕鍵盤及保存失敗驗收。另以Chrome CDP兩接觸點驗證雙指縮放；未用實體手機。

## 圖卡及外部狀態

本次授權為製作網頁；尚未部署或promote正式站。以下分開記錄真實資料與合成驗證，不以頁面連結存在代表外部設定完成。

### 圖卡

- Prompt：`automation/prompts/grade6-week11-infographic.txt`；實際附件 `grade6/115-1/images/week09/week09-infographic-v2.webp`，metadata記錄requested/uploaded均1。沿用水彩、高年級兒童、深藍粗圓字、紫／藍綠／橘／天藍四區，不用學校官方徽章或吉祥物來源。
- 經註冊AI工作瀏覽器01、精確target與worker；可見ChatGPT帳號 `codex THPS`，核對後才上傳參考及送出。一次成功接受的圖像請求，生成／穩定／下載各有證據；沒有因前置連線或選單載入問題重送已接受請求。
- 逐字核對星星、Shift＋Alt向左複製、先放滑鼠、下載及上傳、已繳交待評、四個平行快手；泛用熊班徽為操作示意，不冒充學生原作品。
- 正式檔 `grade6/115-1/images/week11/week11-infographic-1920x1080-q80.webp`，1920×1080、q80、197368 bytes。以contain保留全圖。
- [Cloudinary正式圖卡](https://res.cloudinary.com/dmqmjfqng/image/upload/v1794539117/it-class-tcwu/grade6/115-1/week11/week11-infographic-20261113-1920x1080-q80.webp) 與頁面img／燈箱href一致；HTTP回讀與本機SHA-256皆 `96ddcf9e25b8648f285b43d9a7e8b2a923109eb127a6186ecd1dffb4b6087781`。
- 原PNG、參考附件證據與metadata留ignored `.chat-mode/evidence/image/`，不提交原圖、帳戶憑證或教材PDF。

### 真實後台與目錄

- 已確認可見教師帳號 `chianwu@gmail.com` 才建立／開放603及604最終作業和閱讀期間。開始為學校測試帳號，未以該帳號冒充教師；正常OAuth切換後再確認權限。
- 正式Supabase專案以personal CLI可見專案清單、linked ref及DB host核對為 `upxgyusodibaqcrocdzj`。只套用三筆目錄設定，受保護交易可重跑／衝突拒絕；沒有套用任何函式SQL。live snapshot核對175函式通過。
- 新設定／正式manifest比對expected98、actual98，missing／mismatched／extra均空；證據 `.chat-mode/evidence/catalog/audit.json`。
- 教師專用學校測試帳號核對可見身分後切至六年級測試身分，正式保存普通六關及兩個魔王共8次；每次等待保存成功再讀回。前三關完成後重整接第四關，三筆最終狀態各自completed=true；閱讀入口可見本週。通知RPC在測試分頁攔截為空，以免消耗花園通知；進度REST及讀回是正式服務。
- 驗收腳本最初僅等待readOnly就重整，第三筆請求尚未完成即被中斷；確認資料只停在前兩關後，修正腳本為等下一關／慶祝顯示並逐筆讀回，再接續完成，未把該次誤判為產品保存成功。
- 完成後恢復原三年級專用測試身分，並以限定學校測試email、seat30、課程、週次、三活動與預期完成狀態的SQL只清除本次三筆測試進度，剩餘0。未清學生舊進度、草稿、成長已讀或閱讀內容。

### 本機與合成驗證

- `node --test automation/tests/grade6-week11.test.mjs automation/tests/grade3-week11.test.mjs`：7項通過；正式growth快照在隔離PostgreSQL執行，0～4／5／6關、全三活動一葉三花、穩定ID、目錄可重跑及衝突拒絕、舊活動規則保留。
- `automation/tests/grade6-week11-browser.cjs`：註冊工作瀏覽器、精確本機target；合成Auth／REST、真實頁面及模組。匿名鎖定／登入按鈕、讀取失敗連直接check都不保存、錯字行次、草稿保存及回復、保存失敗不解鎖、六關保存／重整／重練不重寫、兩魔王獨立、桌手機無溢出、概念四狀態鍵盤切換、燈箱操作通過，pageerror0。
- Browser截圖／報告在ignored `.chat-mode/evidence/browser/`；已目視第10週參考、週頁、概念手機畫面及圖卡。Chrome雙指touchStart／touchMove／touchEnd雙接觸點縮放另通過，不冒稱實體手機手勢。
- JavaScript語法、UTF-8、教案連結、`git diff --check`、練功坊21產物檢查通過。navbar變更造成16個練功坊入口與assets manifest資產指紋同步，是產生器結果，不手改其他年級內容；同學期20個舊入口只同步navbar快取版本。
- 製作樹內含既有追蹤教材索引／目錄，直接執行release preflight按專案排除規則阻擋；沒有刪教材或繞過檢查。發布時由main發布腳本的來源排除流程處理，正式目錄則已另用官方audit比對通過。未在製作樹直接部署。

### 實際限制與交付

- 未測實體Microsoft注音候選窗、實體手機或603／604學生本人最終檔案上傳；這些沿用原服務，不以本輪測試身分代替實班證據。作業收件已教師回讀，閱讀已學生入口確認。
- 努力樹新獎勵前端／伺服器及正式目錄一致，未以真實學生進度觸發主場景成長動畫；發布前課堂smoke仍需保留此項確認。
- 本機預覽 `http://127.0.0.1:8131/grade6/115-1/week11.html` 與專用預覽分頁保留供教師檢視；其餘本次暫存頁及教師操作頁已清理，租約／worker已釋放。預覽僅bind127.0.0.1並拒絕dotfile及教材來源，不是公開測試站。

## 發布前檢查

週卡、navbar 及後台預設同步後需執行 `node automation/build-quiz-workshop.mjs`，同步產生器的資產指紋。新增三活動後執行 `node automation/build-garden-catalog.mjs` 並核差異；正式目錄未套用前，garden preflight 應阻擋發布，不關閉檢查。若後續需改函式，另取套用同意並更新 production snapshot／live check。
