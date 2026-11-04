# 11/04 三年級課堂監看（10:30–11:00，含全班自組卷）

監看方式同 10/30：`automation/quiz-class-monitor.mjs` 經 AI 工作瀏覽器分身 01 讀 Supabase Management API，每 120 秒取樣，上課期間不直連資料庫。原始資料：`automation/output/quiz/class-20261104-g3/`（ignored）。課後另補日誌路徑統計與資料庫筆數。

## 課前檢查（10:17–10:22）

- 主機 Pro + Small：`shared_buffers` 512 MB、`max_connections` 90。
- 外層 `quiz_action` 的 md5 已改變（`19260721…`）。原因是 Codex 把它重構成轉接層，原函式改名為 `quiz_action_before_learning`。內層兩處找下一題的查詢都保有 `order by ord limit 1`，修正仍有效，所以沒有修改正式資料庫。抽查 60 份開放中的作答紀錄，下一題計算全部正確。
- 前端 `say()` 訊息修正與題序自動同步都在線上（`quiz-student.mjs?v=20261102-learning`）。

## 結果：全部通過

| 項目 | 結果 |
|---|---|
| 全班自組卷 | 57 份卷，20 位學生 |
| 作答 | 508 題，22 位學生；看題計時 542 筆；答太快警告 0 |
| 同時使用學生（每分鐘不重複） | 最多 22 人（10:53、10:56、10:58、11:00） |
| 每分鐘請求 | 最多 426 個（10:58） |
| API 回應 p95（全部請求，每分鐘） | 最高 361 ms（10:58）；其餘大多 100–200 ms |
| 作答 RPC（rpc，2,965 次） | p50 77 ms、p95 101 ms、最大 395 ms |
| 錯誤 | 5xx 0、連線池逾時 0、statement timeout 0、Postgres ERROR 0（含 `question_order` 0）、Auth 錯誤 0 |
| 主機 | CPU 平均最高 5.2%、iowait 最高 0.2%、RAM 最大 554 MB、swap 固定 38 MB 未增加 |

- 10:58–11:00 的 p95 上升，主要來自 Storage 圖片讀取（`object` 199 次，p95 692 ms、最大 901 ms、2 筆 4xx）。作答 RPC 本身維持約 0.1 秒。
- PostgREST「thread kill」42 次，沒有對應的錯誤或逾時，持續觀察。
- 10:54 Dashboard 權杖過期，監看程式自動重新整理分頁後恢復，這是第一次實際觸發這個機制並成功，資料沒有中斷。
- 對照 10/30 第七節：同樣約 20 人，當時有 2,295 筆 `question_order`，這次是 0。

## 限制

- 只有一個班、最多 22 人，尚未驗證 30 人。
- 2 筆 Storage 4xx 未逐筆查原因。
