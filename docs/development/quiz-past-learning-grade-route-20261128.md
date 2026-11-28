# 考古卷學習解析的錯題返回年級修正候選

中正九年級二段補齊教材與固定學習圖時，查得既有 `quiz_past_snapshot_before_drafts(uuid)` 將錯題返回連結寫死為 `/grade3/115-1/quiz-library.html`。前端接受三、四、六、九年級格式的本站連結，沒有依原卷年級改寫，因此九年級學習圖啟用後的這條路徑會導向三年級入口。

## 範圍與候選

- 僅修正上述既有函式產生連結的 SQL：從本人作答綁定的原卷取得年級，並同時核作答版本與學習圖的原卷識別。
- 查詢參數保留同一次作答、版本、大題及小題，返回 `/grade{原卷年級}/115-1/quiz-library.html`。115-1 是現有正式入口契約；歷年參考卷的來源學年度不拿來取代學生入口學期。
- [修正 SQL](../../supabase/quiz-past-learning-grade-route-fix-20261128.sql)及[回復 SQL](../../supabase/quiz-past-learning-grade-route-rollback-20261128.sql)均以完整函式定義指紋守衛。只接受已知前／後版本；遇到其他工作變更則拒絕，不覆蓋未知函式。
- 原正式指紋 `588e36cb7015d20bb4a3797de71f916b`；候選 `074421da5937e369d97813f418900737`。2026-11-28 正式唯讀查詢確認仍為原指紋，九年級有 2 份啟用學習圖；這不是學生操作重現或發布收據。
- 兩份 SQL 個別固定 `eol=lf`，避免 Windows checkout 改變 dollar-quoted 函式內容與完整指紋；不修改其他檔案的換行政策。

## 已做的驗證

從最新 `origin/main` 的 `87b19b25` 另建 `codex/g9-learning-grade-route-20261128` 與獨立 worktree。原題庫內容工作留在另一工作區；此修正不提交私有題目、答案、教材、帳戶或權杖。

命令：

```text
node --test automation/tests/quiz-past-learning-grade-route.test.mjs automation/tests/past-learning-map-validation.test.mjs
```

6 項測試通過。新增測試使用純合成資料與本機 PGlite，實際執行正式快照中的 SQL 投影鏈及本次遷移：

- 先重現九年級回傳三年級連結，再核三／四／六／九年級各回原年級，所有來源作答參數相符。
- 正確題、自核題及未答題不產生錯題返回連結；停用學習圖回到來源解析。
- 不相符的學習圖原卷不能供應這個返回連結；跨人及無身分讀取由既有本人守衛拒絕，匿名及學生角色不能直接執行私有 helper。
- 重裝同一候選、精確回復及重複回復通過；遇到另一函式變更會拒絕。
- 前後作答、答案、收據與獎勵資料相符。

本機 scaffold 的舊年級限制依正式快照調整，只用於建立合成資料。上述測試不代表公開 RPC 年級授權、OAuth 或正式桌機／手機驗收。

另以 Windows 原生 PostgreSQL 17.12 重跑這個返回路徑的多情境資料庫案例，維持相同合成 scaffold、來源函式、候選 SQL 及斷言；接頭改用原生連線，明確序列化 JSONB 陣列，另加整份安裝交易回滾後指紋回到原版的斷言。本人／跨人／無身分、三／四／六／九年級參數、角色拒絕、資料摘要、重裝、精確回復、重複回復及未知變更拒絕均通過。每案使用獨立暫存庫，結束已刪除並停止只監聽本機的服務；不是正式資料交易或 OAuth 驗收。原生收據 SHA-256：`9ec3161bcbd5d796c68edce457b3712a56b3dddb887b8deec99749df49c5c4ad`；日誌 SHA-256：`6f92a64e962031424eb7e6bd5d499e82e40d82b8e28afb9183601d3060c3df0f`。原生執行檔使用 PostgreSQL 官方 Windows 頁指向的 EDB binaries，來源及封存 SHA 詳見[文字引用候選的原生驗證紀錄](https://github.com/chianwu-hash/it-class-tcwu/pull/569)。

## 正式套用前仍須完成

目前僅備妥候選，未修改正式函式、未發布網站。本案使用者指定正式函式變更須先取得同意，因此保留本次核准關卡；其他 main／PR、來源守衛及快照流程依 [AGENTS.md](../../AGENTS.md)。此處不將本案指定的核准關卡擴張為所有可復原操作都要另問。

原生隔離交易回滾已驗證。取得針對此單一函式的核准並經 PR 進 main 後，套用前仍須重查正式指紋及原資料摘要；套用後更新 `supabase/production-snapshot/`，執行 `node automation/db-snapshot-check.mjs --live`，並補正式讀回收據。實際學生入口的年級返回及同次作答還需正式 OAuth 驗收，不能以本機測試代替。

此候選尚未決定含解答教冊原頁的開放政策，也未啟用新增題庫學習包；這些仍屬二段完整交付的未完成項。
