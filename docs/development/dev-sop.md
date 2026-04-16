# 課程網頁開發 SOP

> 最後更新：2026-04-15
>
> 目標：避免「上課才發現功能壞掉」。

---

## 階段 0：給 AI 的提示規範

在把任何新頁面任務交給 Codex 或 Claude 之前，prompt 必須包含以下三件事：

1. **指定參考頁面**：「請參考 `grade3/week10.html` 的結構，不可只仿版面」
2. **貼上功能契約**：把填好的 `new-page-checklist.md` 直接貼進 prompt
3. **禁止清單**：明確說「不可用 localStorage 存進度」、「不可自己重寫 typing 邏輯」、「levelsData 的欄位是 `ans` 不是 `answer`」

---

## 階段 1：開發前確認

### 1.1 確認頁面類型
對照 `page-types.md`，確認這頁屬於 A / B / C / D / E 哪種類型。

### 1.2 找最近的同類型參考頁
- 打字闖關（類型 C）→ 參考 `grade3/week10.html`（最新）
- 一般說明頁（類型 B）→ grade3 參考 `week09.html`，grade6 參考 `week10.html`
- **不要參考最早的頁面**，早期頁面可能缺少後來加入的架構修正

### 1.3 填寫功能契約 Checklist
把 `new-page-checklist.md` 複製一份，逐項填寫。不確定的項目先查程式碼再填，不可留空。

### 1.4 確認 activityKey 不重複（若有進度記錄）
```bash
grep -r "activityKey\|activity_key" grade3/ grade6/
```
確認沒有相同的 weekCode + activityKey 組合。

---

## 階段 2：開發中規範

### 絕對不可以做的事

| 禁止行為 | 正確做法 |
|----------|----------|
| `document.getElementById('login-btn').addEventListener(...)` | `initNavbarAuth()` |
| 打字記錄存 `localStorage` | `initTypingChallenge` 接 Supabase |
| `levelsData: [{ id, answer }]` | `levelsData: [{ id, ans }]` |
| 手刻 nav HTML | 使用 `navbar.js` |
| 直接呼叫 `supabase.auth.signInWithOAuth()` | `beginCentralizedLogin()` |
| 把 quiz / typing 進度直接 upsert `student_progress` | 使用模組的 save 函數 |
| `navbar.js` 不加版本字串 | `navbar.js?v=YYYYMMDD` |

### 模組選用規則

**依需求選用，不可重寫功能模組**：

| 需求 | 必用模組 | 不可替代 |
|------|----------|----------|
| Nav 顯示 | `navbar.js` | 手刻 nav |
| 登入/登出 UI | `initNavbarAuth()` | 直接綁 button |
| 打字關卡進度 | `initTypingChallenge()` | localStorage + 自寫邏輯 |
| 題組進度 | `quiz-module` + adapter | 自寫 supabase upsert |
| 首頁週卡可見性 | `applyWeekVisibilityToCards()` | 自行查 DB |

**可以自由寫的部分**（不碰 auth / progress / navbar）：
- Spotlight 放大圖
- 靜態說明文字區塊
- 倒數計時、進度條等 UI
- 解鎖後顯示/隱藏的 UI 區塊（但觸發邏輯要橋接，不改 module）

### Grade3 打字闖關頁的固定樣板

每次新增 grade3 打字闖關頁，`<script type="module">` 最開頭必須是：

```javascript
import { initNavbarAuth } from "../shared/navbar-auth.js";
import { initTypingChallenge } from "../shared/typing-challenge.js";

initNavbarAuth();
```

然後才是 `levelsData`、`initTypingChallenge({...})`。

### `navbar.js` 版本字串

每次更新 `navbar.js` 或新增頁面時，使用當天日期：

```html
<script src="navbar.js?v=20260415"></script>
```

---

## 階段 3：完工後本機驗證

> **必須在 `http://localhost:3000` 完成，不能用 `file://`**。
> Supabase OAuth 和 auth 相關功能在 `file://` 下不會正常運作。

### 基本 auth 流程

1. **未登入**：開啟頁面，navbar 出現 Google 圖示按鈕（grade3）
2. **點登入**：跳轉 Google OAuth，完成後跳回原頁（不是首頁）
3. **登入後**：email 顯示在 navbar，登入按鈕消失，教師帳號出現後台按鈕
4. **登出**：點登出，email 消失，登入按鈕重新出現

### 打字闖關（若有）

5. 輸入第 1 關正確答案，過關動畫出現，第 2 關出現
6. 故意輸入錯誤答案，確認提示能指出第幾行、第幾個字附近，或判斷可能少字/多字；不可只出現籠統提示，且不可把少字誤導成多打標點
7. 繼續打完最後一關，確認 Supabase 有記錄（開後台查）
8. **開新分頁**，同一頁面，確認進度自動接回（顯示「從第 N 關繼續」）
9. 用重置按鈕重設，確認回到第 1 關

### 解鎖邏輯（若有）

10. 完成最後一關後，確認解鎖區塊出現，鎖定區塊隱藏
11. 重新整理頁面（已完成進度），確認解鎖狀態正確恢復

### 後台

12. 用教師帳號登入 `admin-progress.html`，確認此週此活動出現在進度清單

---

## 階段 4：上課前 Smoke Test（上課前 15 分鐘）

```
□ 確認是用 http:// 開啟（不是 file://）
□ 點一下 navbar 登入按鈕，確認有反應（跳 Google 授權或跳 alert）
□ 若有打字闖關：輸入一個正確答案，確認過關訊息出現
□ 若有打字闖關：故意少打一兩個字，確認錯誤提示方向正確且能指出附近位置
□ 若有解鎖邏輯：（若可以）打完最後一關，確認解鎖區塊出現
□ Console 無紅色錯誤（F12 打開看一眼）
□ 手機或小螢幕快速確認版面不爛
□ 所有外連連結（外部網站）能開啟
```

如果 smoke test 有任何一項失敗：**先修好再上課，不要帶著 bug 進教室**。

---

## 常見錯誤與修法速查

| 症狀 | 最可能原因 | 修法 |
|------|-----------|------|
| 登入按鈕點了沒反應 | 沒呼叫 `initNavbarAuth()`，或 grade3 navbar 重渲後 listener 消失 | 確認 `initNavbarAuth()` 有被呼叫；若頁面有 `initTypingChallenge`，兩個都要呼叫 |
| 打了字過關，但後台看不到進度 | 打字邏輯用 localStorage 實作，沒有接 `initTypingChallenge` | 改用 `initTypingChallenge`，`activityKey` 要有值 |
| 刷新頁面進度不見 | 同上，或 `weekCode` / `activityKey` 格式錯誤 | 確認 `weekCode` 是兩位數字串、`activityKey` 不重複 |
| 打字錯誤提示方向不對，例如少字卻提示多打標點 | 新頁沒有沿用精準 `buildHint`，只寫了籠統提示 | 參考 week06/week07/week10 的逐行逐字比對提示，至少能指出第幾行與錯誤附近文字 |
| 完成最後一關，解鎖區塊沒出現 | 解鎖 UI 依賴 module 完成狀態，但沒有橋接 | 加 MutationObserver 監聽 `#progress-status`，參考 week10 寫法 |
| `confetti is not defined` | 沒加 canvas-confetti CDN | 在 `<head>` 加入 CDN script |
| `levelsData` 第一關過不了（正確答案也不對） | `levelsData` 用了 `answer` 而非 `ans` | 把所有 `answer:` 改成 `ans:` |
