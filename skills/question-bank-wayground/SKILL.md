---
name: question-bank-wayground
description: Use when the user wants to turn textbooks, teacher guides, scope notices, or past exams into a reviewed local Markdown question bank and publish it to Wayground. Also use when the user asks about Wayground import vs AI generation routes, distractor review, Gemini or Claude review steps, or updating project pages with Wayground links.
---

# Question Bank Wayground

Use this skill when the task is about:

- 從教材或考古題產生題庫
- 題庫本地初審、誘答選項自審
- Gemini 二審或 Claude 最終審
- Wayground 匯入、AI 出題、清題、發布
- 數學公式或自然化學式在 Wayground 的顯示策略
- 發布後把連結回寫到專案頁面

## First Read

先依任務需要讀以下檔案。若任務是完整出題到發布流程，照順序讀：

1. `./references/README.md`
2. `./references/END_TO_END_FLOW.md`
3. `./references/PREP_BEFORE_QUESTION_BANK_SOP.md`
4. `./references/TEXTBOOK_TO_BANK_SOP.md`
5. `./references/DISTRACTOR_SELF_REVIEW.md`
6. `./references/WORKFLOW_SOP.md`
7. `./references/question-bank-quality-spec.md`
8. `./references/subject-wayground-routing.md`
9. `./references/prompts/master-question-bank-prompt-template.md`
10. 對應分科 prompt：
   - `./references/prompts/subjects/chinese-prompt-template.md`
   - `./references/prompts/subjects/english-prompt-template.md`
   - `./references/prompts/subjects/math-prompt-template.md`
   - `./references/prompts/subjects/science-prompt-template.md`
   - `./references/prompts/subjects/social-prompt-template.md`
11. `./references/prompts/review/gemini-review-prompt-template.md`
12. `./references/prompts/review/claude-final-review-prompt-template.md`

若任務只牽涉局部操作，不必每次讀完整套：

- 只做教材前置整理：讀 `PREP_BEFORE_QUESTION_BANK_SOP.md`
- 只做題庫品質檢查：讀 `PREP_BEFORE_QUESTION_BANK_SOP.md`、`TEXTBOOK_TO_BANK_SOP.md`、`DISTRACTOR_SELF_REVIEW.md`、`question-bank-quality-spec.md`
- 只做 Wayground 操作：讀 `WORKFLOW_SOP.md`、`tooling.md`、`subject-wayground-routing.md`
- 只做安裝或搬移：讀 `README.md`、`DEPLOYMENT_CHECKLIST.md`
- 遇到腳本失敗或 UI 異常：讀 `troubleshooting.md`

（以上省略路徑的檔案均在 `./references/` 下）

## Workflow Rules

- 不跳過本地 Markdown 題庫階段。
- 正式產題前先整理教材、課綱或能力指標、教學目標與出題範圍。
- 除非使用者明確指定單一概念，題庫要覆蓋主要教學目標，不可偏廢。
- 不把未審教材直接交給 Wayground AI 當最終題庫。
- 應用、分析、評鑑與高風險題，必須能說明每個錯誤選項為什麼學生可能會誤選。
- Gemini 與 Claude 是審稿者，不是最終裁判；最終仍要回教材與範圍核對。
- 題庫進 Wayground 前，要再次確認：
  - 範圍
  - 題數
  - 答案唯一性
  - Bloom 分配
  - 題型轉換是否合理
  - 平台顯示是否正常

## Subject Routing

先讀 `./references/subject-wayground-routing.md`，再依科目分流。

目前預設：

- 自然：優先使用本地 Markdown 題庫 + unicode-plus + Wayground 直接匯入
- 數學：優先使用 Wayground AI 出題，再做刪錯題、刪重複題、公式顯示檢查

如果實測結果與文件不一致，先記錄差異，再更新 routing 文件，不要默默改流程。

## Project Inputs

在目標專案中優先找：

- `project.config.md`
- `docs/references/`
- `automation/question-banks/`
- `automation/output/`
- `wayground/`

若專案工作區尚未建立，依 `./references/DEPLOYMENT_CHECKLIST.md` 建立標準結構。

## Expected Outputs

輸出應寫回專案工作區，不要寫回 skill 目錄：

- 題庫：`automation/question-banks/<bank-name>.md`
- 本地初審：`automation/output/<bank-name>-local-review.md`
- 誘答自審：`automation/output/<bank-name>-distractor-review.md`
- Gemini 二審：`automation/output/gemini-reviews/`
- Claude 最終審：`automation/output/claude-reviews/`
- Wayground 發布紀錄：`wayground/`

## Automation Notes

Wayground / Gemini 腳本在專案的 `automation/` 目錄下。

若要操作瀏覽器，優先先確認：

- Chrome 已用 CDP 開啟
- Wayground 已登入
- Gemini 已登入
- 專案需要的腳本與 output 路徑已建立

需要工具細節時再讀 `./references/tooling.md`。

## Safety

- 不保存帳號密碼。
- 不保存 `.env`、API key、瀏覽器 session。
- 不把單次 runtime output 回寫到通用模組。
- 不在未完成審題前直接發布。
