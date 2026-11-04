# 本機發布前報告與專案設定分離（2026-11-04）

本次實作流程的第一階段：大檔只警示，排除規則由各專案設定決定。沒有部署、刪除、建立排程、變更正式設定或付費。使用者另行授權本次修改完成後commit／push，推送仍使用已停用Git自動部署的獨立分支。

## 行為

- `automation/release-report.mjs`只讀呼叫者明確提供的發布清單，支援Vercel CLI dry-run JSON與API `files`，不把整個工作目錄當成上傳範圍。檔案大小／SHA由完整發布目錄或內嵌data核對，不以來源清單猜測大小。
- **單檔大於20,000,000bytes只警示。** 剛好20MB不警示；大檔報告仍成功、CLI結束碼0，不要求逐檔批准。報告不創造發布授權，也不保證平台本身接受任何大小的檔案。
- 報告列出大檔完整清單、bytes／MB、用途、首次／新增／變更／未變更狀態、包總量，以及相較基準的檔案增減和大小。未變更大檔排後面；用途註記不充當放行白名單。基準大小不全時總量增減顯示未知，不補0或估算。
- 專案身份不符、清單重複、缺檔、SHA／大小不符、路徑穿越、連結等仍中止；這些是正確性檢查，不是大檔限制。

## 專案設定

預設讀發布目錄的`release/project-policy.json`，或用`--policy`指定。缺少預設設定時採無排除規則、20MB警示；明確指定卻找不到、JSON損毀、未知欄位或無效規則則回報錯誤，不默默放行。

```json
{
  "version": 1,
  "warningThresholdBytes": 20000000,
  "exclusions": [],
  "purposes": {
    "downloads/lesson-video.mp4": "必要教學影片，只註記用途"
  }
}
```

沒有排除規則的專案可以發布課本與PDF。需要排除時才填寫`exclusions`，每項指定`path`、`kind`（file或directory）、`reason`。路徑以專案根目錄為準，不因任意路徑片段叫textbooks就全域禁止。必要的Windows CLI相容pattern附在**各排除項目**的`cliIgnorePatterns`，移除該項也移除其pattern。

本專案設定沿用既有參考庫和本次已核對的S091／S092來源排除，不加入其他課本或16張PNG；不外推至其他專案。既有`automation/vercel-slim-policy.json`32筆歷史審核表沒有被修改或納入本次提交。

`.vercelignore`中的專案排除區塊由設定產生，保留其他開發用排除規則。`legacyIgnorePatterns`只用於清除本專案舊位置的重複規則。修改JSON後應從它重新準備發布副本，不手動維護兩套相異清單；直接在儲存庫執行原始CLI仍會讀儲存庫當時的ignore，不能把未同步的設定稱為已生效。

`release/textbook-policy.mjs`保留既有匯入介面，但只轉接通用的`project-policy.mjs`；程式內已無寫死課本目錄。`prepareTextbookFreeRelease`亦保留為相容別名，新匯出名稱是`prepareConfiguredRelease`。

## 使用方式

從完整凍結發布包建立新的副本，原始來源保持不變：

```powershell
npm run release:prepare-files -- <完整凍結包> <新的獨立目錄> release/project-policy.json
```

省略第三個參數時只讀來源包自己的設定，不偷用這個儲存庫的規則。輸出包含有效專案設定，ignore受管理區塊同步更新。此工具不證明來源本身已包含全部最新正式功能；仍需原先規劃的正式manifest完整性守衛，不能把partial包當完整網站。

為實際發布清單產生報告（輸出父目錄需已存在）：

```powershell
npm run release:report -- --manifest <CLI-dry-run或API-JSON> --root <完整發布目錄> --policy release/project-policy.json --baseline <正式來源清單JSON> --baseline-root <正式完整來源目錄> --out <發布目錄之外的report.json>
```

`--baseline`、`--baseline-root`、`--out`皆可省略；無out時輸出繁體中文Markdown。有out時新增JSON及同名`.md`，不覆寫舊檔，並拒絕把報告寫入發布／基準目錄。API內嵌data按UTF-8或base64實際位元組計算；SHA引用需要完整本機來源。報告不呼叫Vercel或讀取帳號憑證。

此報告只對所給清單與檔案負責，不自行驗證雲端正式ID的新鮮度、不自動判定全量差異合法，也不代替預覽功能驗收。來源位元組增減不等於帳務空間回收。

## 既有入口整合

- 努力樹關卡仍核對原本四個來源、正確Supabase專案、即時RPC及目錄完整性；其檔案排除改讀發布包的專案設定。
- `prepare-garden-release.mjs`安裝四個關卡模組及有效設定，保留原headers／rewrites，並同步副本ignore。它仍需原有即時資料庫唯讀查核，不是離線報告器的一部分。
- API部署清單必須內嵌專案設定與可核對的vercel.json，四個關卡SHA須符合目前工具；設定被改成不同排除範圍時會拒絕。
- `check-vercel-deployment-payload.mjs <JSON> [--root <完整發布目錄>]`先核對關卡／設定，再產生大檔報告；預設根目錄依腳本所在儲存庫決定，不隨呼叫者cwd換政策。
- PowerShell API入口可傳`-ReleaseRoot`，在POST建立部署前執行上述檢查及報告。GET等讀取不受影響。大檔經報告後可以繼續原已授權發布；缺少或不符的SHA來源仍中止。
- PowerShell入口將檢查／大檔報告送到stderr，stdout保留給Vercel API原始回應，避免報告文字破壞既有JSON讀取；報告寫入stderr不代表大檔被拒絕，是否失敗仍依結束碼。
- 通用報告器可供其他專案使用；努力樹關卡與現有PowerShell團隊scope是資訊課專案專用整合，不能當成跨專案通用發布器。

本輪沒有擴大到任意原始CLI、prebuilt、第三方發布腳本或平台權限的全域攔截。正式站與雲端既有部署不會因本機或Git修改而更新。

## 驗證

```powershell
node --test automation/tests/release-report.test.mjs automation/tests/garden-release-gate.test.mjs automation/tests/textbook-release.test.mjs
pwsh -NoProfile -File tools/preflight.ps1
```

涵蓋20MB下／等於／上1byte、實際API入口大檔仍呼叫模擬Vercel、無設定可發布課本、明確排除才中止、錯誤設定不降級、跨路徑／連結拒絕、清單與實際SHA／大小不符、用途註記及變更狀態、基準缺大小、報告不覆寫輸入、原努力樹錯誤／逾時中止等。

本機回放以11/4已備齊且核對過的831檔來源為輸入：排除16PDF，新增專案設定、更新ignore，816檔共68,005,520bytes；814個其餘原檔SHA保持一致。這是打包／報告樣本，尚未安裝全部新版關卡或完成新雲端預覽，不可直接拿作已驗收正式發布包。

另以11/1保存的真實CLI dry-run清單回放749檔、35,398,171bytes，報告成功。這只驗證格式相容性，不使用舊版網站作新正式基準。11/4新CLI dry-run加正確project／team仍回403；沒有匯出瀏覽器憑證、切帳號或建立部署繞過。

證據位於`D:/ai-browser/logs/vercel-release-report-20261104/`，包括local-report.json/.md、recorded-cli-report.json/.md及測試／preflight輸出。後續每日、每週維護與排程仍未實作。

本次32項測試全部通過，pre-commit使用的preflight通過（8個PowerShell原始檔皆為ASCII，agent state檢查通過）。本次測試與示範沒有建立或刪除雲端部署。
