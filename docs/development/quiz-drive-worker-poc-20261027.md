# Google Drive＋Cloudflare Worker 圖片試作驗收

日期：2026-10-27。使用者已授權試作、挑含圖片與解析的題目、本機試答與驗證圖片不經 Supabase。本輪未要求改正式學生流程、全量搬移或付費升級。

## 結果

已建立 3 題測試卷：錢幣計數、單位積木、分數塗色；共 5 張去重原圖，415,799 bytes。前兩題解析含圖片，積木解析含原生表格，分數解析保留網頁公式。選項打亂；題目未整題轉圖。

- 原圖放學校帳號 `th990821@mail.thps.ntpc.edu.tw` 的新增私有資料夾「考前練功房_圖片送圖測試_20261027」，資料夾 ID `1VG-XJSenubjn42gxsyMZVyTRCaqh2Z6A`。上傳前後與經 Worker 下載的 SHA-256 全數一致。
- Cloudflare 可見帳號 `Chianwu@gmail.com`，帳戶 `6ecb5e147cf628802fbe42154ad531af`，新增獨立 Worker `dingxi-quiz-drive-poc`，網址 `https://dingxi-quiz-drive-poc.nblm-book-audio.workers.dev`。未調整其他 Worker、網域或方案。
- 新增專用電腦版 OAuth 用戶端 `Dingxi Quiz Media PoC 20261027` 與新授權，沿用 `dingxi-it-homework-115` 專案及「頂溪資訊作業收件」品牌，不複製既有作業收件 refresh token。**這不是獨立 Google Cloud 專案／應用程式層級隔離**；新 client 本身不保證不能讀取同 app 先前獲授權的檔案。本 PoC 由 Worker 的五圖白名單再限制讀取；正式擴充應評估獨立專案／應用程式與唯讀權限方案。
- Google 新授權與簽章金鑰保存在 Windows DPAPI vault，專案外 `%LOCALAPPDATA%/Codex/secrets/quiz-drive-worker/poc.dpapi`；Worker 使用 secret bindings，不將 Google token 傳給瀏覽器、不持有 Supabase service role。

## 本機功能契約與實際流向

沿用 `grade6/115-1/quiz.html`、`initQuizModule({mode:'server'})`、既有圖文渲染、10 套回饋動畫及共用燈箱。未新增 navbar 或另寫登入／評分 UI。此為既有本機測試模式，使用合成身分及本機 PGlite 的 `quiz_attempts/quiz_answers`，不寫 localStorage 作答進度，也不冒稱正式學生雲端保存。沒有更動正式學生資料、RLS、Auth 或課程首頁。

本機服務 `automation/quiz-local-server.mjs` 新增 opt-in `QUIZ_DRIVE_WORKER_MANIFEST`：既有 handler／SQL 先驗證題目、場次與解析可見性，再核發五分鐘媒體 ticket。Worker 驗 HMAC、到期、媒體用途、fileId／hash／MIME／大小與白名單，才讀內部快取或 Drive 原檔。未揭答不核發解析 ticket，缺少／偽造／過期 ticket 回 401；內部快取路徑不公開。

圖片路徑：私有 Drive → Worker → 瀏覽器。此輪連控制面也是本機，不經 Supabase；**正式 Supabase 核發 ticket 尚未實作或驗證**。正式接入後題目、授權及進度仍有少量 Supabase 流量，圖片 bytes 可維持獨立路徑。

本機環境：`QUIZ_LOCAL_PORT=4350`、`QUIZ_LOCAL_DATA=automation/output/quiz/drive-worker-poc/db`、`QUIZ_DRIVE_WORKER_MANIFEST=automation/output/quiz/drive-worker-poc/manifest.json`。

使用者試答：`http://127.0.0.1:4350/grade6/115-1/quiz.html?local=1&session=8420ba5b-8bf1-4298-a928-e8082edbb82e&student=1`。已在 AI 工作瀏覽器開啟，交付時 0／3 題。驗收另用合成學生 2／3，沒有替使用者作答。

## 驗收證據

ignored 稽核資料夾：`automation/output/quiz/drive-worker-poc/`。

- `browser-qa.json`：3 題逐題故意答錯；題目燈箱均正常，前兩題解析圖燈箱正常；預設 80%、縮小 70%、重設 80%；積木表格及分數 KaTeX 正常；末題正誤先停留，重新整理接回；使用者身分 0／3；pageerror 0。
- 瀏覽器記錄 19 次 Worker 圖片回應，Supabase 回應 0。DOM 圖片來源均為該 workers.dev，每張回傳 bytes 的雜湊與原圖一致。燈箱讀取原始像素，包括錢幣題目圖 1600×388、分數題目圖 1746×1167。
- `worker-qa.json`：五圖均冷讀 MISS／後續 HIT；未簽章／過期／偽造回 401，快取直接網址 404，匿名 Google 原檔讀取 403。
- 30 個並行模擬用戶各讀五圖，共 150 次，失敗 0；HIT 132、MISS 18；此輪 p50 55ms、p95 1423ms，整批約 3.1 秒。這是小規模 PoC 的一次網路量測，不是正式 SLA，也沒有取得 Worker CPU 用量分布。
- 新增 Worker 4 組測試通過；原 `npm run quiz:test` 11 組通過。
- 三張 `question-*-wrong.png` 已人工視覺檢查，題目、獨立選項、解析圖、表格與公式正常。

## 遇到的問題與修正

1. Worker 初次回 502：Google 原檔 API 實際會轉址，原本 `redirect:'error'` 拒絕轉址。改有限次手動轉址，只允許 HTTPS `www.googleapis.com`／`*.googleusercontent.com`，且 Google Bearer 不轉送到內容主機，再核對原圖 SHA-256。補測允許轉址與惡意主機拒絕。
2. 背景分頁驗收在下一題等待停滯：中止本次已登記測試程序並釋放租約，以新合成身分重跑；驗收前先啟用精確測試分頁，之後三題完整通過。未重設使用者試答身分。

## 尚未涵蓋與後續

- 目前媒體 ticket 五分鐘有效；若頁面擱置很久後燈箱重新讀圖失敗，可重新整理讓目前題目取得新 ticket。正式接入前應加入過期時受控重取，不把 ticket 當永久網址。
- Cloudflare／Google 的配額、費用與 OAuth 管理仍存在；本次沒有升級方案，不宣稱無限免費。Drive about 的 quota 數字可能反映組織層級，不能直接當該帳號的個人剩餘空間。
- 只驗證媒體獨立送圖與本機現有授權契約。未做正式學生跨裝置登入、Supabase ticket API、全庫匯入、跨地長期壓測或即時撤銷快取。
- 無須改正式入口即可回退：不設定 `QUIZ_DRIVE_WORKER_MANIFEST` 即使用原本本機媒體；正式題庫圖片原本就未改。
