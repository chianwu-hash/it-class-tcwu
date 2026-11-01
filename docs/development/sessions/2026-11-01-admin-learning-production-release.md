# 學生學習檔案後台正式發布

> 後續新增的「全班剩餘解鎖條件」與新版面已獲授權發布，並完成兩班及五種視窗寬度的正式站複驗，見[新增功能正式發布紀錄](2026-11-01-admin-learning-class-unlock-gaps-release.md)。下方保留既有功能的發布與複驗紀錄。

日期：2026-11-01。使用者明確授權「把後台功能上線」，取代前階段僅本機限制。

## 最新：正式站 Google 登入與後台複驗完成

2026-11-01，使用者要求接續完成正式站 Google 登入複驗。原02分身由另一工作占用；使用者明確同意改用空閒01分身，另開本任務分頁，沒有接管原02頁面。

- 在 `https://it-class-tcwu.vercel.app/admin-learning.html` 按教師登入，經正常 Google 選帳號流程選取預期教師，回到同一正式網址，頁面確認 `chianwu@gmail.com` 並成功讀取名冊。沒有擷取密碼、搬移 token、模擬 session 或使用本機橋接。
- 正式網址完整14類個人檢查通過：三／六年級各一位的年度名冊與摘要、週次、打字進度／事件、固定版本題目與選項順序、學生原答、錯題篩選、兩份試卷共10張圖片、390px手機版與腳本錯誤0。
- 正式網址全班表驗證301全21人、604全22人，逐列花葉／等級／完整解鎖清單與個人模型一致；未連結者保留不假報第一級，三種排序、重新讀取、搜尋不影響全班、表末學生個人明細一致、快速切班舊回應不覆蓋及手機捲動皆通過。
- 個人努力樹與剩餘解鎖條件在正式網址另行驗證：三年級樣本58葉9花為第一級且顯示還差1朵花；六年級樣本48葉13花為第二級，四項已解鎖功能與來源判定相符。其他九項寵物／小窩門檻、已新增與剩餘數量的文字均與共用模型一致。實際樣本沒有已存寵物項目，該已取得權限分支仍以先前合成測試為證，不擴張宣稱。
- 多次從正式網址重載與切課程後仍保留教師登入，所有查詢直接呼叫正式教師RPC／媒體Edge；沒有回到localhost驗證。本輪未修改runtime、部署、學習成果、成長或解鎖紀錄。分頁留在正式後台，測試攔截與自動化連線已移除，租約由保護入口釋放。
- 新證據彙整保存在 ignored `automation/output/admin-learning-release-20261101/formal-verification/`：`google-login-report.json`、`real-google-live-report.json`、`class-rewards-browser-report.json`、`garden-status-browser-report.json`。報告標示正式 origin，可與先前localhost候選驗證區別；截圖只拍統計／功能區，不保存學生姓名或原答。完整個人檢查的報告初寫在父層，核對正式 origin 與通過旗標後複製至本目錄，並修正產生器的輸出路徑替換。

以下初次發布時「正式Google複驗未完成」為歷史狀態，已由本節的正式站成功紀錄取代。

正式入口：<https://it-class-tcwu.vercel.app/admin-learning.html>。舊教師後台 `admin-progress.html` 已加上「學生學習檔案・全班花葉」連結。範圍維持已驗證的三／六年級 115 上學期。

## 正式架構與發布來源

- 核心教師查詢：`supabase/admin_learning.sql` 的 `admin_learning_action`、內部紙卷投影、`admin_learning_media_access`。
- 花葉與成長：新增 `supabase/admin_learning_rewards.sql` 的 `admin_learning_rewards`，提供個人花葉、努力樹等級／解鎖及全班查詢。由與本機相同 SELECT 編譯，`STABLE SECURITY DEFINER`，每次先檢查 `auth.uid()`／既有 `is_teacher()`，只授權 authenticated 呼叫；匿名及學生拒絕，內部 helper 不授權瀏覽器。
- 正式端使用標準 Supabase JWT／publishable key 呼叫教師 RPC，不發布 Windows Credential Manager／個人 Management token／本機橋接。目錄由正式 RPC 內部讀既有 immutable `garden_item_catalog()`，不開放私有目錄函式權限。
- 新 Edge `admin-learning-media` 只驗權及簽章讀取，沿用專案既有 CORS、Drive worker 與簽章秘密；未改學生端 `quiz-media`、Worker、Storage 或其他 Edge。JWT 在 PostgREST 教師／名冊／固定卷媒體 RPC 驗證；`--no-verify-jwt` 僅停用不相容的閘道檢查，不跳過應用驗權。
- `automation/admin-learning-release.mjs` 提供來源快照、準備、回滾證明、正式套用與來源核對；`automation/lib/admin-learning-production.mjs` 產生正式唯讀 RPC。正式 DB 回滾演練與套用皆在 repeatable-read 交易中，比對進度、事件、試卷、答案、葉花、成長、解鎖、名冊摘要，確認沒有資料異動。沒有提交模擬作答、重置、成長遷移或解鎖發放。
- 初始來源是當時最新正式 `dpl_8RRMxcuQ9ozADDWWC77BgYF5isFa` 的全部 773 檔，每檔 SHA-1 符合正式來源；新增 7 檔後共 780 檔。僅本功能 7 個新 runtime 檔及舊後台入口連結共 8 檔納入變更，未使用主工作樹整包覆蓋，保留四年級題庫、努力樹與同期更新。
- 最終部署：`dpl_FNyxToDFZyB57RQuRzAyQbQnRfJD`，部署網址 `it-class-tcwu-hucxtzz7z-chianwu-4755s-projects.vercel.app`。最後教師切換補正重新擷取已發布的 `dpl_6SxKAWDKCZ8bCtnK16WQm1TDUW2r` 全 780 檔，只更新本功能 main/API；完整來源與 public 正式網址的 8 個檔案逐檔核對相符。
- Vercel MCP 對正式 alias／promote 回覆404，改用專案既有 `vercel --scope chianwu-4755s-projects` CLI，核對相同 project/team 後部署及 promote，未調整方案、保護設定或環境變數。

## 相容性修正與驗證

- 正式渲染器比主 repo 舊版新，使用帶版本號的媒體模組。首次完整圖片驗證因此失敗，分段驗權與簽章均正常；後台改把 resolver 透過既有 `mediaScope` 契約直接交給渲染器，與目前 dialog／學生 epoch 綁定，不改正式渲染器或學生端模組。修正後完整14類實際流程、兩份試卷共10張圖片通過。
- 正式站原先已有學校學生登入時，集中登入入口會消費返回網址並沿用原 session，導致教師按鈕返回鎖定頁。後台現在於已有非教師 session 時使用共用 `signInWithGoogle({returnTo})` 的選帳號流程；未登入仍走集中入口。共用 Auth、首頁、navbar 不改寫，新增對應測試。
- 真教師登入、直接正式 RPC 的候選本機驗證：三／六年級各一位的年度名冊、摘要、週次、基礎歷程、固定題目與選項順序、原答、錯題、10張圖片、手機390px通過。全班301（21人）、604（22人）的花葉／等級／完整解鎖清單、排序、重讀、搜尋獨立、個人明細一致、快速切班舊回應失效通過。
- 正式網址已驗證 HTTP200 與發布 byte hash。最後在正式網址的 Google 登入複驗，因工作瀏覽器 `Runtime.callFunctionOn` 逾時中斷；該舊租約續約遭拒後已停止瀏覽器動作，重新取得同一02分身又遇啟動失敗。沒有借用其他分身／使用者Chrome、讀取儲存的登入憑證或繞過占用協定。正式網址登入切換補正已有測試且已發布，但該最後一輪真實Google複驗未完成，不能宣稱已通過。
- 最後28項Node/PGlite測試全部通過；直接正式RPC完整14類個人流程與兩班全班表的瀏覽器驗證，是以發布候選在localhost:3000、真正教師Google session、正式教師RPC與正式Edge完成，非本機Management橋接，也不冒稱整套流程已於正式網址重跑。
- 證據：ignored `automation/output/admin-learning-release-20261101/`，含交易演練／套用報告、來源核對、public hash 核對、直接 RPC 瀏覽器測試報告與發布完整包。報告只記錄數量／狀態，不公開學生姓名、帳號、答案或票證。

本輪未 stage／commit／push 主工作樹；主 repo 有大量不相關異動，後續發布仍須取當時最新完整正式來源合併，不能從舊本機樹直接覆蓋。
