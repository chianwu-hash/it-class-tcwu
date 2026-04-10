# AI Handoff Prompt for Wayground Question-Bank Work

你現在接手的是 `C:\Users\user\projects\it-class-tcwu` 專案中的 Wayground 題庫工作。

你的任務通常會包含以下其中一項或多項：
- 根據考試範圍整理本地題庫
- 驗證本地題庫品質
- 用已登入的正式 Chrome + CDP 在 Wayground 生成題組
- 檢查、刪除重複題、調整設定、發布
- 把最終題組整理到對應年級的 `wayground.html`

## 你開始前必讀的 3 個檔案

1. `C:\Users\user\projects\WORKFLOW_GUARDRAILS.md`
2. `C:\Users\user\projects\it-class-tcwu\docs\browser-automation-sop.md`
3. `C:\Users\user\projects\it-class-tcwu\docs\skills\wayground-question-bank-workflow\SKILL.md`

如果需要查腳本與檔案位置，再讀：
- `C:\Users\user\projects\it-class-tcwu\docs\skills\wayground-question-bank-workflow\references\tooling.md`

## 你必須遵守的核心規則

1. 題庫內容必須先在本地驗證，通過後才能進 Wayground。
2. Wayground 只做平台生成、平台檢查、發布，不是內容審稿工具。
3. 只能使用「使用者已登入的正式 Chrome + CDP」，不要用 Playwright 新開瀏覽器登入 Google。
4. 不要把 raw 中文直接放進 PowerShell inline script / heredoc。
5. 不要用 terminal / console 的中文輸出當最終驗證依據。
6. 驗證中文內容時，只能依靠 UTF-8 檔案、網頁實際畫面或截圖。
7. 如果某流程已成功很多次，遇到問題先檢查頁面狀態，不要直接大改腳本。
8. 優先重用目前正在操作的 Wayground 分頁，不要一直開新分頁。
9. 在回報檔案、審稿結果、輸出資料或題庫位置時，至少要提供一份可直接複製使用的 Windows 絕對路徑，不可只給特定介面才看得懂的內部連結。

## 標準工作順序

1. 先讀 guardrails、SOP、skill。
2. 確認 CDP Chrome 與 Wayground 登入狀態正常。
3. 準備或讀取本地題庫檔。
3.5 若需要新出題庫，出題時同步執行以下規則：
   - 出完每一道挑戰題後，立刻在題目下方補寫每個錯誤選項「學生為什麼會猶豫」的理由
   - 說不出理由就在當下換掉，不要等審稿階段再修
   - 統整題（問「三課共同核心」「本單元精神」等）的錯誤選項必須對應到「只讀懂部分內容」的學生視角，不可全部採用顯然錯誤的道德命題
   - 舉證說明在送 Wayground 前可以刪除，但審稿時必須能還原每個選項的設計理由
4. 驗證本地題庫：
   - 範圍
   - 題數
   - 難易度
   - 答案正確性
   - 是否有重複題
   - 題幹與選項是否清楚
5. 修正本地題庫直到通過。
6. 才能進 Wayground 生成。
7. 生成後跑檢查腳本。
8. 如有重複題或壞題，刪除指定題號，再重檢。
9. 設定語言為中文。
10. 設定每題時間為 2 分鐘。
11. 發布並確認不是草稿。
12. 收集分享連結。
13. 更新對應年級頁面的 `wayground.html`。
14. 如果有改 repo 檔案，commit 前先跑 preflight。

## 常用指令

在 `C:\Users\user\projects\it-class-tcwu` 執行：

```powershell
npm.cmd run browser:smoke
npm.cmd run wayground:generate -- .\automation\question-banks\xxx.md --subject 數學 --grade 三年級 --count 30
npm.cmd run wayground:check -- .\automation\question-banks\xxx.md
npm.cmd run wayground:delete -- 21,20,19
npm.cmd run wayground:set-language
npm.cmd run wayground:set-all-timers-2min
npm.cmd run wayground:publish
python C:\Users\user\projects\tools\preflight_guardrails.py
```

## 生成流程的關鍵事實

- Wayground assessment 頁面正確入口是先點 `用人工智慧生成`，再點 `文字或提示`。
- 自然科可能會多出子題頁或 `使用此測驗` 流程，這是科目特例，不一定是腳本壞掉。
- 題組標題必須一眼看得出年級、科目、範圍。

## 如果你需要修 Wayground 上已生成的題

判斷原則：
- 只改 1 題且是小修，可以直接修 Wayground。
- 要改很多題，先修本地題庫，再考慮重出整份題組。

修完線上題組後必做：
1. 保存
2. 視覺確認頁面結果
3. 重新發布
4. 確認不是草稿

## 你輸出結果時應至少交代

- 本地題庫是否已驗證
- 使用了哪些腳本
- 題組是否已發布
- 有沒有更新 `wayground.html`
- 如果有改 repo，是否已跑 preflight
- 如果沒做某一步，原因是什麼
- 如有引用本機檔案，是否已提供完整 Windows 絕對路徑

## 最後提醒

如果你發現自己正準備：
- 把中文塞進 PowerShell inline script
- 依賴 console 中文輸出判斷對錯
- 跳過本地題庫驗證
- 在已驗證成功多次的流程上直接亂改腳本

請立刻停下來，回到 `WORKFLOW_GUARDRAILS.md` 和 `SKILL.md`，重新照流程做。
