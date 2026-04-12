# Question Bank Wayground Workflow Module

這是一個可搬移到其他教學專案的「題庫製作到 Wayground 上架」模組。

適用情境：
- 從 PDF 教材、歷屆考題或教師手冊整理文字資料。
- 依教材範圍與命題規格組合 prompt，產生本地 Markdown 題庫。
- 在本地產出 Markdown 題庫。
- 做本地自檢與 Gemini 第二審稿。
- 將題庫直接匯入 Wayground，避免 AI 生成流程改寫題目。
- 最後整理成題組入口網頁。

## 模組內容

- `AI_DEPLOY_PROMPT.md`：給 AI 讀的部署提示詞。
- `END_TO_END_FLOW.md`：從教材到 Wayground 發布的完整流程索引。
- `DEPLOYMENT_CHECKLIST.md`：搬到新專案後的檢查清單。
- `PROJECT_CONFIG_TEMPLATE.md`：新專案設定檔範本。
- `PACKAGE_SCRIPTS_SNIPPET.json`：可加入新專案 `package.json` 的 scripts 片段。
- `WORKFLOW_SOP.md`：搬移版流程 SOP。
- `TEXTBOOK_TO_BANK_SOP.md`：從教材整理、組合 prompt、產出題庫到審題的前半段 SOP。
- `DISTRACTOR_SELF_REVIEW.md`：進 Wayground 前的誘答選項自審門檻。
- `prompts/`：教材到題庫的可搬移命題與審題 prompt 模板。
- `templates/`：新專案可複製的 JSON 設定範本。
- `scripts/install-module.ps1`：將模組複製到新專案的 PowerShell 安裝腳本。
- `automation/`：Wayground、Gemini、CDP 相關腳本副本。
- `docs/question-bank-quality-spec.md`：題庫品質規格。
- `docs/tooling.md`：工具與腳本參考。

## 建議部署方式

1. 將整個資料夾複製到新專案，例如：

```powershell
Copy-Item -Recurse <source-module-path>\question-bank-wayground-workflow <target-project-path>\workflow-module
```

2. 讓 AI 先讀新專案中的：

```text
workflow-module\AI_DEPLOY_PROMPT.md
workflow-module\END_TO_END_FLOW.md
workflow-module\PROJECT_CONFIG_TEMPLATE.md
```

3. 請 AI 依照部署提示詞完成：

- 建立標準資料夾。
- 複製 `automation/` 腳本到新專案。
- 補上 `package.json` scripts。
- 建立專案設定檔。
- 複製教材到題庫 SOP 與 prompt 模板。
- 建立新專案專用的命題 prompt。
- 試產一份本地 Markdown 題庫並完成審題。
- 用一份小題庫試跑 Wayground 匯入流程。

也可以用安裝腳本先複製標準檔案：

```powershell
.\scripts\install-module.ps1 -TargetProjectRoot <target-project-path>
```

安裝腳本會建立標準資料夾、複製 automation 腳本、workflow 文件、prompt 模板與 templates，並把 scripts snippet 複製成 `PACKAGE_SCRIPTS_SNIPPET.question-bank-wayground.json` 供你合併進 `package.json`。

## 建議新專案資料夾

```text
automation/
automation/question-banks/
automation/output/
automation/output/gemini-reviews/
docs/workflow/
docs/references/
docs/references/textbooks/
docs/references/exams/
docs/references/curriculum/
templates/
wayground/
```

## 核心原則

- 教材與考題脈絡放在新專案，不要硬沿用原專案年級設定。
- 教材到題庫的命題流程必須在本地完成，並留下可讀的 Markdown 題庫。
- 困難題與高風險中等題必須先做誘答選項自審，不能把荒謬選項或顯然錯誤選項當成干擾項。
- 題庫必須先在本地完成，再進 Wayground。
- Gemini 是第二審稿者，不是最終裁判。
- Wayground 優先使用 `wayground:import` 直接匯入，不讓 AI 改寫題目。
- 最後才更新題組入口網頁。

## 已知限制

- `wayground-import-from-bank.js` 會保留文字，但不會自動轉成漂亮的數學公式物件。
- 複雜圖表、幾何圖、圖片題仍需另外處理。
- 需要使用已登入 Chrome 的 CDP session，不建議讓 AI 重新登入帳號。
