# 共用模組說明

> 基於實際程式碼，最後更新：2026-04-15
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
- grade3：`wayground.html`、`week03–10.html`（全部週頁面）
- grade6：`wayground.html`、`week03–08.html`、`week10.html`

**關鍵設計**：使用 `document.addEventListener('click', handleClick)` 事件代理，**不是直接綁在按鈕元素上**，因此 grade3 navbar 重渲後 listener 不會消失。

**使用限制**：
- grade6 的 `navbar.js` 未定義 `authBarHtml`，nav 裡沒有 `#login-btn` 等元素，呼叫 `initNavbarAuth()` 在 grade6 頁面上是**空轉**（不報錯，但無作用）。若 grade6 未來需要登入按鈕，要先修 `grade6/navbar.js`。
- 不可和自己手寫的 `#login-btn.addEventListener` 並存，會觸發兩次登入流程。

---

## `shared/typing-challenge.js`

**責任**：管理多關卡打字練習的完整生命週期：session 解析、進度讀取（Supabase `student_progress`）、關卡解鎖、答案驗證、進度儲存、進度重置、慶祝動畫、auth UI 更新。

**匯出**：`initTypingChallenge({ weekCode, activityKey, levelsData, levelEncouragements, buildHint, getWrongAnswerHtml, progressMessages, celebrationContent, afterAuthUpdate })`

**被誰 import**：`grade3/week04.html`、`week05.html`、`week06.html`、`week07.html`、`week10.html`、`week12.html`、`week13.html`、`week14.html`、`week15.html`

**levelEncouragements 語氣**：三年級打字闖關需為每關提供阿德勒式鼓勵語，重點放在努力、策略、耐心、修正、檢查與進步，避免只寫「很棒」「太厲害」或單純宣布過關。

**levelsData 格式**（容易寫錯）：
```javascript
// 正確
{ id: 1, ans: "答案文字" }

// 錯誤（Codex 常犯）
{ id: 1, answer: "答案文字" }
```

**weekCode 格式**：兩位數字串，`"04"`、`"07"`、`"10"`，不是數字 `4`、`7`、`10`。

**activityKey 命名規則**：`typing_task_N`（N 需符合後台顯示的總關卡數）。`student_progress` 的唯一鍵是 `user_id + week_code + activity_key`，所以不同週次可以使用相同 activityKey；重點是同一週內不要讓兩個活動共用相同 key。

**Navbar auth 邊界**：模組可更新打字闖關所需的 auth 顯示與 reset-progress 狀態，但不直接綁定 `#login-btn`、`#logout-btn`。登入 / 登出點擊一律交給 `initNavbarAuth()` 的事件代理。**因此，所有使用 `initTypingChallenge` 的頁面，必須同時呼叫 `initNavbarAuth()`。**

**未登入鎖定規則**：`initTypingChallenge` 必須在未登入時鎖定 `#typing-levels-container` 內的輸入框與 `checkLevel` 按鈕。學生不可在未登入狀態先完成關卡，避免完成後才發現沒有保存。

**需要的外部 CDN**：`canvas-confetti`，必須在 `<head>` 加入，否則完成動畫會報 ReferenceError：
```html
<script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>
```

**不可自行替代的理由**：自寫邏輯容易只存 localStorage，後台看不到進度，且難以維護重置 / 接回進度的複雜狀態。`student_progress` 保存是課堂核心路徑，必須能承受學生切到其他分頁後再回來送出；若保存邏輯要調整，先讀 `supabase-tab-resume-incident.md`。

---

## `shared/typing-tools.js`

**責任**：提供三年級中英打闖關頁面共用的浮動輔助工具，包含「標點符號表」與「中英文鍵盤圖」。標點符號表需以兩頁切換顯示，避免一張圖上下擠在同一視窗裡太小；鍵盤圖需支援中文鍵盤與英文鍵盤切換。

**匯出**：`initTypingTools({ showPunctuation, showKeyboard })`

**被誰 import**：三年級所有有中英打闖關的週頁面，例如 `grade3/week04.html`、`week05.html`、`week06.html`、`week07.html`、`week10.html`、`week12.html`、`week13.html`、`week14.html`、`week15.html`。

**使用規則**：
- 有中英打闖關的三年級週頁面，需 `import { initTypingTools } from "../shared/typing-tools.js"` 並在 module script 中呼叫 `initTypingTools()`。
- 預設同時顯示標點符號表與鍵盤圖；若特殊頁面只需要其中一項，可用 `showPunctuation: false` 或 `showKeyboard: false` 關閉。
- 不要在單一週頁面複製浮動工具 HTML、`toggleFloatingKeyboard()`、`showKeyboardLayout()`、`toggleFloatingPunctuation()` 或 `showPunctuationPage()`。
- 此模組只建立輔助圖表 UI，不負責登入、解鎖或進度保存；打字進度仍必須交給 `initTypingChallenge()`。

**不可自行替代的理由**：鍵盤圖與標點符號表是跨週固定課堂工具，分散在各頁會造成圖片版本、裁切方式、手機顯示與事件綁定不一致，學生上課時容易遇到同一功能在不同週次行為不同。

---

## `shared/week-visibility.js`

**責任**：從 Supabase `week_visibility` 表讀取哪些週可見，套用到首頁週卡（隱藏 / 顯示），或提供 navbar.js 過濾 activeWeeks。

**匯出**：
- `extractWeekCodeFromHref(href)`
- `collectWeekCards(root)`
- `loadWeekVisibility(grade)`
- `applyWeekVisibilityRows(weekCards, rows)`
- `prioritizeLatestVisibleWeekCard(weekCards)`
- `applyWeekVisibilityToCards(grade, root)`（主入口）

**被誰 import**：
- `grade3/index.html`（首頁週卡）
- `grade6/index.html`（首頁週卡）
- `grade3/navbar.js`（navbar 週次過濾，**這是觸發 navbar 重渲的來源**）
- grade6/navbar.js：**沒有整合**，grade6 nav 週次是寫死的

**重要注意**：grade3 navbar 在非同步載入 week-visibility 後會完整重渲 nav（`existingNav.remove()` + `insertAdjacentHTML`）。這會移除所有直接綁定在 nav 元素上的事件 listener。

---

## `shared/quiz-module.js`

**責任**：通用題目問答 UI 邏輯（選項顯示、作答、送出、評分）。不直接操作 Supabase，由使用方的 adapter 負責讀寫。

**登入規則**：只要是課程頁中的可點選測驗 / 小測驗，預設必須使用登入鎖定。未登入時顯示 lock 區塊，不渲染可作答題目；登入後才顯示 quiz content。若只是口頭檢查，請做成靜態文字，不做互動選項。

**匯出**：`initQuizModule({ questions, selectors, messages, loadProgress, saveProgress, getCurrentUser, onRequireLogin, onAfterSubmit })`

**被誰 import**：`grade3/week06.quiz-adapter.js`、`grade3/week07.quiz-adapter.js`

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
