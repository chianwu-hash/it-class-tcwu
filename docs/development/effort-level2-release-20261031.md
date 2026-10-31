# 第二級努力樹正式發布（2026-10-31）

使用者明確授權「修好沒問題就 commit push 上線」。本輪已完成正式發布，未合併或覆蓋主工作區尚未提交的 Claude 工作。

## 版本與來源

- 發布分支：`codex/effort-level2-release-20261031`。
- `332a646`：以正式站完整539檔同步發布基準，保留題目回報、作答順序修正與第九週。
- `d868486`：第二級寵物、小窩、互動、成長主場景、日夜天氣、考古花、名稱及載圖／續播修正。
- 舊正式版：`dpl_J9cLJUUCH6GeoGqC7dj47jNFajzC`。
- 新正式版：`dpl_CR8iCGz53mwX8tzPT1iGsa6TUEhR`，READY。
- 正式入口：<https://it-class-tcwu.vercel.app/my-tree.html>。

透過 Vercel CLI 建立 production target、`--skip-domain` 待發布版本；先核對完整755檔、既有522檔不變，再完成認證與儲存驗證，最後使用 `vercel promote` 切換正式網址。部署時團隊、專案及來源均明確指定；沒有從較舊工作樹整包覆蓋正式站。

原 `shared/auth.js`、傳輸、天氣API、題目回報模組及第九週保留原正式UID。`quiz-server.mjs` 保留 `resyncOrder`、錯序節流與回報表單，只加必要獎勵成功接點；考古題表單保留回報橋接。

## 資料遷移

`automation/lib/garden-level2-release.mjs` 將六份SQL合併為單一 repeatable-read 交易，鎖等待3秒、單一語句60秒上限。交易內先後比較來源紀錄及核心函式雜湊，不符即回滾；匿名與學生權限不符也回滾。已用本機測試注入刪除進度的錯誤，確認整批回滾且進度保留。

2026-10-31 14:33 UTC遷移成功：

- 原課堂進度、測驗葉／考古獎勵、老師測試準備及既有核心作答函式未被遷移改動；交易外前後來源雜湊也一致。
- 寵物／小窩偏好、解鎖帳本與通知採伺服器本人權限；匿名不能執行，學生不能直接讀寫新帳本或呼叫內部解鎖函式。
- 考古題原獎勵UUID、首次作答與歷史紀錄保留，改呈現為第四種考古花，不另加葉。
- 轉換基準時同步調整 `flower_floor`，保留既有升級資格，且老師撤銷原本必要魔王花仍能正確降級；重跑不重算。
- 沒有套用舊 `quiz_action` 或舊半葉核心SQL，沒有關閉防弊，也沒有重新發放或重設學生學習成果。

來源備份與回退SQL僅存在 ignored `automation/output/effort-level2-release-20261031/`。不可提交 `before.private.json`、`rollback.private.sql` 或認證資料。

## 正式與預覽驗證

- 先前40項程式／PGlite測試及本輪新增原子遷移回滾測試通過；前一輪30人本機多連線540請求零錯誤、慢網路／CPU降效、九窩進出與手機驗證仍有效，範圍限制見發布前驗證紀錄。
- 待發布版本使用已核准的老師測試學生本人認證；憑證僅在同一工作瀏覽器的已驗證正式／待發布網站間於工作程序記憶體傳遞，未列印、保存或提交。
- 真實 Supabase RPC完成小窩顯示偏好儲存、讀回、還原與重載。沒有代答題目、增減葉花或確認消耗解鎖通知。
- 正式頁重載後本人認證、第二級場景、已解鎖寵物名稱「橘寶」、花葉及回看來源正常；依條件只顯示已取得的夥伴與小窩，不預告後續門檻。
- 正式／待發布天氣API均200，學校地點與陰天資料正常；定位／拒絕／故障備援的既有政策保留。
- 正式755個來源檔逐一比對成功；另直接HTTP讀取17個重要頁面／模組，全部200且回應位元組等同發布包。
- 正式390px無橫向溢出、無素材警告或未處理JavaScript錯誤。

原登入與作答紀錄仍在 Supabase；題庫圖片既有 Google Drive＋Cloudflare Worker 分工未變。

## 回退方式

保留舊部署可供 `vercel promote dpl_J9cLJUUCH6GeoGqC7dj47jNFajzC --scope chianwu-4755s-projects --yes`。若需完整回退此次考古花語意，還須配套檢查受保護的 `rollback.private.sql`，不能只換前端就假定資料語意也已還原。

回退SQL會核對來源學習紀錄雜湊，若已有新學習活動即拒絕自動回復成長快照，避免覆蓋新成果；此時應保留新紀錄，由維護者調整回退方案。新增偏好／帳本是加法式資料，不用刪表或刪學生進度。

## 證據與接手

ignored 發布資料夾內：`migration-result.json`、`preview-source-guard.json`、`preview-browser-report.json`、`production-source-guard.json`、`live-browser-report.json`、`runtime-http-report.json`。只有核准測試學生的實際儲存驗證；未將本機材料化子服務壓測宣稱為Supabase雲端容量保證。

後續若 Claude 再發布練功房，必須以這次755檔完整來源或當時更新的正式版為底。不得用舊539／433／425檔包覆蓋；須保留 `garden/scene-cat.html`、`garden/scene-pets.html`、新素材、陪伴與考古花模組及現有天氣API。
