# 閱讀小卡批次過關

- 使用者希望先將需補充的小卡標為再努力，再把其餘待回應小卡一次過關。
- 教師閱讀區在「已分享・待老師回應」篩選下顯示「目前篩選全部過關（N張）」；僅作用於當週、目前班級及搜尋結果內的submitted小卡。零筆時停用。
- 單筆或批次後保留班級、狀態及搜尋條件；切換週次或帳號清除條件。
- 沿用reading_action review，逐筆帶入version_id與review_seq，不變更SQL、權限或努力樹模型，不覆蓋feedback。
- 批次開始鎖定清單快照與篩選控制，逐筆處理；任一失敗停止後續請求，回報已確認成功數與尚未確認數，再重讀清單。不自動重試結果不明的寫入；帳號改變停止後續處理。
- 教師頁的模組版本字串已更新。僅本機修改，尚未commit、push或部署，沒有對真實學生執行批次評比。

## 驗證

- `node automation/tests/reading-bulk-browser.cjs`：通過待回應限定、班級／搜尋範圍、再努力與已過關不改動、單筆後保留篩選、零筆停用、衝突停止與重試、390px版面及登出中止。
- 瀏覽器載入實際reading-ui與reading-api，攔截RPC為合成紀錄，未送出真實評比。手機截圖已檢視。
- `git diff --check` 通過。
- 原有 `automation/tests/reading.test.mjs` SQL測試未能執行：環境缺少 `%TEMP%/codex-drive-validation` 的 `@electric-sql/pglite`。本次未修改SQL；不宣稱SQL回歸通過。
