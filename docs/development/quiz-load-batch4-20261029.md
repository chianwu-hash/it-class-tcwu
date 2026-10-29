# 考前練功坊第四批：目錄快取與重複請求減量（Claude 實作，已上線）

2026-10-29 15:00–15:25（臺北時間）。使用者決定先不升級 Supabase，要求 Claude 直接實作並上線，供下一班實測。依據：[第三批後故障查核](quiz-bottleneck-claude-review-20261029.md)。那堂課只有 12 位學生、約 1.7 req/s，Nano 就因 swap I/O 卡住、CPU 100%、監控中斷 7 分鐘。

**本批是減少負載，不是根治。** Nano 能否撐 30 人仍需實際課堂驗證；主機升級仍是建議項目。

## 改了什麼

| 項目 | 之前 | 之後 |
|---|---|---|
| 自組卷目錄 `quiz_pool_catalog` | 每次 join 2,906 題重算；新連線第一次 0.7–4.9 s | 讀每年級快取表 `quiz_catalog_cache`；題池／單元歸屬／課程／角色異動時 statement trigger 清空，下次讀取時重建（advisory lock 防止寫入舊資料） |
| 組卷成功後 | 另外重載整份 `quiz_library_sessions` | `quiz_compose` 回傳 `paper`（與清單項目同格式），前端直接插入；重送也一樣 |
| 練功坊 navbar 身分 | 每頁另外呼叫 `get_my_student_enrollment`（故障時最多的請求） | `library_sessions`／`entry_context` 帶回 `identity`，交給 `grade6-nav-identity.js` 的 `provideNavIdentity()`；quizMode 不再查 RPC |
| `quiz_entry_context` 取科目 | 讀整份 `quiz_versions.document` | 讀 `quiz_version_meta.catalog`（缺 meta 時退回原文件） |
| 伺服器忙碌 | 學生一直重新整理 | 504／502／503、`PGRST003`、`57014`、20 秒逾時後，本頁 30 秒內的讀取（清單、目錄、錯題、獎勵、入口、教師清單／監看）直接在本機提示「請等 N 秒，不要重新整理」，不送出請求；寫入（送答、組卷）照常，原 request_id 手動重送不變 |
| `pg_stat_statements` | 4,831／5,000 筆、約 4 MB，平台 exporter 故障時跑 13.9 s | 07:12:42 UTC 已 reset；重設前的 top 30 存在 Claude 暫存目錄 |

沒有改動：`quiz_action`、送答、判分、計時、防弊、揭答、一葉、抽題邏輯（compose 只在兩個 return 多帶 `paper`，其餘逐字沿用第三批）、媒體驗權、錯題、教師監看。

## 檔案

- SQL：`supabase/quiz-load-batch4.sql`（安裝順序：原 quiz／media／wrong／pool／rewards → batch1 → batch2 → batch3 → **batch4**；重裝舊檔後要依序重套）。
- 前端：`shared/quiz-api.mjs`、`quiz-transport.mjs`、`quiz-library.mjs`、`quiz-compose.mjs`、`quiz-student.mjs`、`grade6-nav-identity.js`；`grade3|grade6/115-1/navbar.js`、`quiz-library.html`、`quiz.html`（快取標記 `v=20261029-batch4`）。
- 測試：`automation/tests/quiz-load-batch4.test.mjs`、`quiz-load-batch4-browser.cjs`；`automation/lib/quiz-local-db.mjs` 新增 `QUIZ_TEST_READ_BATCH4`。第一批的 SQL／瀏覽器測試改為新契約：`entry_context` 多 `identity`，作答頁名冊 RPC 0 次。

## 驗證

- 本機全套：`QUIZ_TEST_READ_BATCH4=1 node --test --test-concurrency=2 automation/tests/quiz*.test.mjs` 共 62 項，0 失敗、0 略過（基準 93721eb 為 60 項全過）。
- 新等價測試：目錄快取與第三批函式深比相同，涵蓋三／六年級、停用課程、空課程、缺 membership、多單元、空單元、不可靠知識點，以及 7 種異動後失效重建；教師與未登入照舊；快取表與 4 支內部函式 authenticated 不可直接存取；其他 5 支核心函式雜湊不變。清單、開卷與第三批相同（只多 `identity`）；組卷卡片與隨後清單項目深比相同，重送結果相同，抽題結果與第三批相同。
- 瀏覽器（AI 工作瀏覽器分身 01；真實產品 HTML／模組，Auth／RPC 合成）：選卷頁清單 1 次、目錄 0 次、名冊 RPC 0 次，navbar 顯示「301 班 7 號 合成學生」；組卷 compose 1 次、清單 0 次重載、卡片出現在「我的自組卷」；504 後 30 秒內讀取為 `server_busy` 且 0 次網路請求，寫入仍送出；作答頁名冊 RPC 0 次。第一、二批既有瀏覽器回歸重跑全過（保存失敗重送、同 request_id、題組延後揭答、手機、燈箱、登出清除、錯題延伸、教師版本）。
- 正式 SQL：套用前後以三、六年級真實學生身分在回滾交易內比對 `quiz_pool_catalog`、清單（去掉 identity）、開卷（去掉 identity）、錯題清單的雜湊，**全部相同**；其餘 quiz 函式定義雜湊相同；banks／versions／sessions／attempts／answers／generated／leaf／pool／meta 九表筆數與內容雜湊相同。權限：anon 全部不可用；authenticated 只能執行 4 支公開 RPC。4 張表的 trigger 已建立。
- Vercel：以 `dpl_9igJHMDmzwAeHQSqJHC3bbzeF1Gd`（偵錯開關版）凍結包為底，只覆蓋 12 個檔案；覆蓋前確認這 12 檔在凍結包中與 93721eb 完全相同。候選 `dpl_G6mqwLwCj3JqJ66HzQzuW1UqeyCu` 以 `vercel curl` 讀回 12 檔 SHA256 全符合，promote 到 `https://it-class-tcwu.vercel.app`，正式網址讀回一致。正式來源（Auth／RPC 合成）跑 batch4 瀏覽器驗證全過。另有一個重複建立、未 promote 的候選部署，無影響。
- 正式 DB 新連線第一次呼叫目錄：64／14／20 ms（上午 673～4,885 ms）。量測在回滾交易內，每次都包含重建快取，且當時主機較閒，不能直接代表上課表現。

## 未做與風險

- 沒有合併 `entry_context` 與 `join`（會牽涉錯年級時是否多建 attempt，需另外設計）；沒有改每題 `view_question`＋`submit` 兩個 RPC；也沒有改 submit 的整份文件讀取。
- 沒有真人課堂驗證；下一班是第一次實測。課後請查 Logs（`/v1/projects/{ref}/analytics/endpoints/logs`，ClickHouse SQL，`source` 欄位）與 `infra-monitoring` 的 swap／CPU。
- git 分支 `claude/quiz-load-batch4`（worktree `D:/projects/it-class-tcwu-batch4`），**尚未 push**；主工作區與 Codex 分支都沒有合入。之後從 Git 重新部署時必須包含本分支，不可用舊主工作區整包覆蓋。
- 回滾：前端 promote 回 `dpl_9igJHMDmzwAeHQSqJHC3bbzeF1Gd`。SQL 的新欄位是增量，舊前端也相容，一般不必回滾；若要回滾，重套 batch1（catalog／entry）、batch2（library）、batch3（compose）即可，快取表與 trigger 可保留或 drop。
