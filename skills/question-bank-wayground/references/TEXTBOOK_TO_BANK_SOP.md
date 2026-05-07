# Textbook to Question Bank SOP

這份 SOP 說明如何從已整理好的教材、教師手冊、課綱、教學目標、考試範圍與考古題，產生可匯入 Wayground 的本地 Markdown 題庫。

正式使用本 SOP 前，請先依 `PREP_BEFORE_QUESTION_BANK_SOP.md` 完成資料整理。若整理檔、原始教材與模型常識衝突，命題時以原始教材、本次範圍與整理檔為優先。

## 0. 目標

產出三個主要檔案，而不是讓流程散成太多文件：

```text
automation/output/<bank-name>-blueprint.md
automation/question-banks/<bank-name>.md
automation/output/<bank-name>-local-review.md
```

若需要正式給學生使用，再補外部審題與 Wayground 發布紀錄：

```text
automation/output/gemini-reviews/
automation/output/claude-reviews/
wayground/
```

核心原則：

- 教材與本次範圍決定「考什麼」。
- 考古題與校內考風決定「怎麼考」。
- 教學目標、課綱學習內容與 108 課綱用來檢查覆蓋，不取代教材。
- Bloom 與誘答選項用來檢查品質；不再用容易/中等/困難硬性配題，避免為了比例扭曲題型。
- Gemini 與 Claude 是審稿者，不是最終裁判；若審稿意見與教材衝突，回教材核對。

## 1. 前置摘要

先把出題依據整理成一頁摘要，不要每次分散成多份文件。摘要至少包含：

- 年級、科目、教材版本
- 範圍與題數
- 題型與 Wayground 路線
- 教材重點
- 教學目標或評量目標
- 課綱學習內容或 108 課綱對應
- 考古題或校內考風摘要
- 特殊要求，例如偏文法、偏閱讀、不可出題型

建議資料來源放在：

```text
docs/references/textbooks/
docs/references/teacher-guides/
docs/references/exams/
docs/references/curriculum/
docs/references/scope/
```

依據順序：

```text
教材與教師手冊 > 本次範圍 > 校內考風 > 課綱/教學目標 > 品質規格
```

若本次只是同一課、同一範圍的後續題庫，可沿用既有前置摘要，不必重新整理。

## 2. 題型藍圖與 Coverage

正式產題前，只做一張表，同時完成題型藍圖與 coverage matrix。不要另外拆成兩份文件。

表格至少包含：

```markdown
| 題號 | 題型 | 教材重點 | 教學目標/課綱對應 | Bloom | 考風依據 | 備註 |
|---|---|---|---|---|---|---|
| 1 | 字音 | 本課生字 | 目標 1 | 記憶 | 考古題常見字音題 |  |
```

硬條件：

- 若使用者要求參考考古題或校內考風，藍圖是必做步驟。
- 題型比例要能回扣考古題摘要，不得只把教材重點改寫成一串概念題。
- 除非使用者明確指定單一概念，主要教學目標與教材重點都要有題目覆蓋，不可偏廢。
- Bloom 預設使用記憶、理解、應用、分析、評鑑；創造不列入 Wayground 單選預設。
- 不使用容易/中等/困難作為配題硬條件；若使用者特別要求難度標記，需另外說明，且不可取代 Bloom 與教學目標 coverage。

國文題庫若有考古題風格，通常要檢查是否合理保留：

- 字音 / 注音
- 字形
- 詞義 / 成語
- 修辭
- 句義 / 課文理解
- 文言字義、句式、翻譯、用典（限文言課）
- 閱讀題組或短文判讀
- 語文常識 / 應用文格式

英文題庫若有考古題風格，通常要檢查是否合理保留：

- 字彙與片語情境
- 文法句型
- 對話完成或基本問答
- 克漏字
- 閱讀理解與表格資訊
- 若紙本有聽力感，改寫成短對話或情境判斷，不製造需要音檔才成立的題目

## 3. 產出本地題庫

題庫先寫到：

```text
automation/question-banks/<bank-name>.md
```

格式：

```markdown
# 題庫標題

範圍：
題數：
題型：Wayground 單選題，A-D 四選一
考風依據：

1. 題幹
A. 選項
B. 選項
C. 選項
D. 選項
答案：B
Bloom：記憶
```

產題原則：

- 每題都要能回扣本次範圍。
- 不出需要教材外資料才能穩定作答的題目。
- 不出問命題技巧、難度標籤、Bloom 類別或教學目標的後設題。
- 學生端題幹與選項不得出現來源字眼或教師端用語，例如 `備課用書`、`教材指出`、`教學目標`、`學習表現`、`題解`、`命題方向`。

### Wayground 題組暫行規則

Wayground 平台本身有 Passage / Text & questions 題組功能，但目前 Markdown 直接匯入腳本會把每一題轉成獨立 MCQ，不會建立共用 passage。

因此，在 `wayground:passage-import` 或等效流程完成前：

- 每一道題都必須自包含。
- 不可讓題目只寫「根據上文」、「上述短文」、「若將短文與本文合併比較」而不附短文。
- 若紙本考古題是題組，轉成目前 Markdown 題庫時，要把必要閱讀材料重複放進每一道題的題幹。
- 本地初審要搜尋 `短文`、`上文`、`上述`、`前文`、`這段文字`、`合併比較` 等詞，確認該題本身已有足夠材料。

## 4. 本地一審

本地一審合併原本的「格式檢查、coverage 檢查、誘答自審」。不要另外拆出太多文件；直接寫在：

```text
automation/output/<bank-name>-local-review.md
```

必查項目：

- 題數正確
- 每題 A-D 四個選項
- 每題只有一個最佳答案
- 答案可由教材、題幹或本次範圍推得
- 不超出範圍
- 題幹清楚，不靠猜老師意思
- Bloom 分配合理，且不塌縮成記憶題
- 題型配置符合藍圖
- 主要教學目標或教材重點都有覆蓋
- 考古題或校內考風比例有被保留
- 無明顯重複題或概念過度重複
- 學生端沒有來源字眼或教師端用語
- 每題自包含，不依賴共用短文或上文

誘答檢查併入本地一審，重點看高層次 Bloom 題與高風險題：

- 每個錯誤選項對應哪一種學生可能犯的錯
- 多數應用、分析或評鑑題至少有一到兩個錯誤選項會讓部分理解的學生猶豫
- 正答沒有因為最長、最完整、最正面而過度突出
- 高層次題不是只靠題幹變長或敘述變模糊

若說不出錯誤選項為什麼有誘答性，就重寫選項。

本地一審若發現問題，直接修本地題庫，不要先進 Wayground。

## 5. 外部審題與 Wayground

### Gemini 二審

下列情況建議或要求做 Gemini 二審：

- 語文科、社會科
- 題目涉及價值判斷、文本整合、敘述判斷
- 題庫會正式給學生使用
- 本地一審已發現答案、範圍或誘答疑慮

Gemini 主要檢查：

- 錯題與雙答案
- 範圍與教材支撐
- 題型比例是否符合考古題或校內考風
- 題幹是否自含
- 誘答項是否太弱或太荒謬

Gemini 修正後若改動較大，可重審一次；小改可直接記錄。

### Claude 三審

正式發布、跨章節題庫或已經經過一輪修正的題庫，建議做 Claude 三審。

Claude 三審只做最後 gate，不當改寫機器：

- 是否還有 blocking issues
- 是否仍有錯題、雙答案或超綱題
- 是否符合考風與平台路線
- 是否建議進入 Wayground import / check / timer / publish

Claude prompt 應短而聚焦，要求輸出：

```text
blocking issues
recommended fixes
residual risks
final decision
```

### 修正與上架

根據本地一審、Gemini 二審與 Claude 三審：

- 明確錯誤：修正
- 範圍疑慮：回教材確認後修正或保留
- 小建議：視教學需求採用，並記錄理由

只有本地題庫通過後，才接續：

```text
docs/workflow/WORKFLOW_SOP.md
```

進 Wayground 前，先查科目分流決策：

```text
docs/subject-wayground-routing.md
```

標準命令：

```powershell
npm.cmd run wayground:import -- .\automation\question-banks\<bank-name>.md --subject <subject> --lang Chinese --grade <grade>
npm.cmd run wayground:check -- .\automation\question-banks\<bank-name>.md
npm.cmd run wayground:set-all-timers-2min
npm.cmd run wayground:publish
```

發布後至少確認：

- 標題
- 題數
- 每題時間
- 題目顯示沒有截斷
- 發布紀錄已存入 `wayground/`

## 可省略條件

為了避免流程過重，可依任務類型簡化：

- 若只是快速自用複習題，可省略 Claude 三審，但仍要做本地一審。
- 若同一課已經完成前置摘要與考風整理，可沿用摘要，不必重做資料整理。
- 若是單一文法、單一公式或單一概念的 10 題專練，藍圖可簡化，但仍需列題號、考點、Bloom 與答案檢查。
- 若題庫不正式給學生使用，可不做 Gemini，但不能省略答案唯一性、範圍與誘答檢查。

## 建議輸出組合

標準高品質題庫：

```text
<bank-name>-blueprint.md
<bank-name>.md
<bank-name>-local-review.md
gemini-reviews/
claude-reviews/
wayground/
```

快速但仍可控的題庫：

```text
<bank-name>-blueprint.md
<bank-name>.md
<bank-name>-local-review.md
```
