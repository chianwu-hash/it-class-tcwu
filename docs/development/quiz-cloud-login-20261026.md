# 題庫 Google 登入與 Supabase 本人作答

2026-10-26 使用者明確要求：「不能只存在本機，要能存在資料庫，你做個登入介面我來登入後把記錄在在supabase」。此為先前僅本機驗證範圍之後的新授權。

## 本次結果與待本人驗收

### 後續修正：以學生登入作答（同日）

使用者指出原意是學生帳號作答，並已自行登入測試學生帳號。原先只做教師本人試答屬實作誤解，已修正：入口改為 `library_sessions`；名冊學生看見所屬年級的 16 卷，教師則保留自己的 32 卷試答。登入文案改為學生帳號，不再要求使用者用教師帳號測學生流程。

新增 `practice` 場次模式：仍以本人 Auth 身分、已驗證 email 及既有名冊班級驗權；各學生的 `quiz_attempts`／`quiz_answers` 分開保存。共用單元自學卷供跨班使用，不套用課堂場次的 29 人上限；原 `classroom` 的名冊與 29 人限制保留。`supabase/quiz-student-library-seed.sql` 使用原有固定版本另建 32 個學生場次，依現有名冊班級分配三／六年級，未新增或更改學生名冊。

**實際學生登入流程已驗證**：沿用使用者自行登入的測試帳號，顯示三年級 16 卷；另開英語第一單元試答，實際送出 1 題，Supabase 獨立查詢確認該題 response 與本人帳號相符。重新整理自動進入下一未答題，回看前題仍保留選項、順序與解析；選卷摘要顯示 1／10，雲端私有圖片正常解碼，390px 無水平溢出，頁面程式錯誤 0。這 1 筆測試作答保留供使用者查看，未擅自清除。

新增年級分流、非名冊／跨年級拒絕、不同學生紀錄隔離、未揭答投影、保存／接回與 30 位合成學生自學場次測試；`npm run quiz:test` 共 10 組通過。最終瀏覽器紀錄在 `automation/output/quiz/cloud-practice/student-live-report.json`。本節取代下文早先「待本人登入、0 作答」的階段性狀態；未代登出或重新要求登入。

題庫頁以 `data-quiz="true"` 沿用既有年級 navbar 的獨立模式，顯示中性的「我的雲端測驗」及「單元選卷」，避免三年級看到六年級資訊課週次或連到未供應的課程頁。共用 `course-navbar` 新增可選 `homeHref`，預設仍為 `index.html`；一般週頁導覽不變，登入事件仍交由 `initNavbarAuth()`。

入口：http://localhost:3000/grade6/115-1/quiz-library.html

已建立 32 份雲端固定版本／本人試答場次，沿用既有三、六年級期中單元卷的 320 題。作答經真實 Supabase Auth 與 `quiz_action` RPC，保存在雲端 `quiz_attempts`／`quiz_answers`，不使用本機 PGlite 或 localStorage 保存答案。頁面目前仍由本機供應，尚未發布公開網址；從其他電腦使用相同前端及 Google 帳號，可讀取同一份雲端進度。

登入頁已在 AI 工作瀏覽器開啟。**尚待使用者本人完成 Google OAuth，送出一題後再核對雲端紀錄及重整接續。** 未宣稱這一步已完成。部署及 SQL 交易測試後，雲端仍為 0 筆作答，未替使用者作答。

舊合成身分的本機試答完整保留，未自動歸到真實帳號，避免錯誤認領。此次雲端版本另建場次，不覆蓋原本 4344／4345／4347 的紀錄。

## 頁面功能契約

- 類型：題組選卷入口，功能參考 `grade6/115-1/quiz.html` 與既有 32 卷入口；沿用已確認的紫色、圓角卡片、大字與圖文答題風格。
- Navbar：沿用 `grade6/115-1/navbar.js`，透過 `initNavbarAuth()` 登入／登出，不直接綁 navbar 按鈕。
- 登入：沿用 `beginCentralizedLogin()` → 根 `/index.html?login=1` → 共用 `signInWithGoogle()` → 返回原頁。專用本機服務的根 callback 使用 `shared/quiz-login-callback.mjs`，未改全站 `auth.js` 或既有正式首頁。
- 未登入：鎖定試卷與作答，顯示登入說明。登入後列出本人雲端進度，可按年級／科目篩選及手動更新，不輪詢。
- 保存：沿用 `createQuizRequest`、最新 SDK session、`initQuizModule({mode:'server'})`、後端判分、穩定選項亂序、冪等 request_id 與最後一題停留回饋。
- 換人／登出：清除畫面上的前一位題卷、進度與作答；請求回來時仍須核對身分。選卷頁使用 generation 及非同步排程，避免 Auth callback 鎖與舊回應混入。
- 不映射 `student_progress`、努力樹、課堂身分卡、作業或閱讀；沒有新增週卡或可見性設定。
- 桌面 1280px、手機 390px 已檢查未登入畫面；手機無水平溢出。

## 雲端資料與權限

指定既有個人專案 `upxgyusodibaqcrocdzj`，CLI 再核對專案名稱後操作。未建立新付費資源或調整方案。

`quiz_sessions.access_mode` 新增 `classroom`（預設）與 `personal`：

- 原課堂場次仍要求正式學生名冊，教師不能以學生加入，原名額及規則保留。
- `personal` 只允許該場次擁有者、且符合現行 `is_teacher()` 的帳號加入／送答。另一位教師或學生即使取得連結也不能使用。
- `personal_sessions` 只回傳本人場次的標題、編目、題數、已答數、已答正確數，不提供未揭答答案或解析。
- 六張題庫／媒體表皆啟用 RLS 並撤除匿名及一般帳號直接讀寫權限；只經受控 RPC／Edge 使用。原有教師帳號規則未更動。

必要的 `quiz.sql`、`quiz-media.sql` 已套用；`quiz-media` Edge Function 已部署並在 handler 以 Auth `/user` 驗證 JWT，不依賴停用的舊 gateway JWT 檢查。CORS 僅開放 `http://localhost:3000` 與 `http://127.0.0.1:3000`；未設定外部媒體抓取來源。

32 卷引用 49 個既有私有媒體物件（含原版聽力）；直接沿用原本物件，沒有重傳或公開。資料庫逐項確認 49 個物件皆存在、大小符合媒體資料；`quiz-media` bucket 仍為 private。頁面透過驗權後的短效網址讀取，不保存簽章網址。未套用 `quiz-storage.sql` 改動既有桶設定。

## 實作與重啟

- `grade6/115-1/quiz-library.html`、`shared/quiz-library.css`、`shared/quiz-library.mjs`：登入／選卷／進度入口。
- `shared/quiz-login-callback.mjs`：專用服務集中登入返回。
- `shared/quiz-student.mjs`：`cloud=1` 顯示雲端身分與返回選卷；原 `local=1` 不變。
- `automation/quiz-cloud-server.mjs`：只供應頁面，綁 loopback 3000，不含 service key、不提供本機合成 API。
- `automation/quiz-cloud-import.mjs --prepare`：產生可核對的匯入 SQL；`--apply` 才套用。固定版本識別由來源 key 與擁有者決定，重跑不覆寫內容；衝突中止。此次只匯入既有 32 卷，未擴及全題庫上雲。
- 啟動：從專案根目錄執行 `npm run quiz:cloud`。前端無須本機管理員憑證；只以使用者 Supabase 登入權杖呼叫雲端。

匯入 SQL／場次對照與實測輸出在受 Git 忽略的 `automation/output/quiz/cloud-practice/`；不保存任何 OAuth 權杖或私密 API key。未新增 Git 提交或推送。

## 已完成的檢查

- 原 8 組 quiz 測試通過；新增本人模式測試涵蓋跨帳號拒絕、課堂規則保留、未揭答投影、保存、接回、亂序與冪等，已納入 `npm run quiz:test`。
- 真實雲端 PostgreSQL 交易測試：讀取 32 卷、本人加入、保存一題、接回相同答案、重送相同 request_id、選卷進度一致；交易最後 rollback，作答數仍 0。這不等同實際 Google OAuth 驗收。
- 真實 HTTP 9 項檢查：六張表匿名讀取拒絕、匿名 RPC 拒絕、匿名媒體讀取拒絕、非允許 origin 拒絕。
- 真實瀏覽器：未登入時試卷隱藏、登入按鈕可見、程式錯誤 0、390px 無水平溢出。
- 待本人登入後：確認正確帳號、送出一題、資料庫確實入帳、重整及重新登入後接續、雲端圖文／音檔與答後解析。
