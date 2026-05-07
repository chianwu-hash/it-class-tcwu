# Codex Skill 化計畫

這份文件規劃未來如何把 `question-bank-wayground-workflow` 包成 Codex skill，讓其他專案可以用同一套出題、審題與 Wayground 上架流程。

## Skill 目標

讓使用者可以在任一教材專案中說明需求後，由 Codex 依固定流程完成：

- 讀取 project config 與教材來源。
- 組合 master prompt 與 subject prompt。
- 產出本地 Markdown 題庫。
- 做本地初審與誘答選項自審。
- 需要時送 Gemini 二審與 Claude final review。
- 依科目路由進 Wayground：直接匯入或 AI 出題後清題。
- 發布後回寫專案頁面或連結紀錄。

## Skill 觸發情境

未來 `SKILL.md` 可描述以下觸發條件：

- 使用者提到 Wayground、題庫、出題、審題、匯入測驗。
- 使用者要求從教材、教師手冊、範圍公告或考古題產生題庫。
- 使用者要求處理數學公式、自然化學式在 Wayground 的顯示問題。
- 使用者要求把題庫發布到 Wayground，或把 Wayground 連結回寫到網站。

## Skill 必讀文件順序

建議 `SKILL.md` 要求 Codex 依序閱讀：

1. `README.md`
2. `END_TO_END_FLOW.md`
3. `TEXTBOOK_TO_BANK_SOP.md`
4. `DISTRACTOR_SELF_REVIEW.md`
5. `WORKFLOW_SOP.md`
6. `docs/question-bank-quality-spec.md`
7. `docs/subject-wayground-routing.md`
8. `prompts/master-question-bank-prompt-template.md`
9. 對應分科 prompt
10. `prompts/review/gemini-review-prompt-template.md`
11. `prompts/review/claude-final-review-prompt-template.md`

若只是更新文件或檢查流程，可以只讀相關文件，不必每次讀完整套。

## Skill 執行規則

Skill 應要求 Codex：

- 不跳過本地 Markdown 題庫階段。
- 不把未審教材直接交給 Wayground AI 當最終題庫。
- 困難題與高風險中等題必須能說明每個誘答選項的誤選原因。
- Gemini 與 Claude 是審稿者，不是最終裁判；最終仍要回教材與範圍核對。
- 自然科預設走 `unicode-plus` 直接匯入。
- 數學科預設走 Wayground AI 出題，生成後刪錯題與重複題，並用截圖或人工視覺檢查公式。
- 發布前要確認題數、答案唯一性、Bloom 分配、題型轉換與平台顯示。

## Skill 輸入資料

每次執行時，Codex 應先找：

- `project.config.md`
- `docs/references/`
- `automation/question-banks/`
- `automation/output/`
- `wayground/`

若專案尚未建立這些資料夾，則依 `PROJECT_CONFIG_TEMPLATE.md` 與 `DEPLOYMENT_CHECKLIST.md` 建立。

## Skill 輸出資料

Skill 應將專案產物放在專案工作區，而不是 skill 目錄本身：

- 題庫：`automation/question-banks/<bank-name>.md`
- 本地初審：`automation/output/<bank-name>-local-review.md`
- 誘答自審：`automation/output/<bank-name>-distractor-review.md`
- Gemini review：`automation/output/gemini-reviews/`
- Claude final review：`automation/output/claude-reviews/`
- Wayground 發布紀錄：`wayground/`

## Skill 不應處理的內容

- 不保存使用者帳號密碼。
- 不保存 `.env` 或 API key。
- 不把瀏覽器 session 放入 repo。
- 不把單次 runtime output 放回通用 skill 目錄。
- 不把未經確認的 AI 題目直接發布。

## 建議 Skill 檔案結構

```text
skills/question-bank-wayground/
  SKILL.md
  references/
    README.md
    END_TO_END_FLOW.md
    TEXTBOOK_TO_BANK_SOP.md
    DISTRACTOR_SELF_REVIEW.md
    WORKFLOW_SOP.md
    docs/
    prompts/
    templates/
  scripts/
    install-module.ps1
```

若 automation 腳本仍需要在專案根目錄執行，skill 可以保留安裝或同步指引，不一定直接內嵌所有腳本。

## Skill 化前置條件

在真正建立 skill 前，建議先完成：

1. 抽成獨立 GitHub repo。
2. 清乾淨通用模組中的 runtime output。
3. 確認 `scripts/install-module.ps1` 能安裝所有必要文件。
4. 用一個非目前主專案的測試專案跑過最小流程。
5. 把 Wayground UI 變動造成的手動介入點寫進 troubleshooting。

## 目前進度

第一版 skill scaffold 已建立於：

```text
skills/question-bank-wayground/
```

目前已完成：

- `SKILL.md`：定義觸發情境、必讀文件順序、核心規則、分科路由與輸出位置
- `agents/openai.yaml`：提供 Codex UI 顯示名稱、簡述與預設提示詞
- `references/`：skill 自帶所有必讀文件副本（SOP、prompts、quality spec、routing、tooling）
- `SKILL.md` 路徑改用 `./references/`，不再依賴 repo 結構
- `references/troubleshooting.md`：收錄 Wayground UI 變動與 CDP 操作的手動介入點
- `install-module.sh` 更新為同時複製 `skills/` 到目標專案
- `install-module.ps1` 更新為同時複製 `skills/` 到目標專案
- 用乾淨測試專案（`/tmp/qbwf-skill-validation`）驗證安裝後 skill 結構完整

目前尚未完成：

- `references/` 與 `docs/workflow/` 有重複內容，文件改版後需同步兩處
  — 目前接受此重複，維護時記得兩處都更新
- 用另一個真實專案完整驗證 skill 是否足以獨立帶完題庫產生、審題、Wayground 發布流程
