# 六年級作業收件

## 功能契約

- 年度固定 grade6-115-1；學生頁 grade6/115-1/homework.html 為登入後操作頁，參考同年度 navbar 與 shared/admin-drive.js 的身分生命週期。教師頁 admin-homework.html 參考 admin-drive.html（類型 E）。
- 使用原 navbar.js、initNavbarAuth；作業頁 opt-in 顯示首頁型 navbar 登入列，不改既有週頁登入行為。
- 作業進度獨立 homework_* 表；不改 student_progress、guest_progress、打字、測驗或週卡可見性。作業開放是收件業務狀態，不是外連的課堂即時開關。
- 名冊以 student_enrollments 的 115 年六年級登入信箱匹配，班級座號不可自行輸入。草稿由老師明確開放。沒有作業時顯示空狀態。
- 單次單檔，預設最多 100 MiB，接受 MP4/WebM/MOV、PDF、圖片、Office/ODF、Scratch、文字與 ZIP。由 homework_settings.max_file_bytes 調整，硬上限 500 MiB。每段 4 MiB 經後端傳給 Drive resumable upload，授權 token 與 resume URI 不回傳瀏覽器。中斷可在 24 小時內選同檔接續。
- Drive 檔案不公開分享；老師使用學校 Drive 開啟，學生只讀自己的提交狀態與評語。
- 重交保留所有舊檔；最新版本重新待評。評比有版本檢查，防止老師評到舊版本。繳交/評比事件和最新狀態在同一資料庫交易保存。
- 努力樹從後端作業紀錄推導：每份作業一片繳交葉、最新版本過關一朵花，不把老師判定寫進學生可自行編輯的 student_progress。
- 失敗不顯示成功；重送使用固定 Drive 檔案 ID，避免網路中斷造成重複檔案或獎勵。未登入不能上傳，無自動輪詢，無 localStorage 進度。
- 無新增課本題目、AI 圖片、打字/測驗/解鎖區，相關契約 N/A。

## 部署與驗收

先執行 supabase/homework.sql，再部署 homework Edge Function（verify_jwt=false；函式內驗證 Auth，RPC 再驗證身分），沿用 DRIVE_* secrets。最後發布前端。
尚未部署或完成驗收時不可宣稱正式收件可用。

驗收涵蓋：角色/名冊/班級隔離、匿名與學生拒絕評比、同檔重試與重交、過期、關閉作業、評比版本衝突、資料庫保存失敗、努力樹去重與舊課程回歸、手機排版。

### 2026-09-09 驗證紀錄

- `node --test automation/tests/homework-sql.test.mjs automation/tests/homework.test.mjs`：6 項通過，其中 SQL 使用真正 PostgreSQL 引擎 PGlite；包含 20 MiB MP4 預約、100 MiB 邊界、角色/班級隔離、重試事件去重、重交和評比版本檢查。
- 後端 handler 模擬 9 MiB 分段上傳：4 MiB 已寫入但回覆遺失，依 Drive Range 接續；hash 錯誤與資料庫失敗均不會完成繳交。
- `node automation/tests/homework-browser.cjs`：同一 AI 工作瀏覽器 localhost:3000，9 MiB 影片中斷/接續、重整待評、老師評比、葉花去重、舊打字模型、refocus 不取資料及 390px 手機版面通過。這些是模擬 Auth/API，不能當作真實學生上傳驗收。
- Deno check 與公開資產引用檢查通過。
- Supabase SQL Editor 已成功套用 homework.sql；homework Edge Function 已發布，內部使用 Auth /user 和 RPC 身分驗證，legacy JWT gateway 關閉並保存。
- 尚無真實学生交件紀錄；正式站部署後需用名冊中的學生帳號完成第一筆實際影片上傳驗收。

### 維運與範圍

- `homework_events` 是不可由學生直接寫入的繳交/評比歷程；努力樹以 homework_submissions 最新狀態推導。同檔重送不重複記錄，重交保留葉並重新等待過關花。
- 每位學生每份作業每小時最多建立 10 次上傳；新嘗試取代未完成嘗試。上傳把檔案留在 Drive 後才原子保存狀態；在關閉/逾期邊界可能留下未入帳檔案，不會自動刪除老師 Drive 檔案。
- 未完成的 resume URI 僅在 service_role 可讀表內，前端只保存臨時 handle/hash/名稱到 sessionStorage。超過 24 小時改為重新上傳。未新增自動清理或容量通知。
- 容量設定以 `homework_settings.max_file_bytes` 為準，單段固定 4 MiB；不需重新授權 Google 即可調整限制。建議先以真實教室網路測量大檔速度。

### 管理頁空白排查

Supabase 原分頁導航後空白；等待、重載及略過快取未恢復，JS 資產 HTTP 200 且未捕捉到 pageerror。依官方排查方向，在同一 AI 工作瀏覽器建立新分頁後正常，沿用既有登入；沒有清除 cookie/profile。根因未確認，只確認是原分頁特有狀態。
參考：[Supabase 管理頁無法載入](https://supabase.com/docs/guides/troubleshooting/supabase-dashboard-not-loading-project-not-loading-on-dashboard-LfMq9F)。

參考：[Google Drive 上傳](https://developers.google.com/workspace/drive/api/guides/manage-uploads)、[預先產生檔案 ID](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateIds)。
