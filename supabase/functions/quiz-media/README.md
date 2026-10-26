# 測驗媒體版本保存（候選，僅完成本機驗證）

2026-10-24候選開發階段未套用正式SQL、未建立正式儲存桶、未部署Edge Function或網站。2026-10-25使用者另行授權單張Storage試傳：真實私有`quiz-media`桶已建立，單張上傳／簽署下載及未授權拒絕通過；尚未套用下述候選桶限制、正式SQL或本函式，亦非學生OAuth／揭答的完整整合驗收。詳見`docs/development/supabase-storage-smoke-20261025.md`。

## 流程

教師與學生透過 `shared/quiz-api.mjs` 共用正式登入 transport。每次請求從共用 Supabase SDK 取得目前 session；身分不符、失效或回應期間換人就拒絕。教師固定版本改走本函式，其他作答仍走 `quiz_action`。集中 Google 登入、返回網址及學生 navbar 都沿用原本模組。

`freeze` 先呼叫 Auth `/auth/v1/user` 驗證 Bearer，再用本人權杖取得自己的草稿。逐一保存材料、題幹、選項及解析的圖片／音檔，SHA-256 路徑為 `<owner UUID>/<digest>`，不覆寫既有物件；重複檔案仍比對既有位元組雜湊。最後由 service role 專用交易同時寫入媒體 metadata 與固定版本，重新核對原始草稿與 revision。原草稿保留可編輯的來源網址；失敗不產生半份版本。重試已成功的 revision 直接回傳原版本，不重抓可能變動的來源。

文件只保存 `https://quiz-media.invalid/<owner>/<digest>` 識別引用，該保留域名不會被當成實際下載主機。預覽時即時換成短效簽署網址，不把簽署網址保存或匯出。學生的 `read` 重用 `quiz_action('resume')` 的名冊、本人及揭答投影；未揭答的解析媒體即使猜到引用也拒絕。已發出的簽署網址可在 60 秒內使用，登出或關場不會立即撤銷這個既有能力；音檔長時間停留後網址失效時可按「重新載入媒體」重新驗權。

## 正式環境候選準備（本次不執行）

1. 審核並依序套用 `supabase/quiz.sql`、`supabase/quiz-media.sql`、`supabase/quiz-storage.sql`。`config.toml` 的新函式候選設定關閉平台舊 JWT gateway 檢查，以支援目前 key 類型；handler 仍強制呼叫 Auth `/user` 驗證本人，不能移除或以瀏覽器身分取代。
2. 儲存桶 `quiz-media` 必須是 private；不可新增學生／教師直接讀寫物件的 policy，不可使用 public URL。正式物件只由此函式使用 service key 保存與簽署。現有同名桶與 policies 須在審核時另行確認。
3. 函式環境：`SUPABASE_URL`、`SUPABASE_ANON_KEY`／`SUPABASE_PUBLISHABLE_KEYS`、`SUPABASE_SERVICE_ROLE_KEY`／`SUPABASE_SECRET_KEYS`。私密 key 僅放在函式環境。
4. `QUIZ_ALLOWED_ORIGINS`：精確網頁 origin，以逗號分隔、不含尾斜線。`QUIZ_MEDIA_SOURCE_HOSTS`：精確、可信任且解析為公開網路的 HTTPS 主機，以逗號分隔。預設來源清單為空，全部拒絕；不要填入內網、可控制 DNS 的不可信主機或萬用字元。網址不可帶帳密／自訂 port，拒絕 IP、localhost、`.local` 與重新導向。
5. PNG/JPEG/GIF/WebP、MP3/WAV/Ogg；同時檢查檔頭及 Content-Type。單檔 8 MiB、新下載合計 32 MiB；不支援 SVG、轉碼或完整惡意檔案掃描。固定前應透過教師預覽檢查來源、聲音及內容。

資料庫版本固定交易與 Storage 上傳無法跨服務原子提交。失敗可能留下未被版本引用的私有物件；不會公開，暫無自動清理，未來清理前須查版本引用。既有本機測試的舊外部引用版本不會自動改寫；重新固定新 revision 才會保存媒體。JSON 備份含媒體引用，需保留對應儲存桶，不是含附件的離線封裝。

## 本機驗證

`npm run quiz:test` 執行 6 組測試，Auth／Storage 是替身，候選 SQL 由 PGlite 真實執行。`npm run quiz:dev` 僅監聽 loopback，以合成教師／學生工作；預設媒體來源為 `https://quiz-fixture.example.invalid/*.png`／`*.wav`，由本機產生有效圖片與靜音音檔，沒有對外連線。其他公開來源需由啟動程序明列 `QUIZ_MEDIA_SOURCE_HOSTS`，不會自動開放。

`automation/tests/quiz-auth-media-browser.cjs` 必須經登記 AI 工作瀏覽器租約和 `D:/ai-browser/run-background.cjs`，傳入既有教師頁精確 TargetId。它原樣載入正式入口、`auth.js`、`navbar-auth.js` 與學期 navbar，僅以合成 SDK、Auth／Storage 及本機 RPC 取代雲端。涵蓋集中登入返回原場次、教師固定媒體版本、原生圖片／WAV 解碼、揭答後音檔、重整接回、換學生隔離與登出清空；結果在忽略版控的 `automation/output/quiz/auth-media-browser-qa.json`。不是實際 Google OAuth、正式 Supabase 或教室多機驗收。

設計參照官方文件：[私有儲存桶](https://supabase.com/docs/guides/storage/buckets/fundamentals)、[媒體下載與簽署網址](https://supabase.com/docs/guides/storage/serving/downloads)、[Auth 伺服器驗證](https://supabase.com/docs/reference/javascript/auth-getuser)。
