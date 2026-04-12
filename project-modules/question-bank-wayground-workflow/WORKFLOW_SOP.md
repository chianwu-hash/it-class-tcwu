# Portable Question Bank Workflow SOP

本 SOP 用於新教學專案，不綁定特定年級或學校。它涵蓋從教材到題庫，再到 Wayground 上架的完整流程。

前半段細節請搭配：

```text
docs/workflow/TEXTBOOK_TO_BANK_SOP.md
docs/workflow/DISTRACTOR_SELF_REVIEW.md
docs/workflow/prompts/
```

## 1. 建立資料來源

1. 將教材、教師手冊、歷屆試題放入 `docs/references/`。
2. 將 PDF 轉成 UTF-8 `.txt`。
3. 不要用終端機輸出的亂碼當作文字依據；以檔案內容為準。

## 2. 建立專案設定

1. 建立 `project.config.md`。
2. 明確寫下年級、科目、範圍、題數、難易度比例。
3. 固定命題依據順序。

## 3. 建立 prompt 系統

建議結構：

```text
docs/workflow/prompts/master-prompt.md
docs/workflow/prompts/subjects/chinese-prompt.md
docs/workflow/prompts/subjects/english-prompt.md
docs/workflow/prompts/subjects/math-prompt.md
docs/workflow/prompts/subjects/science-prompt.md
docs/workflow/prompts/subjects/social-prompt.md
```

可先從本模組複製：

```text
prompts/master-question-bank-prompt-template.md
prompts/subjects/
prompts/review/gemini-review-prompt-template.md
```

每個 prompt 必須包含：
- 角色定位。
- 命題依據順序。
- 範圍限制。
- 題型限制。
- 難易度定義。
- 干擾項規則。
- 自我驗證要求。

## 4. 本地出題

請先依 `docs/workflow/TEXTBOOK_TO_BANK_SOP.md` 完成：
- 教材文字整理
- 任務規格建立
- master prompt + subject prompt 組合
- 題庫初稿產出
- 本地初審

題庫先寫在：

```text
automation/question-banks/
```

建議 Markdown 格式：

```markdown
# 題庫標題

範圍：
- ...

題數：N 題

難易度：
- 容易：N 題
- 中等：N 題
- 困難：N 題

## 容易

1. 題幹
A. 選項
B. 選項
C. 選項
D. 選項
答案：B

## 中等

2. 題幹
A. 選項
B. 選項
C. 選項
D. 選項
答案：C

## 困難

3. 題幹
A. 選項
B. 選項
C. 選項
D. 選項
答案：D
```

## 5. 本地自檢

檢查：
- 題數是否正確。
- 每題是否有 A-D 四個選項。
- 每題是否只有一個答案。
- 正答是否客觀唯一。
- 題目是否在範圍內。
- 干擾項是否有真實誘答性。
- 是否有後設題或命題術語題。

困難題還要檢查干擾項是否有真實誘答性。若無法說明錯誤選項對應哪一種學生迷思，請重寫。

請依 `docs/workflow/DISTRACTOR_SELF_REVIEW.md` 做誘答選項自審。正式題庫至少要能對每一道困難題說明三個錯誤選項的誘答來源。

## 6. Gemini 第二審稿

使用 Gemini 時：
- 使用已登入 Chrome + CDP。
- 不要另開新登入流程。
- Gemini 是第二審稿者，不是最終裁判。
- 若 Gemini 與教材衝突，回到教材與範圍判斷。

建議保存審稿輸出到：

```text
automation/output/gemini-reviews/
```

可使用本模組模板：

```text
prompts/review/gemini-review-prompt-template.md
```

## 7. Wayground 上架

優先使用直接匯入：

```powershell
npm.cmd run wayground:import -- .\automation\question-banks\bank.md --subject Mathematics --lang Chinese --grade 8
npm.cmd run wayground:check -- .\automation\question-banks\bank.md
npm.cmd run wayground:set-all-timers-2min
npm.cmd run wayground:publish
```

若有特殊需求才使用 AI 生成：

```powershell
npm.cmd run wayground:generate -- .\automation\question-banks\bank.md --subject Mathematics --lang Chinese --grade 8 --count 30
```

## 8. 更新題組網頁

所有題組發布後，再更新入口頁，例如：

```text
wayground/index.html
```

每張卡片至少包含：
- 科目。
- 範圍。
- 題數。
- Wayground 連結。

## 9. 交付回報

請回報：
- 題庫 Windows 絕對路徑。
- Gemini 審稿 Windows 絕對路徑。
- Wayground quiz id。
- 題組入口網頁 Windows 絕對路徑。
- 題數與難易度分配。
- 修正過的核心問題。
