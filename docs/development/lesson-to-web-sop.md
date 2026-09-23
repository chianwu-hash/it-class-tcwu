# 從教案討論到網頁完成 SOP

最後更新：2026-09-15

## 1. 目的

這份 SOP 用來標準化每週課程頁的完整製作流程，從「討論教案」一路走到「網頁完成並可本機驗證」。

適用情境：

- 新增目前學年度週頁，例如 `grade3/115-1/weekXX.html`
- 新增其他年級目前學年度週頁，例如 `grade6/115-1/weekXX.html`
- 需要同步教案、資訊圖卡、首頁週卡、navbar 週次與教師後台週卡管理
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
7. 確認是否要同步首頁週卡、navbar 與教師後台週卡管理；新增正式週卡時三者必須同步

如果其中任何一項還不清楚，不要直接做 HTML。

### 3.1 先選年級身分分支

115-1 的三、六年級不能共用同一個登入與資料假設：

- **三年級 `grade3-115-1`**：除教案明確的首週免身分例外外，使用課堂身分卡與 `guest_progress`。目前不使用六年級作業／閱讀入口，努力樹也尚未讀取 `guest_progress`，因此頁面與 navbar 不顯示努力樹入口。
- **六年級 `grade6-115-1`**：使用學校 Google 帳號，學生還必須符合六年級名冊。中英打使用 `student_progress`；作品與閱讀分別使用 homework、reading 專用資料。

先決定分支，再選 A～E 頁型。頁型描述主要互動；作業、閱讀與努力樹是可以疊加到六年級週頁的功能契約，不另在週頁重做服務。

### 3.2 六年級週卡與閱讀小卡綁定規則

自 `grade6-115-1` 第 02 週起，正式任務週卡與閱讀 period 採一對一預設：

- 有建立任務週頁與首頁週卡，就必須在同一次製作流程建立相同週次的閱讀 period。
- 沒有上課、沒有建立週卡的週次不補號，也不建立空白閱讀 period。
- 週頁仍只連到 `grade6/115-1/homework.html#reading`；「建立 period」是教師後台的外部狀態操作，不代表可在週頁寫死 period ID 或另做閱讀表單。
- 建立前先核對可見的教師帳號、課程、週次、日期範圍與填寫權限；日期範圍只代表本週顯示期間，填寫權限另決定能否新增或修改。建立後必須從學生入口確認本週小卡已出現。
- 若當次工作無法登入教師後台或缺少正確日期，不得把週頁交付標成全部完成；需明確列為未完成外部狀態。

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

#### 4.1.1 若包含六年級作業繳交

教案必須再寫清楚：

- 是建立新作業，還是續作／補交舊週作業。
- 作業原始週次、名稱、適用班級、檔名、格式與學生可見成果。
- 教師何時在 `admin-homework.html` 建立草稿與開放收件。
- 上傳完成判準：學生看見「已繳交・待評」與自己的檔案。
- 重交、老師回饋、再努力與版本歷史如何處理。
- 收件尚未開放、已關閉或服務異常時的備援。

跨週續作不得自動建立同名新作業。例如第 03 週補交第 02 週名牌，仍指定「第 2 週・我們的班級名牌」。

#### 4.1.2 六年級閱讀小卡（115-1 第 02 週起預設必有）

教案必須再寫清楚：

- 本週主要閱讀入口與閱讀時間。
- 是否為全班共同體驗；即使共同體驗，系統仍維持自由分享、不列缺交。
- 閱讀小卡最低內容：來源、書名、自己的發現或問題。
- 教師需在 `admin-homework.html` 設定的學期週次與日期。
- 沒有當週 period、平台異常或學生尚未分享時的備援。
- 分享一葉、老師評為過關再一葉；修改同週小卡不重複增加獎勵。

若本週會建立六年級 115-1 任務週卡，以上內容不得因原始教案未特別提到閱讀而省略；應在教案定稿時補入閱讀時間、最低分享內容與備援。

#### 4.1.3 打字闖關的課堂定位

三年級週頁若包含中英打或中打闖關，不要預設它一定是「全班同一時間、當堂必須完成全部關卡」的主流程。實際課堂常有登入帳號、開啟網頁、進入外部工具、繳交作業等操作速度差；打字闖關常用來吸收這些差異。

撰寫教案時需先判斷並明確標註打字闖關定位：

- **主流程任務**：全班同步進行，需規劃固定時段與最低完成關卡。
- **先完成者緩衝任務**：學生完成老師交代的主要任務後可進入，避免等待時空轉；不要求全班同時完成全部關卡。
- **暖身任務**：上課開始登入完成、等同學準備時先做，用來穩定座位與操作節奏。
- **延伸任務**：給完成快的學生挑戰，未完成不影響本週主要學習目標。

若打字闖關是緩衝、暖身或延伸任務，教案與網頁完成標準應分開寫：

- 本週主要任務完成標準，例如完成測驗、截圖繳交、完成指定工具操作。
- 打字闖關完成標準，例如「先完成者挑戰 5 關」、「全班至少嘗試第 1 關」、「慢速學生完成前 2-3 關即可」。

若同一個打字闖關同時擔任多種角色（例如「暖身 + 先完成者緩衝 + 課末延伸」），教案應在標題或說明段明確列出所有角色，並說明各角色對應的時間點。不要只用一個固定時間區間描述，避免網頁實作者誤以為它是全班同步、當堂必完的主流程。

跨領域中英打需在教案中明確標註文本來源、課次與取材理由。六年級中英打預設取材自學生正在學習或即將複習的國語、英語課文，或由教師明確指定的跨科文本；不得用資訊課操作說明、網站使用口令或臨時造句取代課文材料。若因課程進度不同需改用其他文本，需在教案與 `levelsData` 草案旁註明調整原因。

即使打字闖關不是全班必完任務，只要頁面有打字闖關進度，技術契約仍不可降低：

- 必須使用 `initTypingChallenge()`。
- 一般 Google 登入頁未登入時必須鎖定輸入框與檢查按鈕；課堂身分卡分支未確認身分時也必須鎖定。
- `levelsData` 必須使用 `{ id, ans }`。
- 一般登入頁的進度必須寫入 `student_progress`，不可改用 `localStorage`。
- 若屬於「三年級 Google 登入前的課堂身分卡例外」，進度必須寫入 `guest_progress`，不可混用 `student_progress` 或 localStorage 進度。

若教案頁面屬於三年級 Google 登入前的課堂身分卡分支，教案轉網頁時要先寫清楚：

- 本週使用「課堂身分卡」，不是 Google 登入。
- Navbar 只出現課堂身分卡；Google 登入入口不得同頁出現。
- 每個互動活動的 `activityKey`、總關卡數與完成標準。
- 進度寫入 `guest_progress`，教師後台可查詢與重設。
- 未輸入課堂身分卡前，打字、測驗、視窗操作與延伸任務都必須鎖定。
- 若從 localStorage 暫存版本改版而來，要列入清除舊暫存鍵的需求。

打字闖關每一關都要設定 `levelEncouragements`，並採用阿德勒式鼓勵語：

- 鼓勵語要描述學生的努力、策略、耐心、修正、檢查或進步。
- 避免只寫「很棒」「太厲害」「成功」等泛泛稱讚，也避免把學生互相比較。
- 每關鼓勵語應對應該關卡的實際挑戰，例如英文換行、中文標點、長句耐心檢查、中英混打切換。
- 最後一關可強調「靠方法完成」「下次也能使用同樣策略」，不要只寫「全部完成」。

若打字闖關有最後一關、魔王關或 boss level，完成動畫／完成 overlay 要把努力樹納入回饋設計：

- overlay 需顯示阿德勒式鼓勵語，說明這次完成是來自練習、檢查、修正與持續嘗試。
- overlay 需提供「去看我的努力樹」或同等文字的主要行動連結，導向 `/my-tree.html`。
- 引導語要強調努力樹呈現自己的學習累積，不鼓勵與同學比較。
- 週頁面不應額外寫入努力樹資料；努力樹以既有進度資料讀取呈現。
- 若頁面屬於三年級 Google 登入前的課堂身分卡分支，且努力樹尚未讀取 `guest_progress`，完成 overlay 不應導向 `/my-tree.html`，改用回到本週課程或下一個任務，避免學生誤以為 Google 努力樹已累積。
- 若這是新導入的互動設計，教案中需註記是否要在新頁確認後回頭同步調整既有打字闖關頁。

若教案包含「資訊素養互動小測驗」：

- 題目若來自影片，必須先核對實際影片內容再出題，不可只依標題、封面或既有常識推測。
- 預設 5 題時，至少要挑 2 題做成較困難、有挑戰性的題目。
- 這 2 題應使用情境判斷或概念辨析，讓學生需要聽過課堂重點才比較容易答對。
- 選項要有誘答性，避免三個選項明顯荒謬、只靠常識或語氣就能猜出答案。
- 困難題仍要符合年級程度，不用恐嚇、羞辱或過度抽象的表述。
- 三年級題目若文字較長，需評估注音顯示／隱藏功能；注音是閱讀輔助，不可改變題目或答案判定。
- 教案定稿時先列出每個會保存的活動：`activityKey`、總題數／關卡數、完成標準、是否列入過關紀錄，以及「再練習」是否更新正式紀錄。純操作練習不要因為畫面有完成提示就自動當成後台進度。

### 4.2 先決定哪些內容要上網頁

不是教案全文都要搬到網頁。先拆成：

- 網頁主標題
- 本週任務卡
- 分流或完成標準
- 使用提醒
- 外部入口
- 截圖或正式作業繳交提醒；若為六年級正式收件，需寫出原始週次與作業名稱
- 閱讀小卡入口與自由分享說明（若有）
- 課本頁碼對照（若有）

學生頁只呈現能幫助學生理解、操作或確認完成的資訊。教案中的分鐘配置、活動流程表、教師觀察重點、備課檢核，以及只供教師掌握的「本節至少完成幾項」摘要，預設不搬到學生網頁；若確實需要呈現，必須改寫成學生看得懂且能立即採取行動的提示。

### 4.2.1 判斷是否需要課堂即時開關

「課堂即時開關」（Classroom Control）是指：某些連結、影片、活動入口或操作區塊，老師希望在課程進行到指定階段才開放，避免學生在前半段提早分心。

需要時，在教案中明確寫出：

- 哪個區塊需要先鎖住，例如景點連結、影片入口、練習網站。
- 什麼時間點由老師開放。
- 學生要按哪個「更新狀態」按鈕同步。
- 對應的 `controlKey`，例如 `maps_links`、`video_links`、`practice_links`。

網頁實作一律使用 `shared/classroom-controls.js` + `supabase/classroom_controls.sql`，不要在週頁面中重寫 RPC、老師判斷、鎖定樣式或輪詢。學生端採手動更新狀態，不使用 `setInterval`。

### 4.3 把教案存檔

路徑：

- `grade3/LessonPlan/115-1/Week XX.md`（目前 115 學年度上學期）
- `grade6/LessonPlan/115-1/Week XX.md`（若本學期有六年級新教案）
- 舊學年度教案放入對應資料夾，例如 `grade3/LessonPlan/114-2/Week XX.md`

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
- 若有打字闖關：一般頁未登入是否鎖定輸入框與檢查按鈕；課堂身分卡分支未確認身分是否鎖定
- 若有測驗 / 小測驗：是否使用 `shared/quiz-module.js` 或既有 adapter，未登入或未確認課堂身分卡是否只顯示鎖定區
- 是否有 spotlight 放大圖
- 是否有外部連結卡
- 是否有週卡首頁入口同步

參考舊頁時不能只仿配色或卡片外觀；要把「學生操作契約」一起列出，例如選取狀態、取消方式、拖曳方向、重玩後是否換題、登入鎖定、完成回饋及保存失敗狀態。新頁和參考頁差異很大時，先說明差異理由，不可在沒有教學需求的情況下自行換掉既有互動模式。

---

## 6. 第 3 階段：課本頁碼查詢（NotebookLM）

若本週需要「技能參考課本頁碼」，應在教案確認後、網頁實作前先補上這一步。這樣後面不論是做資訊圖卡、寫教案補充，還是實作 HTML，都可以直接用同一套頁碼資料，不用中途回頭插隊。

### 6.1 前置條件

- 已開啟支援 CDP 的正式 Chrome
- 已登入 Google，或已確認課堂身分卡（依頁面分支而定）
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

### 6.2.1 透過 CDP 自動送出頁碼查詢

若使用者已經在支援 CDP 的正式 Chrome 中打開正確的 NotebookLM 筆記本，可直接用 `notebooklm:ask` 將提示詞送入目前開啟的筆記本。

重要規則：

- 中文提示詞一律先存成 UTF-8 `.txt` 檔，不要用 PowerShell inline / here-string 傳中文。
- 本機 AI Work Browser 使用共用 CDP `9232`；實際工作明確加上 `--cdp-url http://127.0.0.1:9232`。
- 回答若停在 `Consulting your sources...` 或 `Reviewing the content...`，代表 NotebookLM 尚未完成，需等待、重新整理 NotebookLM，或重新送出提示詞，不可把 placeholder 當成答案。
- 頁碼表格請要求欄位固定為「技能 / 可參考頁碼 / 頁碼重點」，方便後續 `notebooklm:page-refs` 解析。

範例：

```powershell
npm.cmd run notebooklm:ask -- --cdp-url http://127.0.0.1:9232 --prompt-file automation/output/notebooklm-week13-prompt.txt --out automation/output/notebooklm-week13-page-refs.txt --screenshot automation/output/notebooklm-week13-page-refs.png --stable-checks 4 --poll-ms 3000 --timeout-ms 300000
```

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
npm.cmd run notebooklm:page-refs -- --input C:\Users\user\projects\it-class-tcwu\automation\output\notebooklm-week11-page-refs.txt --json-out C:\Users\user\projects\it-class-tcwu\automation\output\notebooklm-week11-page-refs.json --markdown-out C:\Users\user\projects\it-class-tcwu\automation\output\notebooklm-week11-page-refs.md --html-out C:\Users\user\projects\it-class-tcwu\automation\output\notebooklm-week11-page-refs.html --lesson-target "C:\Users\user\projects\it-class-tcwu\grade6\LessonPlan\114-2\Week 11.md" --html-target C:\Users\user\projects\it-class-tcwu\grade6\week11.html
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
- 目前頁碼格式主要辨識 `P.125`、`P.125, P.157`、`P.117-118`、`未明確對應`；若 NotebookLM 回成 `p.125`、`第125頁`、`P. 125` 等格式，腳本會跳 warning，需人工確認
- 若教師或使用者已知某個技能對應頁碼，但第一輪 NotebookLM 沒抓到，必須做第二輪「指定技能追問」，例如：`請再檢查本週是否有和路徑動畫相關的課本頁碼；若有請直接列出頁碼與對應技能。`

第 13 週已實測成功的流程：

1. 先建立 UTF-8 提示詞：`automation/output/notebooklm-week13-prompt.txt`
2. 用 `notebooklm:ask` 連到共用 CDP `9232` 的 NotebookLM 筆記本，輸出：`automation/output/notebooklm-week13-page-refs.txt`
3. 用 `notebooklm:page-refs` 產生 JSON / Markdown / HTML snippet，並回寫對應學年度教案，例如 `grade6/LessonPlan/114-2/Week 13.md`
4. 若 NotebookLM 第一次卡住，可請使用者重新整理 NotebookLM 後重送同一份 prompt file

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

### 7.3 生圖：預設使用網頁 ChatGPT + CDP wrapper

課程資訊圖卡、案例卡、投影圖預設使用「網頁 ChatGPT + CDP wrapper 生圖」，也就是 `npm.cmd run chatgpt:image-batch`。不要使用 Codex 內建 ImageGen。原因是內建 ImageGen 會在對話中消耗大量 token，且不會自然留下本專案需要的 prompt file、metadata、下載檔、壓圖與 Cloudinary 流程紀錄；CDP wrapper 則能穩定接上這些正式資產流程。

ChatGPT 生圖先讀：

- `skills/chatgpt-image-workflow/SKILL.md`

ChatGPT 優先方式：

1. 透過 `ai-browser-launch` 啟動或確認共用 AI Work Browser，使用 `http://127.0.0.1:9232`。
2. 在該 Chrome 開啟 `https://chatgpt.com/`，確認是登入後畫面，例如有聊天歷程、專案、圖庫或輸入框。
3. 將提示詞寫成 UTF-8 prompt file。
4. 執行 `npm.cmd run chatgpt:image-batch` 送出 prompt、等待生圖、下載圖片並寫出 metadata。
5. 確認 metadata 與實際圖片檔後，再接 WebP 壓圖與 Cloudinary 流程。

CDP batch wrapper 指令：

```powershell
npm.cmd run chatgpt:image-batch -- --cdp-url http://127.0.0.1:9232 --prompt-file automation/prompts/week12-safety-card.txt --count 1 --min-images 1 --output-dir grade3/images/week12 --output-prefix week12-safety-card --meta automation/output/week12-safety-card.json
```

固定規則：

- 中文提示詞一律先存成 UTF-8 檔案
- 不要用 PowerShell inline / here-string 直接塞中文 prompt
- ChatGPT 若非刻意延續對話，也不要沿用舊對話脈絡；只有需要上下文連續時才使用 `--reuse-chat`
- 生圖後要確認 metadata 與實際圖片檔，再進入壓圖與 Cloudinary 流程
- 生圖成果需人工檢查主體辨識度、肢體／器官數量與方向、物件彼此關係、文字及不自然細節；「檔案已下載」不等於可直接上課。發現魚、動物、人物或配對場景結構怪異時，先重生成或修圖，不要用 CSS 裁切掩蓋內容問題。
- 需確認 `--cdp-url` 指向 `ai-browser-launch` 管理、已登入 ChatGPT 的共用 Chrome；不要另開 profile 或改用其他除錯連接埠
- Codex Chrome 擴充套件只作為 CDP 不可用時的臨時備援或人工檢查；若需要可靠下載與 metadata，回到 CDP wrapper 重跑
- 若使用者明確指定「用內建 ImageGen」，或 ChatGPT / Gemini 瀏覽器流程不可用且使用者同意，才可例外使用內建 ImageGen；例外產物仍需進入同一套 WebP / Cloudinary 正式資產流程

Gemini 是備援工具，不是課程資訊圖卡的預設首選。

Gemini 已驗證工具：

- `automation/gemini-generate-infographic.js`

Gemini 使用方式：

```powershell
npm.cmd run gemini:generate-image -- --prompt-file C:\Users\user\projects\tmp\week11-gemini-prompt.txt --out-dir C:\Users\user\projects\tmp --output-name week11-infographic-source.png
```

注意：

- 使用 Gemini 前先切到 Gemini 的「新對話」，不要沿用舊對話脈絡，避免上一張圖卡或其他任務內容殘留，導致生錯主題

### 7.4 圖卡資產落點

本地原圖與正式頁資產要分開：

- 暫存原圖：`C:\Users\user\projects\tmp`
- 專案資產：目前學年度使用 `gradeX/115-1/images/weekXX/`；舊 114 學年度資產若仍留在 `gradeX/images/weekXX/`，新頁不得直接引用，除非確認是跨學年度共用素材。

命名：

- 原圖：`weekXX-infographic-source.png`
- 正式圖：`weekXX-infographic-1920x1080-q80.webp`

若一週有多張圖卡、案例卡或投影片式圖像，仍要套用同一原則：

- 生成原圖可以暫存在 `gradeX/115-1/images/weekXX/` 或暫存資料夾，但不得直接成為頁面 runtime 引用資產。
- 頁面引用檔應是壓縮後的 WebP，建議命名為 `weekXX-card-01-1920x1080-q80.webp` 這類可辨識格式。
- 生成工具留下的 `*-01.png`、重複檔、metadata 或來源圖，不應被頁面引用，也不應混入正式上課資產清單。
- 若頁面一次引用多張圖，需檢查所有被引用圖片的總量；避免十幾張 1-2 MB PNG 造成教室網路載入卡頓。

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

多張圖卡需逐張壓成 WebP 後再更新頁面引用。驗收時用 `rg` 或瀏覽器 Network 面板確認頁面沒有引用生成 PNG 原圖；若仍引用 `.png`，需明確確認那是小圖示、鍵盤圖或既有必要資產，不是大型生成圖卡。

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

- `grade3/115-1/weekXX.html`（目前 115 學年度上學期）
- `grade6/115-1/weekXX.html`（若本學期有六年級新頁）
- 舊 114 學年度頁面目前仍保留在 `grade3/`、`grade6/` 根目錄，避免破壞已發布連結；不要把 115 新頁新增到舊根目錄。

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
  import { initNavbarAuth } from "../../shared/navbar-auth.js";
  initNavbarAuth();
</script>
```

上例適用 115-1 巢狀週頁；舊學期根目錄週頁才使用 `../shared/...`。三年級 115-1 課堂身分卡頁還需依契約初始化 `initClassCardAuth()`，不得只接 Google auth。

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

若頁面模擬桌面滑鼠操作，行為要貼近學生之後會遇到的真實介面：

- 普通點擊只能留下單一選取；按住 `Ctrl` 點擊可增加或取消單項。
- 點空白處可取消全部選取；從空白處拖曳可框選多個物件。
- 已選取物件可整群拖曳；拖曳預覽需跟隨游標，不能停留在原處造成「是否有拖到」的誤解。
- 題目若要求不同方向或數量，要把「從左／右開始、框幾個、哪些不要框」寫進學生指示，不可只存在教案備註。

所有具有關卡、逐題練習或操作挑戰的學生頁面，**每一關都必須提供「再練習一次」功能**，不可只在整份活動最後提供。每關至少準備 2 組同技能、不同內容的題目或資料；按下後必須完整清除上一輪的輸入、選取、拖曳、完成與提示狀態，並保證下一輪與上一輪不同（題目、目標、排列、方向或資料組至少改變一項）。只把同一題復原不算再練習。

第一次過關仍依活動契約保存正式進度並解鎖下一關；「再練習一次」預設為不回寫正式過關層級，尤其不得把已到達較後關卡的 `current_level` 覆寫成較小值。若教案確實要求再練習也更新正式紀錄，必須在教案與活動契約中明寫，並測試不會造成進度倒退。答對後同時提供「再練習一次」與「前往下一關」時，兩個出口都要清楚、可用鍵盤操作，且不可自動捲走到讓學生看不到選擇。

### 8.4.1 六年級作業／閱讀整合邊界

六年級週頁只負責教學指引與入口：

- 作業連到 `grade6/115-1/homework.html`，文字寫清楚目標週次與作業名稱。
- 閱讀連到 `grade6/115-1/homework.html#reading`。
- 不複製 `homework-student.js`、上傳 dropzone、閱讀 editor 或教師評比 UI。
- 不直接呼叫 homework／reading RPC，不寫死 assignment ID、period ID 或動態 activity key。
- 頁面若同時有中英打，仍依 C 類契約使用 `initTypingChallenge()`；作業／閱讀不共用 `student_progress`。

如果頁面有 2 個以上的大型任務卡，或單一卡片內容已長到會讓學生來回捲動、難以快速找到其他區段，評估是否加上「可收合卡片」。

可收合卡片規則：

- 只用在同層級主區段，例如「本週提醒 / 任務一 / 任務二」
- 預設先展開，避免學生一進頁面看不到內容
- 標題列整條可點擊，並有清楚的箭頭狀態
- 收合功能只做 UI 導航優化，不要改動 auth、progress、quiz 等既有邏輯
- 實作後要額外確認 RWD、鍵盤操作、以及 module 初始化不受影響

若外部入口需要課堂中才開放，使用「課堂即時開關」：

- 老師控制按鈕只在教師帳號登入後顯示。
- 學生端保留「更新狀態」按鈕，不做自動輪詢。
- 鎖定時應攔截點擊、加上 `aria-disabled="true"`，並以清楚文字提示尚未開放。
- 開放時應恢復可點擊狀態，外部連結仍用新分頁開啟。
- 同一週的 `controlKey` 不可重複，並要在教案或功能契約中記錄。

### 8.5 Spotlight 圖片放大

如果有圖卡或教學截圖，可沿用既有 spotlight 模式。

參考：

- `grade6/week08.html`
- `grade6/week10.html`

---

## 9. 第 6 階段：同步首頁、navbar 與教師後台

週頁做好後，不算完成，還要同步首頁、navbar 與教師後台三處。只要新增正式週卡，三處同步都是必做項目，不可把教師後台視為日後補做。

### 9.1 同步 `navbar.js`

如果該年級 navbar 用 `activeWeeks` 控制顯示，記得把週次加進去。
也要確認清單中缺少的週次是刻意排除（例如假期、行政週），不是漏掉。

例如：

- `grade6/navbar.js`

### 9.2 同步首頁週卡

更新：

- `grade3/index.html` / `grade3/115-1/index.html`
- `grade6/index.html` / `grade6/115-1/index.html`
- `admin-progress.html` 的 `visibilityDefaults`，讓老師後台「首頁週卡片顯示管理」也看得到新週卡

通常要做：

1. 新增本週卡片
2. 把上一週的「本週最新」移除
3. 把這週卡片改為 `data-latest-week="true"`
4. 在 `admin-progress.html` 對應 `courseId` 的 `visibilityDefaults.weeks` 加入本週週碼，例如 `"02"`

### 9.3 驗證教師後台週卡管理

1. 用教師帳號開啟 `admin-progress.html`。
2. 確認「首頁週卡片顯示管理」在正確年級、學年度下列出本週，預設狀態符合規劃。
3. 實際按一次「隱藏」，確認對應學年度首頁的本週卡片消失，其他課程相同週碼不受影響。
4. 再按「顯示」恢復預定狀態，確認首頁卡片重新出現。

### 9.4 navbar 版本字串一起更新

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

- `http://localhost:3000/gradeX/115-1/weekXX.html`（目前 115 學年度上學期）

### 10.2 至少驗這些

1. 頁面可正常打開
2. navbar 可顯示正確週次，且前後週連結符合目前顯示規則
3. 首頁可點進本週頁面
4. 新增正式週卡時，教師後台可看到本週，且實測隱藏／顯示會讓對應學年度首頁週卡消失／恢復
5. 圖卡或圖片可正常載入
6. `initNavbarAuth()` 沒有報錯，登入按鈕不是靜默無反應
7. 若本機有 auth 條件，實際點一次登入按鈕，確認有觸發 OAuth 或導向行為
8. console 沒有紅字
9. 若有外部連結，確認格式正常
10. 若有課堂即時開關，確認未登入不顯示老師按鈕、教師登入可開關、學生按「更新狀態」可同步，且沒有 `setInterval` 輪詢
11. 若頁面引用生成圖卡，確認引用的是壓縮後 WebP 或 Cloudinary 正式網址，不是生成 PNG 原圖；多張圖卡需檢查總載入量，避免上課網路卡頓
12. 三年級 115-1：教師 Google session 存在時仍只顯示課堂身分卡；進度寫入 `guest_progress`；頁面、首頁與 navbar 不顯示努力樹入口
13. 六年級作業：以匿名、教師與名冊學生三種角色驗證權限；確認正確作業週次／名稱、上傳完成狀態、重整接回與重交版本
14. 六年級閱讀：確認教師已設定本週 period；學生可分享／修改、歷週可補分享，教師只列已分享者
15. 六年級努力樹：作業與閱讀均為繳交一葉、過關再一葉；重交／再努力不重複累積
16. 滑鼠操作活動以實際 pointer／mouse 動作測試，不只直接呼叫函式或人工派發 `drop`；至少驗證拖曳跟手、左右方向框選、`Ctrl` 增減選取、空白取消與整群搬移
17. 有「再練習」時，確認狀態已清空且題目／方向／排列真的改變
18. 打字活動確認範例不能反白複製，輸入框無法貼上或拖入文字，且一般鍵盤逐字輸入仍正常
19. 測驗同時驗證：選項有明顯已選狀態、滿分回饋／動畫可見、保存失敗不會覆蓋答題結果、正式資料表可讀回完成紀錄

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
5. 教師後台週卡管理已加入本週，並驗證隱藏／顯示與對應首頁同步
6. 若教案需要資訊圖卡，資產已落位；不需要時標記 N/A
7. 課本頁碼（若有）已回寫
8. 本機已驗證
9. 若為正式上站頁面，資訊圖卡優先改用 Cloudinary 正式網址，或已確認目標網路環境可穩定存取本機資產
10. 六年級 115-1 自第 02 週起，若已建立任務週卡，同週 reading period 也已在本次工作建立，並從學生入口驗證可見；若因帳號或日期資訊不足未完成，交付狀態必須明確標示尚未完成
11. 若含正式作品作業，教師端所需作業草稿／開放狀態已建立或明確列出未完成項目；程式碼完成不等於外部狀態已設定

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

- 教案：`grade6/LessonPlan/114-2/Week 11.md`
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
- 週頁 / 首頁 / navbar / 教師後台週卡管理同步

尚可再補：

1. 壓圖腳本未來可補批次模式與自動命名
2. Cloudinary 上傳腳本可再補批次模式與 URL 自動回填
3. NotebookLM workflow 可再補更穩的多版回答解析與提醒語句模板化

---

## 16. 一句話版流程

> 先定教案，再判頁型；需要頁碼就先問 NotebookLM，需要圖卡就先做圖卡；接著做週頁，同步首頁、navbar 與教師後台週卡管理，最後用 localhost 驗證，再整理提交範圍。
