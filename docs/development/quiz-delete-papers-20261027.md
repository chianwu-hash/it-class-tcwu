# 我的自組卷：刪除與清單整理

2026-10-27，使用者要求學生可刪除不需要的自組卷，避免個人清單過長。

- 每張自組／延伸卷卡片加入「刪除試卷」。確認視窗顯示名稱，並明示從個人清單移除、原作答及錯題保留；取消不送出刪除。
- 使用 `quiz_generated_papers.deleted_at` 標記移除，不刪除固定版本、圖片、作答或錯題。個人清單自動排除已移除卷；既有作答仍可供錯題回顧與原連結回看使用。
- `quiz_delete_paper` 只允許名冊學生移除自己的自組卷，拒絕匿名、教師、他人卷與未知參數；重試同一刪除安全。無法刪老師預組卷或共用題庫。
- 已移除卷不能改名或透過原組卷request_id重新回到清單；原組卷結果連結若仍在畫面，也會清除，改提示可重新組新卷。
- 前端收到後端成功回應才移除卡片並顯示成功；失敗保留卡片供重試，換人後舊回應不得更新新身分畫面。
- 18組測試通過，涵蓋刪除隔離、未答卷、重試、版本／答案完全保留、錯題詳情仍可回看，以及既有命名／組卷／媒體／揭答。瀏覽器本機完成取消刪除、確認移除、重整不再出現，且該卷錯題仍在。

正式schema更新使用 `node automation/quiz-g3-math-pool/names-deploy.mjs --delete`，只更新metadata／RPC，不重匯題庫與圖片；前後比對原答案、原版本摘要。正式瀏覽器只對原指定測試學生新組的測試卷操作，不刪其他既有試卷。

瀏覽器重跑：AI工作瀏覽器租約＋精確TargetId，設定 `QUIZ_BROWSER_URL` 及 `QUIZ_DELETE_TEST=1` 執行 `named-browser.cjs`；證據寫入ignored `qa/delete-local.json` 或 `qa/delete-production.json`。schema結果在ignored `deletion/deployment.json`。
