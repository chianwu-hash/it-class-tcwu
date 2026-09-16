# 高風險變更清單

> 最後更新：2026-09-15
>
> 以下任何改動都可能牽動多頁。修改前先看清風險，修改後執行指定的最低驗證。

---

## 1. `grade3/navbar.js` 的 `renderNavbar()`

**風險**：`renderNavbar()` 每次執行都會 `existingNav.remove()` 然後重新插入整段 nav HTML。所有**直接綁定在 nav 按鈕元素上**的事件 listener 全部消失。

**觸發時機**：
1. 頁面載入時同步觸發一次
2. 非同步載入 `week-visibility` 完成後再觸發一次

**影響範圍**：所有 grade3 週頁面（week03–10）。

**修改後最低驗證**：
- 任何 grade3 週頁面，登入按鈕點一次確認有反應
- 登入後重整頁面，確認 email 顯示正確

---

## 2. `grade3/navbar.js` 的 `authBarHtml`

**風險**：`authBarHtml` 裡的 button / div id（`login-btn`、`logout-btn`、`auth-status`、`reset-progress-btn`、`admin-btn`）被 `navbar-auth.js` 和 `typing-challenge.js` 同時依賴。任何 id 改名都會讓這兩個模組靜默失效（找不到元素，`?.` 不報錯但無作用）。

**修改後最低驗證**：
- grade3 任意一頁完整走登入 → 顯示 email → 登出流程
- 若有打字闖關：確認重置按鈕出現（登入後）、點了有效果

---

## 3. `shared/navbar-auth.js` 的事件代理

**風險**：`document.addEventListener('click', handleClick)` 是整個 auth 互動的骨幹。若被移除、執行順序錯誤、或同一頁面呼叫了兩次 `initNavbarAuth()`，登入/登出行為會異常（雙重觸發或完全失效）。

**修改後最低驗證**：
- 登入 → 登出完整流程在 grade3 和 grade6 各走一次

---

## 4. `shared/course-navbar.js` 的 HTML 結構

**風險**：nav 的 HTML 結構被 `grade3/navbar.js` 和 `grade6/navbar.js` 兩個地方呼叫生成。若 HTML 結構改動（例如改 flex 容器層級、移動 auth bar 位置），可能影響所有頁面的版面。

**修改後最低驗證**：
- grade3 和 grade6 各開一個週頁面，確認 navbar RWD 版面正常

---

## 5. `shared/auth.js` 的 `beginCentralizedLogin()`

**風險**：所有頁面的登入最終都走這個函數。它依賴 `window.location.origin + entryPath` 組成跳轉 URL（預設 `/index.html?login=1`）。若 `entryPath` 被改，或 `index.html` 的 OAuth callback 邏輯被移除，**所有頁面的登入都會壞**。

**修改後最低驗證**：
- 從一個週頁面（不是首頁）未登入狀態點登入，確認 OAuth 完成後**跳回原始頁面**（不是首頁）

---

## 5.1 Supabase 分頁切回 / refocus lifecycle

**風險**：Supabase auth event 可能在分頁切回前景時重新觸發，尤其 `SIGNED_IN` 不只代表剛登入，也可能代表既有 session 被重新確認。若在 `onAuthStateChange`、`pageshow`、`visibilitychange`、`focus` 中無條件重讀資料或 reload，會造成後台表格閃爍、按鈕延遲、typing 進度保存 timeout。

**修改後最低驗證**：
- 切到別的分頁再切回，確認頁面沒有自動 `window.location.reload()`。
- 後台表格切回後不應出現「讀取資料中...」，除非使用者明確按「重新整理」或改篩選條件。
- 中英打闖關切分頁後送出，必須能寫入 `student_progress`。
- 詳見 `supabase-tab-resume-incident.md`。

---

## 6. `student_progress` 表的欄位 / RLS 政策

**風險**：`student_progress` 的 unique constraint 是 `(user_id, week_code, activity_key)`。若新頁面使用重複的 `weekCode + activityKey`，會覆蓋其他活動的進度記錄。若 RLS 政策被修改，學生可能看到別人進度或寫入失敗。

**修改後最低驗證**：
- 用測試帳號在新頁面打完一關，查 Supabase 確認 `student_progress` 寫入正確的 row（欄位值對、沒覆蓋別的活動）
- 用另一個帳號確認看不到第一個帳號的資料

---

## 7. `shared/week-visibility.js` 的回傳格式

**風險**：`grade3/navbar.js` 的 `buildVisibleWeeks()` 依賴 `week_visibility` 表回傳的欄位格式（`week_code`、`is_visible`）。若表格 schema 或欄位名稱被修改，`buildVisibleWeeks()` 會靜默返回全部週（因為 `.filter(row => row.is_visible === false)` 找不到符合的 row），nav 不會隱藏任何週次。

**修改後最低驗證**：
- 在後台把一個週次設為不可見
- 確認 grade3 首頁週卡消失
- 確認 grade3 navbar 該週連結消失
- 確認 grade6 首頁週卡消失（grade6 navbar 不支援，不需查）

---

## 8. `grade6/navbar.js` 的 `activeWeeks` 陣列

**風險**：grade6 navbar 的週次是**寫死在 `activeWeeks` 陣列**裡，不讀 week-visibility。新增週次時若忘記更新此陣列，grade6 nav 不會顯示新週連結。

**修改後最低驗證**：
- 開 grade6 任意週頁面，確認新週次出現在 navbar

---

## 9. `shared/classroom-controls.js` 與 `classroom_controls` RPC

**風險**：課堂即時開關會在同一頁面中依 Supabase 旗標鎖定或開放外部入口。若模組、RLS 或 RPC 改壞，可能導致老師按鈕不出現、學生無法同步開放狀態，或連結在不該開放時可點。

**修改後最低驗證**：
- 未登入開含課堂即時開關的頁面，確認老師按鈕隱藏、學生「更新狀態」按鈕可見
- 教師帳號登入後，確認老師開關按鈕可見
- 按一次開放，確認受控連結全部可點；按一次關閉，確認受控連結全部鎖住
- 確認頁面沒有 `setInterval` 輪詢，console 沒有紅色錯誤

---

## 10. `shared/quiz-module.js` 的渲染、評分與保存橋接

**風險**：`quiz-module.js` 被多個三年級週頁面共用，負責測驗選項顯示、選取、送出、評分、未登入鎖定與頁面 adapter 的 `student_progress` 寫入橋接。改動看似只影響畫面標號，也可能造成正確答案對應錯亂、未登入可作答、送出後沒有保存、重整後無法接回完成狀態，或後台看不到紀錄。

**修改前必查**：
- `rg -l "initQuizModule" grade3 grade6 shared`
- 讀取所有 import 使用方，確認哪些頁面直接呼叫、哪些頁面透過 adapter 呼叫
- 若只要調整單一週頁面，優先使用 opt-in 參數或頁面 adapter，不要讓既有頁面預設行為改變

**修改後最低驗證**：
- 未登入開測驗頁，只能看到登入鎖定區，不能看到或點選題目選項
- 測試「選項打亂後顯示標號」與「正確答案判定」仍一致
- 點選選項後有清楚的已選狀態；不可只靠 hover 或不明顯色差
- 送出測驗後，`saveProgress`／`saveGuestProgress` 實際被呼叫且失敗時會顯示保存錯誤，但不得覆蓋已算出的分數、正誤與滿分訊息
- 滿分動畫等答題回饋使用 `onAfterGrade`；需要確認保存成功的完成狀態使用 `onAfterSubmit`，不可混用兩個時機
- 已完成測驗重新整理後，`loadProgress` 能顯示完成狀態與分數
- 後台以「全部」與「quiz」篩選都看得到對應 activity_key 的紀錄

---

## 11. `shared/typing-challenge.js` 的手動草稿暫存

**風險**：草稿功能會在打字頁插入「儲存草稿 / 回復上次草稿」UI，並讀寫 `typing_drafts`。若誤把草稿寫入 `student_progress`、改用 `localStorage`、或加入自動存檔 / focus 事件同步，可能污染正式進度、造成學生以為草稿等於過關，或重演分頁切回後請求卡住的問題。

**使用邊界**：
- 草稿只存 `typing_drafts`，不寫入 `student_progress`。
- `draftOptions` 預設關閉；頁面需明確設定 `draftOptions: { enabled: true }`。
- 草稿只做手動儲存與手動回復，不做自動存檔。
- 回復草稿不可自動覆蓋學生已輸入的內容。
- 草稿讀寫使用 direct REST fetch + access token + timeout，失敗不得阻塞 `checkLevel()` 或 `student_progress` 保存。

**修改後最低驗證**：
- 未登入時，草稿按鈕不可使用，輸入框與檢查按鈕仍維持鎖定。
- 登入後輸入部分文字，按「儲存草稿」，重新整理後能按「回復上次草稿」取回文字。
- 輸入框已有文字時按回復，必須先出現確認，不可直接覆蓋。
- 過關成功後，`student_progress` 正常寫入，該關草稿被刪除或至少不再顯示為可回復。
- 重置進度驗證成功後，該週該活動草稿同步清除。
- 切換分頁再切回時，不應自動 reload，也不應自動發出草稿保存請求。

---

## 12. 三年級課堂身分卡與 `guest_progress` 分支

**風險**：課堂身分卡頁是 Google 登入前的例外路徑。若 shared module 誤讀背景 Google session，學生會看到老師或其他 Google 帳號的 `student_progress`；若進度仍存在 localStorage，教師後台重設後學生端可能繼續顯示完成；若 navbar 同時顯示 Google 登入與課堂身分卡，三年級學生會混淆該用哪一個。

**修改最低測試**：
- 在教師 Google session 存在的瀏覽器開課堂身分卡頁，確認頁面只顯示課堂身分卡入口，不讀取 `student_progress`。
- 未輸入課堂身分卡時，打字、測驗、視窗練習與延伸任務都不能操作；特別檢查 `requireAuth: false` 的 typing 頁面是否由頁面端明確加上 `inert` / `disabled` 橋接。
- 輸入有效班級座號與生日四碼後，完成一關，教師後台可看到 `guest_progress`。
- 檢查 `getIdentity().source === 'rpc'`；若瀏覽器保存的是舊 `sample-roster` 身分，加入正式名冊後重新開頁應自動升級，不可出現「navbar 有姓名但保存永遠失敗」。
- 教師後台重設該筆 `guest_progress` 後，學生頁重新整理回到未完成。
- 檢查是否清除舊 localStorage 進度鍵，避免重設後仍顯示完成。
- 若有完成 overlay 或努力樹入口，確認不承諾尚未支援的 Google 努力樹累積。

---

## 13. 六年級作業上傳、重試與版本評比

**風險**：作業上傳跨越瀏覽器、homework Edge Function、Google Drive 與資料庫交易。若週頁自行做上傳表單、寫死 assignment ID，或把「已選檔」誤當「已繳交」，可能造成檔案未完整保存、補交到錯週、重試產生重複紀錄，或老師評到舊版本。

**修改前必查**：

- `docs/development/homework-setup.md`
- `shared/homework-student.js`
- `shared/homework-api.js`
- `shared/homework-review-ui.js`
- `supabase/homework.sql`

**修改後最低驗證**：

- 匿名、教師、未列名冊帳號都不能以學生身分上傳。
- 名冊學生只看到適用班級且非草稿的作業。
- 學生選檔後仍需主動上傳；成功後顯示「已繳交・待評」與實際檔名。
- 中斷後選同檔可接續，失敗不顯示成功；重整後狀態可接回。
- 重交保留舊版本、最新版回到待評；教師不能把評比寫到過時版本。
- 週頁只連向共用入口，不複製上傳流程；跨週補交仍指向原作業週次與名稱。

---

## 14. 六年級閱讀週次、版本與自由參與語意

**風險**：閱讀 period 是教師依行事曆配置的外部狀態，不會因新增週頁自動建立；但六年級 115-1 自第 02 週起，流程規定有任務週卡就必須在同一次工作建立同週 period。若漏建、日期重疊、週次錯誤、頁面把閱讀寫成必交，或另做一套表單，可能造成學生看不到本週小卡、分享到錯週、版本衝突，或後台錯誤出現缺交壓力。

**修改前必查**：

- `docs/development/reading-release-20260911.md`
- `shared/reading-ui.js`
- `shared/reading-api.js`
- `supabase/reading.sql`

**修改後最低驗證**：

- 六年級 115-1 第 02 週起，任務週卡與 reading period 一對一；只有沒有上課且沒有週卡的週次保持缺號。
- 教師已建立正確學期週次、日期範圍與填寫權限；日期範圍代表本週顯示期間，填寫權限使用「開放填寫與修改／暫停填寫與修改」，缺課週維持缺號。
- 建立前已核對可見的教師帳號；建立後已從學生入口確認本週小卡可見。
- 名冊學生能分享本週小卡，修改後保留版本；舊重試不能覆蓋新版本。
- 歷週開放項目可補分享／修改，暫停週仍可查看既有紀錄。
- 教師只看到已分享者，不顯示未分享或缺交人數。
- 測試紀錄重設只接受 `chianwu@apps.ntpc.edu.tw`；教師與學生權限、非測試帳號拒絕、事件／目前小卡／歷史版本完整清除、週次保留及 `reading_test_resets` 稽核都需驗證。
- 週頁沿用 `homework.html#reading`，不自行呼叫 reading RPC 或硬寫 period ID。

---

## 15. 作業／閱讀與努力樹的動態獎勵

**風險**：六年級作業與閱讀的 activity key 含資料庫 ID，並由現有 API adapter 動態產生。若週頁硬寫 key、直接寫入進度，或仍沿用舊的「過關花」文案，畫面可能重複長葉、獎勵對不上最新版，或和實際規則矛盾。

**修改後最低驗證**：

- 作業與閱讀都是繳交一葉、目前版本過關再一葉，不產生花朵。
- 重交、再努力或收回評比時保留繳交葉、收回第二葉；再次過關後恢復第二葉。
- 同檔重試、同週閱讀修改與歷史事件不會重複增加獎勵。
- `homework_<assignment_id>`、`reading_<period_id>` 只由 `homeworkTreeData()`、`readingTreeData()` 產生。
- 三年級 115-1 不載入這兩種六年級資料，也不顯示尚未支援 `guest_progress` 的努力樹入口。

---

## 風險等級對照

| 風險項目 | 影響範圍 | 靜默失效 | 等級 |
|----------|----------|----------|------|
| grade3 navbar 重渲 / authBarHtml id | 全 grade3 週頁面 | **是**（`?.` 不報錯） | 🔴 高 |
| auth.js beginCentralizedLogin | 全站所有登入 | **是**（跳到錯誤頁） | 🔴 高 |
| Supabase 分頁切回 / auth lifecycle | typing、後台、navbar 登出 | **是**（閃爍、timeout、按鈕延遲） | 🔴 高 |
| quiz-module 渲染 / 評分 / 保存橋接 | 全部互動測驗頁 | **是**（選項、分數或保存錯但畫面可能仍像成功） | 🔴 高 |
| navbar-auth.js 事件代理 | 全站所有頁面 | **是** | 🔴 高 |
| student_progress activityKey 衝突 | 受影響的兩頁 | **是**（資料被覆蓋） | 🔴 高 |
| 課堂身分卡 guest_progress 分支 | 三年級 Google 登入前頁面、後台 | **是**（進度誤讀、重設無效、學生身分混淆） | 🔴 高 |
| 六年級作業上傳／重試／版本評比 | 學生作品、Drive、教師評比 | **是**（畫面可能像成功但檔案或版本未入帳） | 🔴 高 |
| 六年級閱讀週次／版本 | 閱讀分享、教師回饋 | **是**（錯週或舊版本覆蓋） | 🔴 高 |
| 作業／閱讀努力樹動態獎勵 | 六年級努力樹 | **是**（重複葉片或舊花朵文案） | 🔴 高 |
| typing_drafts 手動草稿暫存 | 全部啟用 `draftOptions` 的打字頁 | 是（草稿失敗不能影響正式進度） | 🟡 中 |
| week-visibility 格式 | grade3 nav + 首頁 | **是**（全週顯示） | 🟡 中 |
| grade6 activeWeeks 未更新 | grade6 nav | 否（肉眼可見） | 🟡 中 |
| course-navbar.js HTML 結構 | 全站 nav 版面 | 否（版面明顯爛掉） | 🟡 中 |
| classroom-controls / RPC | 使用課堂即時開關的頁面 | 否（按鈕或連結狀態可見） | 🟡 中 |
