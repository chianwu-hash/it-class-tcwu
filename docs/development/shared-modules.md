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

**被誰 import**：`grade3/week04.html`、`week05.html`、`week06.html`、`week07.html`、`week10.html`

**levelsData 格式**（容易寫錯）：
```javascript
// 正確
{ id: 1, ans: "答案文字" }

// 錯誤（Codex 常犯）
{ id: 1, answer: "答案文字" }
```

**weekCode 格式**：兩位數字串，`"04"`、`"07"`、`"10"`，不是數字 `4`、`7`、`10`。

**activityKey 命名規則**：`typing_task_N`（N 需符合後台顯示的總關卡數）。`student_progress` 的唯一鍵是 `user_id + week_code + activity_key`，所以不同週次可以使用相同 activityKey；重點是同一週內不要讓兩個活動共用相同 key。

**內建的 listener 問題**：模組自身會對 `#login-btn` 等元素執行直接綁定（`loginBtn?.addEventListener`）。在 grade3 頁面，navbar 重渲後這些直接綁定會消失。**因此，所有使用 `initTypingChallenge` 的頁面，必須同時呼叫 `initNavbarAuth()`。**

**需要的外部 CDN**：`canvas-confetti`，必須在 `<head>` 加入，否則完成動畫會報 ReferenceError：
```html
<script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>
```

**不可自行替代的理由**：自寫邏輯容易只存 localStorage，後台看不到進度，且難以維護重置 / 接回進度的複雜狀態。

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

**匯出**：`initQuizModule({ questions, selectors, messages, loadProgress, saveProgress, getCurrentUser, onRequireLogin, onAfterSubmit })`

**被誰 import**：`grade3/week06.quiz-adapter.js`、`grade3/week07.quiz-adapter.js`

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
