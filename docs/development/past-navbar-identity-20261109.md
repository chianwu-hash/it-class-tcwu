# 個人考古頁名冊導覽相容修正

## 問題與處理

主對話正式雙帳號驗證回報：普通與夥伴入口能顯示班級、座號、姓名，個人考古頁卻只有 Email。考古 `start/resume` 的 identity 僅有 role、email、grade、class_code；`quiz-past-exams.mjs` 直接交給共用導覽列，而 `provided:true` 又禁止第二次名冊讀取。`paint()` 因缺少 seat_no／display_name 不會畫出名冊標籤。先前合成資料具完整名冊，因此未涵蓋這個實際回應差異。

考古入口改以 `lookupIfIncomplete:true` 明確選用相容補讀；`grade6-nav-identity.js` 仍是唯一名冊呈現／快取實作，沒有另造身分資料。完整頁面資料不額外讀取；若只有部分資料，透過既有 `get_my_student_enrollment(p_school_year:115)` 讀本人資料。正式快照中的既有函式以 auth.uid() 與已確認 Email 限定本人，不接受前端指定其他使用者。沒有改 SQL、API、權限或名冊。

補讀沿用原 pending、generation 與 session 檢查，換人、登出、同帳號切換年級會讓舊結果失效。相同帳號已有完整名冊時，不讓後續部分 snapshot 擦掉快取。換人但新頁面尚未提供身分時，不把舊頁的 opt-in 套到新帳號。失敗、空回應及 Email 不符保留 Email，navbar 重繪不持續重試；新頁面資料可再啟動補讀。不阻塞考古作答載入。

## 驗證與限制

```text
node --test automation/tests/quiz-nav-identity.test.mjs automation/tests/quiz-workshop.test.mjs automation/tests/quiz-grade-route.test.mjs
node automation/build-quiz-workshop.mjs --check
git diff --check
```

18 項全通過，其中10項以隔離 VM 執行完整的實際導覽身分模組，僅替代 DOM／Auth／RPC 邊界，涵蓋完整與部分 identity、本人讀取與快取、失敗、空名冊、錯誤 Email、換人、登出、年級切換、進行中請求失效、新完整資料優先，以及原夥伴 lookup 相容。其餘8項覆蓋年級路由、生成檔、canonical identity import 與既有合成隔離契約。四課程16入口與 manifest 已重建，CSS內容未變。

本輪未操作01／02瀏覽器、正式測試帳號、正式作答資料或 SQL；未進行真登入瀏覽器驗證。主對話後續完成原版本雙帳號驗證，明確通知合併與發布；PR127 已依流程上線。此修正的真登入 navbar 仍待主對話補驗。

## 接手資訊

- 基準：`origin/main b2adae41b76f6cffd93fda114c26bc9678fd830d`
- 分支：`codex/past-navbar-identity-20261109`
- 工作樹：`D:/projects/it-class-tcwu-worktrees/past-navbar-identity-20261109`
- 下一步：主對話以真實兩帳號重驗考古 navbar；本發布者未使用01／02。

## 發布結果

來源 main `a0b16ceb96899595988c0f70c1716b210d6ffe1c`，正式部署 `dpl_4dzZgLLGzwJ8v8XfAkXebipaBxxA`；完整樹及候選／正式各25項資產比對通過，發布鎖已釋放。[收據與限制](past-navbar-release-20261109.json)。
