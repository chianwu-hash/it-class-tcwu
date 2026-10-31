# Vercel CLI 升級與課本 PDF 排除驗證

日期：2026-10-31（臺灣時間）。本次只更新本機工具與排除規則，未建立任何部署，未重新部署正式站。

## 結果

- 全域 Vercel CLI：54.7.1 → 65.8.0；Node.js 24.14.0。
- 新版預設設定目錄改為 `%APPDATA%/com.vercel.cli/Data`；既有登入已從舊 `%APPDATA%/xdg.data/com.vercel.cli` 延續，未另行授權或輸出憑證內容。原帳號 `chianwu@gmail.com`、團隊 `chianwu-4755s-projects` 已實際核對。
- **升級本身沒有修好巢狀目錄的 Windows 路徑比對。** CLI 65.8.0 的實際 dry-run 仍列出 16 份 S091/S092 課本 PDF。
- `.vercelignore` 保留原有精確目錄規則，另補兩個不含路徑分隔字元的目錄名稱模式，兼容反斜線路徑：

```gitignore
*S091-Google網路AI好幫手-PDF*
*S092-Canva魔法工作室PDF*
```

這兩條是 Windows 相容措施，不是刪除課本。它們會排除路徑中含這兩個完整目錄名稱的項目；勿改成廣泛排除全部 PDF，以免影響正式教材附件。

## 實際驗證

以 `D:/projects/it-class-tcwu` 為工作目錄，對同一專案執行 CLI 的 dry-run，未執行建置／部署：

```powershell
vercel --scope chianwu-4755s-projects deploy --dry --json --project prj_eJ1qle57xyilS5MKy6ZS6OuYtyFb --non-interactive
```

- 修正前檔案清單：2,331 項；修正後：2,315 項。
- 移除的清單項目恰為原來 16 份課本 PDF，共 231,820,219 bytes；沒有其他路徑被移除，也沒有新增其他路徑。
- `index.html`、`shared/auth.js`、`shared/quiz-server.mjs`、`my-tree.html`、三上及六上首頁均仍在清單中。
- 現有 `node automation/check-vercelignore-references.js` 通過（228 份公開檔案）。
- 正式部署 ID、最新部署 ID 與最近部署清單前後相同；dry-run 沒有建立 `.vercel/project.json`。既有 `package.json` 的使用者修改未變動。

232 MB 是這次從「上傳清單」排除的來源檔案大小，不是已釋放的雲端儲存量。10/30 的正式站來源雖含課本，16 個公開 PDF 網址皆為 404；不得把來源清單與正式建置輸出混為一談。

## 下次發布必須沿用

從目前工作目錄發布時，使用已更新的 `.vercelignore`，先檢查 dry-run 再發布。

**若從正式來源重建凍結發布資料夾，不可直接沿用舊來源中的 `.vercelignore`。** 將本次兩條相容規則同步至那個發布資料夾，並在實際發布資料夾執行相同的 dry-run。其清單不得包含上述兩個課本目錄下的 PDF，必要 runtime 檔案仍須完整；發布保護的差異清單也須明列這次 `.vercelignore` 更新，不能因「保留舊來源所有檔案」而把排除規則退回舊版。

本次 Git 提交僅包含排除規則與本紀錄；未推送 Git，也未更新既有發布快照，以免改到其他進行中的發布工作。

## 證據

本機 `D:/ai-browser/logs/vercel-cli-upgrade-20261031/`：

- `dry-run-before-fix.json`：升級後、補規則前的實際清單。
- `dry-run.json`：補規則後的實際清單。
- `verification.json`：16 份 PDF、完整路徑差異及正式站未變的斷言結果。
- `before.json`、`after.json`：dry-run 前後的部署識別與輸入雜湊。
- `old-cli-54.7.1-file-collector.js`：原版 CLI 檔案收集器的非憑證程式碼備份。

官方參考：[dry-run 說明](https://vercel.com/changelog/dry-run-deployments-with-vercel-cli)、[deploy 指令](https://vercel.com/docs/cli/deploy)。實際參數以本機 65.8.0 的 `vercel deploy --help` 為準，JSON 旗標是 `--json`。
