# 夥伴練功服務穩定性複查（2026-11-04，Claude Desktop）

發布結果：Codex 依 PR #10／#11 → 乾淨 main `8ff1efc` → 發布腳本完成；2026-11-04 21:32 正式部署 `dpl_EGn9CwbxtAbHLhnGx6uNUoLjBsKd`，回滾基準 `dpl_FBgBVoAs3HsNu46qJNE8P47U14iP`。完整樹精確 7 修改、0 新增、0 刪除、0 換行差異；候選與正式的 13 個關鍵檔位元組一致，發布後正式 live 檢查通過，發布鎖已釋放。真實學生多機與夥伴整班壓測仍待驗證。

範圍：剛上線的夥伴練功（main `95fb685`，正式 `dpl_FBgBVoAs3HsNu46qJNE8P47U14iP`）的同步、重試、媒體與資料庫呼叫鏈。工作區 `D:/projects/it-class-tcwu-worktrees/partner-stability-20261104`，分支 `codex/partner-stability-20261104`，基底 `395d0e2`。

依任務約束：沒有 commit／push／部署，沒有連正式資料庫或讀取憑證，沒有改組隊、計分、半葉配對或獎勵 ID。第一輪 Bash 讀檔逾時被 Codex 停止；turn-0003 使用者撤銷工具限制後，下列測試都由我在本工作區實際執行（結果見「測試」一節）。

## 結論

沒有找到會讓服務自己崩潰的無界迴圈或重送風暴。找到五個「有明確呼叫鏈、會隨使用量放大」的缺陷，已做最小修正；另外列出尚未量測的容量風險。

## 已確認的缺陷與修正

### 1. 每次作答多算一次完整快照（DB）

- **呼叫鏈**：`public.quiz_partner_pilot_action` → `partner_pilot.action_core` 在最後 `result:=partner_pilot.learning_snapshot(rid)`（production-snapshot `functions.sql` 中 action_core 內）→ 回到外層後，`if act in ('finish','answer') then perform partner_pilot.claim_award(rid);result:=partner_pilot.learning_snapshot(rid);end if;`（同檔第 3592 行，正式 md5 `2773f879…`）。
- **為何多餘**：`claim_award` 在 `not r.finished` 時，除了重複檢查成員（action_core 已檢查）外直接 `return`，不寫任何資料。所以未完成小隊每答一題，第二次重算的結果必定與第一次相同。
- **影響**：Codex 的 PGlite 插樁顯示，一次未完成作答會算 2 次 `learning_snapshot`；加上作者與其他 3 位成員各 refresh 1 次，合計 6 次。`learning_snapshot` 本身對每題、每位成員都要跑多個子查詢（單一房間內的 N+1）。
- **修正**：`supabase/quiz-partner-stability.sql` 以正式定義為底，只把該行改成 `... and exists(select 1 from partner_pilot.rooms where id=rid and finished) then ...`。已 finished 的房間（完成後訂正補發獎勵）行為完全不變。

### 2. notes／members 缺查詢索引，重算成本隨全校資料無上限成長（DB）

- 依 `production-snapshot/schema.json`：`partner_pilot.notes` 只有 `notes_pkey(id)`，`partner_pilot.members` 只有 `members_pkey(room_id,user_id)`。
- `learning_snapshot` 每次以 `room_id` 查 notes 數十次（每題的 `exists … qid … kind in ('ask','mark')`、每位成員 5 組故事查詢、整房 notes 清單）；沒有 `room_id` 索引就每次掃全表，成本隨所有小隊累積的 notes 增加。
- `me` 與 Realtime 授權 `quiz_partner_pilot_can_subscribe` 以 `members.user_id` 查詢，每次也是全表掃描；後者在每次加入頻道時執行。
- `notes.thread_id` 外鍵（ON DELETE CASCADE）沒有索引。
- **修正**：同一個 SQL 檔新增 `partner_notes_room_qid(room_id,qid,kind)`、`partner_notes_room_user(room_id,user_id,kind)`、`partner_notes_thread(thread_id)`、`partner_members_user(user_id,room_id)`，皆為 `create index if not exists`，只增不減，可重複執行。

### 3. 手寫題底圖繞過媒體快取，隊友每個動作都重新下載（前端）

- **呼叫鏈**：`shared/partner-pilot/learning.js` 的 `render()` 在每次收到有變化的快照時執行（`app.mjs` `accept()` → `renderRoom()` → `learning.render()`）。原本第 34–35 行傳給 `mountPastAnswers`／`mountPastResults` 的 `loadAsset` 直接呼叫 `loadMedia`（Edge Function `quiz-partner-pilot-media`，回傳 base64），沒有經過 `rich-content.js` 的快取與併發合併，也沒有 MIME 檢查。
- **影響**：畫面上有手寫題（考古題 manual）時，隊友每答一題、留一則訊息，每位成員都重新下載一次底圖。
- **修正**：`rich-content.js` 把既有的快取解析抽成 `resolveFor(context,url)`，`mount` 內的 `scope.resolve` 與新對外的 `resolve(url)` 共用同一個快取（鍵仍是 room:user:hash，失敗不快取，換人／離開房間時 `clear()` 清空）；`learning.js` 兩處改為 `loadAsset:rich.resolve`。底圖網址就是 `q.rich.material.media` 的同一批媒體物件，題目圖片本來就要求同樣的 `https://partner-media.invalid/<64 hex>` 格式。

### 4. 自己的操作會再多要一次快照（前端，小幅）

- 自己送出的操作已經帶回最新快照，但同一操作的 `revision` 廣播又觸發 `refresh()`。`app.mjs` 改為：廣播的 `room_id` 等於目前房間，且 `revision` 不大於手上的 `room.revision` 時略過；讀不到 revision 時照舊 refresh。快照的 `revision` 與廣播都是 `rooms.revision`（production-snapshot 第 5035 行、action_core 的 `realtime.send`）。

修正後，一次未完成作答在 4 人小隊裡的完整重算次數，在回應先於廣播時可從 6 次降到 4 次（伺服器 1 次＋其他 3 位成員各 1 次）；廣播先到時仍可能為 5 次。伺服器端 2→1 有測試實證；瀏覽器合成廣播也確認已持有版本不再 refresh，尚未量測正式 Realtime 的時序分布。

### 5. 努力樹／獎勵頁的夥伴獎勵查詢用不到索引（DB）

- `public.quiz_partner_rewards`（production md5 `104f9b99…`）以 `auth.uid()=any(members)` 篩選，用不到既有的 GIN 索引 `partner_awards_members`，所以每次載入努力樹或獎勵頁都要掃描整張 awards 表，成本隨全校累積的合作紀念增加。
- **修正**：同一個 SQL 檔以正式定義為底，只把條件改成 `members @> array[auth.uid()]`。`auth.uid()` 前一行已確認不是 null，`members` 也不含 null，結果等價；回傳內容、排序與權限都不變。
- 其餘兩處 `any(members)`（`paused_snapshot` 依 `room_id`、`record` 依主鍵 `id`）已經有選擇性很高的條件，沒有修改。

## 檢查後沒有發現問題的部分

- **Realtime 迴圈**：`topic` 只在 `epoch` 改變時才換（`'partner-pilot:'||id||':'||epoch`），所以 refresh 不會一直重新訂閱。`SUBSCRIBED` 時 refresh 一次。`CHANNEL_ERROR／TIMED_OUT／CLOSED` 最多自動重試 3 次，間隔 1、2、4 秒；自己 `removeChannel` 觸發的 CLOSED 會被 `topic!==currentTopic` 擋掉。
- **refresh 合併**：`refreshing／again` 保證同時最多一個 snapshot 請求在途，之後最多再補一次。`visibilitychange`、`online` 也走同一個 refresh。
- **舊回應覆蓋**：`accept()` 會丟棄 revision 較舊的快照，`generation／view` 會丟棄換人或換房後才回來的回應。
- **重送**：寫入操作要使用者手動重送，並沿用同一個 requestId；`ready` 只在 `STALE_REVISION` 時自動重試，上限 6 次。
- **鎖**：作答在 action_core 內以 `for update` 鎖單一房間列，`claim_award` 也鎖同一列（同一交易）；request 冪等用 `(uid||req)` advisory lock。沒有跨房間的共用鎖，不同小隊不會互卡。

## 尚未量測的容量風險（未修改）

1. **`learning_snapshot` 的房間內 N+1**：每題跑 `owner_of` 與數個子查詢，每位成員再跑最多 6 組。補索引後每個查詢都便宜，但總查詢數仍有上百個，沒有重寫。
2. **每次 RPC 都執行 `register_self()`**：`INSERT … ON CONFLICT DO UPDATE WHERE …` 即使不更新也會鎖本人的 `allowed_users` 列。只鎖自己，不會互卡，但每次都有開銷。
3. **快照回傳本人草稿**：`privateDraft.state` 上限 1.5MB，每次快照都會回傳，屬於回傳量風險。
4. **`sync_source_links()`**：在 catalog／create／join／lookup 時執行 `insert … select`，會掃 `quiz_sessions`，成本隨場次數增加。
5. **整班 30 人多房**：沒有做多房並行壓測。4 個合成帳號成功，不代表整班安全。

## 修改的檔案

- `supabase/quiz-partner-stability.sql`（新增；Claude 交回時為提案，Codex 已從 main 套用）
- `shared/partner-pilot/rich-content.js`
- `shared/partner-pilot/learning.js`
- `shared/partner-pilot/app.mjs`
- `automation/tests/quiz-partner-stability.test.mjs`（新增）
- `automation/tests/quiz-partner-production.test.mjs`（只加一行選項：`QUIZ_PARTNER_STABILITY=1` 時，在正式遷移後加套穩定性遷移，讓完整情境在修正後重跑；預設行為不變）
- `docs/development/quiz-partner-stability-20261104.md`（本檔）、`docs/development/agent-handoff.md`

Claude 交回後，Codex 將三、四、六、九年級 `partner-practice.html` 的入口版本更新為 `20261104-stability`。使用者 turn-0003 已撤銷額外的檔案與工具限制。沒有修改既有 production 遷移或獎勵／努力樹政策。

## 測試（我在本工作區實際執行，2026-11-04）

| 命令 | 結果 |
|---|---|
| `npm run quiz:setup` | 安裝 PGlite 0.3.14、katex（3 個套件） |
| `node --test automation/tests/quiz-partner-stability.test.mjs` | **5／5 通過** |
| `node --test automation/tests/quiz-partner-production.test.mjs`（正式狀態，未加遷移） | **2／2 通過** |
| `QUIZ_PARTNER_STABILITY=1 node --test automation/tests/quiz-partner-production.test.mjs`（正式遷移＋穩定性遷移） | **2／2 通過** |
| `npm run quiz:test` | **11／11 通過**，0 略過 |
| `node --check shared/partner-pilot/app.mjs`；以 ESM 複本檢查 `learning.js`、`rich-content.js` 語法，並實際 import `learning.js` | 皆正常，`learning.js` 匯出 `createLearningUI` |

`quiz-partner-stability.test.mjs` 的 5 項內容：

1. **重算次數**：套用遷移前重現「一次未完成作答算 2 次快照」，套用後變 1 次，回傳的快照內容完整；重送同一個 requestId 也只算 1 次，且不會新增答案；完成後未達門檻、再訂正，仍會自動補發 1 片葉（走 finished 分支），全程只有 1 筆 award。
2. **索引**：4 個索引存在，遷移可以重複執行。
3. **`quiz_partner_rewards`**：40 筆合成紀念、4 位學生、2 個課程，套用前後的回傳完全相同；禁止全表掃描時，查詢計畫使用 `partner_awards_members`；`authenticated` 仍有執行權限。
4. **`heldRevision`**：從 `app.mjs` 原始碼取出函式測試。沒開房間、同一版或較舊版本、隊友的新版本、其他房間、巢狀 payload、沒有 revision、undefined，共 8 種情況。
5. **`rich-content.resolve`**：併發時共用一個請求、重畫時使用快取、不合格網址拒絕、換房分開讀、失敗不快取、沒有登入內容時拒絕。

## 未驗證範圍

Codex 獨立重跑穩定性 5／5、套穩定性遷移的整合 2／2、原功能回歸 11／11，全部通過。另以租約瀏覽器載入實際 app／learning／rich-content 程式及合成傳輸：50 次已持有版本廣播新增快照 0 次；50 次新版本突發合併為 2 次快照；底圖與作答結果共用 1 次媒體請求；重畫保留輸入，儲存退出重入後重新取圖，pageerror 0。這是本機合成資料驗證，不是正式多人連線壓測。

- 正式 Realtime 的廣播時序與真實學生多機仍未重測；已同時支援兩種 payload 形狀，讀不到 revision 時照舊 refresh。
- 索引效果在 PGlite 小資料上只驗證「可以用上」（禁止全表掃描時的計畫）；沒有對正式資料庫做 EXPLAIN，也沒有量測實際耗時。
- Claude 交回時未套用。Codex 已從合併的 main `5061630` 套用：先回滾證明，再提交；24 張相關資料表雜湊不變，所有原函式權限與不相關函式保留。已重新匯出 139 函式／97 表快照，`db-snapshot-check.mjs --live` 通過，只有既有警告。
- 沒有做多房、30 人並行壓測。
