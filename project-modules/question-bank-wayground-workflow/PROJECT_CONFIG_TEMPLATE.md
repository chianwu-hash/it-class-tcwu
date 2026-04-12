# Project Config Template

請複製本檔為新專案根目錄的 `project.config.md`，並填入實際內容。

## Project

- 專案名稱：
- 專案根目錄：
- 年級：
- 考試目標：
- 教材版本：
- 主要輸出平台：Wayground

## Subjects

| 科目 | 範圍拆分方式 | 每份題數 | 難易度比例 | 備註 |
| --- | --- | --- | --- | --- |
| 國文 |  |  |  |  |
| 英文 |  |  |  |  |
| 數學 |  |  |  |  |
| 自然 |  |  |  |  |
| 社會 |  |  |  |  |

## Source Priority

請依專案需求調整，但必須明確固定順序。

1. 教材與教師手冊
2. 本次明確範圍
3. 歷屆試題與校內考題
4. 課綱或會考能力指標
5. 題庫品質規格

## Textbook to Bank Workflow

- 教材來源資料夾：`docs/references/textbooks/`
- 教師手冊資料夾：`docs/references/teacher-guides/`
- 範圍公告資料夾：`docs/references/scope/`
- 歷屆試題資料夾：`docs/references/exams/`
- 命題 prompt：`docs/workflow/prompts/master-prompt.md`
- 分科 prompt：`docs/workflow/prompts/subjects/`
- 審題 prompt：`docs/workflow/prompts/review/gemini-review-prompt.md`
- 題庫輸出：`automation/question-banks/`
- 審題紀錄：`automation/output/gemini-reviews/`
- 是否必做 Gemini 第二審：
- 是否需要校內考風摘要：
- 是否需要保留紙本題型精神：

## Difficulty Definition

- 基礎：
- 核心：
- 挑戰：

## Local Paths

- 題庫資料夾：`automation/question-banks/`
- Gemini 審稿輸出：`automation/output/gemini-reviews/`
- Wayground 輸出紀錄：`automation/output/`
- 教材參考資料：`docs/references/textbooks/`
- 歷屆試題參考資料：`docs/references/exams/`
- 題組入口網頁：`wayground/index.html`

## Wayground Defaults

- 題型：單選題
- 每題時間：2 分鐘
- 匯入方式：優先使用 `wayground:import`
- 語言：
- 年級：

## Review Rules

- 本地自檢：
- Gemini 第二審稿：
- 最終裁判：
- 不可出題型：
- 干擾項規則：

## Deployment Notes

- CDP Chrome profile：
- Gemini 帳號：
- Wayground 帳號：
- 需要保留的輸出紀錄：
