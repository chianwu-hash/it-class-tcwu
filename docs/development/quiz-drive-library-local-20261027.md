# 已整理題庫圖片：Drive＋Cloudflare，本機接真實 Supabase

日期：2026-10-27。使用者確認三題 PoC 正常後，授權把目前已整理圖片改為 Google Drive＋Cloudflare Worker，登入／作答紀錄維持 Supabase，先在本機測試。

## 使用者確認的後續方向

2026-10-27，使用者了解 Cloudinary 較整合、但有免費額度及私有短效存取方案限制後，確認先沿用目前方向：**Google Drive 保存私有題庫圖片、Cloudflare Worker 驗權送圖／快取、Supabase 管理登入與作答紀錄**。

先依目前本機整合結果實際試用；若發現不穩定，再根據實際問題與用量討論 Cloudinary 或其他方案，不因存在其他選項就立即重做或搬移。本次確認是保存方向，沒有另行授權正式網站切換、刪除備援、付費升級或新增背景監控。

## 完成範圍

- 盤點既有三上數學第1～4單元、分數及三／六年級各科已整理期中題源的 `web-images`／`web-media` 圖片。排除光碟原始檔、Word／EMF來源、字型、截圖、QA、資料庫與音檔。
- 8,742 個本機圖檔按實際內容 SHA-256 去重為 **5,534 張、533,010,377 bytes（約533 MB）**，全數上傳完成。上傳前再次核對 SHA-256；Google 回傳的 MD5、大小、MIME 逐張與本機相符，檔案均非公開／非全網域共享。
- 學校帳號 `th990821@mail.thps.ntpc.edu.tw`，新增私有資料夾「考前練功房_已整理題庫圖片_20261027」，ID `1oM_o5G7v1WJrFUs8hrgahZVxuNrVda5R`。沿用前輪專用 OAuth client／新 grant，不複製既有作業收件授權。仍沿用原 GCP 專案與品牌，不宣稱完整應用程式層級隔離。
- Cloudflare 可見帳號 `Chianwu@gmail.com`；新增獨立 Worker **`dingxi-quiz-drive-library.nblm-book-audio.workers.dev`**。完整圖片白名單編譯成私有 Worker 模組（813,783 bytes），不把數千筆索引塞入環境變數，也不提供公開目錄端點。原三題 PoC Worker 保留。
- 既有32卷的題目／解析文件及原版本保持不變，正式 Supabase 圖片保留，沒有刪除桶或修改正式圖源。完整準備媒體上雲不代表未校對題型已開放學生。

## 本機功能契約

入口：[三年級本機選卷](http://localhost:3000/grade3/115-1/quiz-library.html)、[六年級本機選卷](http://localhost:3000/grade6/115-1/quiz-library.html)。依目前登入學生的名冊年級分流，維持每年級16份原卷。

| 項目 | 本輪處理 |
| --- | --- |
| 頁面／視覺 | 沿用既有 quiz-library／quiz 頁、原 navbar 與風格；未建立另一套答題 UI |
| 登入 | 原 `shared/auth.js`／`initNavbarAuth()`、Supabase Google session；沒有合成學生或本機進度替身 |
| 作答與判分 | 原 Supabase `quiz_action`、`quiz_attempts/quiz_answers`；沒有 localStorage 答題紀錄、不映射努力樹 |
| 題目／解析可見性 | 先驗 Supabase Auth `/user`，再以同一學生 Bearer 呼叫既有 `quiz_media_access`；未重寫或放寬 RLS／SQL |
| 圖片 | 私有 Drive → Cloudflare Worker → 瀏覽器；Supabase 只處理小型身分／授權資料 |
| 音檔 | 保留原版音檔與既有 Supabase 媒體路徑，未改傳 Drive |
| 燈箱 | 80%開啟、可縮小至70%／重設；每次開啟重新取得授權，避免短效網址到期後開圖失敗 |
| 揭答／末題 | 原後端揭答、選項亂序、答錯解析、動畫與末題先顯示正誤維持 |

本機啟動：設定 `QUIZ_CLOUD_DRIVE_MANIFEST` 為 `automation/output/quiz/drive-library/manifest.json` 絕對路徑，再執行 `node automation/quiz-cloud-server.mjs`。主機只綁 `127.0.0.1:3000`。

該 opt-in 設定會為本機 HTML 加入 `quiz-media-backend=drive` metadata。共用前端只有在 localhost／127.0.0.1 且有此設定時，才向同源 `/__quiz-drive-media` 讀取圖片授權；正式網站維持原路徑。關閉環境設定並重啟即可回復原本本機 Supabase 圖源。

## 授權與資料流

`automation/lib/quiz-drive-ticket-handler.mjs` 是本機開發用授權閘道。它不持有 Supabase service role，以目前登入學生的權杖做 Auth 與可見性 RPC 驗證，確認媒體 MIME／大小與已驗證 Drive 索引相符，才核發五分鐘 HMAC ticket。沒有簽署權限時不提供圖片網址；圖片未完成移轉不偷偷回退到 Supabase。音檔則明確回傳 fallback，交由原媒體服務處理。

Worker驗 ticket 的 audience、期限、媒體hash／fileId／MIME／大小，再查內部快取或 Drive 原檔；不先用公開快取繞過授權。Google token只留後端，不給學生、不寫題庫。Google下載只允許有限次HTTPS Google主機轉址，不將Bearer轉送內容主機；下載後再驗SHA-256。

**正式網站用的雲端 ticket API 尚未部署。** 本輪簽票服務在本機；登入、可見性檢查、判分與答案保存都是真實 Supabase。這符合「先本機測試」，不冒稱正式服務已切換。

## 驗收

ignored證據：`automation/output/quiz/drive-library/`。

- `inventory.json`、`upload-progress.json`、`manifest.json`：5,534／5,534 verified、533,010,377 bytes。預先批次配置 Drive file IDs，重試相同ID可查核409，不因回應遺失重複建檔；分批checkpoint可接續。Google限流／暫時錯誤有限退避重試，沒有輸出憑證。
- `catalog-check.json`：Supabase當時登錄25張圖片、24個音檔、41個既有版本，25圖均有本機原檔且MIME／大小相符。
- `deployment.json`：完整5,534圖白名單部署完成。未改其他Worker、網域、方案或原PoC。
- `worker-final-qa.json`：全部25張已入卷圖片，加各題源最大圖等共33張，經Worker下載並核對SHA-256全數通過；最大樣本4,479,862 bytes。第一輪有兩筆客戶端網路中斷／stream terminated，已保留 `worker-first-pass-qa.json`；僅重試這兩筆後通過，不隱藏首次錯誤。未宣稱所有5,534圖均經Worker逐張下載，完整上傳則有逐張Google MD5驗證。
- `browser-qa.json`：可見本機測試學生登入、三題故意答錯、題目與解析圖燈箱、80%→70%與重設、原生表格、末題回饋、重整接回3／3、390px不溢出均通過；pageerror 0。16次Worker圖片回應，8次Supabase控制資料回應，**Supabase圖片回應0**。
- 未揭答解析403、其他attempt403、匿名401；Worker過期／缺少票證401、直接快取路徑404。
- `supabase-save-proof.json`：直接查真實資料庫確認此測試學生在獨立驗收場次有3筆答案，皆為本次測試故意答錯，與重新整理後畫面一致。
- 獨立驗收場次 `985b093a-dbc5-421e-bdf2-fdbacb665c6b`、三題來自已固定的三上數學第1～3單元。另新增一份測試bank/version，使用classroom模式避免混進32份正式選卷清單；原41版本文件雜湊未變，沒有對原單元場次送答。
- `audio-qa.json`：真實學生授權音檔明確fallback至Supabase，取得原音檔HTTP200、SHA-256相符；沒有送出英語答案。
- 原11組測驗測試＋新增9組媒體／簽票測試通過。已視覺核對真實雲端學生答錯畫面。

## 邊界與後續

此輪不切正式網站、不刪Supabase備援圖片、不替使用者升級付費，也沒有將所有原始題目全數上線。正式切換前需將簽票閘道放到受控雲端後端、設定其獨立金鑰與Origin，再驗證正式網域及學生跨裝置使用；不能把目前僅本機的簽票端點直接當正式服務。

既有DPAPI與Worker secrets保存授權；索引與原題只在ignored輸出資料夾，不含Google／Supabase登入權杖。原GCP app權限隔離及更大規模長期CPU／流量量測仍是後續工作；本輪沒有把小規模通過解讀為無限免費或正式SLA。
