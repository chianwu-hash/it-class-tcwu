# Portability Test

這份文件記錄 `question-bank-wayground-workflow` 在抽成獨立 repo 前的可搬移性驗證方式與目前結果。

## 測試目標

- 確認 shell 安裝腳本能在乾淨專案中建立標準資料夾。
- 確認 workflow 文件、prompts、templates 與 automation 腳本都會被複製。
- 確認安裝後的測試專案不含來源專案名稱、絕對路徑或真實 Wayground quiz id。
- 確認 JSON 範本可被解析。

## 測試環境

- OS：Ubuntu VM
- Shell：bash
- 測試路徑：`/tmp/wayground-portability-test`
- 安裝腳本：`scripts/install-module.sh`
- PowerShell 腳本：本機未安裝 `pwsh` / `powershell`，Windows 路線需日後在 Windows 或已安裝 PowerShell 的環境驗證。

## 測試指令

```bash
rm -rf /tmp/wayground-portability-test
mkdir -p /tmp/wayground-portability-test
tools/question-bank-wayground-workflow/scripts/install-module.sh /tmp/wayground-portability-test
```

## 檔案與資料夾驗收

以下項目已確認存在：

- `automation/wayground-import-from-bank.js`
- `automation/wayground-generate-from-bank.js`
- `automation/wayground-check-generated-quiz.js`
- `automation/wayground-delete-questions.js`
- `automation/wayground-set-all-timers-2min.js`
- `automation/wayground-publish.js`
- `automation/output/gemini-reviews`
- `automation/output/claude-reviews`
- `docs/workflow/README.md`
- `docs/workflow/END_TO_END_FLOW.md`
- `docs/workflow/TEXTBOOK_TO_BANK_SOP.md`
- `docs/workflow/DISTRACTOR_SELF_REVIEW.md`
- `docs/workflow/WORKFLOW_SOP.md`
- `docs/workflow/module-boundary.md`
- `docs/workflow/extraction-plan.md`
- `docs/workflow/codex-skill-plan.md`
- `docs/workflow/question-bank-quality-spec.md`
- `docs/workflow/subject-wayground-routing.md`
- `docs/workflow/tooling.md`
- `docs/workflow/prompts/templates/master-question-bank-prompt-template.md`
- `docs/workflow/prompts/templates/review/gemini-review-prompt-template.md`
- `docs/workflow/prompts/templates/review/claude-final-review-prompt-template.md`
- `docs/workflow/prompts/templates/subjects/science-prompt-template.md`
- `docs/references/textbooks`
- `docs/references/teacher-guides`
- `docs/references/scope`
- `docs/references/exams`
- `docs/references/curriculum`
- `templates/project-workspace.sample.md`
- `templates/wayground-quizzes.sample.json`
- `project.config.md`
- `PACKAGE_SCRIPTS_SNIPPET.question-bank-wayground.json`
- `wayground`

## 專案殘留掃描

掃描項目：

- 來源專案名稱。
- 來源專案路徑。
- 來源專案年級與段考資料夾名稱。
- 真實 Wayground quiz id 前綴。

結果：未在 dry-run 測試專案中掃到上述殘留內容。

## JSON 驗收

已確認下列 JSON 可解析：

- `PACKAGE_SCRIPTS_SNIPPET.question-bank-wayground.json`
- `templates/wayground-quizzes.sample.json`

## 目前結論

Ubuntu / bash 安裝路線已通過乾淨專案 dry run，可以把模組安裝到不依賴來源專案的 workspace。

尚未完成：

- Windows / PowerShell 實機驗證。
- 用 dry-run 專案實際產生一份 sample 題庫。
- 連到已登入的 Wayground CDP session 做最小匯入測試。

下一階段建議先在 Windows 驗證 `scripts/install-module.ps1`，再建立獨立 repo。
