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
2. 明確寫下年級、科目、範圍、題數與 Bloom 分配原則。
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
- Bloom 分配原則。
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

1. 題幹
A. 選項
B. 選項
C. 選項
D. 選項
答案：B
Bloom：記憶

2. 題幹
A. 選項
B. 選項
C. 選項
D. 選項
答案：C
Bloom：理解

3. 題幹
A. 選項
B. 選項
C. 選項
D. 選項
答案：D
Bloom：應用
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

應用、分析、評鑑與高風險題還要檢查干擾項是否有真實誘答性。若無法說明錯誤選項對應哪一種學生迷思，請重寫。

請依 `docs/workflow/DISTRACTOR_SELF_REVIEW.md` 做誘答選項自審。正式題庫至少要能對每一道應用、分析、評鑑與高風險題說明三個錯誤選項的誘答來源。

## 6. 圖表與表格 Gate

若藍圖標記任何題目需要表格、輔助圖或必須圖，進外部審題前必須完成本節檢查。

### 表格題

表格適用於資料比較、平均、總量、分類、前後變化與多組數值。正式題庫中，表格可以是：

- 題幹內的文字表格。
- Markdown 表格。
- 圖片表格。

目前實測結論：

- Wayground 題幹支援 HTML `<table>`，也保留 inline style。
- Wayground 不會自動把 Markdown 表格渲染成表格；若直接送 Markdown 表格，只會顯示成管線文字。
- 本地題庫仍建議寫 Markdown 表格，方便審題；正式匯入時由 `wayground:import` 轉成 HTML table。
- 匯入後需用 DOM 或截圖確認表格不是管線文字。

表格題必查：

- 表格資料是否足以解題。
- 欄名與單位是否清楚。
- 題幹、答案與表格數字是否一致。
- 表格是否比純文字更清楚；若只是裝飾，改回文字。
- 匯入 Wayground 後是否保留為真正表格。

### 圖表題

數學與自然圖表題的核心原則：

> 圖表不能只靠視覺直覺決定，必須能回溯到結構化 figure spec。

每個正式圖表至少要有：

```text
figure id
題號
圖表型態
必要數值與單位
圖中標籤
本地圖檔路徑
Cloudinary URL
答案驗算
是否必須看圖才能解
```

強制流程：

1. 先建立 figure spec，固定數值、單位、標籤與答案驗算。
2. 幾何圖、立體圖、展開圖、複合形體、切割圖、挖空形體與任何影響答案的圖表，進 imagegen 前必須先建立 `structureDraft`。
3. 高風險精準圖的 `structureDraft` 階段必須納入 Gemini CLI：可由 Gemini CLI 直接產生 SVG 草圖，或由 Codex 先產草圖後請 Gemini CLI 做幾何/拓撲審查與修正建議。
4. `structureDraft` 可為 SVG、PNG 簡圖、座標草稿或其他可檢查的結構草圖，只求資訊完整與幾何關係正確，不追求美觀。
5. 不得只用自然語言 prompt 直接進 imagegen 產生上述高風險圖型。
6. 若 SVG 或簡圖直接成品不適合正式考題，可用 imagegen 依草圖重繪成考卷級圖表。
7. imagegen prompt 必須明確禁止不必要的視覺語意，例如多餘鋪色、陰影、漸層、局部色塊、額外文字。
8. imagegen prompt 必須明確保留 `structureDraft` 的幾何拓撲，例如前後全等面、對應稜、共同高度、半徑方向、切面位置與展開圖構件。
9. 最終圖上傳 Cloudinary，題庫以 `圖片：https://...` 記錄。
10. Wayground 匯入或生成後，確認題目 media 真的掛入圖片。

`structureDraft` 硬門檻：

- figure manifest 必須記錄 `structureDraft.type` 與 `structureDraft.path`；若使用座標草稿，需記錄足以重建圖形的座標或結構描述。
- 高風險精準圖必須在 visual review notes 或 manifest 記錄 Gemini CLI 的 `structureDraft` 參與結果：prompt 路徑、輸出草圖路徑、採用/不採用理由與人工審查狀態。
- 若 Gemini CLI 逾時、額度不足、無法讀圖或輸出不完整，必須記錄 fallback 原因；除非人工明確核准，不得跳過 `structureDraft` gate 直接進 imagegen。
- 高風險圖型缺少 `structureDraft` 時，狀態不得標為 `visual-review-passed`。
- 若 validator 尚未支援 `structureDraft` 欄位，人工紀錄仍必須在 visual review notes 明確列出草圖路徑與草圖審查結果。
- Q6 / Q10 這類立體圖不得以「標籤存在」視為通過；必須先確認立體物件本身成立。
- 若同一高風險圖在 Gemini CLI 參與後仍連續兩輪人工 FAIL，停止盲目修圖，升級為題目設計審查：改投影方式、改 2D 圖、改文字題、換題，或尋找正確參考圖後重新建立草圖。

### 圖表生成工具分流

數學與自然的精準圖表預設使用 Codex 內建 `imagegen` 工具生成或重繪，尤其是幾何圖、立體圖、自然實驗圖、標籤圖、讀圖題與任何會影響答案的圖表。

內建 `imagegen` 主線規則：

- prompt 必須由 figure spec 產生，不可只用自然語言概略描述。
- 高風險圖型的 prompt 必須同時引用 `structureDraft`，不得只引用 figure spec。
- 一次先產一張圖，先審圖再進下一張；不得在新圖型尚未穩定時批量盲跑。
- 每張圖都需比對 figure spec、題幹、答案驗算與圖中標籤。
- 產物需移入 `automation/figures/<bank-name>/` 後，才可進 Gemini / Claude CLI 視覺審查與 Cloudinary。
- 若同類型圖表已連續多批穩定，才可討論半批次生成；第一次使用的新圖型仍逐張處理。

ChatGPT browser image workflow 的定位：

- 適用於課堂插圖、簡報圖、資訊圖卡、風格化教學視覺、非答案關鍵圖。
- 不作為數學或自然精準圖表的預設工具。
- 只有在使用者明確指定、內建 `imagegen` 不可用，或已完成內建主線但需要另一路徑對照時，才可改走 ChatGPT browser workflow。
- 若改走 ChatGPT browser workflow，必須在紀錄中標明 fallback 原因，不可默默切換。

圖表題必查：

- 圖表必要數值與 figure spec 一致。
- 題幹、選項、答案與圖中標籤一致。
- 幾何物件本身是否成立；不可只檢查標籤與數字。
- 立體圖需檢查底面/頂面、前後全等面、對應邊、共同高度、連接稜與遮擋關係是否合理。
- 圖表是否有裁切、遮字、箭頭錯位、比例暗示錯誤或多餘元素。
- 鋪色是否有解題必要；若沒有，應使用白底、黑色輪廓、量測線與標籤。
- 若鋪色會被誤讀為液面、截面、部分體積或指定區域，不得使用。
- Cloudinary URL 可開，且為最新版圖片。
- Wayground API 或畫面確認 `query.media` 存在並指向正確圖片。

圖表題進 Gemini 二審與 Claude 三審時，prompt 必須提供：

- 題目與選項。
- 答案與驗算。
- figure spec。
- structureDraft 與其幾何不變量。
- 圖片連結。
- 要求審查圖題一致、標籤正確、圖表是否足以解題、幾何物件本身是否成立，以及是否有誤導性視覺元素。

已實測 Gemini CLI 與 Claude CLI 可讀取本地 PNG 圖檔並辨識簡單數學圖表，例如圓柱、半徑 `r = 4 cm` 與高度 `h = 10 cm`。因此正式圖表題優先使用 CLI 做視覺審查；若 CLI 審稿無法穩定檢視圖片，才使用已登入 Chrome + CDP 的網頁審查，並保存審稿結果。

### 視覺審查輸出格式

圖表題正式發布前，需產出一份集中檢視用的 visual review sheet：

```text
automation/output/<bank-name>-visual-review.html
```

visual review sheet 至少包含：

- 題號、題幹、選項、正答。
- 圖片縮圖。
- 本地圖檔路徑與 Cloudinary URL。
- figure spec。
- 答案驗算。
- Gemini CLI 視覺審查結果。
- Claude CLI 視覺審查結果。
- `figure:validate-manifest` 結果。
- `wayground:check` 的 `mediaMismatchCount` / `tableMismatchCount` 結果。
- Wayground 實際畫面截圖或連結。

人工看圖的主要位置是 visual review sheet；發布前最後再看 Wayground edit page 或 Wayground 截圖，確認平台實際呈現沒有裁切、縮放、掛圖失敗或表格排版問題。

### 人工 gate 暫行規則

Gemini CLI 與 Claude CLI 可以承擔圖表審查主力，但新流程剛啟用時，不得完全跳過人工 gate。

若下列條件全數成立，人工審查可降為只看 visual review summary 與異常項：

- Gemini CLI 視覺審查通過。
- Claude CLI 視覺審查通過。
- 兩者對圖形、標籤、數值與題意的描述一致。
- `figure:validate-manifest` 通過。
- `wayground:check` 的 `mediaMismatchCount` 為 0。
- `wayground:check` 的 `tableMismatchCount` 為 0。
- Wayground 截圖或 edit page 確認圖片/表格有正確顯示。

下列任一情況必須人工逐題看圖：

- 新圖型第一次使用，例如角柱展開圖、複合形體、挖空形體或切割圖。
- Gemini / Claude 任一方表示不確定、無法檢視圖片或提出圖題不一致。
- Gemini / Claude 對圖形、標籤、數值或題意的描述不一致。
- 圖中有鋪色、箭頭、切面、透視、局部區域或容易造成比例暗示的元素。
- 題目答案依賴非常細的圖形位置。
- Wayground 截圖或 edit page 顯示可能裁切、縮放、遮字或掛圖失敗。

等同一類型圖表累積多批穩定紀錄後，才可討論把人工 gate 從逐題檢查降為抽查；在此之前，人工 gate 不能取消。

## 7. 外部審題 Gate

正式題庫進 Wayground 前，必須完成：

1. Gemini 二審。
2. Claude 三審。
3. 綜合二審、三審意見後修正本地題庫。
4. 再次確認本地題庫無 blocking issues。

未完成二審與三審，不可進入 Wayground import / generate / check / publish。

### Gemini 二審

Gemini 二審優先使用 Gemini CLI。若 CLI 逾時、登入失效、輸出不完整或無法取得穩定審稿結果，才改用已登入 Chrome + CDP 的 Gemini 網頁審查。

使用 Gemini 時：
- CLI 優先；Chrome + CDP 只作為逾時或失敗 fallback。
- 使用 Chrome + CDP 時，不要另開新登入流程。
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

### Claude 三審

Claude 三審優先使用 Claude CLI。若 CLI 逾時、權限受限、輸出不完整或無法取得穩定 final gate，才改用已登入 Chrome + CDP 的 Claude 網頁審查。

```text
prompts/review/claude-final-review-prompt-template.md
```

Claude 三審只負責最後驗收與指出阻擋發布的問題；若和教材衝突，仍以教材與範圍為準。

Claude 三審輸出必須至少包含：

```text
blocking issues
recommended fixes
residual risks
final decision
```

### 綜合修正

Gemini 二審與 Claude 三審完成後，先綜合意見再修本地題庫：

- blocking issues：必修。
- 明確錯題、雙答案、超範圍：必修。
- 誘答太弱、題型偏離校內考風：原則上修；若不修需記錄理由。
- 與教材衝突的審稿意見：回教材或範圍文件核對後決定。

修正後如改動超過少數題目，需重新執行相關審稿；不得直接帶著未驗證的大改進 Wayground。

## 8. Wayground 上架

先依科目決定 Wayground 路線：

```text
docs/workflow/subject-wayground-routing.md
```

目前實測採用：
- 自然：使用 `unicode-plus` 題庫，直接匯入。
- 數學純文字或公式題：可使用 Wayground AI 出題，生成後刪錯題、重複題，並做公式畫面檢查。
- 數學圖片或表格題：使用直接匯入，避免 Wayground AI 改寫題意、遺失 `query.media` 或把表格轉回純文字。

直接匯入路線：

```powershell
npm.cmd run wayground:import -- .\automation\question-banks\bank.md --subject Mathematics --lang Chinese --grade 8
npm.cmd run wayground:check -- .\automation\question-banks\bank.md
npm.cmd run wayground:set-all-timers-2min
npm.cmd run wayground:publish
```

Wayground AI 出題路線：

```powershell
npm.cmd run wayground:generate -- .\automation\question-banks\bank.md --subject Mathematics --lang Chinese --grade 8 --count 30
npm.cmd run wayground:check -- .\automation\question-banks\bank.md
npm.cmd run wayground:set-all-timers-2min
npm.cmd run wayground:publish
```

使用 AI 出題時，最後一定要回到本地題庫與畫面檢查。若是數學公式，不能只依 DOM `innerText` 判斷，應使用截圖或人工視覺檢查公式是否正確渲染，再刪除錯題、重複題與 AI 多生題。

若題庫含 `圖片：https://...`，Wayground 路線需確認：

- 匯入前先跑 figure manifest 驗證，確認本地圖檔存在、Cloudinary URL 可讀、必要驗算與標籤完整。
- 匯入或生成後題目仍有圖片。
- 圖片 URL 是 Cloudinary 最新版本。
- 題目畫面沒有裁切、遮字或錯誤縮放。
- `wayground:check` 的 `mediaMismatchCount` 必須為 0。

若題庫含 Markdown 表格，Wayground 路線需確認：

- 使用直接匯入，讓 `wayground:import` 轉成 HTML `<table>`。
- 匯入後題目 DOM 或檢查報告不是管線文字。
- `wayground:check` 的 `tableMismatchCount` 必須為 0。

## 9. 更新題組網頁

所有題組發布後，再更新入口頁，例如：

```text
wayground/index.html
```

每張卡片至少包含：
- 科目。
- 範圍。
- 題數。
- Wayground 連結。

## 10. 交付回報

請回報：
- 題庫 Windows 絕對路徑。
- Gemini 審稿 Windows 絕對路徑。
- Wayground quiz id。
- 題組入口網頁 Windows 絕對路徑。
- 題數與 Bloom 分配。
- 修正過的核心問題。
