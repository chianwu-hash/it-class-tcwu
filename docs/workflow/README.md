# Question Bank Wayground Workflow Module

這是一個可搬移到其他教學專案的「題庫製作到 Wayground 上架」模組。

## Quick Start

若你要把這個 repo 當成獨立模組使用，建議先完成以下步驟：

1. 安裝依賴：

```bash
npm install
```

2. 準備已登入 Wayground / Gemini 的 Chrome，並以 `9222` 開啟 remote debugging。

   若你的 Chrome 使用其他 CDP port，可用環境變數覆蓋，例如：

   ```bash
   CDP_URL=http://127.0.0.1:18801 npm run wayground:inspect
   ```

3. 先測試瀏覽器連線：

```bash
npm run browser:smoke
```

4. 將模組安裝到目標專案：

Ubuntu / macOS / WSL：

```bash
./scripts/install-module.sh <target-project-root>
```

Windows / PowerShell：

```powershell
.\scripts\install-module.ps1 -TargetProjectRoot <target-project-root>
```

5. 到目標專案中完成：

- 合併 `PACKAGE_SCRIPTS_SNIPPET.question-bank-wayground.json` 到 `package.json`
- 填寫 `project.config.md`
- 依 `docs/workflow/DEPLOYMENT_CHECKLIST.md` 做第一次小規模驗證

適用情境：
- 從 PDF 教材、歷屆考題或教師手冊整理文字資料。
- 依教材範圍與命題規格組合 prompt，產生本地 Markdown 題庫。
- 以「前置摘要 → 題型藍圖/coverage 一張表 → 本地題庫 → 本地一審 → 外部審題與上架」五步流程製作題庫。
- 本地一審合併格式、coverage 與誘答自審；正式給學生使用時再做 Gemini 二審，重要題庫可再做 Claude 最終 gate。
- 將題庫直接匯入 Wayground，避免 AI 生成流程改寫題目。
- 最後整理成題組入口網頁。

## 模組內容

- `AI_DEPLOY_PROMPT.md`：給 AI 讀的部署提示詞。
- `END_TO_END_FLOW.md`：從教材到 Wayground 發布的完整流程索引。
- `DEPLOYMENT_CHECKLIST.md`：搬到新專案後的檢查清單。
- `CHANGELOG.md`：通用模組變更紀錄。
- `PROJECT_CONFIG_TEMPLATE.md`：新專案設定檔範本。
- `PACKAGE_SCRIPTS_SNIPPET.json`：可加入新專案 `package.json` 的 scripts 片段。
- `PREP_BEFORE_QUESTION_BANK_SOP.md`：教材、課綱、教學目標與出題範圍整理的前置 SOP。
- `WORKFLOW_SOP.md`：搬移版流程 SOP。
- `TEXTBOOK_TO_BANK_SOP.md`：從教材整理、組合 prompt、產出題庫到審題的前半段 SOP。
- `DISTRACTOR_SELF_REVIEW.md`：進 Wayground 前的誘答選項自審門檻。
- `prompts/`：教材到題庫的可搬移命題與審題 prompt 模板。
- `templates/`：新專案可複製的設定與 workspace 範本。
- `scripts/install-module.ps1`：將模組複製到新專案的 PowerShell 安裝腳本，適合 Windows 或已安裝 PowerShell 的環境。
- `scripts/install-module.sh`：將模組複製到新專案的 shell 安裝腳本，適合 Ubuntu、macOS 或 WSL。
- `scripts/export-standalone.sh`：將模組輸出成獨立 repo 根目錄的 shell 腳本。
- `automation/`：Wayground、Gemini、CDP 相關腳本副本。
- `docs/codex-skill-plan.md`：未來包成 Codex skill 的規劃。
- `docs/extraction-plan.md`：未來抽成獨立 GitHub repo 的規劃。
- `docs/question-bank-quality-spec.md`：題庫品質規格。
- `docs/module-boundary.md`：通用模組與專案工作區的邊界定義。
- `docs/portability-test.md`：抽離獨立 repo 前的可搬移性驗證紀錄。
- `docs/subject-wayground-routing.md`：自然與數學等科目的 Wayground 匯入/AI 生成分流決策。
- `docs/tooling.md`：工具與腳本參考。
- `templates/project-workspace.sample.md`：專案教材、題庫、審稿與發布紀錄的建議擺放方式。

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
- 先依 `PREP_BEFORE_QUESTION_BANK_SOP.md` 整理教材、課綱、教學目標與出題範圍。
- 複製教材到題庫 SOP 與 prompt 模板。
- 建立新專案專用的命題 prompt。
- 試產一份本地 Markdown 題庫並完成審題。
- 用一份小題庫試跑 Wayground 匯入流程。

也可以用安裝腳本先複製標準檔案。

Windows / PowerShell：

```powershell
.\scripts\install-module.ps1 -TargetProjectRoot <target-project-path>
```

Ubuntu / macOS / WSL：

```bash
./scripts/install-module.sh <target-project-path>
```

安裝腳本會建立標準資料夾、複製 automation 腳本、workflow 文件、prompt 模板與 templates，並把 scripts snippet 複製成 `PACKAGE_SCRIPTS_SNIPPET.question-bank-wayground.json` 供你合併進 `package.json`。

目前安裝腳本也會一併複製：

- `automation/*.js`
- `automation/lib/browser.js`
- workflow 文件
- prompt 模板
- templates

## 獨立 Repo 匯出

若要準備建立獨立 GitHub repo，可先輸出乾淨的 repo 根目錄：

```bash
./scripts/export-standalone.sh /tmp/question-bank-wayground-workflow-export
```

匯出腳本會排除 `automation/output/`、`.env` 等執行產物與敏感設定，並把 `templates/standalone-gitignore.sample` 複製成匯出目錄的 `.gitignore`。

## 建議新專案資料夾

```text
automation/
automation/question-banks/
automation/output/
automation/output/gemini-reviews/
automation/output/claude-reviews/
docs/workflow/
docs/references/
docs/references/textbooks/
docs/references/teacher-guides/
docs/references/scope/
docs/references/exams/
docs/references/curriculum/
templates/
wayground/
```

## 核心原則

- 教材與考題脈絡放在新專案，不要硬沿用原專案年級設定。
- 教材到題庫的命題流程必須在本地完成，並留下可讀的 Markdown 題庫。
- 應用、分析、評鑑與高風險題必須先做誘答選項自審，不能把荒謬選項或顯然錯誤選項當成干擾項。
- 題庫必須先在本地完成，再進 Wayground。
- Gemini 是第二審稿者，不是最終裁判。
- Wayground 原則上優先使用 `wayground:import` 直接匯入，不讓 AI 改寫題目；若科目已實測有更適合的路線，依 `docs/subject-wayground-routing.md` 分流。
- 最後才更新題組入口網頁。

## 已知限制

- `wayground-import-from-bank.js` 會保留文字，但不會自動轉成漂亮的數學公式物件；數學科若需要 Wayground 公式渲染，可依 `docs/subject-wayground-routing.md` 走 AI 出題後清題流程。
- `wayground-import-from-bank.js` 會忽略題後 metadata，例如 `難易度`、`難度`、`Bloom`、`依據`、`分配檢查` 與分隔線，避免審題資訊混進 Wayground 題幹。
- 複雜圖表、幾何圖、圖片題仍需另外處理。
- 需要使用已登入 Chrome 的 CDP session，不建議讓 AI 重新登入帳號。預設連線為 `http://127.0.0.1:9222`，可用 `CDP_URL` 覆蓋。
