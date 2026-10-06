# 三年級第 06 週實作與 Claude 審查紀錄

日期：2026-10-06。本文件記錄部署前審查；使用者稍後核准正式切換，結果見 [發布紀錄](grade3-week06-release.md)。主專案尚未提交或推送。

## 審查方式與結果

依 chat-mode 技能使用 Claude Code CLI supervisor，Claude 2.1.289，以訂閱 OAuth 執行唯讀 Read／Glob／Grep，無 shell、網路、憑證及部署權限。Codex 為唯一寫入者；檢視器正常啟動。唯讀工具不提供作業系統層的讀取路徑隔離；審查契約限定宣告的專案檔案。

主專案：main，基準 HEAD `74dcec56eab16a29a64eeb75b4c666eaaed40703`，原有大量不相關變更，全部保留。四次審查分別為主專案初查、修正複查、限定來源封包與最後窄範圍複查。Claude 發現的身分／歷史座號對應、錯誤訊息、舊完成列空分數、NULL 比對與介面提示等問題已依實際程式查核修正。

**Claude 在最後兩次已讀範圍沒有發現 P0/P1；並未宣稱完整通過。** 最後 P2 與不確定項的處理如下：

| 項目 | Codex 查核與處理 |
| --- | --- |
| 刪綁定重匯撞稽核主鍵 | 保留 fail-closed；補原綁定還原／座號異動／凍結來源維修說明，不刪稽核 |
| 23505 與座號訊息順序測試缺口 | 新增殘留匯入稽核測試；先只改名冊、不改審查表以隔離訊息順序 |
| 來源完成滿關但空分數未測 | 新增直接案例，全人回滾 |
| 其他 NULL 欄位 | 真正來源 schema 原有 NOT NULL；SQL 再加顯式防護，合成較寬 schema 也測兩種空值 |
| 第 02／03 週讀取失敗 | 第02週視窗與練習測驗原有讀取失敗重試，無可答選項；第03週評量呼叫端補 catch，隱藏並 inert、顯示原因；瀏覽器注入錯誤驗證 |
| 提示舊措辭 | 改成登入／確認本人帳號；Week02 ready 已在實際來源依身分切換 |
| 手機訊息高度 | 已核對 Week06 HTML 選擇器；390px 實測錯字提示不與下一張卡重疊 |
| 正規化描述較程式窄 | 文件補充所有已驗證空分數列的正規化，不把未完成當滿分 |
| 第05週歷史總關數可能不同 | 列為正式 preflight 逐人核對，不猜測資料 |

最後審查後的變更只包含上述 NULL 防護、補充測試、測驗錯誤 catch、提示文案與文件。這些是 Codex 修正及驗證，尚未再次交由 Claude 審查，不能稱為 Claude 已讀過最後每一行。

## 驗證

- 真正 PGlite／PostgreSQL 執行轉換 SQL：2 個整合測試通過；十二種來源變異逐人原子拒絕、重試不重複、正式成果單調合併、RLS、歷史來源凍結、稽核、教師重設、名冊異動、既有正式快照及舊打字空分數。
- 瀏覽器測試：本機合成 auth／RPC；1280／390px、五關保存、失敗重試、navbar、匿名／接回失敗鎖定、努力樹四葉一花及舊六關、登出換人清除、舊週載入／保存。最後補測第02週練習測驗／視窗讀取錯誤重試，以及第03週評量讀取錯誤鎖定；全部通過（exitCode 0），詳見 session 紀錄。
- Claude 沒有執行測試；以上執行結果由 Codex 核對。PGlite 單連線與瀏覽器合成回應不能取代真實 OAuth、正式資料與雙連線競爭測試。
- 只對本次修改檔案做差異／語法檢查；專案原有不相關差異不是本次驗證範圍。

## 傳輸與證據

- session：`20261006-grade3-week06-fixes`；Claude session：`99308209-3d3b-4c3f-b2be-4dbde1b89a53`；狀態 completed，exitCode 0。
- 證據工作目錄：`.chat-mode/evidence/grade3-week06-p2-fixes`；分支 `codex/review-snapshot`；HEAD `ffa0125cf05abd9cf07ac5380816d2b7fadfe326`；審查前後 Git 基準相同。這是來源複本的審查快照，不是主專案提交。
- 回應：`.chat-mode/evidence/grade3-week06-p2-fixes/.chat-mode/sessions/20261006-grade3-week06-fixes/turn-0001.response.md`。封包 SHA256 全數核對相符；原始逐字審查如下。

## 正式發布仍待完成

正式 schema／全部名冊與歷史本人核對、受限備份、SQL 部署與前端同步、實際學生 Google OAuth 回跳、舊測驗／視窗完整保存、教師 visibility／reset 和雙連線匯入。審查表不自動核准名冊；完成正式驗收前不標記可上課。

## 最後 Claude 原文

正在收尾：封包內的修正來源已讀完，以下是結論。

# 三年級第 06 週修正：窄範圍審查（唯讀）

**結論：已讀的變更邏輯中沒有發現 P0 或 P1，但這不是完整通過。** 上輪 7 項 P2 中 5 項已修正、2 項只修了一部分，另有 3 項新的 P2。測試我只讀了內容，沒有執行；「PGlite 與瀏覽器測試通過」是 `fixes.md` 的說法。

## 上輪 P2 的處理狀況

| 上輪項目 | 狀況 | 依據 |
|---|---|---|
| P2-1 首頁兩張「本週」 | 已修（靜態） | `grade3/115-1/index.html:42` 是唯一的「本週」；第 05 週 `:47` 只剩週次徽章 |
| P2-2 第 02、03 週提示 | 部分 | `week03.js:234` 已依身分切換；`week02.js` 不在封包 |
| P2-3 完成但 score 為 NULL 的正式列 | 已修 | `grade3_google_transition.sql:114-118`、`:133-135` |
| P2-4 NULL 姓名略過比對 | 已修 | `:129` 姓名與班級座號都改用 `is distinct from` |
| P2-5 座號異動的訊息順序 | 已修 | `:97-99` 已移到審查表查詢（`:100`）之前 |
| P2-6 保存失敗訊息未透傳 | 已修 | `shared/grade3-google-course.js:65`、`shared/typing-challenge.js:907`、`:1107`、`:1136`、`:1247-1251` |
| P2-7 測試缺口 | 部分 | 見下方 P2-B |

補充確認：

- **P2-2**：`week03.js:234` 的判斷在 `await initClassCardAuth`（`:11`）之後才求值，身分變動會重新載入（`:693`），所以單次求值沒有問題。`:233` 的舊措辭還在，但 adapter 分支下 `guestReady` 一定有值（`typing-challenge.js:711`），這行實際不會顯示。
- **P2-3**：
  - 只有 `typing_%`、`score` 為 NULL、已完成且 `current_level=total` 的列會被接受。非 typing 的同型列會被 `:116` 拒絕。
  - 老師快照比對（`:118`）在正規化 `update` 之前，`update` 排在來源驗證迴圈之後。
  - 來源 guest 的同型列仍在 `:127` 被拒。
- **P2-6**：保存失敗時不解鎖下一關，但輸入框會恢復可編輯以便重試（`:1109`、`:1138`）。真正鎖住輸入的只有初始化讀取失敗（`:1248-1249` 設 `inert`）。`fixes.md` 的「inputs locked」只適用後者。
- **23505 轉換**：`:152-153` 的 exception 區塊包住整個函式本體，之前的寫入會一併回滾。

## 仍存在的 P2

**P2-A：解除綁定後重新接回會卡死，且封包內沒有修復說明**（`grade3_google_transition.sql:140-141`、`:133-135`、`:152-153`）

- 老師若刪除綁定列讓學生重新接回，`grade3_google_imports` 的舊列還在，`:140` 會撞主鍵，學生只看到「資料綁定或匯入紀錄衝突」。
- 同時 `:133` 已把正式列的 `score` 補成非 NULL，與老師原快照不再相符，`:118` 也會先擋下。
- 方向是 fail-closed，不會多給成果。但修復要同時清匯入紀錄並重做快照，approve 範本不在封包內，是否有寫我無法確認。

**P2-B：新增的測試沒有直接驗到三個修正分支**（`automation/tests/grade3-google-transition.test.mjs`）

- **23505 分支沒有案例**：`:120-125` 的衝突案例會先被 `:103` 的明確檢查攔下，走不到 `unique_violation`。可達路徑是 P2-A 的匯入殘留，以及同一 email 換了 `user_id`。
- **順序調整沒有被隔離**：`:103` 同時更新了審查表，新舊順序都會得到「班級座號已異動」。要驗 P2-5，應該只改名冊、不改審查表。
- **來源 guest 的舊形狀沒有被測到**：變異 `completed=true,score=null`（`:84`）作用在第 2 關的列上，是因為別的不一致被拒。`current_level=total` 且 `score` 為 NULL 的完成列只靠閱讀 `:127` 確認。

**P2-C：來源驗證對其他欄位的 NULL 仍會放行**（`grade3_google_transition.sql:125-128`，與上輪 P2-4 同型）

- `current_level` 為 NULL 而 `score` 有值時，`:125` 與 `:128` 的比較結果是 NULL，不會 raise。匯入值由 `score` 推得，結果無害。
- 三欄全為 NULL 時也會通過，`:143` 的 `least(NULL, t)` 會寫入 `current_level=total`、`score` 與 `completed` 為 NULL 的列。
- 是否可達取決於 `guest_progress` 這些欄位能否為 NULL；`class_card_guest_progress.sql` 不在封包，無法確認。若有 NOT NULL 約束，這項就不成立。

## 不確定項

1. **讀取錯誤改為拋出後，其他呼叫端是否接得住。** `grade3-google-course.js:65` 現在讀取失敗會 throw；typing 模組有接（`:1245`），但測驗、視窗練習、快手投遞的呼叫端都不在封包。
2. **`week06.css:3` 的選擇器是否命中。** 它依賴頁面有 `#typing-levels-container` 且訊息列 id 以 `msg-level` 開頭（`typing-challenge.js:1059` 相符），但 `week06.html` 不在封包。其他週的 CSS 沒有這個覆寫，較長的訊息仍套 `h-6`。
3. **登入但尚未接回的學生，第 03 週提示略有誤導。** `week03.js:234` 會顯示「請先登入學校 Google 帳號」，真正原因寫在 `#course-identity-status`。這是措辭問題，不影響資料。
4. **`fixes.md` 第 3 點的描述比實作窄。** `:133-135` 會補正該生所有 `score` 為 NULL 的正式列，包含未完成的列，不只 typing 完成列。補入值與已驗證的值一致，不算缺陷。
5. **首頁徽章是否會被執行時改寫。** `week-visibility.js` 仍不在封包（`index.html:141-143`）。

## 未變更的覆蓋缺口

- 兩條連線的並行接回、正式 OAuth、舊測驗與視窗的端對端保存、雲端部署，`fixes.md` 已列為發布關卡。
- 瀏覽器測試檔不在封包，第 5 點的各項瀏覽器檢查我都沒看到。
- DB 測試依賴封包外的 `tmp/week06-dbtest` 與 `supabase/student_progress.sql`（`:5`、`:109`）。
- `fixes.md` 自述最後一次窄型別防護加入後尚未重跑 SQL 測試。

## 未審查範圍

- `shared/typing-challenge.js` 只讀了 `:700-819`、`:880-979`、`:1085-1164`、`:1196-1253` 與搜尋命中行。
- `week03.js` 只讀了 `:120-244` 與搜尋命中行。
- `grade3_google_transition.sql` 全檔已讀，但 `:156-203` 未變更的部分沒有重新審查。
- 沒有核對 `source-manifest.json` 的 SHA256（無 shell）。

CHAT_MOD_GRADE3_WEEK06_FIXES_DONE
