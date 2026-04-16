# 課程網頁類型盤點

> 基於實際程式碼，最後更新：2026-04-15

---

## 類型 A：首頁 / 週卡頁

**檔案**：`grade3/index.html`、`grade6/index.html`

**主要用途**：顯示該年級所有週次的卡片入口，依後台設定動態隱藏未開放的週次。

| 項目 | 狀態 |
|------|------|
| 共用模組 | `navbar.js`、`shared/week-visibility.js` |
| 需要登入 | 否 |
| 進度記錄 | 否 |
| 讀取 week_visibility | **是**（`applyWeekVisibilityToCards(grade)`） |
| 解鎖邏輯 | 無（週卡依 week_visibility 顯示或隱藏） |
| initNavbarAuth | 否 |

**已知問題**：`grade3/index.html` 的 `navbar.js` 沒有版本字串（`?v=YYYYMMDD`），快取行為不可預測。

---

## 類型 B：一般課程說明頁（無打字 / 無題組）

**檔案**：
- grade3：`week03.html`、`week08.html`、`week09.html`
- grade6：`week03–08.html`、`week10.html`

**主要用途**：課堂任務說明、外連資源、圖片引導。

| 項目 | 狀態 |
|------|------|
| 共用模組 | `navbar.js`、`shared/navbar-auth.js` |
| 需要登入 | 視頁面（目前用登入識別身份，但無強制） |
| 進度記錄 | 否 |
| student_progress | 否 |
| 讀取 week_visibility | 否（不讀取） |
| 解鎖邏輯 | 無 |

**重要注意**：grade6 的 `navbar.js` 沒有定義 `authBarHtml`，也沒有 `showAuthBarOnWeekPages: true`，**navbar 不顯示登入按鈕**。grade6 頁面呼叫 `initNavbarAuth()` 等於空轉。這是目前的設計選擇，但須明確記錄（見 `shared-modules.md`）。

---

## 類型 C：打字闖關頁

**檔案**：`grade3/week04.html`、`week05.html`、`week06.html`、`week07.html`、`week10.html`

**主要用途**：學生逐關輸入指定文字，進度存到 Supabase，老師可在後台查看。

| 項目 | 狀態 |
|------|------|
| 共用模組 | `navbar.js`、`navbar-auth.js`、`typing-challenge.js`、`canvas-confetti`（CDN） |
| 需要登入 | 建議（未登入可練習但不記錄） |
| 進度記錄 | **是**，存到 `student_progress`（`week_code` + `activity_key`） |
| student_progress | **是** |
| 讀取 week_visibility | 否 |
| 解鎖邏輯 | 關卡順序解鎖（level 逐關） |
| 特殊 | week10 另有 locked/unlock section UI，用 MutationObserver 橋接 |

**activityKey 命名現況**：

| 頁面 | weekCode | activityKey |
|------|----------|-------------|
| week04 | `"04"` | 待確認 |
| week05 | `"05"` | 待確認 |
| week06 | `"06"` | `typing_task_N`（含 quiz） |
| week07 | `"07"` | `typing_task_5` |
| week10 | `"10"` | `typing_task_2` |

**必須同時呼叫 `initNavbarAuth()`**：`initTypingChallenge` 的 button listener 是直接綁定，會因 navbar 重渲失效，必須靠 `initNavbarAuth` 的事件代理補位。

---

## 類型 D：題組入口頁（Wayground）

**檔案**：`grade3/wayground.html`、`grade6/wayground.html`

**主要用途**：連結至 Wayground 平台的各科題組，無自建進度記錄。

| 項目 | 狀態 |
|------|------|
| 共用模組 | `navbar.js`、`navbar-auth.js` |
| 需要登入 | 用 `initNavbarAuth` 但無強制要求 |
| 進度記錄 | 否（進度在 Wayground 平台） |
| student_progress | 否 |
| 讀取 week_visibility | 否 |

---

## 類型 E：教師後台

**檔案**：`admin-progress.html`（根目錄）

**主要用途**：教師查看學生打字進度、管理週次可見性。

| 項目 | 狀態 |
|------|------|
| 共用模組 | `shared/auth.js`（直接 import，不走 navbar-auth） |
| 需要登入 | **強制**（非教師帳號跳轉） |
| 讀取 student_progress | **是**（`admin_list_week_visibility` RPC） |
| 管理 week_visibility | **是**（`admin_set_week_visibility` RPC） |
| initNavbarAuth | 否（自行管理 auth UI） |

---

## 各類型對照表

| 類型 | navbar.js | initNavbarAuth | initTypingChallenge | student_progress | week_visibility |
|------|-----------|----------------|---------------------|------------------|-----------------|
| A 首頁 | ✅ | ❌ | ❌ | ❌ | ✅（首頁卡片） |
| B 說明頁 | ✅ | ✅ | ❌ | ❌ | ❌ |
| C 打字闖關 | ✅ | **✅（必加）** | ✅ | ✅ | ❌ |
| D 題組入口 | ✅ | ✅ | ❌ | ❌ | ❌ |
| E 後台 | ❌ | ❌ | ❌ | ✅（讀） | ✅（管理） |
