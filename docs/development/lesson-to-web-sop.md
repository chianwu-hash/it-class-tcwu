# 從教案討論到網頁完成 SOP

最後更新：2026-04-27

## 1. 目的

這份 SOP 用來標準化每週課程頁的完整製作流程，從「討論教案」一路走到「網頁完成並可本機驗證」。

適用情境：

- 新增 `grade3/weekXX.html`
- 新增 `grade6/weekXX.html`
- 需要同步教案、資訊圖卡、首頁週卡、navbar 週次
- 需要補課本頁碼參考或 NotebookLM 查詢

這份 SOP 特別整合了這次六年級第 11 週實際走通的流程。

---

## 2. 開始前必讀

每次開始新的週頁前，先讀：

- `docs/development/dev-sop.md`
- `docs/development/shared-modules.md`
- `docs/development/page-types.md`
- `docs/development/new-page-checklist.md`
- `docs/development/high-risk-changes.md`
- `docs/development/agent-handoff.md`

如果是新週頁，另外讀：

- `docs/development/prompt-template.md`

如果本週需要資訊圖卡，再讀：

- `docs/image-and-preview-card-sop.md`

如果會用到 Gemini / ChatGPT / NotebookLM / Wayground 的瀏覽器自動化，再讀：

- `docs/browser-automation-sop.md`

---

## 3. 標準輸入

開始做網頁前，至少要有這些輸入：

1. 本週教案方向已定案
2. 確認年級：`grade3` 或 `grade6`
3. 確認週次：例如 `week11`
4. 確認頁型（A / B / C / D / E）
5. 確認是否需要資訊圖卡
6. 確認是否需要課本頁碼對照
7. 確認是否要同步首頁週卡與 navbar

如果其中任何一項還不清楚，不要直接做 HTML。

---

## 4. 第 1 階段：教案討論與定稿

### 4.1 先把教案定到可實作

教案至少要明確寫出：

- 課程主題
- 本週核心技能
- 任務流程
- 最低完成標準
- 分流方式（若有）
- 課後或當堂繳交方式
- 下一週銜接

### 4.2 先決定哪些內容要上網頁

不是教案全文都要搬到網頁。先拆成：

- 網頁主標題
- 本週任務卡
- 分流或完成標準
- 使用提醒
- 外部入口
- 截圖繳交提醒
- 課本頁碼對照（若有）

### 4.3 把教案存檔

路徑：

- `grade3/LessonPlan/Week XX.md`
- `grade6/LessonPlan/Week XX.md`

---

## 5. 第 2 階段：判斷頁型與參考頁

### 5.1 先判斷頁型

依 `docs/development/page-types.md` 判斷：

- A：首頁週卡 / 首頁
- B：一般課程說明頁
- C：打字闖關頁
- D：題組 / Wayground 頁
- E：後台 / 管理頁

### 5.2 先找「同類型最新頁」做參考

原則：

- 優先找同年級、同類型、最新週次
- 不只看版面，也要看它用了哪些 shared modules

例如：

- 一般說明頁可先看：`grade6/week10.html`
- 打字闖關頁可先看：`grade3/week10.html`

### 5.3 先盤點參考頁功能

至少檢查：

- 是否有 `navbar.js`
- 是否有 `initNavbarAuth()`
- 是否有進度寫入
- 是否有 spotlight 放大圖
- 是否有外部連結卡
- 是否有週卡首頁入口同步

---

## 6. 第 3 階段：課本頁碼查詢（NotebookLM）

若本週需要「技能參考課本頁碼」，應在教案確認後、網頁實作前先補上這一步。這樣後面不論是做資訊圖卡、寫教案補充，還是實作 HTML，都可以直接用同一套頁碼資料，不用中途回頭插隊。

### 6.1 前置條件

- 已開啟支援 CDP 的正式 Chrome
- 已登入 Google
- 已打開對應的 NotebookLM 筆記本

### 6.2 問 NotebookLM 的提示詞格式

建議直接問：

- 本週真的會用到的技能有哪些
- 各技能對應哪幾頁
- 頁碼重點是什麼
- 哪些技能課本未明確對應

建議輸出格式：

- 技能｜可參考頁碼｜頁碼重點
- 另補 3 行「給老師的提醒摘要」，方便之後直接回寫到網頁

### 6.3 回收答案後要做的事

把結果同步寫進兩個地方：

1. 教案檔
2. 對應週頁 HTML

頁面上不需要放太長，只保留：

- 主要技能
- 對應頁碼
- 1 到 3 個提醒

### 6.4 建議存檔

NotebookLM 的結果至少存一份文字輸出，避免只留在聊天或瀏覽器中。

建議路徑：

- `automation/output/notebooklm-weekXX-page-refs.txt`

### 6.5 半自動整理與回寫腳本

腳本：

- `automation/notebooklm-page-refs-workflow.py`

用途：

1. 吃 NotebookLM 原始文字輸出
2. 解析成技能 / 頁碼 / 頁碼重點
3. 另存 JSON、markdown snippet、html snippet
4. 若教案與網頁已放標記，可直接回寫

使用方式：

```powershell
npm.cmd run notebooklm:page-refs -- --input C:\Users\user\projects\it-class-tcwu\automation\output\notebooklm-week11-page-refs.txt --json-out C:\Users\user\projects\it-class-tcwu\automation\output\notebooklm-week11-page-refs.json --markdown-out C:\Users\user\projects\it-class-tcwu\automation\output\notebooklm-week11-page-refs.md --html-out C:\Users\user\projects\it-class-tcwu\automation\output\notebooklm-week11-page-refs.html --lesson-target "C:\Users\user\projects\it-class-tcwu\grade6\LessonPlan\Week 11.md" --html-target C:\Users\user\projects\it-class-tcwu\grade6\week11.html
```

回寫前提：

- 教案與 HTML 中要先放標記
- 標記格式固定：
  - `<!-- PAGE_REFS:START -->`
  - `<!-- PAGE_REFS:END -->`
- 標記區塊之間不要手動修改，下一次 write-back 會覆蓋該區塊內容

這條目前是半自動：

- NotebookLM 問答與內容判讀仍由人主導
- 但存檔、結構化、回寫已可重複使用
- 目前頁碼格式主要辨識 `P.125`、`P.125, P.157`、`未明確對應`；若 NotebookLM 回成 `p.125`、`第125頁`、`P. 125` 等格式，腳本會跳 warning，需人工確認
- 若教師或使用者已知某個技能對應頁碼，但第一輪 NotebookLM 沒抓到，必須做第二輪「指定技能追問」，例如：`請再檢查本週是否有和路徑動畫相關的課本頁碼；若有請直接列出頁碼與對應技能。`

---

## 7. 第 4 階段：資訊圖卡流程

如果本週需要資訊圖卡，先做圖，再做網頁。

### 7.1 先定圖卡文案結構

先整理出：

- 主標題
- 副標題
- 任務分流
- 最低完成標準
- 操作提醒

### 7.2 圖卡風格基準

若無另外指定，六年級資訊圖卡先參考 week08：

- 淺色背景
- 黑色粗標題
- 多個圓角資訊卡分區
- 藍綠邊框與柔和陰影
- 適合教室投影

### 7.3 生圖：Gemini 或 ChatGPT

Gemini 已驗證工具：

- `automation/gemini-generate-infographic.js`

Gemini 使用方式：

```powershell
npm.cmd run gemini:generate-image -- --prompt-file C:\Users\user\projects\tmp\week11-gemini-prompt.txt --out-dir C:\Users\user\projects\tmp --output-name week11-infographic-source.png
```

ChatGPT 生圖先讀：

- `skills/chatgpt-image-workflow/SKILL.md`

ChatGPT 使用方式：

```powershell
npm.cmd run chatgpt:image-batch -- --cdp-url http://127.0.0.1:9333 --prompt-file automation/prompts/week12-safety-card.txt --count 1 --min-images 1 --output-dir grade3/images/week12 --output-prefix week12-safety-card --meta automation/output/week12-safety-card.json
```

注意：

- 生圖前先切到 Gemini 的「新對話」，不要沿用舊對話脈絡，避免上一張圖卡或其他任務內容殘留，導致生錯主題
- ChatGPT 若非刻意延續對話，也不要沿用舊對話脈絡；只有需要上下文連續時才使用 `--reuse-chat`
- 中文提示詞一律先存成 UTF-8 檔案
- 不要用 PowerShell inline / here-string 直接塞中文 prompt
- 生圖後要確認 metadata 與實際圖片檔，再進入壓圖與 Cloudinary 流程

### 7.4 圖卡資產落點

本地原圖與正式頁資產要分開：

- 暫存原圖：`C:\Users\user\projects\tmp`
- 專案資產：`gradeX/images/weekXX/`

命名：

- 原圖：`weekXX-infographic-source.png`
- 正式圖：`weekXX-infographic-1920x1080-q80.webp`

### 7.5 壓圖規格

目前規格固定：

- `1920x1080`
- `WebP`
- `q80`

> 注意：目前 repo 已有生圖腳本與 Cloudinary 上傳舊工具，但壓圖流程仍需補成正式腳本；這次可先用本機工具完成，再補標準化工具。

正式壓圖腳本：

- `automation/convert-infographic-to-webp.py`

使用方式：

```powershell
npm.cmd run image:compress-infographic -- --input C:\Users\user\projects\tmp\week11-infographic-source.png --output C:\Users\user\projects\it-class-tcwu\grade6\images\week11\week11-infographic-1920x1080-q80.webp
```

### 7.6 Cloudinary

如要正式上站，圖卡應上 Cloudinary，再由網頁引用正式 URL。

舊工具位置：

- `tools/cloudinary_upload/upload_week07_infographic.py`
- `tools/cloudinary_upload/3_upload_to_cloudinary.py`

正式單張圖卡上傳腳本：

- `automation/upload-infographic-to-cloudinary.py`

使用方式：

```powershell
npm.cmd run cloudinary:upload-infographic -- --input C:\Users\user\projects\it-class-tcwu\grade6\images\week11\week11-infographic-1920x1080-q80.webp --grade grade6 --week week11 --public-id week11-infographic-1920x1080-q80 --overwrite
```

week11 已實測成功上傳，Cloudinary secure_url：

- `https://res.cloudinary.com/dmqmjfqng/image/upload/v1776398793/it-class-tcwu/grade6/week11/week11-infographic-1920x1080-q80.webp`

敏感檔：

- `tools/cloudinary_upload/.env`

`.env` 只供本機使用，不進 commit。

---

## 8. 第 5 階段：實作週頁 HTML

### 8.1 新增週頁

路徑：

- `grade3/weekXX.html`
- `grade6/weekXX.html`

### 8.2 一律用對應年級 navbar

不要手刻 nav。

一律：

```html
<script src="navbar.js?v=YYYYMMDD"></script>
```

### 8.3 一般說明頁 auth

一般說明頁若要維持一致行為，通常要接：

```html
<script type="module">
  import { initNavbarAuth } from "../shared/navbar-auth.js";
  initNavbarAuth();
</script>
```

### 8.4 頁面內容常用區塊

常見可重複區塊：

- hero 主視覺
- 本週任務卡
- 分流卡
- 完成標準
- 操作提醒
- 圖卡 spotlight
- 外部入口
- 截圖或作業繳交提醒
- 課本頁碼區塊

如果頁面有 2 個以上的大型任務卡，或單一卡片內容已長到會讓學生來回捲動、難以快速找到其他區段，評估是否加上「可收合卡片」。

可收合卡片規則：

- 只用在同層級主區段，例如「本週提醒 / 任務一 / 任務二」
- 預設先展開，避免學生一進頁面看不到內容
- 標題列整條可點擊，並有清楚的箭頭狀態
- 收合功能只做 UI 導航優化，不要改動 auth、progress、quiz 等既有邏輯
- 實作後要額外確認 RWD、鍵盤操作、以及 module 初始化不受影響

### 8.5 Spotlight 圖片放大

如果有圖卡或教學截圖，可沿用既有 spotlight 模式。

參考：

- `grade6/week08.html`
- `grade6/week10.html`

---

## 9. 第 6 階段：同步首頁與 navbar

週頁做好後，不算完成，還要同步兩個入口。

### 9.1 同步 `navbar.js`

如果該年級 navbar 用 `activeWeeks` 控制顯示，記得把週次加進去。
也要確認清單中缺少的週次是刻意排除（例如假期、行政週），不是漏掉。

例如：

- `grade6/navbar.js`

### 9.2 同步首頁週卡

更新：

- `grade3/index.html`
- `grade6/index.html`

通常要做：

1. 新增本週卡片
2. 把上一週的「本週最新」移除
3. 把這週卡片改為 `data-latest-week="true"`

### 9.3 navbar 版本字串一起更新

如果這次改了 `navbar.js`，要同步更新同年級各週頁和首頁的：

```html
navbar.js?v=YYYYMMDD
```

避免瀏覽器吃舊快取。

---

## 10. 第 7 階段：本機驗證

### 10.1 一律用本地伺服器

不要用 `file://`。

使用：

- `http://localhost:3000/gradeX/weekXX.html`

### 10.2 至少驗這些

1. 頁面可正常打開
2. navbar 可顯示正確週次，且前後週連結符合目前顯示規則
3. 首頁可點進本週頁面
4. 圖卡或圖片可正常載入
5. `initNavbarAuth()` 沒有報錯，登入按鈕不是靜默無反應
6. 若本機有 auth 條件，實際點一次登入按鈕，確認有觸發 OAuth 或導向行為
7. console 沒有紅字
8. 若有外部連結，確認格式正常

### 10.3 建議留驗證產物

例如：

- `automation/output/gradeX-weekXX-page.png`
- `automation/output/gradeX-index-page.png`

---

## 11. 第 8 階段：完成後輸出

完成一週頁面後，至少要有這些成果：

1. 教案檔已更新
2. 週頁 HTML 已完成
3. 首頁週卡已更新
4. navbar 入口已更新
5. 資訊圖卡資產已落位
6. 課本頁碼（若有）已回寫
7. 本機已驗證
8. 若為正式上站頁面，資訊圖卡優先改用 Cloudinary 正式網址，或已確認目標網路環境可穩定存取本機資產

---

## 12. 協作補充：讓 IDE 比較容易直接開檔

在 Codex 聊天面板中，markdown 路徑或純文字路徑不一定會穩定變成可點連結；目前較可靠的方式，是在回報成果時把「新建或修改完成的檔案」明確列成具體交付物，讓 IDE 有機會渲染出帶 `Open` 按鈕的檔案卡片。

實務建議：

- 回報完成時，明確列出本次最重要的 1 到 3 個檔案
- 不要只說「我改好了」，要說「已更新某個檔案」
- 若需要使用者立刻開檔確認，優先把該檔案放在回報前段

這是目前觀察到的實務規則，不保證所有 IDE 介面都一致，但值得優先採用。

---

## 13. 第 9 階段：commit 前檢查

只 stage 這次真的相關的檔案。

不要混進：

- `.env`
- 教材 PDF
- 與本週無關的 generated files
- 使用者未要求的其他週次改動

---

## 14. 六年級第 11 週實例（已走通）

這次已實際完成的對應範例：

- 教案：`grade6/LessonPlan/Week 11.md`
- 週頁：`grade6/week11.html`
- 首頁：`grade6/index.html`
- navbar：`grade6/navbar.js`
- 圖卡資產：
  - `grade6/images/week11/week11-infographic-source.png`
  - `grade6/images/week11/week11-infographic-1920x1080-q80.webp`
- NotebookLM 頁碼輸出：
  - `automation/output/notebooklm-week11-page-refs.txt`

這次確認有效的頁碼對照例子：

- 頁面轉場：`P.125`、`P.157`
- 套用至所有頁面：`P.125`
- 物件動畫：課本未明確對應，需教師補充示範

---

## 15. 目前已標準化、但仍可再補強的地方

已標準化：

- 教案 -> 週頁內容拆解
- Gemini 生圖下載
- 圖卡命名規格
- NotebookLM 頁碼回寫
- 週頁 / 首頁 / navbar 同步

尚可再補：

1. 壓圖腳本未來可補批次模式與自動命名
2. Cloudinary 上傳腳本可再補批次模式與 URL 自動回填
3. NotebookLM workflow 可再補更穩的多版回答解析與提醒語句模板化

---

## 16. 一句話版流程

> 先定教案，再判頁型；需要頁碼就先問 NotebookLM，需要圖卡就先做圖卡；接著做週頁、同步首頁與 navbar，最後用 localhost 驗證，再整理提交範圍。
