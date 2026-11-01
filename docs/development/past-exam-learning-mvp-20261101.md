# 三上自然單題：解析連學習重點 MVP

日期：2026-11-01。使用者本次授權先做一題 MVP；不是完整錯題延伸功能的發布。僅本機實作與驗證，正式 Supabase、SQL、題庫版本、媒體與學生資料均未變更。

## 使用方式

本機預覽：<http://127.0.0.1:4491/grade3/115-1/past-exam.html?paper=dingxi-114-1-g3-exam1-science>。

第 1 題選擇 O 或 X，送出後即可看到原有核對結果、新增補充解析與兩個可展開的學習重點；不論答對或答錯都可查看。尚未作答時不顯示，也不在 API 回應中帶出這份解析。這是合法揭答後的學習說明，尚未提供完卷後概念推薦清單或書商挑題。

頁首明示合成測試帳號、本機 MVP。沿用現有作答頁、網站主題、年級 navbar、`initNavbarAuth()` 與 `initPastExamUI()`，不另造正式登入／學生進度機制。

## 原題與概念對應

- 試卷：頂溪國小 114 上學期期中、三年級自然，原卷是非第 1 題。
- paper／group／field：`dingxi-114-1-g3-exam1-science`／`s1-q01`／`s1-q01`。
- 原題：「校園生態農場裡的解說牌、落葉堆肥區的設施屬於生物。」
- 官方答案：X。試卷與解答 p1 原頁已目視核對，沒有改題或更改官方答案。
- 採用本機最新已發布卷快照 SHA：`f915d39c2e5cb1fb8f9adddef8e1d023c1c3c3b7f680173bc9efe69db280d78d`；未重新註冊或啟用任何正式版本。
- 試卷 PDF SHA：`76ad38e928a1ddd884afa42d8389f1f943bf682e6b103f19c0f445103e16ee39`。
- 解答 PDF SHA：`093bb39ca515544f24bddf514b244d22fa51cc5faeaa8a6f35b444b26b4856d0`。

| 學習重點 | 與原題的關係 |
| --- | --- |
| 生物與非生物怎麼分？ | 設施是非生物，植物／蚯蚓等是生物；判斷不能只看是否移動。 |
| 分清楚設施和裡面的生物 | 問的是解說牌、堆肥區設施本身，不是問裡面有無生物；用花盆與活著的小草說明。 |

解析與重點是 AI 依題意整理的補充說明，學生頁明示「非官方解析」。這兩個是局部概念標籤，**尚未對應書商知識代碼／題目**，也不是已確認的全卷學習重點清單。一次錯答不當成已診斷學生迷思。

## 檔案與功能契約

- `automation/fixtures/past-learning-g3-science-q01.json`：唯一試辦題的來源、原答、解析及兩個概念，不混進正式原卷 document。
- `automation/lib/past-learning-fixture.mjs`：核對 paper、文件實際 SHA、group／field、答案及 PDF provenance，只在已提交 record 投影 `learningReview`；包含明確 opt-in 的本機合成 auth／transport。
- `shared/quiz-past-learning-review.mjs`：純顯示 server 已揭露 record 中的解析，複查版本、題組及欄位；用文字節點渲染，不請求 AI、不寫進度、不含題目答案映射表。
- `shared/quiz-past-ui.mjs`：僅在 saved 時接顯示器；server 沒回 learningReview 的題型／試卷維持既有畫面。
- `shared/quiz-past-style.css`：新增限定此區的主題樣式及手機單欄重點按鈕。
- `automation/past-exam-local-server.mjs`：原有隔離 PGlite fixture 加上 `PAST_LEARNING_REVIEW_PATH` 選項。不設定時不替代 auth、不投影新資料；只 listen 127.0.0.1，不是正式 migration。

| 契約 | 本次處理 |
| --- | --- |
| 頁型／參考 | 既有 past-exam adapter，參考 `grade3/115-1/past-exam.html`；沒有新增週頁／週卡。 |
| Auth／navbar | 沿用共享頁面生命週期；只有啟用本機 map 的 fixture 才提供合成 auth。不是實際 Google OAuth。 |
| 保存 | 作答仍走本機真 `quiz_past_action`／PGlite；解析開關不保存、不寫 localStorage／student_progress。 |
| 解鎖 | 該題已提交且合法回傳核對 record 才附解析；不要求完成全卷才能看此單題說明。 |
| 版本 | 文件 hash 與原件 provenance 綁定；其他版本／其他題／人工 correct=null 不自動套用。 |
| 葉片 | 不新增獎勵；本題錯答尚未完成原卷，不給葉。原卷的重作、完整作答及首次達標規則不改。 |
| 週次可見性／作業／閱讀／打字 | 不適用，均未修改。 |

## 驗證證據

證據根目錄：ignored `automation/output/past-exam-learning-mvp-20261101/`。

- `paper-q01-source.png`／`key-q01-source.png`：兩 PDF SHA 核對後渲染並目視檢查。
- `api-results.json`：實際本機 SQL/API，送出前無解析；錯答 O 得到官方 X 與重點，另開作答答對 X 得 2 分也可看重點；同請求重試、接回、另一學生讀取拒絕、另一題不套用、重作清空、葉片為零；錯來源 hash、答案對應及實際文件被改而 hash 不變均拒絕。
- `browser-results.json`：桌面 1280、手機 viewport 390／360；兩概念點選、展開及切換；重新整理接回；換題不錯接；換人、登出與重作清除；鍵盤 Enter 開啟並移焦點；無 pageerror、無橫向溢出。
- `learning-1280.png`／`learning-390.png`／`learning-360.png`：實際本機頁截圖；已目視核對桌面及手機版。手機視窗不是實體手機驗證，未宣稱螢幕閱讀器已實測。
- Claude 唯讀審查 session：`past-learning-mvp-20261101-retry`，Code 2.1.289／訂閱 OAuth；約 89 秒含 supervisor、10 次 Read，實看兩原頁及 1280／390 截圖，結論無阻擋本機交付。viewer 啟動、marker、Git 前後一致皆驗；只讀未執行測試，未全面驗正式 SQL／renderer。回覆在 `.chat-mode/sessions/past-learning-mvp-20261101-retry/turn-0001.response.md`。
- 已依其建議補 X（不正確）、非官方解析標示、concept id 字串型別檢查，並追加鍵盤驗證。

初次瀏覽器驗證有兩個 fixture 假設錯誤：換帳號仍帶上一人的 attempt 時被 SQL 拒絕，以及再次 start 本來會續接未完成作答。改測試先清除舊 attempt／明確 restart 後通過，未更改這兩項產品行為。首個 Claude 程序在啟動時回傳 Windows `-1073741502`，0 event／0 Read，未當完成；保留失敗 run，使用新 session 成功複核，不續用失敗會話。

補文句及鍵盤案例後，曾在手機尺寸切換時發生 Runtime 通訊逾時，未把前次成功收據當最新版結果；加入 `browser-phase.json` 步驟紀錄後重新驗證通過，最新版 `browser-results.json` 含時間戳及 `keyboardEnterAndFocus=true`。沒有據此斷言是產品排版問題，也沒有增加依賴或放寬判分／授權。

本輪沒有完整開工計時，不把審查／測試秒數當作總製作工時。自動化負責判分／來源綁定與瀏覽器流程；AI 代理核對原頁與內容，沒有新增教師逐題簽核。

## 重開本機預覽

在本工作區 PowerShell 設定：

```powershell
$env:PAST_LOCAL_PORT='4491'
$env:PAST_BUNDLE_PATH='automation/output/past-exams-autoreview-20261101/dingxi-114-1-g3-exam1-science/bundle.private.json'
$env:PAST_LEARNING_REVIEW_PATH='automation/fixtures/past-learning-g3-science-q01.json'
node automation/past-exam-local-server.mjs
```

以既有 `automation/tests/past-learning-api.mjs` 驗 API；瀏覽器腳本 `past-learning-browser.cjs` 固定本次 port，需先取得 AI Work Browser lease、精確 target，並透過 `D:/ai-browser/run-background.cjs` 執行，不可裸連持久瀏覽器。測試原件／bundle／QA 圖為 ignored 本機產物，clone 不包含，需按來源 SHA 另行取得。

本機資料庫在記憶體內，關 server 就消失；重開後請使用不帶舊 attempt 的上述預覽網址。這不是正式成績保存方案。

## 下一階段（未實作）

若採用此互動，再確認兩個重點如何對應書商題庫的課程／knowledge code、候選練習題及私有媒體；另做正式 RPC 合法揭答後的資料投影與映射版本流程。之後才擴到更多原題、完整錯題概念推薦與延伸作答。不能將本機 auth／測試伺服器部署成正式服務。
