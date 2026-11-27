# 資訊課舊部署清理：七天唯讀試行

本次只新增唯讀收集與候選報告，沒有刪除執行器，沒有 Vercel 設定寫入，也不建立網站部署。既有發布來源、發布鎖、資料庫與 Git 自動部署設定保持。排程由 Codex 本機聊天 heartbeat 管理；本文件不會自行啟用排程。

試行日期：2026-11-28～2026-12-04，Asia/Taipei 每天 03:00，共七個日曆日。結束後不自動續期，也不切換成實際刪除。電腦與 Codex 桌面程式需可執行本機排程；漏跑須如實標記，不偽造當日成功紀錄。

## 保留條件

所有條件取聯集，符合任一條件就不列候選：

- 正式網址 `it-class-tcwu.vercel.app` 實際指向的部署；不以 `targets.production` 猜測。
- 最近兩個不同 commit 的已發布回復版本。從共用 Git 目錄的 `release-history.ndjson` 讀取 `promoted`、正式指向確認、完整檔案樹比對通過、main 祖先及遠端 commit 一致的收據；無時間的 aborted 紀錄不參與日期排序。
- 目前發布收據的直接回復基準。
- 最近七天，每個臺灣日期最後一個可核對發布版本。
- 最近24小時所有部署。
- 所有有效 alias、平台回復標記、建置中或狀態不明、既有明確保留／進行中登記。
- 未到七天的其他正式部署；未到三天的預覽、失敗及取消部署。
- 缺乏任務結束證據、正式歷史用途未審閱或回復狀態未知的版本。

候選仍沿用既有維護工具的正面結束證據要求：登記為 completed，正式歷史另需 productionHistoryReviewed。年齡、READY、曾 promote 都不能單獨當成功能驗收或刪除授權。回復部署被保留不代表已測試回復，也不保證目前資料庫相容。

## 唯讀與一致性

- `automation/lib/deployment-cleanup-collector.mjs` 只允許六類固定 GET 端點，CLI 強制 `--method GET`；不接受任意方法、刪除、設定、部署或套用參數。
- 每輪核對帳號、團隊及專案；所有清單完整分頁，前後兩次比較正式版本、部署集合、alias、網域及原生保留設定。
- 發布鎖存在時略過雲端盤點；查核期間鎖或發布紀錄變動、回復目標不足、既有保留版本失蹤、分頁不完整，全部撤回候選。
- 沿用 `vercel-maintenance-registry.json`，不擅自刪除或解除歷史保留登記。舊保留登記失蹤會列為受阻事項，不能把它當成目前版本被試行程式刪掉。
- CLI 的憑證仍由 CLI 管理；輸出只保存必要欄位，不保存權杖、Cookie、環境變數值或完整 CLI 錯誤內容。
- 不讀寫學生資料或 Supabase；不查閱教材。

## 本機執行

本機私有 JSON 設定沿用 `vercel-maintenance-project.json` 的 version、project、quotaBytes、snapshotMaxAgeMinutes，再加：

```json
{
  "trial": {"startDate": "2026-11-28", "days": 7},
  "repo": "<既有 repo 的絕對路徑，供讀取發布紀錄及 main 來源>",
  "outputRoot": "<repo 外的私有報告絕對路徑>",
  "registryFile": "<已核對保留登記 JSON 的絕對路徑>",
  "cliEntry": "<既有 Vercel CLI dist/vc.js 絕對路徑>",
  "globalConfig": "<既有 CLI 設定目錄絕對路徑>"
}
```

設定檔不放進公開 repo。使用系統 Node 直接呼叫既有 CLI，避免以 shell 拼接含 `&` 的查詢。輸出路徑不得位於 repo 之內。

```text
npm run maintenance:cleanup-trial -- --config <本機私有設定.json> --check
npm run maintenance:cleanup-trial -- --config <本機私有設定.json>
npm run maintenance:cleanup-test
```

`--check` 是立即驗證，不耗用七天次數。一般執行只允許七天日期範圍，每個臺灣日期最多一份正式試行報告；重複執行不覆寫。第八天直接返回 outside-trial，不查雲端。試行狀態損毀時停止，不自動重設。以本機 trial-run.lock 防止同一流程重入，不寫入或移除共用發布鎖。

每次輸出 `summary.md`、`cleanup-candidates.md`、`retained-deployments.md`、`inventory.json`、`snapshot.private.json`、`result.json`。失敗保留 failure.json；受阻報告會撤回全部候選。JSON 保留完整部署 ID、來源指紋、必要回復目標、每條保留理由與原生保留設定快照。

本機安裝可將已提交版本的五個執行模組及保留登記複製至 repo 外固定目錄，保留逐檔 SHA-256 與來源 commit。排程呼叫該固定副本，不能依賴後續會清理的開發 worktree。每日重新讀取真正 repo 的發布紀錄及最新 origin/main，不自動下載或替換執行程式。

## 2026-11-27 歷史登記與舊預覽逐筆複核

使用者另行授權查核原15筆保留登記與兩個舊預覽網址，確認過期者改為歷史封存，保留原資料；禁止刪除遠端部署、網址或變更保留設定。

- 原15筆已逐ID完成兩次指定團隊、既有帳號的認證GET，皆回覆Deployment not found (404)；無現行alias指向，非目前正式版。另讀回11月初快照及11/3清理保留證據，保存原用途、原reason／evidence、最後已知建立時間、類型與網址。它們與本聊天先前刪除的53筆沒有重疊。
- 登記狀態改為archived，附archive.previousStatus、兩次查核時間／404、當時alias引用數及非正式版等證據。原reason與evidence保持；原始登記與完整查核紀錄保留repo外，登記內保存原始證據SHA-256。封存只表示不再以此缺漏阻擋目前盤點，不表示本次刪除、不可恢復或已證明永久消失。
- 兩個網址分別為`it-class-tcwu-git-codex-effort-tr-651cc8-chianwu-4755s-projects.vercel.app`及`it-class-tcwu-git-codex-past-exam-269d79-chianwu-4755s-projects.vercel.app`。目標ID均兩次認證查詢404；公開請求分別410與302。遠端alias保持原狀，僅在aliasReviews記錄精確name／projectId／deploymentId與審閱證據。
- 每次盤點對不在完整部署清單中的alias目標，前後各讀一次部署ID，必須皆為404、帳號／團隊／專案一致、對應同一筆已審閱舊分支網址、資料新鮮且前後不變，才列為「已核對的舊預覽目標不存在」而不全域阻擋。這不是省略網址或忽略所有404。
- 未登記的缺漏、新目標、401／403／網路錯誤、單次或過期查核、目標狀態改變，繼續撤回全部候選。若目標重新在完整清單中出現，正常按有效alias保護；若archived部署重新出現，立即標為受阻且保留，不當成已完成可刪版本。試行疊加保護不得掩蓋封存版本重現。
- 報告列出archivedRegistrations與knownUnavailableAliases；歷史封存不構成任何遠端刪除授權。七天排程與截止日期不變，不重設已執行日期或另加次數。

## 驗收與七天收尾

測試須涵蓋正式 alias 與 targets.production 不同、兩個不同 commit 的回復目標、每日基線、24小時及三／七天邊界、發布中、缺漏、分頁重複、非 main 收據、舊保留版本失蹤、日期與重入、拒絕寫入參數。

每次報告明列正式及兩個回復版本是否都在保留集合。第七次完成後彙整七天成功／受阻／失敗／漏跑、候選數及保護驗證，不自動改設定或刪除。用量追蹤由既有另案處理；本流程不以候選數估算可釋放 GB。
