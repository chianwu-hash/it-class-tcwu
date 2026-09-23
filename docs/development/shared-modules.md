# 共用模組說明

> 基於實際程式碼，最後更新：2026-09-15
>
> **原則**：修改任何共用模組前，先看「高風險變更清單」（`high-risk-changes.md`）。

---

## `shared/auth.js`

**責任**：Supabase 客戶端建立、所有登入 / 登出 / session 操作的底層函數。所有模組的認證行為最終都走這裡。

**匯出**：
- 常數：`SUPABASE_URL`、`SUPABASE_ANON_KEY`、`TEACHER_EMAILS`、`AUTH_STORAGE_KEY`、`LOGIN_RETURN_KEY`、`supabase`
- 函數：`isTeacher(session)`、`getHomeRedirectUrl()`、`getAdminRedirectUrl()`、`requireHttpForAuth()`、`storeLoginReturn()`、`consumePendingRedirect()`、`signInWithGoogle()`、`beginCentralizedLogin()`、`signOutAndReload()`、`getSession()`、`resolveSession()`

**被誰 import**：
- `shared/navbar-auth.js`
- `shared/typing-challenge.js`
- `grade3/week06.html`（直接，操作 quiz student_progress）
- `grade3/week07.html`（直接，操作 quiz student_progress）
- `grade3/week06.quiz-adapter.js`
- `grade3/week07.quiz-adapter.js`
- `admin-progress.html`

**不可自行替代的理由**：
- `beginCentralizedLogin()` 在跳轉前會把 `returnTo` 寫入 `localStorage`，OAuth 完成後 index.html 才能跳回正確頁面。自己呼叫 `supabase.auth.signInWithOAuth()` 會跳回 index.html 根目錄，不會回到原始頁面。
- `requireHttpForAuth()` 在 `file://` 協定下會顯示警告並中止，防止 OAuth 在本機直接開檔案時靜默失敗。
- 分頁切回前景時，Supabase 可能重新觸發 auth event 或 token refresh。不要在 `onAuthStateChange`、`pageshow`、`visibilitychange`、`focus` 中無條件重讀資料或 reload；詳見 `supabase-tab-resume-incident.md`。

---

## `shared/course-navbar.js`

**責任**：純 HTML 字串生成。根據 config 產生 nav 的 HTML，不做 DOM 操作，不做 auth。定義 `window.__buildCourseNavbarHtml()`。

**載入方式**：不透過 ES module import，而是被 `grade3/navbar.js` 和 `grade6/navbar.js` 以**同步 XMLHttpRequest + eval** 載入。

**被誰使用**：`grade3/navbar.js`、`grade6/navbar.js`

**關鍵 config 參數**：

| 參數 | 說明 |
|------|------|
| `activeWeeks` | 顯示在 navbar 的週次陣列 |
| `showAuthBarOnWeekPages` | 週頁面是否插入 authBarHtml |
| `showAuthBarOnHomePages` | 首頁是否插入 authBarHtml |
| `authBarHtml` | 登入按鈕 HTML，**必須包含 id="login-btn" 等固定 id** |

**不可自行替代的理由**：手刻 nav HTML 會跳過 week-visibility 重渲機制，nav 週次將不會跟後台同步。

---

## `shared/navbar-auth.js`

**責任**：在 `document` 上設定點擊事件代理，管理 `#login-btn`、`#logout-btn`、`#auth-status`、`#reset-progress-btn`、`#admin-btn` 的顯示與行為。監聽 `course-navbar:rendered` 事件，在 navbar 重渲後刷新 UI 狀態。

**匯出**：`initNavbarAuth({ onResetProgress, onSessionResolved })`

**被誰 import**：
- grade3：舊學期週頁及 `grade3/115-1` 課堂身分卡週頁；身分卡頁保留它處理 navbar 事件，但不以 Google session 保存活動進度
- grade6：舊學期週頁、`grade6/115-1` 週頁與學期共用交作業入口

**關鍵設計**：使用 `document.addEventListener('click', handleClick)` 事件代理，**不是直接綁在按鈕元素上**，因此 grade3 navbar 重渲後 listener 不會消失。

**使用限制**：
- 舊 `grade6/navbar.js` 未定義 `authBarHtml`，但 `grade6/115-1/navbar.js` 已提供完整 auth bar。判斷時必須看學期資料夾，不能把舊學期限制套到 115-1。
- 三年級 115-1 課堂身分卡頁會由 `initClassCardAuth()` 隱藏 Google UI 並插入身分卡；不得讓背景 Google session 取代課堂身分卡或寫入 `student_progress`。
- 不可和自己手寫的 `#login-btn.addEventListener` 並存，會觸發兩次登入流程。

---

## `shared/typing-challenge.js`

**責任**：管理多關卡打字練習的完整生命週期：session 解析、進度讀取、關卡解鎖、答案驗證、進度儲存、進度重置、慶祝動畫、auth UI 更新，以及 opt-in 的手動草稿暫存 / 回復。一般 Google 登入頁讀寫 Supabase `student_progress`；三年級 Google 登入前的課堂身分卡分支可透過 `guestProgress` adapter 讀寫 `guest_progress`。

**匯出**：`initTypingChallenge({ weekCode, activityKey, levelsData, levelEncouragements, buildHint, getWrongAnswerHtml, progressMessages, celebrationContent, draftOptions, afterAuthUpdate, autoScrollNext, requireAuth, guestProgress })`

**關卡完成後導覽**：`autoScrollNext` 預設為 `true`，維持既有「答對後自動移到下一關」行為。頁面若提供每關「再練習一次／前往下一關」雙按鈕，可設為 `false`，讓學生先在原卡片選擇；頁面端仍須自行顯示下一關按鈕，不能讓流程失去出口。

**被誰 import**：舊學期多個三年級週頁、`grade3/115-1/week02.html`、`week03.html`，以及 `grade6/115-1/week01.html`、`week02.html` 等打字頁。

**levelEncouragements 語氣**：三年級打字闖關需為每關提供阿德勒式鼓勵語，重點放在努力、策略、耐心、修正、檢查與進步，避免只寫「很棒」「太厲害」或單純宣布過關。

**levelsData 格式**（容易寫錯）：
```javascript
// 正確
{ id: 1, ans: "答案文字" }

// 錯誤（Codex 常犯）
{ id: 1, answer: "答案文字" }
```

**weekCode 格式**：兩位數字串，`"04"`、`"07"`、`"10"`，不是數字 `4`、`7`、`10`。

**activityKey 命名規則**：`typing_task_N`（N 需符合後台顯示的總關卡數）。`student_progress` 的唯一鍵是 `user_id + week_code + activity_key`；`guest_progress` 的唯一鍵是 `profile_id + course_id + week_code + activity_key`。不同週次可以使用相同 activityKey；重點是同一週內不要讓兩個活動共用相同 key。

**Navbar auth 邊界**：模組可更新打字闖關所需的 auth 顯示與 reset-progress 狀態，但不直接綁定 `#login-btn`、`#logout-btn`。登入 / 登出點擊一律交給 `initNavbarAuth()` 的事件代理。**因此，所有使用 `initTypingChallenge` 的頁面，必須同時呼叫 `initNavbarAuth()`。**課堂身分卡分支仍可呼叫 `initNavbarAuth()`，但 `initTypingChallenge({ requireAuth: false, guestProgress })` 不得讀取背景 Google session 或寫入 `student_progress`。

**未確認身分鎖定規則**：一般 Google 登入頁必須在未登入時鎖定 `#typing-levels-container` 內的輸入框與 `checkLevel` 按鈕。課堂身分卡分支須由頁面端在未確認身分卡前鎖定互動 UI，並把 `guestProgress` 傳入 `initTypingChallenge()`。`requireAuth: false` 時 shared typing 不會自動鎖定輸入框，頁面端必須用 `inert`、`disabled` 或等效橋接確實鎖住。學生不可在未確認身分狀態先完成關卡，避免完成後才發現沒有保存。

**手動草稿暫存**：三年級打字頁可用 `draftOptions: { enabled: true }` 啟用「儲存草稿 / 回復上次草稿」。草稿存到 `typing_drafts`，只保存學生尚未過關的輸入文字，不寫入 `student_progress`，不進入後台、成績或努力樹計算。第一版只允許手動儲存與手動回復；不可加入自動存檔、`setInterval`、`focus` / `visibilitychange` / `beforeunload` 存檔，避免和老師指令下的手動存檔打架。回復草稿必須由學生主動按鈕觸發，若輸入框已有文字需先確認，不可自動覆蓋。

**題目 / 答案字型**：模組會在 `#typing-levels-container`（含舊頁面的 `#levels-container`）內統一題目顯示區與輸入框 / 文字區的 `font-family`，避免英打題目因 `<pre>` 預設等寬字型而和答案區看起來不一致。

**禁止複製貼上**：這是週頁既有的 HTML 契約，不另外在 `typing-challenge.js` 造第二套攔截器。題目範例區使用 `select-none pointer-events-none`；輸入框／文字區使用 `onpaste="return false;" ondrop="return false;"`，並在學生可見說明明示需逐字輸入。自動測試要同時確認範例 `user-select: none`、paste/drop 事件被取消，以及一般鍵盤輸入仍正常。

**需要的外部 CDN**：`canvas-confetti`，必須在 `<head>` 加入，否則完成動畫會報 ReferenceError：
```html
<script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>
```

**不可自行替代的理由**：自寫邏輯容易只存 localStorage，後台看不到進度，且難以維護重置 / 接回進度的複雜狀態。一般頁的 `student_progress` 與課堂身分卡分支的 `guest_progress` 都是課堂核心路徑，必須能承受學生切到其他分頁後再回來送出；若一般 Google 登入頁保存邏輯要調整，先讀 `supabase-tab-resume-incident.md`。

---

## `shared/class-card-auth.js`

**責任**：提供三年級 Google 登入前的「課堂身分卡」入口，在 navbar 右上角取代 Google 登入，用班級座號與生日四碼確認目前使用電腦的學生。

**匯出**：`initClassCardAuth({ courseId, mode, fallbackRosterUrl, verifyStrategy, storagePrefix, onIdentityChanged })`

**使用規則**：
- 只用於學生尚未學會 Google 登入的低風險課堂練習頁。
- 同一頁 navbar 只能顯示課堂身分卡或 Google 登入其中一種。
- 身分卡可用 localStorage 保存臨時身分，讓學生不小心關閉或重開頁面後接回；活動進度不可存在 localStorage。
- 若使用生日四碼作為 RPC 驗證與後續進度寫入憑證，需在頁面文字清楚標示這不是 Google 登入，並在登出身分時清除 localStorage 身分。
- localStorage 可能殘留學生加入正式名冊前的 `sample-roster` 身分。初始化時應以同一張身分卡重新嘗試 RPC；若已可取得正式資料，自動升級為 `source: "rpc"` 再保存進度，避免 navbar 顯示姓名但 `createClassCardProgress()` 拒絕寫入。

---

## `shared/class-card-progress.js`

**責任**：提供課堂身分卡分支的進度 adapter。`createClassCardProgress({ courseId, weekCode, activityKey, total, getIdentity })` 回傳 `load()` / `save()`，經由 `get_guest_progress`、`upsert_guest_progress` RPC 讀寫 `guest_progress`。

**使用規則**：
- 只搭配 `initClassCardAuth()` 使用；沒有身分時不得保存進度。
- 不可退回 `student_progress`，也不可把活動進度寫進 localStorage。
- 教師後台要能查詢與重設對應 `guest_progress`；重設後學生頁重新整理應回到未完成。
- 若頁面曾使用 localStorage 暫存進度，改用本模組時要清除舊鍵。

---

## `shared/typing-tools.js`

**責任**：提供三年級中英打闖關頁面共用的浮動輔助工具，包含「標點符號表」與「中英文鍵盤圖」。標點符號表需以兩頁切換顯示，避免一張圖上下擠在同一視窗裡太小；鍵盤圖需支援中文鍵盤與英文鍵盤切換。

**匯出**：

- `initTypingTools({ showPunctuation, showKeyboard, keyboardGuide, getKeyboardTarget })`
- `renderEnglishKeyboardGuide(container, { target })`

**被誰 import**：三年級多數中英打闖關頁，以及 `grade6/115-1/week01.html`、`week02.html` 等目前學期六年級打字頁。

**使用規則**：
- 教案要求鍵盤圖或標點表的中英打頁，需依實際巢狀路徑 import 並呼叫 `initTypingTools()`；115-1 週頁通常使用 `../../shared/typing-tools.js`。
- 預設同時顯示標點符號表與鍵盤圖；若特殊頁面只需要其中一項，可用 `showPunctuation: false` 或 `showKeyboard: false` 關閉。
- 初學英打頁若要讓「看鍵盤圖」依目前題目標出按鍵，使用 `keyboardGuide: true`，並以 `getKeyboardTarget()` 回傳目前單字。工具每次開啟都會重新讀取目標，不能把單字寫死在共用模組。
- 頁面內嵌的英文字母位置提示也必須優先呼叫 `renderEnglishKeyboardGuide(container, { target })`，不要複製另一份 QWERTY 鍵盤 HTML。此函式同時顯示鍵帽大寫、輸入小寫、黃色目標鍵與輸入順序。
- 不要在單一週頁面複製浮動工具 HTML、`toggleFloatingKeyboard()`、`showKeyboardLayout()`、`toggleFloatingPunctuation()` 或 `showPunctuationPage()`。
- 此模組只建立輔助圖表 UI，不負責登入、解鎖或進度保存；打字進度仍必須交給 `initTypingChallenge()`。

**不可自行替代的理由**：鍵盤圖與標點符號表是跨週固定課堂工具，分散在各頁會造成圖片版本、裁切方式、手機顯示與事件綁定不一致，學生上課時容易遇到同一功能在不同週次行為不同。

---

## `shared/week-visibility.js`

**責任**：從 Supabase `week_visibility` 表讀取哪些週可見，套用到首頁週卡（隱藏 / 顯示），或提供 navbar.js 過濾 activeWeeks。

**匯出**：
- `extractWeekCodeFromHref(href)`
- `collectWeekCards(root)`
- `loadWeekVisibility(grade, courseId = null)`
- `applyWeekVisibilityRows(weekCards, rows)`
- `prioritizeLatestVisibleWeekCard(weekCards)`
- `applyWeekVisibilityToCards(grade, root = document, courseId = null)`（主入口）

**被誰 import**：
- `grade3/index.html`、`grade6/index.html`（舊學期首頁週卡；使用相容查詢）
- `grade3/115-1/index.html`、`grade6/115-1/index.html`（傳入明確 `courseId`）
- `grade3/navbar.js` 與 `grade3/115-1/navbar.js`（navbar 週次過濾，**這是觸發 navbar 重渲的來源**）
- 六年級 navbar：目前 `activeWeeks` 仍由各學期 navbar 明確設定；首頁週卡另由 `week_visibility` 控制

**學期隔離**：新學期一律傳入完整 `courseId`，例如 `loadWeekVisibility("grade3", "grade3-115-1")` 或 `applyWeekVisibilityToCards("grade6", root, "grade6-115-1")`。省略參數只供舊學期相容。

**重要注意**：grade3 navbar 在非同步載入 week-visibility 後會完整重渲 nav（`existingNav.remove()` + `insertAdjacentHTML`）。這會移除所有直接綁定在 nav 元素上的事件 listener。

---

## `shared/quiz-module.js`

2026-09-07 新增 opt-in `mode: "practice"`（第 2 週使用）：交由 `shared/quiz-practice.js` 逐題呈現，答錯提示重選，答對保存後手動下一題。`saveProgress(correctCount)` 在每題答對時呼叫；`loadProgress()` 回傳 `{ score, completed }` 接回。保存失敗停留原題重試，讀取失敗顯示重試按鈕。同一使用者重複 auth 通知不重畫。未指定 mode 的所有既有頁保留原本一次送出、評分流程。

`shared/activity-progress.js` 提供 `createActivityProgress({ courseId, weekCode, activityKey, total, getSession })` 的 `load()` / `save(score)`，供一般 Google 登入頁的逐題測驗和操作活動使用。明確限定 course_id，使用現有 auth token、RLS REST 寫入與 10 秒 timeout；不退回缺 course_id 的舊資料格式。課堂身分卡分支改用 `createClassCardProgress()`；打字仍使用 `initTypingChallenge()`。

**責任**：通用題目問答 UI 邏輯（選項顯示、作答、送出、評分）。不直接操作 Supabase，由使用方的 adapter 負責讀寫。

**登入規則**：只要是課程頁中的可點選測驗 / 小測驗，預設必須使用登入鎖定。一般頁未登入時顯示 lock 區塊，不渲染可作答題目；課堂身分卡分支未確認身分時也要鎖定。若只是口頭檢查，請做成靜態文字，不做互動選項。

**匯出**：`initQuizModule({ questions, selectors, messages, loadProgress, saveProgress, loadGuestProgress, saveGuestProgress, getCurrentUser, onRequireLogin, onAfterGrade, onAfterSubmit, optionLabelMode })`

**評分與保存回呼**：`onAfterGrade({ correct, total })` 在畫面完成評分後觸發，適合滿分動畫等只依賴答題結果的回饋；`onAfterSubmit({ correct, total })` 只在保存成功後觸發，適合完成 banner、重玩入口或其他需要確認已入帳的行為。保存失敗只能更新保存狀態提示，不得覆蓋既有分數、正誤或滿分訊息。

**Adapter 規則**：`quiz-module.js` 負責 UI 與評分流程，頁面可提供 `loadProgress` / `saveProgress` / `getCurrentUser` adapter 讀寫進度。一般 Google 登入頁寫入 `student_progress`；課堂身分卡分支寫入 `guest_progress`。這種頁面端 callback 是目前允許的整合方式，不視為繞過共用模組；但 adapter 不應重寫題目渲染、選項選取、評分或未登入鎖定 UI。若同一種 adapter 在多週重複，優先抽成週頁共用 adapter 檔。

**被誰 import**：
- `grade3/week06.quiz-adapter.js`
- `grade3/week07.quiz-adapter.js`
- `grade3/week11.quiz-adapter.js`
- `grade3/week12.html`
- `grade3/week13.html`
- `grade3/week14.html`
- `grade3/week15.html`
- `grade3/week16.html`

---

## `shared/classroom-controls.js`

**責任**：管理課堂即時控制旗標。適合老師上課時先鎖住外部連結、影片、活動入口，等進入指定階段再開放；學生端可用「更新狀態」按鈕手動同步，不需要輪詢。

**匯出**：`initClassroomLinkControl({ supabase, isTeacher, grade, weekCode, controlKey, container, linkSelector, statusText, statusIcon, refreshButton, teacherToggleButton, messages, toggleButtonHtml })`

**資料庫依賴**：`supabase/classroom_controls.sql`

- `public.classroom_controls`
- `public.get_classroom_control(p_grade, p_week_code, p_control_key)`
- `public.admin_set_classroom_control(p_grade, p_week_code, p_control_key, p_is_enabled)`

**被誰 import**：`grade3/week14.html`

**使用時機**：
- 景點、影片、外部網站等不想讓學生在課程前半段先點開。
- 老師需要用同一頁面即時開放 / 關閉，但不想用自動輪詢干擾既有登入、測驗或打字進度。

**使用規則**：
- 頁面仍需呼叫 `initNavbarAuth({ onSessionResolved })`，並在 callback 中把 session 傳給 `control.handleSession(session)`，老師按鈕才會依 `isTeacher(session)` 顯示。
- 學生端狀態更新採手動按鈕，不使用 `setInterval` 輪詢。
- `controlKey` 需具有語意且同一週內唯一，例如 `maps_links`、`video_links`、`practice_links`。
- 此模組只控制 UI 可點擊與 Supabase 開關旗標，不寫入 `student_progress`。

**最小使用範例**：

```javascript
const linkControl = initClassroomLinkControl({
    supabase,
    isTeacher,
    grade: "grade3",
    weekCode: "14",
    controlKey: "maps_links",
    container: "#maps-body",
    linkSelector: "a[target='_blank']",
    statusText: "#maps-links-status",
    statusIcon: "#maps-links-status-icon",
    refreshButton: "#maps-refresh-btn",
    teacherToggleButton: "#maps-teacher-toggle"
});

initNavbarAuth({
    onSessionResolved: (session) => linkControl.handleSession(session)
});
linkControl.load();
```

---

## 六年級 115-1 作業收件模組

**入口**：學生使用 `grade6/115-1/homework.html`，教師使用 `admin-homework.html`。

**主要模組**：

- `shared/homework-student.js`：列出作業、處理單檔選取、分段上傳、接續重試、縮圖與學生版本紀錄。
- `shared/homework-api.js`：統一呼叫 `homework_action`、`homework_review` 與 homework Edge Function；並提供 `homeworkTreeData()`。
- `shared/homework-dropzone.js`：檔案選擇與拖放 UI，不負責保存完成狀態。
- `shared/homework-review-ui.js`：作品預覽、批註、文字回饋及版本歷史。
- `shared/homework-thumbnails.js`：圖片縮圖產生、保存與讀取。

**功能契約**：

- 作業資料使用獨立 `homework_*` 表，不寫入 `student_progress` 或 localStorage。
- 學生必須使用名冊中的六年級學校 Google 帳號；教師帳號不能代替學生交件。
- 作業由教師在後台建立草稿並明確開放。週頁不得自動建立作業，也不得寫死 assignment ID。
- 同一作業重交會保留版本，最新版重新待評；網路重試不得產生重複作業或重複獎勵。
- 週頁只連向學期共用入口，並寫清楚「第幾週、作業名稱、檔名／格式、完成狀態」。不可在每個週頁複製上傳 UI 或直接呼叫 RPC。
- 努力樹由 `homeworkTreeData()` 依目前狀態推導：繳交一葉、最新版本過關再一葉，不產生花朵。

---

## 六年級 115-1 閱讀小卡模組

**主要模組**：

- `shared/reading-ui.js`：學生分享／修改、歷史版本、教師週次設定、班級檢視與評比。
- `shared/reading-api.js`：統一呼叫 `reading_action`，並提供 `readingTreeData()`。

**功能契約**：

- 閱讀小卡與作業共用 `grade6/115-1/homework.html#reading`，不是獨立週頁應自行重做的表單。
- 教師依行事曆建立明確週次與日期；沒上課的週保持缺號，已開放的舊週可補分享，除非教師暫停。
- 每位學生每個閱讀週次只有一張目前小卡；修改會保留不可變的歷史版本，不增加額外卡片或獎勵。
- 閱讀目前是自由分享制度：不列缺交、不顯示未分享人數、不使用逾期字眼。課堂可以安排全班共同體驗，但不可改變後台的自願參與語意。
- 努力樹由 `readingTreeData()` 推導：分享一葉、老師評為過關再一葉。`reading_<period_id>` 由模組產生，不在週頁硬寫。
- `chianwu@apps.ntpc.edu.tw` 是唯一可由教師後台清除閱讀測試紀錄的學生帳號。重設必須透過教師限定 RPC，在同一交易清除該帳號指定週次的事件、目前小卡與歷史版本，保留閱讀週次並寫入 `reading_test_resets` 稽核紀錄；一般學生不得顯示或呼叫此功能。
- 不在交作業頁嵌入第二棵努力樹；學生仍從年級 navbar 的共同入口查看。

---

## `shared/reward-tree-model.js` 與六年級動態資料

**責任**：把打字、測驗、作業與閱讀的既有資料轉成葉片／花朵顯示。週頁不得直接寫入努力樹資料。

六年級 115-1 載入方式：

- 靜態設定提供中英打等 `student_progress` 活動。
- `homeworkTreeData()` 動態加入非草稿作業與目前學生提交狀態。
- `readingTreeData()` 只為已分享的小卡建立活動，未分享的自由閱讀週不產生待完成活動。

三年級 115-1 目前不適用：課堂身分卡進度在 `guest_progress`，努力樹尚未讀取此資料來源，因此不得顯示入口或在完成提示中承諾會長葉。

---

## grade3/navbar.js vs grade6/navbar.js 差異對照

| 項目 | grade3/navbar.js | grade6/navbar.js |
|------|-----------------|-----------------|
| 程式碼行數 | 105 行 | 30 行 |
| showAuthBarOnWeekPages | `true` | 未設定（預設 false） |
| authBarHtml | 已定義（含 5 個 id） | 未定義 |
| nav 重渲機制 | `existingNav.remove()` + 重新 insert | 直接 `insertAdjacentHTML beforebegin`（無移除） |
| week-visibility 非同步載入 | **是**（會觸發重渲） | **否** |
| CustomEvent `course-navbar:rendered` | **是**（重渲後派發） | **否** |
| activeWeeks | `[3,4,5,6,7,8,9,10]` | `[3,4,5,6,7,8,10]` |

**結論**：grade3 navbar 架構遠比 grade6 複雜。所有 grade3 auth 問題都要考慮「重渲後 listener 是否還在」。

上表描述舊學期根目錄 navbar。115-1 必須另看同學期檔案：

| 課程 | Navbar 身分現況 | 努力樹／作業入口 |
|---|---|---|
| `grade3-115-1` | 週頁先提供 auth 容器，再由 `initClassCardAuth()` 隱藏 Google UI、換成課堂身分卡；navbar 仍會因週次可見性重渲 | 努力樹入口暫時隱藏；沒有六年級作業入口 |
| `grade6-115-1` | `authBarHtml` 與 `showAuthBarOnWeekPages: true` 已啟用，使用學校 Google 登入 | 顯示交作業與努力樹入口 |
