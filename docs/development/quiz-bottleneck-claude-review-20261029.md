# 考前練功坊：第三批上線後仍故障的查核（Claude，2026-10-29 下午）

使用者回報第三批（`29539cd`）上線後，13:50 前後的課堂仍故障，要求找出還能減少 Supabase 負擔之處，目標 30 人同時操作，尤其自組卷。本輪只做唯讀查核：沒有修改程式、SQL、設定、方案，也沒有代學生作答。量測使用正式 DB（`supabase-personal db query --linked`，會初始化短效登入角色），以一位今天上課的三年級學生身分在交易內呼叫讀取函式，只記錄耗時與位元組數，最後以 exception 回滾。

## 一、課堂實況（平台日誌與主機監控，AI 工作瀏覽器分身 01 已登入 Dashboard 後於頁內讀取）

Logs API 舊端點 `logs.all` 已經停用（回 410），現在要用 `/v1/projects/{ref}/analytics/endpoints/logs`。新端點用 ClickHouse SQL 查單一 `logs` 表，以 `source` 欄位區分來源，詳細欄位在 `log_attributes[...]` 裡。權杖只在頁面內使用，沒有輸出。

**負載很小**：有 JWT 的 quiz RPC 每分鐘不重複的學生最多 12 人；所有 API 請求每分鐘最多 100 個，約 1.7 req/s。

| 時間 | API 請求數 | 回應時間 p50 | p95 | 主機 |
|---|---:|---:|---:|---|
| 13:51～13:53 | 78～100 | 96～118 ms | 0.4～1.9 s | CPU 5～9%，iowait 2～7% |
| 13:54 | 59 | 1.3 s | 11.1 s | iowait 跳到 21%，CPU 16% |
| 13:55 | 15 | 5.4 s | 15.2 s | CPU 23% |
| 13:56 | 12 | 5.2 s | 62 s | **平均 CPU 100%** |
| 13:56～14:02 | 11～20 | 3～26 s | 18～40 s | **監控資料中斷 6～7 分鐘** |

- swap 整堂課都維持在 380～400 MB（約 36～39%）；實際使用的 RAM 只有 150～205 MB。也就是說，Postgres 與各服務的大部分記憶體一直待在 swap 裡。
- 13:54:40 第一筆失敗是 `quiz_compose` 的候選題查詢（`select array_agg(row(...))`）碰到 8 秒 statement timeout；13:58:15 又發生一次。這支查詢在暖連線下只要約 68 ms。
- 13:55 起，連最簡單的查詢都會逾時：用主鍵查 `auth.users`、`quiz_attempts`，以及 `quiz_answer_guard`。13:55:24 有同一位學生的 `quiz_attempts` 列鎖等待（看起來是重送或併發），最後也逾時。
- 13:56:38 起出現 13 次 PostgREST `PGRST003`（取連線池逾時），另有 22 次 Warp 執行緒逾時。
- Auth 連 Postgres 本身都連不上（`dial tcp [::1]:5432` 失敗），flow_state 讀寫被取消，有 504，Google token 交換也被取消。這就是學生登入失敗的原因。
- 平台的 `postgres_exporter` 在 13:56:28 逾時，13:57:44 一次查詢跑了 13.9 秒。它在 09:13～09:16、10:06（301 那堂）也逾時過，每次故障都會出現。
- 故障後的請求以 library_sessions（27 次）、navbar 名冊（39 次）、`reconnect_grade3_progress`（12 次）、`week_visibility`（24 次）為主，顯示學生在重新整理或跳回課程首頁，這又加重了負擔。

結論：在只有 12 人、約 1.7 req/s 的情況下，主機先出現 swap I/O 等待，接著 CPU 滿載、監控中斷。Postgres 連自己的服務都接受不了新連線。這已經不是查詢太重的問題，而是 Nano 主機在這種負載下會整台失去回應。

## 二、最重要的發現：主機在「沒有人用」時就會卡數秒

課後無學生時，在同一條新連線內連續呼叫 3 次（共 3 輪，每輪都是新連線）：

| 函式 | 第 1 次（新連線） | 第 2 次 | 第 3 次 | 回傳 |
|---|---:|---:|---:|---:|
| `quiz_pool_catalog` | 1115／673／**4885** ms | 8／154／588 ms | 8／13／9 ms | 3548 B |
| `quiz_library_sessions` | 30／485／190 ms | 2／125／3 ms | 2／2／2 ms | 7896 B（16 卷） |
| `quiz_wrong_questions` list | 41／**1501**／79 ms | 2 ms | 2 ms | 556 B |
| `quiz_rewards` | 20／286／38 ms | 1～5 ms | 1 ms | — |

- 暖連線下所有函式只要 1～13 ms，SQL 本身已經很便宜；同一呼叫在新連線或剛閒置後會變成 0.5～5 秒，且波動很大。
- 先前 Codex 的 EXPLAIN：目錄 COUNT 只碰 1221 個 shared hit、0 disk read，卻花 604 ms；`pg_stat_statements` 中每個 PostgREST 請求都會跑的 `set_config(...)` 平均 8.4 ms（14,267 次，健康主機應遠低於 1 ms）。
- 設定：Nano、`shared_buffers` 224 MB（主機 RAM 約 0.5 GB）、`max_connections` 60；304 事故時已看到 Memory commitment SEVERE、swap 約 400 MB。
- PostgREST 連線會被回收重建：14:11 左右的 11 條 idle 連線，到 14:14:49～52 已換成 10 條新連線（當時沒有課）。新 backend 都要重新載入快取並編譯 plpgsql；在記憶體被換頁的主機上，這就是上表「第 1 次」的成本，上課時也會碰到。
- 資料量很小：quiz 相關表合計 15 MB，題池 2,906 題約 10 MB、131 場次、543 筆答案。不是資料量太大。

**判斷**：「hit 但很慢」「新連線第一次很慢」「閒置時也隨機卡數秒」，這三點都符合 Nano 記憶體不足、shared buffer 與 backend 記憶體被換頁到 swap 的狀況。程式再省，仍會被這種主機層的停頓放大成 8 秒 statement timeout 與 10 秒 pool 取得逾時。這能說明前三批本機 30 人並行全部通過、真實課堂仍故障：本機 PostgreSQL 不會重現 Nano 的 swap 行為。這是強烈的推論，不是平台確認的根因。

## 三、建議（依效益排序）

### P0：主機規格（需使用者決定是否付費）

- Pro + Micro（1 GB）每月約 25 美元，Pro 內含 10 美元 compute credit，可以抵掉 Micro；Pro + Small（2 GB）約 30 美元。30 人課堂建議 Small 才有餘裕。價格依 304 報告當日官方頁面，升級前要重新核對。
- 升級後重跑本文件第二節的同一個量測腳本，看「第 1 次」是否降到數十毫秒，再上課驗證。不承諾升級後必定解決。

### P0.5：零成本的小調整（需使用者同意才執行）

- `pg_stat_statements` 目前有 4,831 筆，上限 5,000，查詢文字約 4 MB，已經有 eviction（dealloc=6）。平台的 exporter 會定期讀這些資料做正規化，故障時一次跑 13.9 秒。執行 `select pg_stat_statements_reset();` 可以清空，代價是失去自 10/06 起的累積統計（混有優化前版本，參考價值本來就有限）。這只能減少背景負擔，不能取代升級。
- 前端要停止重試風暴：請求逾時後不要自動重載清單，navbar 名冊在同一頁、同一位使用者讀一次就好；並在畫面上提示「伺服器忙碌，請稍候 30 秒再按」，避免全班一起重新整理。

### P1：自組卷流程減少請求與冷啟動（程式，可交 Codex 第四批）

目前一位學生「展開自組卷 → 組卷 → 開卷 → 第一題」至少要 catalog、compose、library_sessions（自動重載）、navbar 名冊、entry_context、join、view_question、媒體票證，共 7～8 個 RPC。

1. **目錄改成預先算好**：`quiz_pool_catalog` 只依年級而變，卻每次 join 全題池重算。它也是冷啟動最慢的函式（實測最慢 4.9 秒）。方案 A：匯入題庫或改課程時產生每年級的靜態 JSON，由 Vercel 提供，完全不經 Supabase；組卷時伺服器照常驗證範圍。方案 B：DB 快取表 `(grade, payload)`，由題池、membership、courses、name_characters 變更觸發更新，函式只做身分檢查加單列讀取。內容只有單元名稱、題數與角色，不含學生資料。
2. **組卷成功後不要整份重載清單**：現在 `quiz-paper-saved` 事件會觸發 `load({refreshComposer:false})`，重新呼叫 `quiz_library_sessions`（歷史平均 1423 ms，是 quiz 函式中最高）。改由 compose 回傳卡片所需欄位（title／catalog／total／config／distribution／saved_at），前端直接插入。
3. **開卷時合併 `entry_context` 與 `join`**：join 本來就會驗名冊、場次與自組卷擁有者。`entry_context` 為了取科目，還會讀出 `quiz_versions.document` 整份 jsonb（detoast），其實可以改用已有的 `quiz_version_meta.catalog`。合併後每次開卷少 1 個 RPC。
4. **練功坊頁面不再另外呼叫 `get_my_student_enrollment`**：navbar 每次換頁都會呼叫（歷史 1435 次、平均 110 ms）。`library_sessions` 和 `entry_context` 已經算過身分，順便回傳班級、座號、姓名，給 navbar 顯示即可。主工作區有一份未發布的 student-display-cache 可參考，但不可整包帶上線。

### P2：作答主路徑（最高頻，需討論取捨）

5. **每題兩個 RPC**（`view_question` + `submit`）：讓 submit 成功時由伺服器直接替下一題登記閱讀起點，可以少一半寫入請求。代價是學生看解析的時間也會被算進下一題的閱讀時間，2 秒防快答會變寬鬆，需要使用者決定。
6. **compact submit 仍讀整份版本文件**：每次送答都 detoast `quiz_versions.document`，重建所有題組的 reviews，並跑 leaf 判斷。可以改成只回本題所屬題組的 review，由前端合併；Codex 原先把增量 reviews 列為暫緩。`quiz_action` 是總耗時最高的函式（自 10/06 累積 1811 次、平均 344 ms，含優化前版本）。

### P3：小幅寫入放大

7. compose 每份卷把完整 doc 存兩次（`quiz_banks.draft` 與 `quiz_versions.document`），另有 version_meta 觸發器；命名觸發器又 join versions 讀 `document->'catalog'`。可以改傳 catalog 或讀 meta。效益小，排最後。

## 四、驗證方式要調整

- 本機 PostgreSQL 壓測證明了「SQL 夠便宜、不會互鎖」，但無法代表 Nano。之後每一批都要加上正式 DB 的「新連線第 1 次呼叫」量測（本文件第二節的方法），並在課後取 Dashboard 的 swap／記憶體與 Postgres 錯誤日誌對照。
- 量測腳本：交易內設定 `request.jwt.claims`，對同一位學生連續呼叫讀取函式 3 次，記錄 `clock_timestamp()` 差值，最後 `raise exception` 回滾。只輸出耗時與位元組，不輸出學生資料。

## 五、未做與限制

- 平台日誌與主機曲線已經取得（第一節）。compose／submit 沒有做單次量測；寫入函式沒有在正式環境試跑，連回滾式試跑也沒有。
- 私有原始輸出（含 IP／查詢文字）只留在 Claude 暫存目錄，沒有進 repo。
- `pg_stat_statements` 自 10/06 起累積，混有優化前的版本，只能當背景參考。
- 正式程式以 Codex worktree `codex/quiz-load-batch3` 加上 `253d2bf`（偵錯預設關閉）為準；主工作區有其他未發布修改，沒有混入。
