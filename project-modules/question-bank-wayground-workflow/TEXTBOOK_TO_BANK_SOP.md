# Textbook to Question Bank SOP

這份 SOP 補足可搬移模組的前半段流程：從教材、教師手冊、考試範圍與歷屆試題，產生本地 Markdown 題庫，並完成進 Wayground 前的審題。

## 0. 目標

產出一份可以直接進入 Wayground 匯入流程的本地題庫：

```text
automation/question-banks/<bank-name>.md
```

題庫必須先通過本地審題與必要的第二審稿，再進入 Wayground。Wayground 不是主要審題工具。

## 1. 整理資料來源

將資料放入新專案的 `docs/references/`，建議結構：

```text
docs/references/textbooks/
docs/references/teacher-guides/
docs/references/exams/
docs/references/curriculum/
docs/references/scope/
```

每份題庫至少要有：
- 本次教材或教材文字檔
- 本次明確範圍
- 題數與難易度要求

若要校準學校考風，另外準備：
- 歷屆校內考題
- 命題風格摘要
- 教師提供的特殊要求

## 2. 轉換教材文字

PDF 或掃描檔要先轉成 UTF-8 `.txt` 或可讀 Markdown。

規則：
- 不要使用終端機顯示的亂碼作為出題依據。
- 以 UTF-8 檔案內容、PDF 原文或人工確認後的文字為準。
- 若 OCR 文字有明顯錯字，先標註或修正再出題。
- 圖表、實驗裝置、地圖、幾何圖若無法可靠轉成文字，需人工補充關鍵資訊。

建議命名：

```text
docs/references/textbooks/<grade>/<subject>/<unit-or-lesson>.txt
docs/references/scope/<exam-scope>.md
docs/references/exams/<exam-name>.txt
```

## 3. 建立任務規格

在 `project.config.md` 或本次題庫檔案草稿中固定：

- 年級
- 科目
- 教材版本
- 範圍
- 題數
- 題型
- 難易度比例
- 是否要模仿校內考風
- 是否必須做 Gemini 第二審稿
- 不可出題型

範例：

```markdown
## Bank Task

- 年級：目標年級
- 科目：目標科目
- 範圍：目標課次或單元
- 題數：目標題數
- 題型：Wayground 單選，A-D 四選一
- 難易度：容易 N 題，中等 N 題，困難 N 題
- 依據順序：教材與教師手冊 > 本次範圍 > 校內考風 > 課綱 > 品質規格
```

## 4. 組合命題 Prompt

使用本模組的 prompt 模板：

```text
prompts/master-question-bank-prompt-template.md
prompts/subjects/<subject>-prompt-template.md
```

組合順序：

1. 貼上 master prompt。
2. 貼上對應科目的 subject prompt。
3. 貼上本次任務規格。
4. 貼上教材範圍文字或清楚列出可讀檔案位置。
5. 貼上歷屆考題摘要或校內風格摘要。
6. 要求輸出為本專案 Markdown 題庫格式。

不要只說「請出 30 題」。必須提供範圍、題數、難度與輸出格式。

## 5. 產出本地題庫

題庫先寫到：

```text
automation/question-banks/
```

建議格式：

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

...

## 困難

...
```

每一題都要能回扣本次範圍。若題目需要教材外資料才能穩定作答，刪除或重寫。

## 6. 本地初審

命題 AI 或接手者必須先做本地審題：

- 題數正確
- 難易度分配正確
- 每題 A-D 四個選項
- 每題只有一個最佳答案
- 題幹清楚，不靠猜題意
- 答案可由教材或範圍推得
- 不超出範圍
- 無明顯重複題
- 無概念過度重複
- 干擾項不是荒謬選項
- 困難題不是只靠題幹變長或敘述變模糊
- 沒有後設題，例如問命題技巧、難度標籤、干擾項設計

本地初審若發現問題，直接修本地題庫，不要先進 Wayground。

## 7. 困難題干擾項檢查

這一步是進 Wayground 前的必要門檻。細則請見：

```text
docs/workflow/DISTRACTOR_SELF_REVIEW.md
```

對每一道困難題，並對高風險中等題，至少在審稿筆記中確認：

- 每個錯誤選項對應哪一種學生可能犯的錯
- 是否至少有一到兩個錯誤選項會讓部分理解的學生猶豫
- 正答是否沒有因為最長、最完整、最正面而過度突出

若說不出錯誤選項為什麼有誘答性，就重寫選項。

建議留下簡短紀錄：

```markdown
Q23
- 正答：B，因為...
- A：學生若只注意...，可能誤選。
- C：學生若混淆...，可能誤選。
- D：學生若把...誤解為...，可能誤選。
- 判斷：保留 / 重寫
```

## 8. Gemini 第二審稿

下列情況建議或要求做 Gemini 第二審稿：

- 語文科、社會科
- 題目涉及價值判斷、文本整合、敘述判斷
- 先前初審已發現多處答案或範圍疑慮
- 題庫會正式給學生使用

使用：

```text
prompts/review/gemini-review-prompt-template.md
```

要求 Gemini 分類回報：
- definite errors
- likely issues
- minor suggestions

Gemini 是第二審稿者，不是最終裁判。若 Gemini 和教材衝突，以教材與範圍回查結果為準。

建議保存輸出：

```text
automation/output/gemini-reviews/<bank-name>.txt
```

## 9. 修正題庫並留下紀錄

根據本地初審與 Gemini 二審：

- 明確錯誤：修正
- 範圍疑慮：回教材確認後修正或保留
- 小建議：視教學需求採用

若有重要修正，可在題庫檔案頂端加入簡短備註：

```markdown
## Review Notes
- 2026-04-12：依二審回饋修正 Q7 干擾項，避免雙答案。
```

## 10. 進入 Wayground 流程

只有本地題庫通過後，才接續：

```text
docs/workflow/WORKFLOW_SOP.md
```

標準命令：

```powershell
npm.cmd run wayground:import -- .\automation\question-banks\<bank-name>.md --subject <subject> --lang Chinese --grade <grade>
npm.cmd run wayground:check -- .\automation\question-banks\<bank-name>.md
npm.cmd run wayground:set-all-timers-2min
npm.cmd run wayground:publish
```

若因平台需求使用 Wayground AI 生成，也仍要先有本地題庫並在生成後檢查對齊，不可直接用教材丟給 Wayground AI 當最終題庫。
