# 學校 Drive 教師授權設定

日期：2026-09-09。此階段只連接教師 Drive，不實作學生上傳、評比或努力樹。

## 已確認的雲端資源

- Google Cloud：`dingxi-it-homework-115`（Dingxi IT Homework），編號 `573433424221`。
- 組織與收件帳號：`mail.thps.ntpc.edu.tw` / `th990821@mail.thps.ntpc.edu.tw`。
- Drive API 已啟用；OAuth 品牌「頂溪資訊作業收件」已建立，目標對象為內部。
- 宣告範圍：`openid`、`userinfo.email`、`drive.file`。
- 2026-09-09 Drive 可見容量：已用 128.72GB / 500GB。
- Supabase 專案：`upxgyusodibaqcrocdzj`。
- Vercel 主網域：`https://it-class-tcwu.vercel.app`，已從專案 Overview 確認。
- 網站教師白名單仍由既有 `public.is_teacher()` 控制；目前前端白名單為 `chianwu@gmail.com`。

## 功能契約（類型 E 教師後台）

- 新頁 `admin-drive.html`，參考 `admin-grades.html` 的教師頁型，以及 `shared/navbar-auth.js` 的事件代理。
- 不新增課程 navbar / 週卡；以既有教師後台返回連結和 `initNavbarAuth` 處理身分 UI。
- 不直接綁定 login/logout/reset；不修改 `auth.js`、學生登入 scope、教師白名單或既有回呼。
- `student_progress`、`guest_progress`、週次可見性、闖關解鎖、努力樹：此階段全部 N/A。
- 僅教師可呼叫後端，後端以 Supabase Auth `/user` 驗證 session，再呼叫既有 `is_teacher()`。
- 不授予學生或一般 authenticated 角色任何 Drive token/state 表權限。
- Google 回呼先由 HTML 的第一個同步腳本取出參數並清除 URL，之後才載入共用 Supabase Auth；避免 `detectSessionInUrl` 誤將 Drive code 當成學生登入 code。
- callback 與開始操作使用同一分頁。sessionStorage 只存十分鐘的 OAuth 證明，不存 Google token 或學生進度。
- callback 的 code 由教師頁 POST 到 Edge Function；交換 code、驗證身分、refresh 測試、Drive about 查詢、加密均在後端完成。

## 部署順序

1. 在 Supabase SQL Editor 執行 `supabase/drive_connections.sql`。這是新增獨立兩表及兩個僅 service_role 可執行的函式，不修改原有表。
2. 建立 Google OAuth「網頁應用程式」用戶端，名稱建議 `Dingxi Homework Web`。
3. Authorized redirect URI 精確填：`https://it-class-tcwu.vercel.app/admin-drive.html`。
   本流程不用瀏覽器 Google SDK，不需新增 JavaScript origin。不要使用既有 Supabase `/auth/v1/callback`。
4. 將以下設定存入 Supabase Edge Function Secrets（不得存入 Git、公開靜態檔案或聊天記錄）：
   - `DRIVE_CLIENT_ID`：此新 OAuth 用戶端 ID。
   - `DRIVE_CLIENT_SECRET`：此新 OAuth 用戶端密鑰。
   - `DRIVE_REDIRECT_URI`：上方正式回呼網址。
   - `DRIVE_TOKEN_KEY`：密碼學亂數產生的 32 bytes，以標準 Base64 編碼；保存在受控密鑰管理處。
   - `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`：平台內建後端環境變數。
5. 部署 `drive-connect`：`supabase functions deploy drive-connect --project-ref upxgyusodibaqcrocdzj`。
   `supabase/config.toml` 設 `verify_jwt=false`；原因是支援 publishable key / 新 JWT，函式內每次仍執行真正 session + 教師驗證。不得刪除此驗證。
6. 網站只發布 `admin-drive.html`、`shared/admin-drive.js`、`shared/admin-drive.css` 及 `.vercelignore` 的後端目錄排除規則。不將其他未提交內容混入。
7. 教師開啟正式頁，用現有網站教師帳號登入，按「連接學校 Drive」，自行完成 Google 同意；必須選指定學校信箱。
8. 成功後驗證重新整理仍有連接紀錄；此時只有連接完成，尚不能收學生作業。

## 憑證與失敗處理

- refresh token 採 AES-256-GCM 加密，隨機 IV，AAD 綁定網站教師 ID 與學校信箱；資料庫只有密文，金鑰只放後端 secrets。
- access token 與授權 code 僅在單次請求記憶體中使用，不保存、不回傳前端、不記錄上游錯誤 body。
- `status` 只回傳已保存授權的信箱與時間，不代表持續健康監測；未來收件端必須處理 Google 撤銷/到期並提示重新連接。
- state 儲存雜湊、綁定 user + browser proof、十分鐘期限；資料庫以 DELETE RETURNING 原子消耗。每位教師最多一個未完成流程，新發起會取代舊流程。
- 綁定錯誤帳號、缺少 drive.file/refresh token、refresh 或 Drive 查詢失敗時，都不覆蓋既有連接。
- 網路中斷後，先手動更新狀態確認；若未保存，重新發起授權。已消耗的 state 不重試交換。
- 不自動撤銷被拒絕的 Google grant，避免意外撤銷既有有效收件授權；可由教師至 Google 帳號管理移除不需要的授權。
- 金鑰更換前需重新加密既有 token，或安排重新授權；不可直接覆蓋 key 導致既有密文失效。

## 驗證與目前界線

- 自動化後端測試：`node --test automation/tests/drive-connect.test.mjs`，22 項通過（含新舊 Supabase 平台金鑰格式）。
- PostgreSQL 引擎驗證：`node --test automation/tests/drive-sql.test.mjs`，使用外置安裝的 PGlite，驗證重複套用 SQL、anon/authenticated 權限拒絕、service_role 存取、過期、不同使用者/證明、一次性 state 及帳號 check constraint。此測試通過，但仍需線上部署驗收。
- 瀏覽器驗證：`node automation/tests/drive-browser.cjs`，使用同一 AI 工作瀏覽器及 `http://localhost:3000` 的模擬 Auth/API。未登入/學生拒絕、教師讀取、callback 清理先於 Supabase 模組、證明用後刪除、重複 callback 拒絕、390px 無水平溢位均通過，無 pageerror。
- Deno：`npx deno check supabase/functions/drive-connect/index.ts` 通過。
- 公開資產引用檢查：`node automation/check-vercelignore-references.js` 通過；新 `supabase/` 排除規則未切斷公開頁面引用。
- 正式上線驗收：未登入 / 學生拒絕、教師正確帳號、錯誤學校帳號、取消、重新連接、重複 callback、切分頁不輪詢、不洩漏 token。
- 真實 Google 授權已由教師完成；背景存取與授權紀錄持久化驗證通過，詳見下節。

## 2026-09-09 線上部署紀錄

- 使用者明確同意建立 OAuth 用戶端、設定後端密鑰、新增線上資料表、部署連接頁與後端。
- OAuth 網頁用戶端 `Dingxi Homework Web` 已建立，回呼為 `https://it-class-tcwu.vercel.app/admin-drive.html`。
- 用戶端密鑰與隨機 token 加密金鑰已存入 Supabase 四項 `DRIVE_*` Secrets；本機備份位於 `%LOCALAPPDATA%/Codex/secrets/dingxi-drive/oauth.dpapi`，透過目前 Windows 使用者的 DPAPI 加密。沒有明文秘密進入 repo。
- Supabase SQL Editor 成功執行 `drive_connections.sql`；新表以 publishable key 查詢均回覆 HTTP 401 / SQLSTATE 42501（permission denied）。
- `drive-connect` 已由 Dashboard 發布，關閉「Verify JWT with legacy secret」並保存；函式內仍保留每次 Auth `/user` + `is_teacher()` 驗證。
- 後端相容平台新式 `SUPABASE_PUBLISHABLE_KEYS` / `SUPABASE_SECRET_KEYS`，亦保留舊格式；新式 secret key 只放 apikey header，不偽裝為 JWT。
- 線上後端測試：本站 Origin + 無登入回覆 401 `login_required`；其他 Origin 回覆 403 `origin_not_allowed`。
- 網站從乾淨 `3609aac5b86df4eec3fe45c941f19f081469b63d` 發布副本加入四個網站變更，不包含工作區其他未提交內容。
- Vercel deployment：`dpl_38wvKhbtjpMwPB2egiNKdCM9zsfR`，已 promote 到正式網域。
- 正式頁、JS、CSS、六年級 Week 01、既有 auth 模組均 HTTP 200；`/supabase/functions/drive-connect/handler.mjs` 為 404，不公開後端來源。
- 教師已自行完成 Google 授權；正式頁顯示「學校 Drive 已連接成功，背景存取已驗證」。網站教師帳號為 `chianwu@gmail.com`，授權收件帳號為 `th990821@mail.thps.ntpc.edu.tw`。
- 真實回呼已通過後端 Google 身分、refresh token 更新與 Drive about 帳號驗證，並保存加密授權。連接時間為 2026/9/9 下午 4:16:16（Asia/Taipei）。
- 手動更新狀態與整頁重新整理後，皆顯示已保存上述學校帳號的授權；網址沒有殘留回呼參數。驗收只讀取頁面狀態，未擷取 token 或資料庫密文。
- 學校 Drive 連接已完成；學生上傳、教師評比與努力樹串接尚未實作。

### Dashboard 編輯器注意事項

Monaco 編輯器中以逐字輸入方式塞入大量 JavaScript，可能觸發自動補括號與縮排，造成內容與原始檔不一致。本次第一次函式 bundle 因此失敗，沒有發布成功。
修正時比較可見編輯器文件與原始檔，再以 Monaco 文件 `setValue` 寫入完整檔案；比對一致後重新部署成功。以後應優先 CLI 或編輯器原生文件替換，不能只憑「貼入成功」訊息判定內容正確。

### 瀏覽器測試排查筆記

初版 mock 在 `null` 身分通過，換成學生物件後停在初始化。增加階段診斷、禁止 HTTP 快取和模組快取後，確認伺服器已送出學生資料，仍有語法問題。
根因是動態生成 `async()=>${JSON.stringify(actor)}`，物件缺少包圍括號，會被解析為函式區塊而非回傳物件。
修正為 `async()=>(${JSON.stringify(actor)})`，全部瀏覽器情境通過。
下次生成 JS mock 模組時，要同時測試 null 與物件值，失敗時先檢查 pageerror，不要只延長 DOM 等待。
參考：https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions

官方參考：
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://supabase.com/docs/guides/functions/auth
- https://supabase.com/docs/guides/functions/secrets
