# Wayground 模組邊界

這份文件用來定義 `question-bank-wayground-workflow` 的通用模組邊界，避免之後抽成獨立 GitHub 專案或 Codex skill 時，混入單一專案的個案資料。

## 目標

- 讓 Wayground 題庫流程可以搬到其他教學專案使用。
- 保留各專案自己的教材、題庫、審題紀錄與發布連結。
- 把「通用流程」和「單一專案成果」分開，降低後續維護與同步成本。

## 通用模組應包含

`tools/question-bank-wayground-workflow/` 應只放可重複使用的內容：

- `README.md`：模組用途與部署方式。
- `END_TO_END_FLOW.md`：端到端流程索引。
- `TEXTBOOK_TO_BANK_SOP.md`：教材到本地題庫的 SOP。
- `DISTRACTOR_SELF_REVIEW.md`：誘答選項自審規則。
- `WORKFLOW_SOP.md`：Wayground 匯入、檢查、發布流程。
- `DEPLOYMENT_CHECKLIST.md`：搬到新專案時的檢查清單。
- `PROJECT_CONFIG_TEMPLATE.md`：專案設定檔範本。
- `PACKAGE_SCRIPTS_SNIPPET.json`：可合併到新專案的 scripts 範本。
- `docs/`：通用品質規格、工具說明、科目路由策略。
- `prompts/`：master prompt、分科 prompt、Gemini review prompt、Claude final review prompt。
- `templates/`：可複製的設定或資料範本。
- `scripts/`：安裝或同步模組的輔助腳本。
- `automation/`：可重複使用的 CDP / Wayground / Gemini 腳本。

## 專案工作區應包含

各專案自己的內容應留在專案資料夾，例如：

`<learning-scope>/<exam-stage>/<subject>/question-bank/`

這一層可以放：

- `project.config.md`：該年級、學期、段考、科目的設定。
- `docs/references/`：教材摘要、教師手冊整理、考古題整理、範圍公告。
- `automation/question-banks/`：實際產出的本地 Markdown 題庫。
- `automation/output/`：本地初審、誘答自審、Gemini review、Claude final review 結果。
- `wayground/`：Wayground 匯入紀錄、發布紀錄、quiz links。
- 專案頁面需要的回寫資料，例如複習頁上的 Wayground 連結。

## 不應放入通用模組的內容

以下內容不應長期留在 `tools/question-bank-wayground-workflow/`：

- 單次執行產生的 `automation/output/*.json`。
- 單次執行產生的截圖，例如 `automation/output/*.png`。
- 單一專案專用的題庫、年級、段考、章節成果。
- Wayground 實際 quiz id 或 share link，除非放在文件範例且明確標為 sample。
- 登入 session、API key、`.env` 或任何敏感資訊。

## 可保留在通用模組的科目策略

像「自然科使用 unicode-plus 直接匯入」與「數學使用 Wayground AI 出題後清題」這類規則可以留在通用模組，因為它們是跨專案可複用的實測策略。

但文件應避免寫成單一專案個案，例如不要寫「某年級某段考某章節使用某 quiz id」。若需要示例，請使用 placeholder：

```text
<grade-term>
<exam-stage>
<subject>
<chapter>
<wayground-quiz-id>
```

## 未來抽成獨立 repo 的建議切法

第一階段先在目前專案 repo 內維持現有位置，只整理邊界與忽略規則。

第二階段可以把以下內容搬到獨立 repo：

```text
question-bank-wayground-workflow/
  README.md
  END_TO_END_FLOW.md
  TEXTBOOK_TO_BANK_SOP.md
  DISTRACTOR_SELF_REVIEW.md
  WORKFLOW_SOP.md
  DEPLOYMENT_CHECKLIST.md
  PROJECT_CONFIG_TEMPLATE.md
  PACKAGE_SCRIPTS_SNIPPET.json
  docs/
  prompts/
  templates/
  scripts/
  automation/
```

第三階段再視需要包成 Codex skill。skill 內應提供：

- 必讀 SOP 順序。
- 專案設定讀取規則。
- 題庫產出與審題流程。
- Wayground 直接匯入與 AI 出題分流規則。
- 發布後回寫專案頁面的檢查清單。

## 下一步整理建議

1. 清掉或搬離 `tools/question-bank-wayground-workflow/automation/output/` 的單次執行產物。
2. 確認 `.gitignore` 只忽略執行產物，不忽略通用文件與題庫 Markdown。
3. 檢查通用模組文件中是否還有專案個案路徑或 quiz id。
4. 將目前已完成的實戰案例整理成 project workspace example，而不是混在通用模組內。
