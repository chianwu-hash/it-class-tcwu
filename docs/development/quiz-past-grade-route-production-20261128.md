# 考古卷錯題返回年級：正式 SQL 收據

- 來源：[PR #553](https://github.com/chianwu-hash/it-class-tcwu/pull/553)，main `e79db50e`；使用者明確核准本份 SQL 後執行。
- 2026-11-28 於獨立乾淨 main checkout 套用，只修改 `quiz_past_snapshot_before_drafts(uuid)`。
- 正式前指紋 `588e36cb7015d20bb4a3797de71f916b`；後指紋 `074421da5937e369d97813f418900737`。
- 先在正式交易安裝並回滾，再執行正式安裝；兩階段均以函式指紋及同一 repeatable-read 交易內的考古作答／答案／收據／獎勵摘要守衛。皆通過。
- `node automation/db-schema-snapshot.mjs`：180 函式、112 資料表、21 policies、22 triggers。
- `node automation/db-snapshot-check.mjs --live`：`ok:true`、無 failures；保留既有舊 SQL 覆寫警告，不重新安裝那些 SQL。
- 精確回復使用 PR #553 的 rollback SQL，拒絕覆蓋未知函式版本。
- 本收據不是社會卷啟用或正式 OAuth 驗收收據；學生入口的返回路徑將與首張社會卷一併實測。
- 未部署網站、未寫入學生答案；本 PR 僅提交函式定義快照與本收據，不含題目、教材、帳戶及權杖。
