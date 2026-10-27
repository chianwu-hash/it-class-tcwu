# 正式題庫圖片切換：Google Drive＋Cloudflare

日期：2026-10-27。使用者授權正式網站切換圖片讀取，登入與作答紀錄繼續使用 Supabase。

## 正式資料流

1. 正式網頁沿用 `shared/quiz-api.mjs` 與現有 Supabase session，呼叫 `quiz-media` Edge Function。
2. Edge Function 先呼叫 Auth `/user`，再以同一學生權杖執行既有 `quiz_media_access`。本人、名冊、題目與解析的可見性規則不變。
3. `QUIZ_IMAGE_BACKEND=drive` 時，已授權圖片取得五分鐘 HMAC 票證；Supabase 不下載圖片，也不簽發 Storage 圖片網址。
4. 瀏覽器直接向 `dingxi-quiz-drive-library.nblm-book-audio.workers.dev` 讀圖。Worker 仍以私有 5,534 張圖片白名單核對 hash、MIME、大小，下載 Google Drive 原圖或取內部快取；任何情況都先驗證票證。

雲端票證不必攜帶 Drive file ID，檔案對應只由 Worker 私有索引決定。原本機票證包含 file ID 時仍須完全相符。未知素材不讀 Drive、不自動回退 Storage。

登入、`quiz_action`、`quiz_attempts/quiz_answers`、原題庫文件及版本皆未修改。音檔與教師固定版本 `freeze` 維持原流程。原 Storage 圖片未刪除。

## 部署

- 正式來源：`https://it-class-tcwu.vercel.app`，加入 Worker 精確允許來源；保留原本機來源。
- Cloudflare 可見帳號核對後更新原 library Worker，完整白名單 5,534 張；未修改其他 Worker 或付費方案。
- Supabase CLI 核對 `upxgyusodibaqcrocdzj` 與既有專案名稱，部署 `quiz-media` 程式套件，狀態 ACTIVE。程式部署時為第 4 版；Supabase 更新環境設定也會增加版本號，因此啟用檢查以函式 ID 與 `ezbr_sha256` 核對實際程式。保留 handler 的 Auth 驗證及既有 CORS 設定，未改資料庫或 RLS。
- `QUIZ_DRIVE_ORIGIN` 與 `QUIZ_DRIVE_TICKET_KEY` 設為後端環境設定；簽署金鑰取自既有本機 DPAPI，只經程序記憶體傳入，不寫入專案、部署紀錄或前端。
- `node automation/quiz-drive-production-deploy.cjs` 部署並設定簽票依賴；`--activate` 會核對 Worker 健康、正式 CORS 及 Edge 版本後切換。沒有修改前端路由；前次 push 的正式頁面已具有每次開燈箱重新取票功能。

## 驗收

正式網站以既有測試學生核對獨立三題驗收場次，回看先前已保存的三題錯誤答案，未對其他學生或原單元卷送答。

- 三題題目原圖、答錯解析、解析圖片、原生表格、末題正誤提示均正常；已視覺檢查截圖。
- 題目及解析圖片燈箱每次開啟重新驗權，預設 80%、縮小至 70%、重設回 80% 通過。
- 正式瀏覽器收到 11 次 Worker 圖片回應，來源標頭為 `google-drive-via-cloudflare`；Supabase 圖片回應 0，沒有本機媒體端點參與。
- 重整後接回已保存 3／3 題；真實資料庫查核仍為原 3 筆錯誤答案。本輪驗收沒有新增送答，並非新增作答寫入的實測。
- 他人 attempt 的媒體請求被拒絕，匿名請求 401；390px 無水平溢出，頁面程式錯誤 0。
- 原測驗 11 組、新增媒體／Worker 9 組及正式簽票端到端 2 組測試全數通過。正式簽票測試覆蓋 Auth／RPC 後簽票、Worker 白名單、設定錯誤不回退與音檔原路徑。

證據存於 Git 忽略的 `automation/output/quiz/drive-production/`：部署及啟用紀錄、`browser-qa.json` 與三張正式頁面截圖。資料庫查核沿用 `drive-library/supabase-save-proof.json`，不提交學生資料或短效票證。

## 回復及後續

如實際不穩定，可執行 `node automation/quiz-drive-production-deploy.cjs --rollback`，只把後端 `QUIZ_IMAGE_BACKEND` 設為 `supabase`；保留 Worker、Drive、題庫與作答資料。不自動切換、刪除備援或升級方案。

這次完成的是已整理圖片的正式讀取，後續新題源仍須先整理、上傳並更新 Worker 白名單。教師 `freeze` 暫沿用原儲存流程，不代表新增圖片會自動移轉 Drive。錯題記錄及相似卷維持規劃。
