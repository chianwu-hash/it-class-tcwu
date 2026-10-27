# 三上數學可出題池

唯讀翰林115三上數學來源，沿用全冊目錄，轉成既有schema 1圖文題目；不把整題截成圖片。所有題目、原圖、來源文件與測試資料存於Git忽略的 `automation/output/quiz/hanlin-g3-math-pool/`。

## 重跑與本機試作

1. `python automation/quiz-g3-math-pool/build_pool.py --prepare`
2. `pwsh -File automation/quiz-g3-math-pool/convert-images.ps1 -Root automation/output/quiz/hanlin-g3-math-pool`（只轉WMF／EMF個別原圖）
3. `python automation/quiz-g3-math-pool/build_pool.py`
4. `node automation/quiz-g3-math-pool/validate-pool.mjs`
5. `python automation/quiz-g3-math-pool/verify-source.py`
6. `node automation/quiz-pool-local-server.mjs`

本機入口：`http://127.0.0.1:4380/grade3/115-1/quiz-library.html?local=1&student=1`。使用合成身分與持久PGlite，不連正式學生資料；頁面明確標示。瀏覽器驗證使用AI工作瀏覽器租約及 `browser-test.cjs`，參數是已取得的精確TargetId，`QUIZ_BROWSER_URL`須對應唯一工作網址。

## 核對界線

- 來源3710筆，第一版只啟用獨立四選一選擇題：516筆、9單元、60學習重點、514個不同內容家族。
- 原題JSON、原始Word選項及答案檔交叉核對。保留圖片、段落及表格；未知結構直接列待處理。
- 簡單分數讀取可見WMF文字及分數線，轉成KaTeX；不信任可能過期的OLE原生值。保留三個已知回歸案例。
- 圖片解碼、位元組雜湊、公式排版與資料格式全量檢查；題意與數學推理仍保留原解析，未聲稱516題都獨立解題證明。
- 51題解析引用原選項位置、1題直向合併表格、2題非獨立四選一及其餘3140筆其他題型均不混入互動池。清單在 `catalog/pending.json`。

## 正式發布

僅依使用者上線授權執行：`cloud-deploy.mjs --prepare` →既有Drive上傳程式→精確Cloudflare分頁帳號核對及Worker發布→`worker-verify.mjs` →`cloud-deploy.mjs --apply` →只提交本功能前端→正式瀏覽器驗收。

正式圖片走Google Drive＋Cloudflare；Supabase只保留圖片metadata、驗權與票證，以及登入、組卷固定版本、作答及錯題。原有版本與作答不得覆寫。正式匯入前後比對原版本與答案摘要；私人題池禁止學生直接SELECT，組卷專用RPC驗本人名冊與範圍。

新增圖片會擴充既有Drive白名單數量。早期固定5534張的舊一次性驗證腳本不能當作新版圖庫上限；不要為了重跑舊啟用腳本而刪圖片。
