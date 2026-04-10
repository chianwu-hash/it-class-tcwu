---
name: wayground-question-bank-workflow
description: 使用本地題庫、已登入的正式 Chrome CDP 與專案內自動化腳本，完成 Wayground 出題、檢查、修正、設定、發布與整理題組頁面的標準流程。適用於需要從教材整理考題、先做本地驗證，再上架到 Wayground 的工作。
---

# Wayground Question Bank Workflow

這份文件是本專案目前已驗證可重複使用的 Wayground 出題流程。

目標：
- 先在本地完成題庫品質驗證
- 再用已登入的正式 Chrome + CDP 進 Wayground 出題
- 用固定腳本完成檢查、刪題、改語言、改時間、發布
- 最後把題組整理進年級頁面的 `wayground.html`

這份流程必須和下列文件一起遵守：
- `C:\Users\user\projects\WORKFLOW_GUARDRAILS.md`
- `C:\Users\user\projects\it-class-tcwu\docs\browser-automation-sop.md`

## 1. 何時使用

遇到以下工作時，使用這份流程：
- 依教材或考試範圍整理題庫
- 將本地題庫批次生成為 Wayground 題組
- 檢查 Wayground 生成品質
- 修正重複題、壞題、題數異常
- 設定中文介面與每題 2 分鐘
- 發布並整理題組連結到年級頁

不要用這份流程做的事：
- 把 Wayground 當內容審稿工具
- 跳過本地驗證直接上架
- 用 Playwright 直接開新瀏覽器登入 Google

## 2. 必備前置條件

### 2.1 已登入的正式 Chrome

必須使用支援 CDP 的正式 Chrome，不可用 Playwright 自開瀏覽器登入。

啟動方式：

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\chrome-cdp-profile"
```

啟動後手動完成：
1. 登入 Google
2. 登入 Wayground
3. 保持這個 Chrome 視窗開著

CDP 檢查入口：
- [http://localhost:9222/json](http://localhost:9222/json)

### 2.2 題庫先在本地完成

題庫檔位置：
- `C:\Users\user\projects\it-class-tcwu\automation\question-banks\`

題庫預設格式：
- Markdown
- 題目行以 `1. 題目內容` 開始
- 選項格式為 `A. ...` `B. ...` `C. ...` `D. ...`
- 正解格式為 `答案：A`

### 2.3 題庫必須先通過本地驗證

在進 Wayground 之前，至少檢查：
- 範圍正確
- 題數正確
- 難易度分配正確
- 沒有明顯超綱
- 沒有明顯錯答案
- 沒有重複題或概念過度重複
- 題幹與選項敘述清楚

若有以下狀態，不得進 Wayground：
- `疑似錯題`
- `疑似超出範圍`
- 明顯重複題

## 3. 中文與編碼規則

這是這份流程最重要的風險控制點。

### 3.1 禁止事項

以下做法禁止：
- 在 PowerShell inline script / heredoc 中直接放中文
- 用終端中文輸出作為最終驗證依據
- 看到 `???` 或亂碼後仍繼續保存、發布或 commit

### 3.2 唯一合法做法

中文資料只能走以下路徑：
- 從 UTF-8 檔案讀取
- 或改用 `\uXXXX` Unicode escape
- 中文驗證只能看 UTF-8 檔案、網頁實際畫面或截圖

## 4. 會用到的工具與腳本

### 4.1 主要 npm 指令

在專案根目錄 `C:\Users\user\projects\it-class-tcwu` 執行：

```powershell
npm.cmd run browser:smoke
npm.cmd run wayground:open
npm.cmd run wayground:generate -- .\automation\question-banks\xxx.md
npm.cmd run wayground:check -- .\automation\question-banks\xxx.md
npm.cmd run wayground:delete -- 21,20,19
npm.cmd run wayground:set-language
npm.cmd run wayground:set-all-timers-2min
npm.cmd run wayground:publish
```

### 4.2 主要腳本

- `C:\Users\user\projects\it-class-tcwu\automation\browser-smoke.js`
  - 驗證 CDP 瀏覽器連線
- `C:\Users\user\projects\it-class-tcwu\automation\wayground-open.js`
  - 開啟 Wayground 首頁
- `C:\Users\user\projects\it-class-tcwu\automation\wayground-generate-from-bank.js`
  - 讀本地題庫、進 assessment、選擇 AI 流程、貼入題庫並生成
- `C:\Users\user\projects\it-class-tcwu\automation\wayground-check-generated-quiz.js`
  - 檢查生成題數、重複題、與原始題庫不一致之處
- `C:\Users\user\projects\it-class-tcwu\automation\wayground-delete-questions.js`
  - 刪除指定題號，內部會自動由大到小刪
- `C:\Users\user\projects\it-class-tcwu\automation\wayground-set-language-chinese.js`
  - 將題組語言設定為中文
- `C:\Users\user\projects\it-class-tcwu\automation\wayground-set-all-timers-2min.js`
  - 把每題答題時間改為 2 分鐘
- `C:\Users\user\projects\it-class-tcwu\automation\wayground-publish.js`
  - 在編輯頁按下發布
- `C:\Users\user\projects\it-class-tcwu\automation\wayground-collect-share-links.js`
  - 從資源庫收集題組分享連結

### 4.3 常見輸出位置

- `C:\Users\user\projects\it-class-tcwu\automation\output\wayground-generated-from-bank.json`
- `C:\Users\user\projects\it-class-tcwu\automation\output\wayground-generated-check.json`
- `C:\Users\user\projects\it-class-tcwu\automation\output\wayground-generated-check.md`
- `C:\Users\user\projects\it-class-tcwu\automation\output\wayground-generated-check.png`
- `C:\Users\user\projects\it-class-tcwu\automation\output\wayground-after-delete.json`
- `C:\Users\user\projects\it-class-tcwu\automation\output\wayground-language-chinese.json`
- `C:\Users\user\projects\it-class-tcwu\automation\output\wayground-set-all-timers-2min.json`
- `C:\Users\user\projects\it-class-tcwu\automation\output\wayground-publish.json`

## 5. 標準工作流程

### Step 1. 確認流程與現況

先讀：
- `C:\Users\user\projects\WORKFLOW_GUARDRAILS.md`
- `C:\Users\user\projects\it-class-tcwu\docs\browser-automation-sop.md`

確認：
- Chrome CDP 已啟動
- Wayground 已登入
- 題庫檔已存在
- 本地題庫已完成內容驗證

### Step 2. 生成題組

基本指令：

```powershell
npm.cmd run wayground:generate -- .\automation\question-banks\xxx.md --subject 數學 --grade 三年級 --count 30
```

支援參數：
- `--language`
- `--subject`
- `--grade`
- `--count`

實際流程：
1. 進入 `https://wayground.com/admin/assessment`
2. 點中間卡片 `用人工智慧生成`
3. 點 `文字或提示`
4. 貼入本地題庫全文
5. 選語言、科目、年級、題數
6. 按下生成按鈕

### Step 3. 處理科目特例

目前已知：
- 一般科目通常會直接進入 quiz 編輯頁
- 自然科可能會先進入「子題」或「使用此測驗」的中繼畫面

`wayground-generate-from-bank.js` 已內建處理：
- `subtopics-container`
- `use-quiz-button`

原則：
- 遇到不同 UI 先停下來確認，不要直接改整支腳本
- 如果前面流程已成功多次，優先判斷是不是不同科目觸發不同頁面

### Step 4. 檢查生成結果

執行：

```powershell
npm.cmd run wayground:check -- .\automation\question-banks\xxx.md
```

重點看：
- `displayedQuestionCount`
- `generatedCount`
- `duplicateCount`
- `mismatchCount`
- `extraCount`

判斷原則：
- 如果題數正確、無重複、無 mismatch，可進下一步
- 如果有重複題或壞題，先決定明確題號再刪
- 不要直接刪尾端題目

### Step 5. 刪除重複題或壞題

執行：

```powershell
npm.cmd run wayground:delete -- 21,20,19
```

規則：
- 傳入明確題號
- 腳本會自動由大到小刪
- 刪完後必須再跑一次 `wayground:check`

### Step 6. 改語言為中文

執行：

```powershell
npm.cmd run wayground:set-language
```

已知行為：
- 自動打開右上角設定
- 設定語言為中文
- 保存後再重新打開設定驗證結果

### Step 7. 每題時間改成 2 分鐘

執行：

```powershell
npm.cmd run wayground:set-all-timers-2min
```

驗證重點：
- `updated`
- `skipped`
- 題卡文字中都應變成 `2 分鐘`

### Step 8. 正式發布

執行：

```powershell
npm.cmd run wayground:publish
```

發布成功判斷：
- 網址從 `/edit` 變成 `/admin/quiz/<id>`
- 不再是草稿狀態

### Step 9. 收集分享連結

若需要整理到年級頁或彙整文件，可收集分享連結：

```powershell
node .\automation\wayground-collect-share-links.js
```

如果腳本中的 `QUIZZES` 清單未包含本次題組，先更新清單再執行。

### Step 10. 更新年級頁面

將題組連結整理到對應頁面，例如：
- `C:\Users\user\projects\it-class-tcwu\grade3\wayground.html`
- `C:\Users\user\projects\it-class-tcwu\grade6\wayground.html`

更新內容至少包括：
- 科目
- 範圍
- 題數
- Wayground 連結

## 6. 題組命名規則

題組標題必須一眼看得出：
- 年級
- 科目
- 範圍

建議格式：
- `六年級數學期中題庫（單元三～四）`
- `三年級國語期中題庫（一～三課）`
- `六年級自然期中題庫（1-1～2-2）`

不要只寫：
- `期中題庫`
- `簡單機械測驗`
- `聲音的探索與理解`

因為在 Wayground 資源庫裡會很難辨識。

## 7. 線上題組修正原則

優先順序：
1. 先修本地題庫
2. 再決定是否要同步修 Wayground

判斷方式：
- 只改 1 題且是小修：可直接修 Wayground
- 同一份題組要改多題：通常先修本地題庫，再重出新版較穩

若要直接修 Wayground：
- 優先重用同一個分頁
- 先找到正確題卡
- 再改題幹、選項、正解
- 保存後立即確認
- 最後重新發布

## 8. 常見風險與對策

### 8.1 Assessment 頁面有兩層入口

正確流程不是一進頁就直接找輸入框。

要先：
1. 點 `用人工智慧生成`
2. 再點 `文字或提示`

關鍵 selector：
- `main-section-educational_materials`
- `ai_create_topic`

### 8.2 自然科 UI 可能不同

自然科可能多出：
- 子題頁
- `生成測驗`
- `使用此測驗`

這不是一定代表腳本壞掉，先確認是否為科目特例。

### 8.3 中文驗證不要回到終端

不要用：
- console 顯示中文
- shell 輸出題幹或標題

要用：
- UTF-8 檔案
- 頁面實際內容
- 截圖

### 8.4 已驗證流程不要亂改

如果腳本前面已成功很多次，遇到問題先排查：
- 當前網址
- 是否在正確頁面
- modal 是否遮住
- 動畫是否尚未跑完
- 是否是不同科目造成不同流程

不要一開始就直接大改 selector 或整體流程。

## 9. 結尾與 Git

如果本次除了 Wayground 上架，也有修改專案檔案：
1. 先跑 preflight
2. 再 stage
3. 再 commit
4. 最後 push

preflight：

```powershell
python C:\Users\user\projects\tools\preflight_guardrails.py
```

注意：
- 只提交本次真正相關的檔案
- 不要把教材、PDF、暫存輸出、無關圖片一起 commit

## 10. 最短版指令清單

```powershell
npm.cmd run browser:smoke
npm.cmd run wayground:generate -- .\automation\question-banks\xxx.md --subject 數學 --grade 三年級 --count 30
npm.cmd run wayground:check -- .\automation\question-banks\xxx.md
npm.cmd run wayground:delete -- 21,20,19
npm.cmd run wayground:check -- .\automation\question-banks\xxx.md
npm.cmd run wayground:set-language
npm.cmd run wayground:set-all-timers-2min
npm.cmd run wayground:publish
python C:\Users\user\projects\tools\preflight_guardrails.py
```
