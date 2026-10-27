# 我的自組卷、命名與儲存提示

2026-10-27，使用者要求加入「我的自組卷」，組卷後清楚顯示已儲存並立即更新清單，允許學生命名以便接續作答；接續已授權的正式題庫流程。

- 組卷表單可填60字內名稱；成功顯示「已儲存到我的自組卷」，未開始作答也會立刻出現在專屬清單。保留再組新卷按鈕，原卷不會被取代。
- 本人的自組卷、錯題延伸卷與既有未命名自組卷均集中列出，依儲存時間由新到舊排列；與原單元卷分開，顯示名稱、範圍、時間與進度。
- 卡片可儲存新名稱；名稱存於 `quiz_generated_papers.display_name`，不覆寫不可變的 `quiz_versions.document`，作答頁僅使用當下顯示名稱投影。
- `quiz_rename_paper` 只允許名冊中的學生改本人仍可存取的自組卷，拒絕空白、超長、控制字元、匿名與他人卷；畫面以textContent呈現名稱。
- 身分變更立即清空自組卷清單、組卷表單與成功提示，舊回應不得帶入新身分。
- SQL命名／改名測試驗未答清單、冪等、本人隔離、原版本不變、答案與選項順序不變；含既有測驗、媒體、錯題及選卷17組通過。本機瀏覽器完成未答即列出→改名→重整→送1題→返回接續第2題，390px無溢出、頁面錯誤0。
- 正式schema更新只增加名稱metadata／RPC／投影，未重匯題池或圖片。更新前後原答案與版本摘要相同，匿名rename權限關閉。證據在ignored `automation/output/quiz/hanlin-g3-math-pool/names/`；本機畫面證據在 `qa/named-local.json`。

重跑：`node --test automation/tests/quiz-compose.test.mjs`；本機 `node automation/quiz-pool-local-server.mjs`；瀏覽器 `named-browser.cjs` 需透過AI工作瀏覽器租約、精確TargetId與唯一 `QUIZ_BROWSER_URL`。正式驗收限定原指定測試學生，新增試卷，不改其他學生資料。
