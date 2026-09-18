# 課程網頁開發 SOP

> 最後更新：2026-09-15
>
> 目標：避免「上課才發現功能壞掉」。

---

## 階段 0：給 AI 的提示規範

撰寫或修訂週次教案時，先讀 `docs/development/lesson-plan-sop.md`，確認教材來源、活動定位、評量方式與中英打素材來源已寫清楚。教案定稿後再依本文件與 `lesson-to-web-sop.md` 製作課程網頁。

在把任何新頁面任務交給 Codex 或 Claude 之前，prompt 必須包含以下三件事：

1. **指定參考頁面**：「請參考 `grade3/week10.html` 的結構，不可只仿版面」
2. **貼上功能契約**：把填好的 `new-page-checklist.md` 直接貼進 prompt
3. **禁止清單**：明確說「不可用 localStorage 存進度」、「不可自己重寫 typing 邏輯」、「levelsData 的欄位是 `ans` 不是 `answer`」

---

## 階段 1：開發前確認

### 1.0 確認學年度資料夾

新增課程網頁與網頁資產前，先確認目前學年度與學期。115 學年度上學期的新頁面放在：

- 三年級：`grade3/115-1/weekXX.html`
- 三年級資產：`grade3/115-1/images/weekXX/`
- 三年級教案：`grade3/LessonPlan/115-1/Week XX.md`

舊 114 學年度網頁目前仍保留在 `grade3/`、`grade6/` 根目錄，避免破壞已發布連結；不要把 115 新頁新增到舊根目錄。

根目錄 `index.html` 也必須區分學年度：

- 目前學年度入口應連到 `grade3/115-1/index.html` 這類學年度首頁。
- 舊學年度入口保留為封存/備查區，例如連到 `grade3/index.html`、`grade6/index.html`。
- 不要讓根首頁的主課程卡直接連到舊學年度首頁。

若新頁參考舊頁，例如 `grade3/week10.html`，必須同步調整巢狀路徑：

- `../shared/...` → `../../shared/...`
- `navbar.js?v=YYYYMMDD` 仍使用同層 `navbar.js`，但應為該學年度資料夾內的 navbar
- 圖片優先放在該學年度資料夾下，例如 `images/week01/...`

注意：現行 `week_visibility` 已用 `course_id` 區分課程。115-1 首頁與 navbar 必須明確傳入 `grade3-115-1` 或 `grade6-115-1`；省略 `course_id` 只供舊學期相容，不可作為新學期實作方式，以免相同週碼互相干擾。

新增正式週卡時，必須完成「週卡三處同步」，缺一不可：

1. 對應學年度首頁新增週卡並設定最新週標記。
2. 對應學年度 `navbar.js` 的 `activeWeeks` 加入本週。
3. `admin-progress.html` 對應 `courseId` 的 `visibilityDefaults.weeks` 加入本週兩位數週碼，讓教師後台可以管理該卡片。

完成後要用教師帳號確認後台出現新週次，並實際切換一次隱藏／顯示，確認只影響相同 `course_id` 的首頁週卡；驗證後恢復預定狀態。只完成首頁或 navbar，不算完成新週頁發布流程。

### 1.1 先確認年級身分分支

- **三年級 115-1**：除教案明確的首週免身分例外外，課堂身分卡取代 Google 登入，互動進度寫入 `guest_progress`。目前不使用六年級作業／閱讀服務，努力樹尚未支援 guest progress，首頁、navbar 與完成提示不得顯示努力樹入口。
- **六年級 115-1**：使用學校 Google 帳號；學生還要符合六年級名冊。中英打使用 `student_progress`，作業與閱讀使用各自的 homework／reading 資料與共用入口。自第 02 週起，只要建立正式任務週卡，就必須在同一次製作流程建立同週閱讀 period；沒有上課、沒有建立週卡的週次才保持缺號。

不可以只看年級名稱，也要確認學年度資料夾；舊 `grade6/navbar.js` 與 `grade6/115-1/navbar.js` 的登入能力不同。

### 1.2 確認頁面類型
對照 `page-types.md`，確認這頁屬於 A / B / C / D / E 哪種類型。

### 1.3 找最近的同類型參考頁
- 打字闖關（類型 C）→ 參考 `grade3/week10.html`（最新）
- 一般說明頁（類型 B）→ grade3 參考 `week09.html`，grade6 參考 `week10.html`
- **不要參考最早的頁面**，早期頁面可能缺少後來加入的架構修正

### 1.4 填寫功能契約 Checklist
把 `new-page-checklist.md` 複製一份，逐項填寫。不確定的項目先查程式碼再填，不可留空。

### 1.5 確認 activityKey 不重複（若有進度記錄）
```bash
grep -r "activityKey\|activity_key" grade3/ grade6/
```
確認沒有相同的 weekCode + activityKey 組合。

---

## 階段 2：開發中規範

### 絕對不可以做的事

| 禁止行為 | 正確做法 |
|----------|----------|
| `document.getElementById('login-btn').addEventListener(...)` | `initNavbarAuth()` |
| 打字記錄存 `localStorage` | `initTypingChallenge` 接 Supabase |
| `levelsData: [{ id, answer }]` | `levelsData: [{ id, ans }]` |
| 手刻 nav HTML | 使用 `navbar.js` |
| 直接呼叫 `supabase.auth.signInWithOAuth()` | `beginCentralizedLogin()` |
| 把 quiz / typing 進度直接 upsert `student_progress` | 使用模組的 save 函數 |
| 課堂中才開放的連結自己寫 RPC / 輪詢 | `shared/classroom-controls.js` |
| 在週頁複制作業上傳或閱讀小卡表單 | 六年級連到 `grade6/115-1/homework.html` 或 `#reading` |
| 跨週續作另建同名新作業 | 指向原作業週次與名稱，保留同一份作業版本史 |
| 在週頁硬寫 `homework_<id>`／`reading_<id>` | 由 `homeworkTreeData()`／`readingTreeData()` 動態產生 |
| `navbar.js` 不加版本字串 | `navbar.js?v=YYYYMMDD` |

### 模組選用規則

**依需求選用，不可重寫功能模組**：

| 需求 | 必用模組 | 不可替代 |
|------|----------|----------|
| Nav 顯示 | `navbar.js` | 手刻 nav |
| 登入/登出 UI | `initNavbarAuth()` | 直接綁 button |
| 打字關卡進度 | `initTypingChallenge()` | localStorage + 自寫邏輯 |
| 題組進度 | `quiz-module` + adapter | 自寫 supabase upsert |
| 首頁週卡可見性 | `applyWeekVisibilityToCards()` | 自行查 DB |
| 課堂即時開關 | `initClassroomLinkControl()` | 自寫 RPC / setInterval 輪詢 |
| 六年級正式作業 | `homework.html` + homework 共用模組 | 週頁自製 upload / 直接呼叫 RPC |
| 六年級閱讀小卡 | `homework.html#reading` + reading 共用模組 | 週頁自製表單 / 硬寫 period ID |
| 作業／閱讀努力樹 | `homeworkTreeData()` / `readingTreeData()` | 週頁直接寫獎勵或 `student_progress` |

**互動活動登入規則**：

- 一般 Google 登入頁的打字闖關必須先登入才能開始；未登入時要鎖定輸入框與檢查按鈕。
- 一般 Google 登入頁的測驗 / 小測驗只要有可點選作答 UI，就必須先登入才能作答，並寫入 `student_progress`。
- 三年級 Google 登入前的課堂身分卡頁不走 Google 登入，改用下方分支 SOP；未確認課堂身分卡前同樣必須鎖定互動 UI。
- 若只是教師口頭檢查，頁面只能放靜態題目文字，不可做成可點選答案的互動 quiz。
- **首週規則闖關例外**：若是第一週、內容僅為電腦教室規則確認與滑鼠點選練習、不作為成績或個人進度，且教案明確要求不登入，則可做成不登入也能作答的純前端規則闖關。這類闖關不得寫入 `student_progress`、不得使用正式 quiz 保存流程，頁面需明確標註「本週不用登入」。
- **三年級 Google 登入前的課堂身分卡例外**：115 三上三年級在正式教 Google 登入前，可用「課堂身分卡」取代 navbar 的 Google 登入入口。課堂身分卡只能用於低風險課堂練習與闖關，UI 必須明確標示這不是 Google 登入。進度不得寫入正式 `student_progress`；若要記錄課堂進度，需透過受控 Supabase RPC 寫入獨立的 `guest_progress`。同一頁 navbar 只能出現課堂身分卡或 Google 登入其中一種。

**三年級 Google 登入前分支 SOP（課堂身分卡頁）**：

適用條件：學生尚未學會 Google 登入，但本週互動任務需要保存進度、重開瀏覽器後接回，或需要在教師後台查看與重設。

必做規則：

1. Navbar 身分入口使用 `initClassCardAuth({ courseId, mode: 'required' })`，並保留 `initNavbarAuth()` 只負責 navbar 事件代理與教師後台入口；頁面不得同時呈現 Google 登入與課堂身分卡。
2. 課堂身分卡可用 localStorage 保存「目前這台電腦是哪位同學」的臨時身分，包含再次呼叫 RPC 保存進度所需的生日四碼；這只適用於會重開機還原的電腦教室情境。闖關、測驗、視窗練習等活動進度不得存在 localStorage。
3. 進度一律使用 `createClassCardProgress()` 經由 `get_guest_progress` / `upsert_guest_progress` 寫入 `guest_progress`，不可寫入 `student_progress`。
4. 同一頁若使用 `initTypingChallenge()`，需設定 `requireAuth: false` 與 `guestProgress`，並確認 shared typing 流程不會讀取背景 Google session 或 `student_progress`。
5. 測驗與其他互動模組需提供 `loadGuestProgress` / `saveGuestProgress`，且未確認課堂身分卡前必須隱藏或鎖定可作答 UI。
6. 後台必須能列出 `guest_progress`、顯示課堂身分卡來源、支援重設；重設後回到學生頁重新整理，應回到未完成狀態。若學生頁仍顯示完成，優先檢查是否仍有舊 localStorage 進度或 shared module 誤讀 `student_progress`。
7. 若頁面曾經用 localStorage 暫存進度，正式改用 `guest_progress` 時要主動清掉舊進度鍵，避免舊瀏覽器狀態誤導畫面。
8. 努力樹若尚未支援 `guest_progress`，課堂身分卡頁不可用「去看我的努力樹」作為完成後主要行動；改用「回到本週課程」或「完成本週任務」，避免學生以為 Google 進度也已累積。
9. 上課前 smoke test 需額外測：有教師 Google session 的電腦仍只讀課堂身分卡進度；登出/登入課堂身分卡、教師後台重設、學生刷新後狀態一致。

**課堂即時開關規則**：

- 若某些連結、影片、活動入口需要「老師講到這裡才開放」，功能名稱統一叫「課堂即時開關」（Classroom Control）。
- 使用 `shared/classroom-controls.js` 搭配 `supabase/classroom_controls.sql`，不要在單一頁面重寫 Supabase RPC、老師判斷、鎖定樣式或點擊攔截。
- 學生端採手動「更新狀態」按鈕同步，不使用 `setInterval` 輪詢，避免干擾同頁的登入、測驗與打字進度。
- 每個控制項要設定清楚的 `controlKey`，例如 `maps_links`、`video_links`、`practice_links`，同一週內不可重複。
- 此功能只控制「可不可點 / 可不可進入」，不寫入 `student_progress`。

**可以自由寫的部分**（不碰 auth / progress / navbar）：
- Spotlight 放大圖
- 靜態說明文字區塊
- 倒數計時、進度條等 UI
- 解鎖後顯示/隱藏的 UI 區塊（但觸發邏輯要橋接，不改 module）

### Grade3 打字闖關頁的固定樣板

舊學期 Google 登入頁與 115-1 課堂身分卡頁不可共用同一段初始化。115-1 三年級頁的 module script 至少要包含：

```javascript
import { initNavbarAuth } from "../../shared/navbar-auth.js";
import { initClassCardAuth } from "../../shared/class-card-auth.js";
import { createClassCardProgress } from "../../shared/class-card-progress.js";
import { initTypingChallenge } from "../../shared/typing-challenge.js";

initNavbarAuth();
const classCardAuth = initClassCardAuth({ courseId: "grade3-115-1", mode: "required" });
```

然後建立 `createClassCardProgress()` adapter，並以 `initTypingChallenge({ requireAuth: false, guestProgress })` 初始化。舊學期頁面依該頁原有 Google auth 契約處理。

### `navbar.js` 版本字串

每次更新 `navbar.js` 或新增頁面時，使用當天日期：

```html
<script src="navbar.js?v=20260415"></script>
```

---

## 階段 3：完工後本機驗證

> **必須在 `http://localhost:3000` 完成，不能用 `file://`**。
> Supabase OAuth 和 auth 相關功能在 `file://` 下不會正常運作。

### 基本 auth 流程

1. **一般 Google 登入頁未登入**：開啟頁面，navbar 出現 Google 圖示按鈕（grade3）；若為課堂身分卡分支，navbar 應出現「先輸入課堂身分」且不顯示 Google 登入
2. **點登入**：跳轉 Google OAuth，完成後跳回原頁（不是首頁）
3. **登入後**：email 顯示在 navbar，登入按鈕消失，教師帳號出現後台按鈕
4. **登出**：點登出，email 消失，登入按鈕重新出現

### 打字闖關（若有）

5. 未登入或未確認課堂身分卡時，確認輸入框與檢查按鈕不可使用，不能先闖關
6. 登入後，輸入第 1 關正確答案，過關動畫出現，第 2 關出現
7. 故意輸入錯誤答案，確認提示能指出第幾行、第幾個字附近，或判斷可能少字/多字；不可只出現籠統提示，且不可把少字誤導成多打標點
8. 繼續打完最後一關，確認 Supabase 有記錄（開後台查）
9. **開新分頁**，同一頁面，確認進度自動接回（顯示「從第 N 關繼續」）
10. **切到別的分頁再切回**，按「檢查答案」後仍要能寫入對應進度表；一般頁為 `student_progress`，課堂身分卡分支為 `guest_progress`。一般頁若失敗先讀 `supabase-tab-resume-incident.md`
11. 用重置按鈕重設，確認回到第 1 關

### 六年級作業繳交（若有）

- 教師後台確認目標作業的週次、名稱、班級與收件狀態；跨週續作不得另建同名作業
- 匿名、教師與未列名冊帳號不可用學生身分上傳
- 名冊學生選檔後仍需按上傳；完成後顯示「已繳交・待評」與實際檔名
- 重整後狀態仍在；重交保留舊版本且最新版回到待評
- 教師評為過關、再努力、收回評比時，最新版與努力樹第二片葉同步變化

### 六年級閱讀小卡（115-1 第 02 週起有任務週卡即必做）

- 六年級 115-1 自第 02 週起，有正式任務週卡就視為「有閱讀小卡」，不得標記 N/A
- 製作週頁與週卡的同一次工作中，使用教師後台建立正確週次與日期的 reading period；沒有上課、沒有週卡的週次才保持缺號
- 建立前核對目前登入的教師帳號、課程、週次與日期；建立後由學生入口確認本週小卡可見
- 名冊學生可分享本週小卡、修改並查看版本；歷週開放項目可補分享
- 教師只列已分享者，不顯示缺交或未分享人數
- 分享後努力樹有繳交葉；過關後再有一葉；修改同週小卡不重複增加

### 三年級 115-1 額外確認

- 課堂身分卡頁只顯示身分卡，不顯示 Google 登入
- 進度寫入 `guest_progress`，後台可查詢／重設，重設後學生重新整理回到未完成
- 首頁、navbar、完成 overlay 都不顯示或承諾尚未支援的努力樹
- 課堂身分來源為 `rpc`；舊 `sample-roster` 身分在正式名冊已存在時能自動升級，完成活動後後台確實讀得到紀錄

### 測驗 / 小測驗（若有）

12. 未登入或未確認課堂身分卡時，只能看到鎖定區，不能看到或點選題目選項
13. 登入後，測驗題目才出現
14. 送出測驗後，確認 Supabase 對應進度表有記錄（一般頁為 `student_progress`，課堂身分卡分支為 `guest_progress`，開後台查）
15. 點選後有明顯已選狀態；滿分回饋可見；模擬保存失敗時只顯示保存警告，不覆蓋分數與正誤結果

### 滑鼠操作模擬與再練習（若有）

16. 使用實際 mouse／pointer 動作完成拖曳、左右方向框選、`Ctrl` 增減選取、空白取消與整群搬移；拖曳預覽要跟隨游標
17. 按「再練習一次／換一題」後，上一輪狀態全部清除，且題目、目標、排列、方向或資料組至少改變一項
18. 打字活動確認題目不可反白複製，輸入框不可貼上或拖入文字，但正常逐字輸入不受影響

### 解鎖邏輯（若有）

19. 完成最後一關後，確認解鎖區塊出現，鎖定區塊隱藏
20. 重新整理頁面（已完成進度），確認解鎖狀態正確恢復

### 後台

21. 用教師帳號登入 `admin-progress.html`，確認此週此活動出現在進度清單

---

## 階段 4：上課前 Smoke Test（上課前 15 分鐘）

```
□ 確認是用 http:// 開啟（不是 file://）
□ 點一下 navbar 登入按鈕，確認有反應（跳 Google 授權或跳 alert）
□ 若有打字闖關：未登入或未確認課堂身分卡時確認不能輸入與過關
□ 若有打字闖關：登入後輸入一個正確答案，確認過關訊息出現
□ 若有測驗：未登入或未確認課堂身分卡時確認只能看到鎖定區，不能看到題目選項
□ 若有打字闖關：故意少打一兩個字，確認錯誤提示方向正確且能指出附近位置
□ 若有打字闖關：範例不能反白複製，貼上／拖入文字被阻擋，逐字輸入正常
□ 若有滑鼠操作：用真實滑鼠完成拖曳、框選、Ctrl 多選、取消與選取後拖曳
□ 若有再練習：清除舊狀態且新一輪內容確實改變
□ 若有測驗：已選狀態明顯；滿分回饋正常；保存失敗不覆蓋答題結果
□ 若有解鎖邏輯：（若可以）打完最後一關，確認解鎖區塊出現
□ Console 無紅色錯誤（F12 打開看一眼）
□ 手機或小螢幕快速確認版面不爛
□ 所有外連連結（外部網站）能開啟
□ 新增正式週卡：首頁、navbar `activeWeeks`、教師後台 `visibilityDefaults` 三處都已同步
□ 新增正式週卡：教師後台可看到本週，並已實測隱藏／顯示會讓對應學年度首頁週卡消失／恢復
□ 三年級 115-1：只顯示課堂身分卡，首頁／navbar／完成提示沒有努力樹入口
□ 六年級有作業：教師已確認原始週次、名稱與收件狀態，學生入口能看到正確作業
□ 六年級 115-1 第 02 週起：有任務週卡就已在同一次製作流程建立 reading period，學生入口能看到本週小卡
□ 六年級作業／閱讀：努力樹文案與實際規則都是繳交一葉、過關再一葉
```

如果 smoke test 有任何一項失敗：**先修好再上課，不要帶著 bug 進教室**。

---

## 常見錯誤與修法速查

| 症狀 | 最可能原因 | 修法 |
|------|-----------|------|
| 登入按鈕點了沒反應 | 沒呼叫 `initNavbarAuth()`，或 grade3 navbar 重渲後 listener 消失 | 確認 `initNavbarAuth()` 有被呼叫；若頁面有 `initTypingChallenge`，兩個都要呼叫 |
| 打了字過關，但後台看不到進度 | 打字邏輯用 localStorage 實作，沒有接 `initTypingChallenge`；或課堂身分卡分支沒有接 `guest_progress` | 一般頁改用 `initTypingChallenge` + `student_progress`；課堂身分卡分支使用 `guestProgress` + `createClassCardProgress()`，`activityKey` 要有值 |
| 刷新頁面進度不見 | 同上，或 `weekCode` / `activityKey` 格式錯誤 | 確認 `weekCode` 是兩位數字串、`activityKey` 不重複 |
| 打字錯誤提示方向不對，例如少字卻提示多打標點 | 新頁沒有沿用精準 `buildHint`，只寫了籠統提示 | 參考 week06/week07/week10 的逐行逐字比對提示，至少能指出第幾行與錯誤附近文字 |
| 完成最後一關，解鎖區塊沒出現 | 解鎖 UI 依賴 module 完成狀態，但沒有橋接 | 加 MutationObserver 監聽 `#progress-status`，參考 week10 寫法 |
| `confetti is not defined` | 沒加 canvas-confetti CDN | 在 `<head>` 加入 CDN script |
| `levelsData` 第一關過不了（正確答案也不對） | `levelsData` 用了 `answer` 而非 `ans` | 把所有 `answer:` 改成 `ans:` |
