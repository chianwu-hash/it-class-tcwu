# 第08週正式發布紀錄

## 2026-10-19 正式發布

使用者明確授權部署。正式網址：https://it-class-tcwu.vercel.app/grade3/115-1/week08.html 。

### 資料庫

以 `supabase-personal db query --linked -f supabase/grade3_week08_typing.sql` 在正式專案登記 `grade3_google_activities('08','typing_task_5',5)`。執行前唯讀查詢只有第07週；執行後確認第08週已登記、total=5。未改既有進度、RPC 或權限。

### 網站（隔離部署，未經 git）

- 基準：正式站原為 git 自動部署 `dpl_5u6oV1uAzjBVuv3oxGnYwxrQWfG9`（main `88c82f9`）。抽查 7 個相關檔案，正式內容與 git HEAD 相同。
- 做法：`git archive HEAD` 匯出到暫存目錄，只疊上 21 個本週檔案：`week08.html/js/css`、學期 navbar `activeWeeks` 與 15 個頁面的 navbar 快取版本（`20261019-week08`）、首頁第08週卡、`shared/typing-tools.js`（新增選用注音鍵盤提示）、`shared/reward-tree-config.js`、`admin-progress.html` visibilityDefaults。主工作區其他未發布修改、教案、SQL、測試與教材未上線。
- 新部署 `dpl_6oyJjPNJAvdFrigrAxfZKMzw3Yki` 先以 production skip-domain 建立，`vercel curl` 核對 21 個檔案 SHA256 一致後 promote；正式網址再核對 21 個檔案全部一致。可回復的前版為 `dpl_5u6oV1uAzjBVuv3oxGnYwxrQWfG9`。

### 驗證

- 本機合成測試 `automation/tests/grade3-week08-browser.cjs` 通過（合成身分，沒有真實學生寫入）：免登入暖身不存任何資料、闖關鎖定、登入回原頁、中文錯字精準提示、保存失敗不解鎖、RPC 參數 `08/typing_task_5`、接回／完成／再練不重複、身分失敗時暖身仍可用、注音鍵盤提示依關卡、首頁／navbar 可見性。
- 正式站未登入檢查：頁面載入、navbar 第8週、暖身答題、注音鍵盤提示（「星」標出 U、V、/、空白鍵）無捲軸、闖關鎖定、首頁第08週為最新且可見、console 無錯誤。
- **尚未驗證**：正式 Google 登入後的闖關保存與努力樹（需教師測試身分 307 或學生帳號）、教室電腦實體注音輸入法逐字輸入、教師後台第08週隱藏／顯示切換。

### 注意：git 尚未同步

本次沒有 commit／push。正式站使用 git 自動部署，若之後有人在未包含第08週檔案的狀態下 push main，自動部署會把第08週與 `typing-tools.js` 注音提示蓋回舊版。下一次 push 前必須先把上述 21 個檔案（與教案、SQL、測試）一併 commit。
