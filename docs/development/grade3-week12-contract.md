# 第12週網頁功能契約與驗收

2026-11-17，本機版完成，待PR審查與正式上線。使用者已採用五關情境設計並指示讀SOP開始製作網頁；尚未套用正式SQL或發布。

程式提交 `7e7cf024`，草稿 [PR #302](https://github.com/chianwu-hash/it-class-tcwu/pull/302)，尚未合併。GitHub連接器建立PR遭403，改用已登入的本機gh建立同一分支草稿，沒有重複PR。

## 2026-11-17 過關小慶祝補強

使用者檢視截圖後要求五關過關時有小動畫。原版僅成功訊息輕微縮放，現補「✓ 過關！」徽章彈出與六顆彩色星星散開、約1.1秒淡出；只在本題從未過關變成答對時播放，重複按檢查不連播，換題／重新開始後可再慶祝，答錯／修改時立即取消。特效以absolute定位且pointer-events:none，不改版面、不搶焦點、不擋按鈕；成功文字持續保留，減少動態效果下不播放特效。

從最新main重新建立 `codex/grade3-week12-celebration-20261117`／同名工作樹，再fast-forward納入未合併的PR302內容；完成後以fast-forward更新原PR，不直接push main。只改本週renderer／CSS／builder／產物與針對性驗收，不改登入、進度、花葉或SQL。

瀏覽器驗收涵蓋五關各兩組：檢查答對後徽章與六星共7個CSS動畫實際running、徽章transform隨時間改變、星星可見且移出徽章、逾時自動隱藏、重複檢查不重播、答錯／換題清理、減少動態效果仍保留成功文字，以及原生剪貼／undo／redo回歸。證據在新工作樹 `.chat-mode/evidence/clipboard/`。本機預覽仍為127.0.0.1:3000，來源已切換至新工作樹。

## 開發前契約

- [x] 以最新 origin/main `e98d6e4b` 新建 `codex/grade3-week12-web-20261117` 與獨立 worktree，不修改主工作區。
- [x] 三年級115-1、C類，`grade3/115-1/week12.html`。功能參考同學期第11週；視覺固定基準 `grade3/week20.html` 及115-1第09／10週，沿用藍綠頁首、黃徽章、彩色圓形圖示、白底圓角彩框與分色任務標題。
- [x] 先讀 dev-sop、shared-modules、page-types、new-page-checklist、high-risk-changes、agent-handoff、prompt-template、lesson-plan-sop、lesson-to-web-sop及每週圖卡／年級視覺SOP。
- [x] 本人學校Google登入：沿用 `initGoogleCourseAuth()`（內含 `initNavbarAuth()`）、`createGoogleCourseProgress()`、`initTypingChallenge()`、`initTypingTools()`。不重寫登入／打字服務，不用localStorage存進度。
- [x] 識別：`grade3-115-1`／`12`／`typing_task_6`／6關；主資料與替換題均使用 `{id,ans}`。正式成果只經現有RPC進本人student_progress，手動草稿走typing_drafts。
- [x] 文字五關為免登入、無評分當堂練習，只保留當頁記憶體、不增花葉；前3關必做，後2關延伸。原生選取／複製／剪下／貼上，結果與本輪操作證據共同判定；右鍵與快捷鍵均可。每關兩組換題，正確前不開放換題，復原／重做與操作狀態一致。
- [x] 正式中英打須登入、讀取成功才開放；逐關保存才解鎖。防貼上／拖入，正常逐字輸入與局部修改保留。重練不倒退、不重領。
- [x] 獎勵模式 `five-then-flower`：0～4關無花葉、前5關合計一葉、全6關再一花。同步前端目錄與登記SQL；本次不需更動資料庫函式，SQL未經核准不套正式。
- [x] 英打與考前練功坊連既有入口，不綁六關全過。期末範圍依現行平台分類與開放單元，不編造正式考試公告或題庫狀態。
- [x] 每週圖卡使用ChatGPT工作瀏覽器，附同年級參考、保留metadata、壓1920×1080 WebP q80、Cloudinary回讀；共用同頁燈箱獨立初始化。
- [x] 首頁最新週徽章、navbar activeWeeks、後台visibilityDefaults、努力樹目錄同次更新；navbar版本與練功坊產生器同步。
- [x] 無六年級作業／閱讀、無新互動測驗、無課堂即時開關。大型區段提供導覽及預設展開的收合，不能影響初始化。

## 待實作與驗收

- [x] 五關兩組，使用實際pointer拖曳、原生剪貼快捷鍵，驗證精準選取、複製保留來源、剪下移除來源、貼上位置、錯貼／復原／重做與跨題隔離；整段重打拒絕、改選取後撤銷完成、換題重新鎖定。
- [x] 本機合成Auth／RPC：匿名鎖定、OAuth回跳、本人名冊失敗／進度失敗鎖定、首關／魔王保存失敗重試、六關保存、重整接回、同帳號TOKEN_REFRESHED事件後可續存、手動草稿、六組換題不回寫、精準行次、登出、慶祝頁到努力樹與返回。這不是正式Google登入或真實雙分頁驗收。
- [x] 17項單元／隔離PostgreSQL檢查：本週登記冪等與衝突拒絕，六關本人RPC讀寫、匿名拒絕、另一學生隔離、重送不倒退、原週進度保持；前端與正式快照的garden_growth在0～4／5／6關零／一葉／一葉一花一致，舊baseline／seen與舊活動規則保持。
- [x] 圖卡已生成、目視、壓1920×1080 WebP q80，158,678 bytes；Cloudinary HTTP200及SHA256一致。公開資訊見 `grade3/115-1/images/week12/infographic.json`，原圖及生圖metadata留ignored證據區。
- [x] 圖卡燈箱1280／390：放大縮小百分比、真實mouse拖曳／滾輪／雙擊、重設／置中、CDP雙指縮放、Esc與關閉、焦點／捲動復原、再開100%；auth模組不可用時仍可開圖。
- [x] 第20週固定基準／本學期第10週／第12週1280與390同尺寸截圖、圖示字型實際載入、8個彩色圓形區段圖示及5個練習圖示、無標題重疊／橫向溢出、減少動態效果；已目視參考與新頁。首頁唯一最新徽章／卡片點入及合成隱藏／恢復通過。
- [ ] 真實可見教師帳號後台隱藏／顯示，與合成驗證分開記錄。
- [ ] Windows原生右鍵選單與實體Microsoft注音候選窗人工驗收；原生快捷鍵剪貼已實測，組字事件鎖定另以合成事件查核，不能冒稱實體候選窗已驗。
- [ ] 正式本週登記SQL套用、正式專用測試身分保存／接回／清理、目錄live全符、PR進main與main發布腳本。

## 來源與證據

- 新增：week12 HTML／JS／內容／剪貼模組／CSS、可重建builder、教案、五關設計紀錄、圖卡及prompt、17項測試與4支瀏覽器矩陣、本週限定登記SQL。
- 共用部分僅調整年級navbar週次、首頁最新卡、後台可見週次與努力樹活動設定；其餘學期HTML只更新navbar版本。練功坊builder重建的16個入口只改manifest版本，manifest僅改三年級navbar指紋；不改其他年級教材或作答流程。
- 生圖已核對可見帳號codex THPS，附三年級第01週參考。接受一次生成後未重送；原圖、metadata、Cloudinary上傳收據及回讀證據均在 `.chat-mode/evidence/image/`。帳號選單先前過早操作無作用，待互動初始化穩定再實際點擊後可讀取；參考 [Playwright互動初始化說明](https://playwright.dev/docs/navigations#hydration)，未將此推論當ChatGPT底層根因證實。
- `.chat-mode/evidence/clipboard/result.json`、`browser/synthetic-checks.json`、`infographic/result.json`、`style/result.json` 為各矩陣收據，截圖同子目錄。Console pageerror均0，正式學生寫入0。
- 原生adapter已負責身分／讀取鎖定及保存防線；共用模組的 `lockOnLoadError` opt-in只處理直接session分支，本頁不啟用、不修改共用模組。載入接回有既有250ms延遲捲動，測試等捲動穩定後再作真實點擊，不拿測試競速當成產品錯誤。

## 正式資料庫差異（唯讀查核）

`garden_catalog_manifest`實際比對：預期99項、正式98項，**唯一缺項** `grade3-115-1:12:typing_task_6`，設定差異0。待套用 `supabase/grade3_week12_typing.sql`，只冪等新增本週 `grade3_google_activities`與`garden_reward_catalog`各一列，衝突即中止；沒有CREATE FUNCTION、RLS／權限或學生進度修改。

完整發布preflight在開發worktree仍會被教材來源排除規則攔下，符合現行政策；上線必從乾淨main經發布腳本準備來源，不停用政策或把開發樹直接上傳。產生 `garden-catalog.sql` 不代表套用，本次沒有以整份目錄SQL覆寫正式資料。

本契約只記已完成證據，不將合成身分或本機測試冒稱正式保存或正式教師操作。
