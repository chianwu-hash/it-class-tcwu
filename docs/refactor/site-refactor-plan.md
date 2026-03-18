# 網站重構現況分析與分階段計畫

更新日期：2026-03-18

## 目的

本文件用來整理目前教學網站的現況、主要結構問題、重構原則、分階段實作順序，以及每一階段的驗收條件。

本次重構的前提：

- 不改變現有網址結構，除非後續另行決議
- 不改變教學內容與互動功能，只整理結構
- 優先提升可維護性、可測試性、可除錯性
- 每次只重構一小塊，保留可回退能力

## 目前網站結構盤點

### 頂層頁面

- `index.html`：全站入口，含登入與教師後台入口
- `114-2-it-class.html`：學期課程總表
- `admin-progress.html`：教師後台
- `keyboard.html`、`kidztype.html`、`c-type.html`、`pts.html`、`angry_birds_guide.html`、`en-type-lession1.html`：工具或練習頁

### 三年級頁面

- `grade3/index.html`
- `grade3/navbar.js`
- `grade3/week03.html`
- `grade3/week04.html`
- `grade3/week05.html`
- `grade3/week06.html`

### 六年級頁面

- `grade6/index.html`
- `grade6/navbar.js`
- `grade6/week03.html`
- `grade6/week04.html`
- `grade6/week05.html`
- `grade6/week06.html`

### 後端資料與設定

- `supabase/student_progress.sql`
- `supabase/LOCAL_AUTH_SETUP.md`

### 教案與內容來源

- `grade3/LessonPlan/*.md`
- `grade6/LessonPlan/*.md`

## 已確認的主要結構問題

### 1. 週頁邏輯高度重複

三年級 `week04.html`、`week05.html`、`week06.html` 都各自帶有大量內嵌 JS，且包含：

- Supabase client 建立
- session/登入狀態處理
- 進度保存與讀取
- 重設進度
- 闖關關卡資料
- 過關動畫與鼓勵文案
- 注音切換
- 關卡切換與驗證

其中 `week04` 與 `week05` 的結構幾乎是同型重複，只差：

- `WEEK_CODE`
- `ACTIVITY_KEY`
- `levelsData`
- 文案與視覺內容

`week06` 則在同一頁混合了：

- 資安測驗
- Email 任務
- 中打闖關
- 進度保存與測驗分數保存

這使得：

- 同一個 bug 需要在多頁修多次
- 同一個新功能容易漏頁
- 除錯時很難快速知道問題屬於內容、畫面、還是共用邏輯

### 2. 導覽列結構重複且責任不清楚

目前至少存在：

- 全站首頁自己的導覽列邏輯
- `grade3/navbar.js`
- `grade6/navbar.js`

這些導覽列負責的內容包含：

- 網站識別
- 週次導航
- Google 登入/登出
- 教師後台入口
- 部分登入狀態顯示

導覽列目前不是單純視圖元件，而是混入了登入、週次推導、條件顯示等狀態邏輯。

### 3. 首頁卡片與週次顯示邏輯分散

`grade3/index.html` 與 `grade6/index.html` 都各自：

- 渲染週卡片
- 查 `week_visibility`
- 依連結型式判斷週次
- 處理隱藏邏輯

這造成：

- `grade3/index.html` 與 `grade6/index.html` 有相同行為卻分開維護
- 之前曾因 Pretty URL 與 `.html` URL 差異出現本地正常、遠端異常

### 4. 教師後台責任過重

`admin-progress.html` 目前同時處理：

- 教師登入/登出
- session 恢復
- 週卡顯示管理
- 學生進度查詢
- 學生進度重設
- RPC 呼叫與畫面更新

這使後台頁本身變成一個獨立應用，且任何 auth 或頁面生命週期問題都會讓整頁功能受影響。

### 5. 內容資料與互動邏輯耦合太深

目前多數內容直接寫在 HTML 內或 JS 常數中，例如：

- 關卡題目
- 注音內容
- 鼓勵語
- 錯誤提示
- 任務說明

這表示：

- 改內容需要碰功能檔
- 改功能容易誤傷內容
- 教案 Markdown 與實際網頁內容沒有明確的映射關係

### 6. 編碼與工具環境風險

目前文字檔已完成 UTF-8 檢查，但仍存在兩個實務風險：

- 專案路徑包含中文，對部分工具與終端有風險
- 部分檔案在 PowerShell 中顯示亂碼，但瀏覽器正常，表示終端顯示層與檔案內容層要分開判讀

這意味著後續重構時要避免：

- 大範圍自動字串取代
- 未指定 `encoding="utf-8"` 的腳本改檔

## 重構原則

### 原則 1：先穩定介面，再整理內部

使用者可見的內容、按鈕、互動順序不先改，優先重構內部結構。

### 原則 2：先抽共用，再談抽象

不是一開始就建立完整框架，而是先把現有已重複的邏輯抽出。

### 原則 3：每一階段都可回退

每次只改一類責任，確保：

- 可比較新舊版本差異
- 可做局部回退
- 可快速驗證回歸風險

### 原則 4：內容資料與互動邏輯分離

週頁的內容資料應抽成設定物件或資料檔；畫面流程與保存邏輯則移到共用模組。

## 建議目標結構

### 共用模組層

建議後續新增：

- `shared/auth.js`
  - Supabase client
  - session 讀取/恢復
  - 登入/登出
  - 教師角色判斷

- `shared/navbar.js`
  - 導覽列渲染
  - 年級/週次導航
  - auth 狀態注入

- `shared/progress.js`
  - `loadProgress`
  - `saveProgress`
  - `resetProgress`
  - 通用錯誤處理與除錯訊息

- `shared/week-visibility.js`
  - 首頁週卡顯示/隱藏查詢
  - 週次 URL 判斷

- `shared/typing-challenge.js`
  - 關卡渲染
  - 答案檢查
  - 過關動畫
  - 阿德勒式鼓勵語顯示

### 內容設定層

每週資料抽出，例如：

- `grade3/config/week04.js`
- `grade3/config/week05.js`
- `grade3/config/week06.js`

內容只包含：

- 標題與 header 文字
- 任務說明
- 關卡題目
- 注音內容
- 鼓勵語
- 特殊設定（如是否有測驗、是否有 score）

### 頁面殼層

每個 `weekXX.html` 只保留：

- HTML 骨架
- 掛載容器
- 載入共用模組與對應 config

## 分階段重構計畫

### Phase 0：規格固定與現況文件化

目標：不改功能，先固定測試基準與架構盤點。

交付物：

- 本文件
- `docs/refactor/test-spec.md`

狀態：本次進行中。

### Phase 1：抽出 Supabase 與 Auth 共用模組

目標：把目前分散在首頁、週頁、後台的 Supabase 初始化與 session 邏輯統一。

範圍：

- 建立 `shared/auth.js`
- 由 `index.html`、`admin-progress.html`、`grade3/week04-06.html` 優先改用共用 auth

不動：

- 頁面視覺
- 關卡內容
- RPC 設計

驗收：

- 登入/登出行為與現在一致
- session 恢復行為至少不比目前差
- 不再需要每頁自己建立一份 Supabase client

### Phase 2：抽出首頁週卡顯示邏輯

目標：統一 `grade3/index.html` 與 `grade6/index.html` 的卡片顯示/隱藏邏輯。

範圍：

- 建立 `shared/week-visibility.js`
- 首頁卡片隱藏判斷與週次 URL 解析共用化

驗收：

- 本地與遠端對 `.html` / Pretty URL 判斷一致
- `week_visibility` 控制導覽列與首頁卡片結果一致

### Phase 3：重構三年級週頁闖關框架

目標：先把 `grade3/week04.html`、`week05.html`、`week06.html` 變成可維護結構。

建議順序：

1. 先重構 `week04` 與 `week05`
2. 再處理 `week06`

原因：

- `week04`、`week05` 邏輯最相似，最適合先抽共用
- `week06` 是混合型頁面，應在共用框架穩定後再納入

範圍：

- 抽出 `shared/typing-challenge.js`
- 抽出 `grade3/config/week04.js`
- 抽出 `grade3/config/week05.js`
- `week06` 視需要拆成 quiz / email / typing 三段配置

驗收：

- `week04` 與 `week05` 功能完全等同現況
- 進度保存、重設、動畫、注音、鼓勵語全保留
- 兩頁不再各自持有整份保存邏輯

### Phase 4：重構教師後台

目標：讓 `admin-progress.html` 的 auth、資料讀取、畫面渲染分層。

範圍：

- 後台改用 `shared/auth.js`
- 抽出 `admin-progress.js`
- 事件綁定、session 同步、RPC 呼叫拆分

驗收：

- 切分頁回來後按鈕仍可用
- session 恢復流程可追蹤、可除錯
- 後台不再是一頁混合所有責任

### Phase 5：擴展到六年級頁面

目標：將三年級完成的共用結構套用到六年級。

範圍：

- `grade6/navbar.js`
- `grade6/index.html`
- `grade6/week03-06.html`

驗收：

- 六年級與三年級共用相同基礎模組
- 視覺與內容維持不變

## 建議第一個切入點

### 第一刀：先做 `shared/auth.js`

理由：

- 它影響首頁、週頁、後台三大區塊
- 重複最多
- 問題也最多
- 但只要做對，頁面外觀幾乎不需要改

### 第一批重構頁面

建議順序：

1. `grade3/week04.html`
2. `grade3/week05.html`
3. `grade3/index.html`
4. `admin-progress.html`
5. `grade3/week06.html`

其中 `week06` 放後面，是因為功能複雜度最高。

## 暫不處理項目

以下內容目前不列入第一輪重構：

- 視覺 redesign
- URL 重新規劃
- 班級進度系統
- 課程內容 CMS 化
- 教案 Markdown 自動轉頁面
- 後端結構大改

## 開發流程要求

每一階段都遵守：

1. 先寫測試規格
2. 再開分支實作
3. 先改最小範圍
4. 本地驗證
5. 再推遠端驗證
6. 驗證通過後才擴下一塊

## 建議分支策略

- `refactor/site-foundation`
  - Phase 1-2
- `refactor/grade3-weeks`
  - Phase 3
- `refactor/admin-panel`
  - Phase 4
- `refactor/grade6-weeks`
  - Phase 5

如果要再保守一點，也可以每 phase 一個 branch。

## 決策摘要

目前最合理的路線是：

1. 不重做整站
2. 先做現況分析與測試規格
3. 先重構共用 auth
4. 先從三年級 `week04` / `week05` 開始驗證共用框架
5. `week06` 與後台放在後面處理

這條路線能保留目前的網站成果，同時逐步把結構整理到可維護狀態。
