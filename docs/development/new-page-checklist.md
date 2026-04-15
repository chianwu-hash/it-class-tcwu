# 新頁面功能契約 Checklist

> 每次新增課程頁面前，將此表複製並填寫。
> **給 AI（Codex / Claude）的提示**：開始寫新頁面程式前，先把填完的這份 checklist 貼進 prompt，要求 AI 依此實作，不可自行省略或替換模組。

---

## 基本資訊

```
頁面名稱：___________（例如 week11.html）
年級：grade3 / grade6
類型：A 首頁 / B 說明頁 / C 打字闖關 / D 題組入口 / E 後台
參考頁面：___________（找同類型最近的一頁，例如 grade3/week10.html）
```

---

## 1. Navbar

- [ ] 使用 `navbar.js`（不手刻 nav HTML）
- [ ] `navbar.js` 有版本字串，格式 `navbar.js?v=YYYYMMDD`，日期為開發當天
- [ ] 若 grade3 週頁面：確認 `navbar.js` 的 `activeWeeks` 陣列已加入這週的週碼
- [ ] 若 grade6 週頁面：確認 `grade6/navbar.js` 的 `activeWeeks` 陣列已加入

---

## 2. 登入 / Auth

- [ ] **需要登入按鈕** → `import { initNavbarAuth } from "../shared/navbar-auth.js"` 並呼叫 `initNavbarAuth()`
- [ ] 不在頁面內直接對 `#login-btn` 等元素使用 `addEventListener`（一律靠 `initNavbarAuth` 的事件代理）
- [ ] OAuth 跳轉必須走 `beginCentralizedLogin()`，不直接呼叫 `supabase.auth.signInWithOAuth()`
- [ ] **此頁不需要登入** → 不呼叫 `initNavbarAuth`，在此行標記 N/A 並說明原因：`___`

---

## 3. 打字闖關進度記錄

- [ ] **有打字闖關** → 使用 `initTypingChallenge`，不重寫進度邏輯，不用 localStorage 存進度
- [ ] `levelsData` 格式確認：`{ id: number, ans: string }`（不是 `answer`）
- [ ] `weekCode` 格式確認：兩位數字串，例如 `"11"`，不是數字 `11`
- [ ] `activityKey` 已確認不與其他頁面重複（格式 `typing_task_N`，N 為關卡數）
  - 確認方式：grep 整個 repo 確認此 activityKey 未被使用
  - 填入本頁 activityKey：`___________`
- [ ] `canvas-confetti` CDN 已加入 `<head>`：
  ```html
  <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>
  ```
- [ ] 有打字闖關且為 grade3 → **同時呼叫 `initNavbarAuth()`**（防止 navbar 重渲後 listener 消失）
- [ ] **此頁無打字闖關** → 標記 N/A：`___`

---

## 4. 後台可見性

- [ ] 有進度記錄 → 確認 `admin-progress.html` 能看到此頁進度（weekCode + activityKey 正確）
- [ ] 測試方式：用教師帳號登入後台，確認此週此活動出現在清單中
- [ ] **此頁無進度記錄** → 標記 N/A

---

## 5. 週次可見性

- [ ] 此頁為首頁 → 使用 `applyWeekVisibilityToCards(grade)` 控制週卡顯示
- [ ] 此頁為 grade3 週頁面 → 確認 `grade3/navbar.js` 的 `activeWeeks` 已更新（navbar 週次同步）
- [ ] 此頁為 grade6 週頁面 → 確認 `grade6/navbar.js` 的 `activeWeeks` 已更新（grade6 nav 不讀 DB，要手動更新）
- [ ] **此頁不需要週次可見性控制** → 標記 N/A

---

## 6. 解鎖邏輯（若有）

- [ ] 解鎖條件明確：是 UI 顯示（純前端 hidden/visible）還是資料庫狀態（需登入驗證）？
  - 填入：`___________`
- [ ] 若解鎖條件依賴 `initTypingChallenge` 的完成狀態 → 使用 MutationObserver 監聽 `#progress-status` 變化觸發 UI 更新，不直接改 module 內部邏輯
  - 參考：`grade3/week10.html` 的 MutationObserver 寫法
- [ ] **此頁無解鎖邏輯** → 標記 N/A

---

## 7. 上課備援模式

- [ ] Supabase 無法連線時，頁面不會白掉（module script 錯誤已隔離）
- [ ] 打字闖關在未登入時可練習但不記錄（`initTypingChallenge` 已內建此降級行為）
- [ ] `file://` 協定下頁面不可用是預期行為（已有 `requireHttpForAuth()` 保護）

---

## 完成標準

完成開發後，在 `http://localhost:3000`（或正式站）逐項確認：

- [ ] 未登入：navbar 顯示 Google 登入按鈕
- [ ] 點登入：跳轉 Google OAuth，完成後回到此頁
- [ ] 登入後：navbar 顯示 email，教師帳號出現後台按鈕
- [ ] 若有打字闖關：過第 1 關，第 2 關出現；開新分頁確認進度接回
- [ ] 若有解鎖邏輯：完成最後一關，解鎖區塊正確顯示
- [ ] Console 無紅色錯誤
- [ ] RWD：手機畫面不爛版
