# End-to-End Flow

這是本模組的完整流程索引。若要把「從教材產生題庫、審題，到 Wayground 發布」搬到新專案，請照這個順序走。

## 1. 部署模組

先讀：

```text
docs/workflow/README.md
docs/workflow/AI_DEPLOY_PROMPT.md
project.config.md
```

在新專案建立：

```text
project.config.md
automation/question-banks/
automation/output/gemini-reviews/
docs/references/
docs/workflow/
docs/workflow/prompts/
wayground/
```

## 2. 整理教材來源

依：

```text
docs/workflow/TEXTBOOK_TO_BANK_SOP.md
```

把教材、教師手冊、範圍公告、歷屆試題放到 `docs/references/`，並轉成可讀的 UTF-8 `.txt` 或 Markdown。

## 3. 產生本地題庫

使用：

```text
docs/workflow/prompts/templates/master-question-bank-prompt-template.md
docs/workflow/prompts/templates/subjects/<subject>-prompt-template.md
```

補上：
- 年級
- 科目
- 教材版本
- 範圍
- 題數
- 難易度
- 題型
- 校內考風或歷屆試題摘要
- 教材文字

輸出到：

```text
automation/question-banks/<bank-name>.md
```

## 4. 本地審題

依：

```text
docs/workflow/TEXTBOOK_TO_BANK_SOP.md
docs/workflow/question-bank-quality-spec.md
docs/workflow/DISTRACTOR_SELF_REVIEW.md
```

檢查：
- 範圍
- 題數
- 答案唯一性
- 干擾項
- 重複與概念過度重複
- 難易度
- 是否符合 Wayground 單選限制

困難題與高風險中等題必須依 `docs/workflow/DISTRACTOR_SELF_REVIEW.md` 做誘答選項自審。

## 5. Gemini 第二審稿

使用：

```text
docs/workflow/prompts/templates/review/gemini-review-prompt-template.md
```

保存輸出到：

```text
automation/output/gemini-reviews/
```

Gemini 回饋必須回到教材與題庫核對後才能採用。

## 6. 匯入 Wayground

依：

```text
docs/workflow/WORKFLOW_SOP.md
docs/workflow/tooling.md
```

優先使用：

```powershell
npm.cmd run wayground:import -- .\automation\question-banks\<bank-name>.md --subject <subject> --lang Chinese --grade <grade>
npm.cmd run wayground:check -- .\automation\question-banks\<bank-name>.md
npm.cmd run wayground:set-all-timers-2min
npm.cmd run wayground:publish
```

## 7. 更新入口頁

發布後更新：

```text
wayground/index.html
```

或新專案指定的題組入口頁。

每張卡片至少包含：
- 科目
- 範圍
- 題數
- Wayground 連結

## 8. 回報

回報時列出：

- 本地題庫絕對路徑
- Gemini 審題輸出絕對路徑
- Wayground quiz id 或分享連結
- 題組入口頁絕對路徑
- 題數與難易度分配
- 主要修正紀錄
