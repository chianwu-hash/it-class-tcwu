# 獨立 Repo 抽離計畫

這份文件規劃如何把 `question-bank-wayground-workflow` 從單一教學專案中抽離，變成可由多個專案共用的獨立 GitHub repo。

## 抽離原則

- 先穩定模組邊界，再建立獨立 repo。
- 只抽通用流程、腳本、模板與 prompt，不抽單一專案的教材、題庫、審稿輸出或 Wayground quiz id。
- 目前專案可以作為第一個實戰案例，但不應成為通用 repo 的預設情境。
- 抽離後仍要支援專案內本地 Markdown 題庫階段，不讓 Wayground AI 直接改寫未審教材。

## 第一階段：目前專案內部整理

目前先在既有專案 repo 內完成以下整理：

1. 定義模組邊界：見 `docs/module-boundary.md`。
2. 排除通用模組的 runtime output：`tools/question-bank-wayground-workflow/automation/output/` 不進 git。
3. 保留科目路由策略，但不要在通用文件中綁定特定 quiz id。
4. 確認安裝腳本只複製通用檔案，不複製單次執行輸出。
5. 把實際題庫、審稿、發布紀錄留在 `<learning-scope>/.../question-bank/` 這類 project workspace。

## 第二階段：建立獨立 repo

建議 repo 名稱：

```text
question-bank-wayground-workflow
```

可先用匯出腳本建立乾淨 repo 目錄：

```bash
./scripts/export-standalone.sh /tmp/question-bank-wayground-workflow-export
```

匯出後再進入目錄執行：

```bash
git init
git add .
git commit -m "Initial Wayground workflow module"
```

建議 repo 結構：

```text
question-bank-wayground-workflow/
  CHANGELOG.md
  README.md
  AI_DEPLOY_PROMPT.md
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

不要搬到獨立 repo 的內容：

- 特定專案的年級、學期、頁面與教材資料夾。
- `automation/output/` 的執行結果。
- 實際題庫、教材摘要、Gemini / Claude 審稿結果。
- Wayground quiz id、分享連結、發布截圖。
- `.env`、瀏覽器 session、API key 或任何私密設定。

## 第三階段：同步方式選擇

可選同步方式：

- `git subtree`：適合把外部 repo 內容同步回既有專案的 `tools/question-bank-wayground-workflow/`，日常使用比 submodule 直覺。
- `git submodule`：版本明確，但對非工程工作流較容易混淆。
- `npm package`：若 automation 腳本逐漸整理成 CLI，這會是長期比較乾淨的方式。
- 手動複製版：初期可行，但要搭配 `DEPLOYMENT_CHECKLIST.md`，避免漏更新。

建議短期使用 `git subtree` 或手動複製版；等 CLI 穩定後再評估 npm package。

## 第四階段：版本與相容性

獨立 repo 應維護：

- `CHANGELOG.md`：記錄 SOP、prompt、automation 行為變更。
- 範例專案設定：使用 placeholder，不用真實學生資料或 quiz id。
- 版本標籤：例如 `v0.1.0`、`v0.2.0`。
- 相容性說明：Wayground UI、CDP 腳本、Gemini / Claude 審稿流程若有變化，要寫入版本紀錄。

## 驗收標準

抽離完成後，任一新專案應能做到：

1. 複製或安裝模組。
2. 填寫 project config。
3. 放入教材、考古題或範圍公告。
4. 依 master prompt 與 subject prompt 產出本地 Markdown 題庫。
5. 完成本地初審、誘答自審、Gemini 二審與必要的 Claude final review。
6. 依科目路由選擇 Wayground 直接匯入或 AI 出題後清題。
7. 發布後把連結回寫到該專案自己的入口頁。
