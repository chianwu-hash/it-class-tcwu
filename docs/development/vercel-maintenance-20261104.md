# Vercel 唯讀維護工具與資訊課試跑

本階段只實作用量報告與舊部署盤點。沒有刪除、部署、訊息發送或排程啟用功能；每日／每週是預定執行頻率，目前由人工執行。

## 目前發布規則

目前發布只從 `main` 的乾淨 checkout 執行，功能分支須先經 PR 合併；發布前須先在 `docs/development/agent-handoff.md` 頂部登記，並依 `docs/development/dev-sop.md`「發布規則：只從 main 發布」完成核對。`main` 已關閉 Vercel Git 自動部署，不得移除此設定。本工具的報告或候選清單不構成發布授權，也不沿用歷史凍結包作為發布來源。

## 乾淨 checkout 的提交檢查

Git hooks 與必要的 PowerShell 檢查腳本一併納入版本控制。在新 checkout 可執行 `pwsh -NoProfile -File tools/install-git-hooks.ps1`，將 `core.hooksPath` 設為相對路徑 `.githooks`；pre-commit 會從該 checkout 執行 `tools/preflight.ps1`，不依賴主工作區未追蹤的檔案。PowerShell 原始碼須為 ASCII，繁體中文提示應放在 UTF-8 資料檔。

## 專案設定與證據

- `automation/vercel-maintenance-project.json`：指定帳號、團隊、專案、額度與快照有效分鐘數。30 分鐘有效期只限制盤點資料的新鮮度，不是保留天數。
- `automation/vercel-maintenance-registry.json`：逐版本登記用途、狀態與證據。由先前已確認的保留紀錄建立 15 筆保護登記，沒有虛構已結束任務。
- `automation/collect-vercel-maintenance.cjs`：透過已登入的工作瀏覽器取得 GET 快照；核對帳號與專案所屬團隊、完整分頁，以及收集前後的正式版、別名、網域與部署集合。
- `automation/lib/vercel-maintenance.mjs`：純本機判讀、保護規則、通知建議去重及批次指紋。
- `automation/vercel-maintenance.mjs`：輸出 JSON 與繁體中文 Markdown。

收集器只接受設定檔、精確分頁 ID 與新快照路徑，沒有任意 HTTP 方法或寫入端點。不要保存 Cookie、Token、環境變數值或完整私有頁面匯出。

## 人工執行

優先使用可用的 Vercel 連線或已登入 CLI。此次連線未能讀取指定專案，改用工作瀏覽器唯讀查核。瀏覽器操作必須依本機 `ai-work-browser` 租約流程取得實例與精確分頁；不可借用別的對話實例。

取得租約及精確分頁後，透過 `D:/ai-browser/run-background.cjs --lease-id <LeaseId>` 執行收集器。由管理器提供 `AI_WORK_BROWSER_CDP_URL`，套件可透過 `CDP_SAFE_CLIENT_MODULE`、`PUPPETEER_MODULE` 指定；不在專案內寫死本機通訊埠或登入資料。收集器參數：

```text
node automation/collect-vercel-maintenance.cjs --config automation/vercel-maintenance-project.json --target-id <精確分頁ID> --out <新快照.json>
```

管理器須在工作期間更新租約並註冊工作程序，結束或失敗均釋放租約。收集失敗會保存失敗證據，後續報告受阻，不可把失敗當成空清單或零用量。

有新快照後，依需要執行以下其中一種；輸出目錄必須尚不存在：

```text
npm run maintenance:daily -- --snapshot <快照.json> --out <新的每日報告目錄> --state <本機狀態.json>
npm run maintenance:weekly -- --snapshot <快照.json> --out <新的每週報告目錄>
npm run maintenance:report -- --snapshot <快照.json> --out <新的合併報告目錄> --state <本機狀態.json>
```

可用 `--config`、`--registry` 指定其他設定，資料身分必須一致。每日輸出 `daily.json`、`daily-usage.md`；每週輸出 `weekly.json`、`retained-deployments.md`、`cleanup-candidates.md`；另有 `result.json`。本機狀態僅去重已輸出報告的通知建議，沒有實際通知送達狀態；損毀狀態會備份，首次執行不假裝已通知。

## 用量判讀

保留來源期間、UTC 日點、取數時間、介面更新文字與獨立入庫時間。`Updated just now` 不能證明用量資料已完整入庫。每日最高量與 GB-month 計費量不同，不以來源檔大小或不同期間差值宣稱精確清理降幅。

帳號錯誤、快照過期、取數失敗、總和不符、資料日期或單位不符等情況，分別標示受阻或未知。本次資訊課有已知函式與保留部署，新日專案 0 B 視為缺漏疑慮；此規則不能直接推論其他純靜態專案的零函式用量異常。今日低於額度至多是暫時觀測，不宣稱已確認恢復。

## 保留與候選規則

正式站、所有別名指向、回復候選、進行中建置、進行中任務、用途未明及回復狀態未明的版本均保留。登記保護到期只要求複查，不自動變成候選。

候選必須具備明確的任務結束證據，且無任何保護條件；歷史正式版本還需明確登記已審閱其正式歷史。任何先前保留版本失蹤、分頁不完整、網域無法對應或收集前後變動，都會撤回候選。批次指紋包含正式版、別名、網域、登記與部署集合；過期或重讀有變化即失效。工具沒有刪除執行器，候選數不代表刪除授權。

## 2026-11-04 資訊課試跑

成功快照時間為臺灣時間 10:21，帳號 `chianwu@gmail.com`、團隊 `chianwu-4755s-projects`、專案 `it-class-tcwu`。部署共 60 次，收集前後正式版、別名、網域及集合一致；當時正式版為 `dpl_BDJATgLLgbUKvQUNXZYYeu8d5L4p`。

- 保留 60，清理候選 0：缺乏可解除保護及確認用途已結束的證據，不能據此說全部版本永遠必要。
- 最新 11/4 UTC 日點只有團隊 24.80 MB、資訊課 0 B；函式亦 0 B，判為未知，不能宣稱恢復。
- 最近已結束日的合理觀測為 11/3：部署儲存團隊 10.747 GB、資訊課 9.950 GB；函式團隊 36.66 MB、資訊課 1.34 MB。這是歷史日點，不能當作目前即時存量或精確清理效果。
- 同一狀態重跑不重複建議通知。

證據：`D:/ai-browser/logs/vercel-maintenance-trial-20261104/`。成功來源為 `live-snapshot-retry.json`，首次失敗快照另外保留；最終報告位於 `report-final/`。實例 02 的本次租約已釋放，未操作另一對話持有的實例 01。

驗證：51 項測試通過，包含既有發布工具回歸測試；`tools/preflight.ps1` 通過。沒有刪除版本、啟用排程、部署正式站或預覽，也沒有付費升級。

整合至新 main 基準：由 `origin/main` 的 `217a9fc` 建立獨立 worktree，只搬入本次維護工具、提交檢查及三個 maintenance 指令。指定的 `vercel-maintenance` 與 `release-report` 共 30 項測試通過；preflight 掃描 14 個 PowerShell 檔案通過。前段 51 項為原試跑的歷史測試紀錄，兩者範圍不同。正式發布仍須另外依上述 main 發布規則執行，本 PR 不啟用排程或部署。
