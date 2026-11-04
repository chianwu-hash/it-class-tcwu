# 課本來源發布入口修正（2026-11-04）

後續更新：檔案排除已改由各專案設定，大檔只警示；目前命令與四個關卡／內嵌設定要求以[本機發布前報告與設定分離](release-report-20261104.md)為準。下文保留早先修正的歷史紀錄，不代表跨專案課本禁令。

這次修正先完成本機驗證，再依使用者指示提交、推送。正式站現有部署不會因本次修改而改變，也尚未驗證雲端套用新版關卡。沒有修改學生資料、登入設定、課程程式或付費方案。

本機與遠端 `main` 歷史已分岔，因此以遠端 `origin/main` 為基準，在獨立工作目錄建立 `codex/vercel-textbook-publisher-fix-20261104` 分支，只帶入本次修正與發布關卡的必要依賴，不強制推送或合併 `main`。`vercel.json` 只停用此分支的 Git 自動部署，未停用其他分支；依據 [Vercel git.deploymentEnabled 官方設定](https://vercel.com/docs/project-configuration/git-configuration)。

**commit／push 本身不會降低已占用的 Deployment Storage。** 本機重播排除的課本來源約 231.82 MB（十進位）；它是後續每個發布包少帶的來源檔案量，不是可保證的帳務降幅。既有部署仍持有舊檔案。必須另行授權乾淨版本的預覽／正式發布，並在保留正式站、回復版本及使用中預覽的前提下清理不需要的舊部署，再等待 Vercel 統計更新，才可確認實際用量。

## 原因與修正

先前已修正主儲存庫 `.vercelignore`，但後來的凍結發布包／API 部署清單仍沿用正式站的舊檔案與 SHA。11/3 正式來源清單有 831 檔，包含 16 個課本 PDF；忽略規則不能視為任意 API 檔案清單的自動過濾器。

現在共用 `release/textbook-policy.mjs` 排除 `S091-Google網路AI好幫手-PDF`、`S092-Canva魔法工作室PDF` 及原本就不應發布的 `textbooks` 參考庫。依路徑辨認，涵蓋 Windows 分隔符與 URL 編碼；不全面禁止 PDF，也不額外刪除圖片。

- 新工具從完整凍結發布包建立**新的獨立副本**，實際略過上述來源目錄，保留其他檔案位元組，補入 Windows／POSIX 相容的忽略規則。不接受工作中 Git 儲存庫、巢狀輸出、既有輸出或符號連結，不刪除原始課本及來源包。
- 現有 `prepare-garden-release.mjs` 複製新版課本檢查模組。努力樹的即時目錄查核完整保留。
- 既有雲端建置命令仍為 `node release/garden-preflight.mjs`；新版程式先查課本來源，發現就失敗，不讓不乾淨的包變成 READY。這是建置後的防線，不能宣稱檔案尚未上傳。
- 共用 PowerShell API 入口在 POST 建立部署前驗證 JSON：不得含課本、不得缺關卡或沿用舊版關卡 SHA、不得覆寫建置命令；`vercel.json` 必須提供可核對的內嵌內容，保留所需的 headers／rewrites。GET 等唯讀呼叫不受影響。

## 後續發布操作

完整凍結發布包（不是只含變動檔案的 partial publish 目錄）：

```powershell
node automation/prepare-textbook-free-release.mjs <完整凍結包> <新的獨立發布目錄>
node automation/prepare-garden-release.mjs <新的獨立發布目錄>
node release/garden-preflight.mjs --root <新的獨立發布目錄>
```

三步全過後才可另行執行經使用者授權的預覽發布。不得拿舊版完整包覆蓋較新的正式功能。新發布包必須以當時正式站為基準，保留教師後台、中英打及其他新功能。

API 發布必須先準備完整 JSON，把三個新版 `release/*.mjs` 的內容／SHA 納入，`vercel.json` 使用已核對的內嵌 `data`（保留既有路由），再產生新清單：

```powershell
node automation/prepare-textbook-free-release.mjs <完整API部署JSON> <新的乾淨JSON>
node automation/check-vercel-deployment-payload.mjs <新的乾淨JSON>
```

舊清單缺少新版關卡時工具會拒絕，不會自行猜測 `vercel.json` 或替換最新正式功能。上傳任何新檔案前先檢查整份清單；實際建立部署使用 `automation/lib/admin-learning-vercel-api.ps1`，該入口會再驗一次。

CLI 使用乾淨發布副本，不能以儲存庫 `.vercelignore` 已修就跳過包檢查。Git 整合若將課本帶進建置工作目錄，新關卡會中止；目前不宣稱 Git 來源上傳已得到同等排除保證。若需直接 Git 自動發布，須先另行驗證實際上傳與輸出清單。

不可用 `--prebuilt`、舊 READY 部署直接 promote、舊 `builds` 或覆寫 Build Command 繞過關卡。直接使用原始 Vercel CLI／API、平台管理權限或未納管的臨時腳本仍可繞過本機入口；本次不是平台 ACL。雲端關卡要隨新版程式部署後才生效，不能把本機測試稱作雲端驗收。

官方參考：[.vercelignore](https://vercel.com/docs/deployments/vercel-ignore)、[CLI 預設忽略與 prebuilt 行為](https://vercel.com/docs/builds/build-features)。不同入口必須依實際清單驗證。

## 驗證與證據

```powershell
node --test automation/tests/garden-release-gate.test.mjs automation/tests/textbook-release.test.mjs
pwsh -NoProfile -File tools/preflight.ps1
```

測試包含一般下載 PDF／後台／登入／中英打／API 檔案的逐位元組保留、原始課本不變、課本在資料庫查詢前即被阻擋、舊關卡 SHA 拒絕，以及 PowerShell 入口在非法 JSON 時不呼叫 Vercel。API 呼叫使用本機假函式，不建立任何雲端部署。

正式來源清單的本機重播與測試輸出存於 `D:/ai-browser/logs/vercel-textbook-publisher-fix-20261104/`。檔案排除的來源位元組不等於 Vercel 帳務釋放量；本次沒有重新量測儲存額度，也沒有移除舊部署。

本次結果：20 項測試全部通過；pre-commit 使用的 `tools/preflight.ps1` 通過（98 個 PowerShell 檔案皆為 ASCII，agent state 檢查通過）。以 11/3 留存的正式部署 `dpl_BA7yZJj3VFrQnhW8oYA2FHTAjQMb` 831 檔清單重播，正確排除 16 個課本 PDF（231,820,219 bytes），其餘 815 檔路徑與 SHA 完全保留。這是本機清單重播，尚未做新預覽或雲端功能驗收。

提交前也在以遠端 `main` 建立的獨立工作目錄重跑 20 項測試，全數通過；該工作目錄的 preflight 檢查通過（8 個 PowerShell 檔案皆為 ASCII，agent state 檢查通過）。原工作目錄其他未提交變更未帶入分支。提交所用 hook 與檢查工具沿用本機既有工具，不另納入本次提交。
