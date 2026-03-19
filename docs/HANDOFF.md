# HANDOFF

更新日期：2026-03-19

## 目的

本文件用來讓新的開發視窗、人類協作者或其他 AI 助手能快速接手目前專案，不需要重新追完整聊天紀錄。

## 目前主開發環境

### 主開發 repo

目前建議的主開發環境已切到 WSL。

Linux 路徑：

- `/home/chianwu/projects/it-class-tcwu`

Windows 端測試網址：

- `http://localhost:3000`

### 原本 Windows repo

原本 Windows 路徑：

- `i:\\我的雲端硬碟\\Netlify\\it-class-tcwu`

這份目前仍存在，但之後不應再作為主要開發來源，以避免：

- 中文路徑風險
- Google Drive 同步風險
- Windows / PowerShell 編碼風險

## 目前 main 已完成的重構

### 1. shared auth

已建立：

- `shared/auth.js`

已接入：

- `index.html`
- `admin-progress.html`
- `grade3/week04.html`
- `grade3/week05.html`
- `grade3/week06.html`

### 2. shared week visibility

已建立：

- `shared/week-visibility.js`

已接入：

- `grade3/index.html`
- `grade6/index.html`

### 3. shared typing challenge

已建立：

- `shared/typing-challenge.js`

已接入：

- `grade3/week04.html`
- `grade3/week05.html`
- `grade3/week06.html`

### 4. shared course navbar

已建立：

- `shared/course-navbar.js`

已接入：

- `grade3/navbar.js`
- `grade6/navbar.js`

### 5. week06 quiz adapter

已建立：

- `shared/quiz-module.js`
- `grade3/week06.quiz-adapter.js`

已完成：

- `week06` quiz 控制層抽離
- `week06.html` 透過 adapter 掛接 quiz module

### 6. admin-progress workaround

已知問題：

- 教師後台切分頁回來後，按鈕可能失效

目前採用的可接受解法：

- 頁面切回前景時自動刷新

狀態：

- 使用者已實測此策略有效

## 本輪已完成的重要文件

重構與測試：

- `docs/refactor/site-refactor-plan.md`
- `docs/refactor/test-spec.md`
- `docs/refactor/quiz-module-spec.md`
- `docs/refactor/week06-quiz-integration-plan.md`
- `docs/refactor/quiz-sandbox.html`

後台規劃與開發規則：

- `docs/admin-roadmap.md`
- `docs/development-guidelines.md`

學生主檔規格：

- `docs/student-profiles-spec.md`

## 目前已知未完成事項

### 1. student_profiles 只做到規格與 SQL

已建立但尚未接 UI：

- `docs/student-profiles-spec.md`
- `supabase/student_profiles.sql`

尚未完成：

- 後台顯示班級座號姓名
- 後台編輯學生主檔 UI
- 學生進度查詢與 `student_profiles` join

### 2. activity_catalog 尚未開始

這是後台後續成績與活動管理的重要基礎。

### 3. admin-progress 仍可再優化

目前「切回分頁自動刷新」可用，但不是最終理想型。

### 4. typing 細部錯誤提示尚未升級為 shared 預設

目前 `week06` 已有細部提示能力。

已知需求：

- 未來要將「打錯細部提示」升級為 shared typing 標配功能

## week06 特別注意事項

`grade3/week06.html` 是高風險頁面，因為它同時包含：

- auth
- quiz
- Email 任務
- typing challenge
- 大量中文文案

### 重要原則

不要直接在 `week06.html` 內嵌的大段中文 script 上做大範圍重構。

若要再改：

- 優先新增外部 JS
- 用 adapter 掛接
- 只做最小 patch

### 已踩過的坑

- 在 Windows / PowerShell 環境下批次重寫內嵌 script，容易把中文文案寫成 `?`
- shell 顯示亂碼不一定等於檔案內容真的壞掉

## 本地與遠端狀態

### Git

目前正式主線在：

- `main`

且重構已合併回主線。

### 部署

目前正式站有：

- Netlify
- Vercel

Supabase URL Configuration 已補：

- `localhost`
- Netlify
- Vercel

登入策略已改成：

- 集中登入入口
- 週頁不再各自發起獨立 OAuth callback

## 新接手時建議先讀的文件順序

1. `docs/HANDOFF.md`
2. `docs/development-guidelines.md`
3. `docs/refactor/site-refactor-plan.md`
4. `docs/refactor/test-spec.md`
5. `docs/admin-roadmap.md`
6. `docs/student-profiles-spec.md`

若要碰 quiz：

7. `docs/refactor/quiz-module-spec.md`
8. `docs/refactor/week06-quiz-integration-plan.md`

## 建議下一步

最合理的下一步是：

1. 先在 WSL 環境繼續開發
2. 按 `admin-roadmap` 先落地 `student_profiles`
3. 先做資料層與後台讀取 join
4. 再做後台 UI 顯示學生主檔

## 接手提示

新視窗接手時，建議直接告知：

- 現在主開發環境在 WSL
- 請先讀 `docs/HANDOFF.md`
- 然後依文件規格接續，不要直接重寫高風險頁
