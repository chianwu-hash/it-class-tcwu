# 學生學習檔案第一版：本機實作與交接

> 後續更新：使用者已另外授權真正 Google 登入與既有實際紀錄的本機唯讀驗證，並已通過。實際資料入口為 `http://localhost:3000/admin-learning.html`；細節與限制見 [真正登入驗證](2026-11-01-admin-learning-real-google-local.md)。下方「未接正式學生／真正登入尚未驗證」是早期合成階段狀態，原 4472 仍保持合成資料；未上線限制不變。

日期：2026-11-01。使用者已核定兩階段實作，第一版包含逐題答案明細；先本機預覽，暫不上線。本節取代前一份討論文件中「尚未核定實作」的當時狀態。

## 本機入口

`http://127.0.0.1:4472/admin-learning.html?local=1`

啟動：在專案根目錄執行 `node automation/admin-learning-local-server.mjs`。

本機服務僅綁定 127.0.0.1，全部使用合成名冊與隔離 PGlite；沒有正式登入、學生資料、憑證或雲端連線。示範資料由每次啟動重新建立，不影響學生。頁首有明顯提示，不能把示範畫面當作正式紀錄已串接。

建議試看：

1. 六年級預設選 603 班 01 號：摘要、週次、英打／中打切換及打字歷程。第一關有目前版本與教師重置前歷史，事件可翻頁。
2. 考前練功坊列表有兩頁；第二頁包含已隱藏卷、尚未完成的同重點延伸卷與一般完整卷。
3. 點「逐題答案明細」：查看原答、亂序後選項、正解、解析、公式、共用材料圖片及簡答題。可切換「只看已答錯題」，未答仍有獨立狀態。
4. 名冊第二頁的 31 號無紀錄、32 號未連結、33 號帳號對應衝突，三種情形不同。02 號週次資料可驗證分頁。
5. 切換三年級課程：名冊與學生選取會清除，三年級英打採對應門檻。

## 已完成範圍

階段一：年度名冊、班級與搜尋、學生摘要、週次活動分頁、英中打各 12 關成果、事件及重置歷史。依可信 email 與已驗證 Auth 帳號對應，姓名以名冊為準；不以姓名或身分卡鍵猜測合併。

階段二：試卷列表與單卷明細，保留固定版本、實際題目順序及選項順序；完整／未完成／尚未開始／學生列表隱藏皆可區分。已答正確率的分母為已答題數，不把未答算成答錯。錯題篩選由伺服器對全卷處理後分頁，不只篩當頁。

目前真實 SQL 契約是 schema 1 的單選與簡答，簡答為非選擇題。獨立 schema 2 非選擇題實驗模組不假稱已整合；未知 document schema 明示不支援，不默默當成無紀錄。題目共用材料、公式與媒體沿用 `shared/quiz-render.mjs`，沒有另寫學生作答或判分器。

練功坊來源以 school_year 與適用 class_codes 為範圍，頁面明標「本學年度」，不冒稱可靠的學期隔離。跨來源不合成總分、學習時數、熟練度、猜題或弱生判定。

## 功能契約（E 類教師後台）

- 視覺：沿用既有課程的淺色漸層、粗體、白底圓角與柔和邊框；以教師查閱為主，採名冊／個人檔案雙欄，非新增學生週頁。參考 `admin-progress.html`、`admin-typing-foundation.html` 與週頁風格基準；UI/UX 技能建議中的行銷頁模式及裝飾動畫不適用。
- Navbar：E 類後台不使用學生 navbar，不新增或手刻學生導覽列；正式模式有連回既有後台的文字連結。
- 登入：沿用 `shared/auth.js` 的 `resolveSession`、`isTeacher`、`beginCentralizedLogin`、`signOutAndReload`；後台自行管理身分 UI（既有 E 類契約）。不同帳號切換立即清除 DOM、取消請求與關閉明細；token 更新不無條件重載。
- 學習資料：只讀；不用 localStorage 保存成果、摘要或學生選擇；不新增 student_progress／quiz_answers 的寫入、不代答、不重判、不重置。
- 權限：新增教師限定 RPC，伺服器再次確認教師、兩個目前課程、年度名冊、選定學生與試卷所屬；不接受呼叫者傳任意 user_id，資料表權限不放寬。
- 週卡、活動鍵、課堂開關、獎勵、作業繳交、自由閱讀、解鎖：本次沒有新增或改動，相關學生頁 checklist 為 N/A。既有基礎重置僅留在原後台。
- 載入：預設三個請求（名冊、所選學生摘要、打字列表）；未選卷不傳題目與正解。列表及事件分頁，無輪詢。逾時／錯誤有手動重試，不顯示成零分。
- 明細：原生 dialog、Esc 關閉與焦點返回；Tab／方向鍵操作紀錄頁籤，文字狀態不只依顏色。手機名冊可捲動，明細按需載入。

## 檔案所有權與整合

本輪 Codex 只新增以下功能檔與本紀錄，不覆蓋並行的課程、練功坊、努力樹或既有後台修改：

- `admin-learning.html`
- `shared/admin-learning.mjs`、`admin-learning-api.mjs`、`admin-learning-model.mjs`、`admin-learning.css`
- `supabase/admin_learning.sql`
- `supabase/functions/admin-learning-media/index.ts`、`handler.mjs`
- `automation/admin-learning-local-server.mjs`、`automation/lib/admin-learning-local-db.mjs`
- `automation/tests/admin-learning.test.mjs`、`admin-learning-browser.cjs`

沒有變更 package.json 或既有共用模組。後台入口先用直接本機網址，未將連結加到其他人正在修改的 `admin-progress.html`。

新增 SQL 提供 `admin_learning_action`（roster、profile、weekly、typing、typing_events、papers、paper）；內部 paper projection 不授予瀏覽器角色執行。新增索引僅針對目前查詢鍵，不修改判分、進度或獎勵函式。

媒體用新增 `admin_learning_media_access` 與獨立唯讀 Edge handler，驗證教師與所選試卷固定版本內的 URL 後才取短效簽章，支援既有 Storage／Drive 簽章機制。沒有修改原 `quiz_media_access` 或 quiz-media handler。正式媒體 Edge 與實際 Drive 尚未呼叫。

## 驗證與已知限制

- `node --test automation/tests/admin-learning.test.mjs`：12 項通過，包含真實新增 SQL、匿名／學生拒絕、跨學生／年級拒絕、未對應與重複對應、分頁、重置舊版本、軟刪除卷、原始亂序選項、簡答、媒體 URL 綁定、來源拒絕與切換帳號後回應失效。
- 所有學習表查閱前後 SHA-256 一致；不因查閱修改作答、進度、重置或卷列表。
- 瀏覽器 12 類檢查通過；證據為 ignored `automation/output/admin-learning-20261101/` 的 `browser-report.json`、桌面／答案明細／手機 PNG。涵蓋英中打切換、摘要不預取答案、未開始卷的原序預覽、打字版本與事件分頁、原答／亂序選項／公式／圖片／簡答、錯題與未答、隱藏卷、三種空狀態、延遲回應、部分來源失敗重試、課程切換、鍵盤與 390px、無輪詢。以共用登記瀏覽器、精確 target 及租約工作程序驗證，結束斷線釋放，保留預覽分頁。
- 初次瀏覽器 URL 比對曾命中舊分頁，已在任何頁面操作前因 target 不符而中止；改用啟動器回傳的精確 target。隱藏分頁的滑鼠測試曾等待，停止自有 worker 後以技能允許的單次啟用目標分頁恢復。新增英中打切換後同步更新測試選取規則，保留最後完整報告為準。
- 本機 C／D 兩路徑指向同一專案，啟動器的入口判斷使用 realpath，避免只載入模組卻未啟動服務。
- 未讀正式學生、未套正式 SQL、未發 Edge、未提交／推送／部署。正式 Google 登入、正式 schema／完整最新發布來源相容性、實際容量與 Drive 媒體為未來上線前工作，本機合成測試不能取代。

下一步：讓使用者在本機檢視功能、版面與用語；依回饋修改。仍遵守「暫時不要上線」，不得因候選完成自行發布，也不能從較舊主工作樹整包覆蓋正式站。

## 接續補強（2026-11-01）

使用者回覆「好，繼續」；延續本機範圍，沒有視為部署、讀正式學生或套用正式資料庫的授權。

- 練功坊新增科目及狀態篩選（全部、尚未開始、作答中、已完成、學生列表已隱藏）；SQL 先篩整位學生的完整試卷集合，再分頁，回傳符合數／全部數及可選科目。無符合條件不冒稱無紀錄，支援清除篩選；換學生自動清除前一人的條件。摘要維持全部試卷口徑，不隨列表篩選變動。
- 預覽資料增加英語卷，與數學卷保持 23 張總量，可實際檢視跨科與交集篩選，不用錯標數學題冒充英語題。
- 憑證失效 HTTP 401 明示重新登入，立即清空姓名、名冊、摘要與明細。不同帳號回應以 `identity_changed` 丟棄，避免舊帳號回應觸發新帳號登出。不同帳號、登出與教師切成學生時同步移除敏感 DOM；同帳號 token 更新不重載內容。
- 真實新增 SQL／adapter／HTTP 測試現為 **13 項**通過。
- 新增 `automation/tests/admin-learning-auth-browser.cjs`：以本機精確頁籤攔截的合成 Auth 模組、真實本機 SQL 查詢驗證 8 類情境（未登入／非教師、共用登入入口、token 更新、登出、教師 A→B 延遲回應、教師→學生、401／重新登入、跨科與狀態／390px／換學生清條件）。無實際 Google OAuth 或雲端請求。證據 `auth-browser-report.json`，無 JS 錯誤；測試結束移除攔截並回到一般合成預覽。
- 新增 `automation/admin-learning-load-check.mjs`：獨立 PGlite 合成 480 名學生、9,600 張卷、192,000 筆答案、30,720 次打字事件、3,840 筆週次紀錄。六類查詢各量測 6 次，第一次單列、後五次取中位數；本輪約 2.31–7.83ms，JSON 回應約 425–10,332 bytes。查閱前後答案及事件雜湊一致，單卷答案查詢計畫使用既有索引，沒有對正式庫執行壓測。
- 大資料量指標是額外合成資料的數量；基礎展示 fixtures 仍同時存在。測試為單一本機 PGlite 連線，**不是 Supabase 的容量／併發或正式環境效能保證**。確切結果見 ignored `load-report.json`。

仍保留本機入口 `http://127.0.0.1:4472/admin-learning.html?local=1`，新桌面篩選畫面為 ignored `04-filters-desktop.png`。既有正式來源相容性、正式 Google OAuth 與實際媒體環境仍需在未來獲准上線前另外驗證；本次沒有變更其他工作區檔案、正式 schema 或部署設定。
