# 高風險變更清單

> 最後更新：2026-04-15
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

## 風險等級對照

| 風險項目 | 影響範圍 | 靜默失效 | 等級 |
|----------|----------|----------|------|
| grade3 navbar 重渲 / authBarHtml id | 全 grade3 週頁面 | **是**（`?.` 不報錯） | 🔴 高 |
| auth.js beginCentralizedLogin | 全站所有登入 | **是**（跳到錯誤頁） | 🔴 高 |
| navbar-auth.js 事件代理 | 全站所有頁面 | **是** | 🔴 高 |
| student_progress activityKey 衝突 | 受影響的兩頁 | **是**（資料被覆蓋） | 🔴 高 |
| week-visibility 格式 | grade3 nav + 首頁 | **是**（全週顯示） | 🟡 中 |
| grade6 activeWeeks 未更新 | grade6 nav | 否（肉眼可見） | 🟡 中 |
| course-navbar.js HTML 結構 | 全站 nav 版面 | 否（版面明顯爛掉） | 🟡 中 |
