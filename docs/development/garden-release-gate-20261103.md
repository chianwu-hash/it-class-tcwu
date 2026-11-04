# 努力樹升級任務目錄：發布自動阻擋（2026-11-03）

## 已啟用

正式 Vercel 專案 `prj_eJ1qle57xyilS5MKy6ZS6OuYtyFb`／`team_SOhQ0oysg6ZGV9vs3RryW2CB` 已設定：

```text
Build Command: node release/garden-preflight.mjs
Output Directory: .
```

根目錄 `vercel.json` 同時版本控管相同設定。一般 Git 或來源包部署都會在雲端建置時檢查；舊發布包若漏帶檢查程式，建置也會失敗，不會靜默放行。這不是只有開發者記得執行的 npm 指令。

本次只啟用建置關卡、增加唯讀目錄 RPC，並建立預覽驗證；沒有 promote、rollback 或替換學生正式網站。啟用與驗收時正式版本維持 `dpl_HaMgmjC6LWrkaiXaZ3fxAGTN2oQt`。此版本號只是當時的查核紀錄，後續不可拿它覆蓋更新的正式來源。

## 比對契約

`release/garden-preflight.mjs` 直接讀取**本次發布包**的三個課程設定模組，產生完整應有目錄；再以 `shared/auth.js` 中既有公開 anon key，向固定正式 Supabase 專案呼叫 `garden_catalog_manifest()`。

- 比對課程、週碼、活動鍵，以及 `kind`、`total_levels`、`reward_mode`。
- 漏項／設定不符：列出活動與欄位，程序 exit 1，Vercel 建置失敗。
- RPC 缺少、無權、連線失敗、12 秒逾時、無效／重複資料、錯誤專案或過期回應：一律失敗，不使用舊快取或上次通過結果。
- 只有本次新鮮比對通過才 exit 0。輸出來源 SHA-256 與資料庫時間，供建置紀錄查核，不輸出 API key。
- 資料庫保留而此次來源不再使用的歷史定義只列為 `retainedHistorical`，不刪除、不阻擋。活動類型／數量若要變更，仍必須先審核資料語意並正式同步。
- 不會自動套用 SQL，也不讀寫學生進度、答題、花葉、成長、寵物或已讀狀態。

新 RPC 只回傳已在公開課程設定中的任務識別與類型／數量等中介資料；匿名與學生仍不能直接 SELECT 目錄資料表。沒有新增學生資料查詢介面，也沒有把 service-role／管理金鑰放進建置環境或網站。

## 實際發布用法

完整 repo Git 部署已由 `vercel.json` 與專案 Build Command 自動執行。可先在本機跑同一檢查：

```text
npm run release:check
```

若使用「從最新正式來源重建完整凍結發布包」的 CLI 流程，在 deploy 前執行：

```text
node automation/prepare-garden-release.mjs <完整發布包路徑>
```

此步會先檢查那份發布包的實際設定；通過才放入兩個 `release/` 檢查模組、合併 `vercel.json` 的 gate 設定，保留既有 headers／rewrites，不改應用程式來源。若已有不同 buildCommand、outputDirectory 或 legacy builds，直接中止，不能覆蓋。準備完成後仍須延續原有完整來源雜湊、dry-run、預覽、身分／進度與正式別名查核；目錄檢查不取代這些保護。

**不要使用 `--prebuilt`、legacy `builds` 或覆寫 Build Command 來繞過檢查，也不要把舊 READY 部署直接當成新的已檢查版本。** Vercel 的來源建置關卡不是平台權限鎖，專案管理員仍能刻意改設定或略過建置。若未來改採預先建置／直接 promote 流程，必須把同一 live check 接到該流程並綁定實際發布來源，不能聲稱既有 Build Command 會重新執行。

## 驗證證據

- 12 項自動測試通過：正常、漏項、三種設定不符、改來源後重查、連線／HTTP／讀取 body 逾時、錯誤／過期回應、重複與空目錄、歷史列，以及凍結包保留路由／來源與衝突不覆蓋。
- 本機實連正式 Supabase：94 項全部一致、無缺項或設定差異。
- SQL 單一受保護交易建立 RPC；既有學習／成長／解鎖／寵物資料、任務目錄與其他 public 函式前後雜湊不變；匿名可執行此 RPC，但不能直接讀目錄表。
- 真正 Vercel Git 預覽：正常提交 `cef0b15` → `dpl_9Dy3j8dqRa3xAs29W8Q2WL4GwCSU` **READY**，建置 log 包含「努力樹升級目錄檢查通過」。
- 獨立測試分支故意把第 10 週總關卡數 5 改為 4，提交 `a8941f9` → `dpl_3o9oGaZGk2WJdPu1FkNgzozNwHcR` **ERROR**，log 明列 `total_levels` 差異及「發布已阻擋」，exit 1。該故意錯誤已用 `a15736f` 還原並推送，未合併功能分支、未改正式站或真學生。
- MCP 無法存取該專案，CLI 當下登入另一帳號；改用既有工作瀏覽器中可見的 `chianwu@gmail.com`／正確專案設定頁操作，未切換 CLI 帳號或擷取登入憑證。建立來源部署 API 回 403，改用正常 Git 預覽完成雙向驗收，沒有繞過權限。

證據保留於主工作樹 ignored `automation/output/garden-gate-20261103/`：`enabled.json`、`migration-result.json`、`cloud-proof.json` 與兩份雲端建置 log。

若關卡擋住新增週次：核對並同步正式 SQL 目錄，再重新建置。不可關閉檢查或要求學生重做。已在線的正式頁不會因新建置失敗而停機。
