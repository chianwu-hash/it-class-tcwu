# 課程網頁開發 SOP

> **2026-10-24 測驗場次例外（使用者已核准）**：`initQuizModule({ mode: 'server' })` 的個人進度測驗由後端判分與揭答，正式作答使用 `quiz_attempts/quiz_answers`；暫不映射 `student_progress` 或努力樹。此例外只適用新場次模式，既有 scored／practice 週頁契約不變。見 [實作與驗收](quiz-implementation-20261024.md)。

> **2026-10-06 三年級轉換更新**：教師已指定第 06 週接 Google 登入與努力樹。第 02～06 週改用本人名冊核對、一次性舊成果接回與正式 `student_progress`；下文身分卡／不顯示努力樹的敘述僅適用轉換前。第 01 週免身分例外保留。以 [三年級 Google 契約](grade3-google-course.md) 與已填驗收契約為準；正式 SQL 與網站已於2026-10-06獲授權後完成切換；詳見 [正式切換紀錄](grade3-week06-release.md)。

> 最後更新：2026-11-06
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

### 資訊圖卡的放大互動

資訊圖卡一律採用六年級115-1第01週的同頁燈箱模式，使用 `shared/image-lightbox.css` 與 `initImageLightbox()`，提供縮放、拖曳、雙擊、手機雙指、重設、置中與關閉，不以另開圖片分頁取代。實作與驗收詳見 `lesson-to-web-sop.md` 第8.5節；第05週為共用模組使用範例。

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

### 打字活動與努力樹同步

若課程支援努力樹，新增打字活動時，同次更新 `shared/reward-tree-config.js` 對應課程的活動清單，核對 `courseId`、`weekCode`、`activityKey`、`totalLevels` 與 `pageHref`。後台有完成紀錄不代表努力樹已收錄；即使週頁沒有努力樹入口，仍須完成這項設定。作業／閱讀沿用動態 adapter，不改為靜態活動設定。三年級 115-1 的 `guest_progress` 尚未支援努力樹，維持既有例外。

### 每週任務與升級目錄必須同次交付（2026-11-03）

新增或修改任何支援努力樹的每週任務，都必須同次同步前端活動設定與正式資料庫的 `garden_reward_catalog`；不能只部署週頁或更新 `reward-tree-config.js`。適用於已接 Google 正式進度的三年級與六年級，不能依下方歷史課堂身分卡敘述跳過。

1. 核對正式頁／adapter 的課程、週碼、活動鍵、類型、總關卡數及 `rewardMode`，更新前端設定。
2. 執行 `node automation/build-garden-catalog.mjs`，審核產生的 `supabase/garden-catalog.sql` 差異；以受保護遷移套用對應正式專案。
3. **產生或提交 SQL 不等於已套用正式資料庫。** 保留套用結果與前後比對證據，不修改學生原有進度、花葉或首次成長已讀狀態。
4. 作業、閱讀、考古花與基礎打字里程碑沿用既有動態蒐集器，不重複登錄為週活動；新增這類來源時也要驗證升級端能收錄。

案例：[第 10 週漏列導致無法升級](effort-garden-catalog-fix-20261103.md)。前端顯示達標而升級端漏算是系統缺陷，不能要求學生重做或反覆登入。

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

### 關卡／滑鼠操作模擬與再練習（若有）

16. 使用實際 mouse／pointer 動作完成拖曳、左右方向框選、`Ctrl` 增減選取、空白取消與整群搬移；拖曳預覽要跟隨游標
17. 每一關都要有「再練習一次」；按下後上一輪狀態全部清除，且題目、目標、排列、方向或資料組至少改變一項，並確認不會把正式進度倒退
   - 若有逐題「換一題」：先確認按鈕鎖定；答錯仍鎖定；按「檢查」答對後出現成功文字與短暫小動畫，才可換題；修改答案、切換身分或換新題後重新鎖定。減少動態效果設定下仍須看得到文字回饋。純暖身不可因動畫或換題寫入正式進度。
18. 打字活動確認題目不可反白複製，輸入框不可貼上或拖入文字，但正常逐字輸入不受影響

### 解鎖邏輯（若有）

19. 完成最後一關後，確認解鎖區塊出現，鎖定區塊隱藏
20. 重新整理頁面（已完成進度），確認解鎖狀態正確恢復

### 過關返回與打字努力樹（若適用）

- 完成最後一關後，實際點擊慶祝畫面的按鈕，確認遮罩移除、目標區段可見且可操作。同頁 `#錨點` 不會換頁，不能只檢查網址已改變；遮罩關閉交由共用 typing 模組處理。
- 若按鈕導向另一頁，確認到達正確課程，並能透過返回入口回到原週頁。
- 後台確認完成紀錄後，再開啟對應課程努力樹，核對本週葉片與魔王花；重新整理後仍應一致。依目前模型，N 關全部完成為 N−1 片葉與 1 朵魔王花，例如 5 關為 4 葉、1 花；作業／閱讀另依各自規則。
- 後台已完成但努力樹缺少本週成果時，先查活動設定及課程／週次／活動鍵是否一致，不先重設學生進度或要求重打。
- 事件與驗證依據：[2026-10-01 第 03 週修正紀錄](sessions/2026-10-01-grade6-week03-completion-fix.md)。

### 後台

21. 用教師帳號登入 `admin-progress.html`，確認此週此活動出現在進度清單

---

## 發布規則：只從 main 發布（2026-11-04 起）

> 優先於下方及其他文件中「以凍結發布包為底、只覆蓋本批檔案」的流程。

背景：10/30 曾用舊發布包部署，蓋掉另一個 agent 已上線的內容約 9 分鐘。11/04 起 `main` 是正式網站與資料庫函式的唯一來源。

1. **來源只能是 `main`**：部署目錄必須是 `main` 某個 commit 的乾淨 checkout（`git status --porcelain` 為空）。功能分支先經 PR 合併進 `main` 才能發布。不再從凍結發布包、功能分支、主工作區或任何有未 commit 修改的目錄部署。
2. **只能用 `automation/release-from-main.mjs` 發布**（2026-11-04 起）。不要自己執行 `vercel deploy --prod` 或 `vercel promote`。這支腳本會在以下任一情況直接擋下：目錄有未 commit 或未追蹤的檔、HEAD 不是最新 `origin/main`、別人正在發布、開始後正式版或 `origin/main` 有變動、候選版與正式版的差異不等於宣告的檔案。
   - 在一個乾淨的 worktree（從 `origin/main` 建立，不是主工作區）執行；Vercel CLI 設定用 `--global-config` 或環境變數 `VERCEL_GLOBAL_CONFIG` 指定。
   - **新工作目錄先確認 Vercel 綁定**：使用指定帳號／設定執行 `vercel link --project it-class-tcwu --yes`（依 CLI 加上 `--global-config`），讀回忽略檔 `.vercel/project.json`，確認 projectName 為 `it-class-tcwu`、projectId 為 `prj_eJ1qle57xyilS5MKy6ZS6OuYtyFb`，且 orgId 與正確帳號的專案相符；缺少或不符時不得 deploy，否則 CLI 可能按資料夾名稱新建錯誤專案。綁定檔不提交 Git。
   - `node automation/release-from-main.mjs status`：查看鎖、正式網址目前指向的部署與 `origin/main`。
3. **開始（取得發布鎖）**：`node automation/release-from-main.mjs start --agent <名稱> --changed <預期修改檔,…> --added <新檔,…> --removed <刪除檔,…>`。基準是正式網址 `it-class-tcwu.vercel.app` 實際指向的部署（不是 `targets.production`，後者可能是建置失敗的部署）。鎖存在 repo 共用 git 目錄的 `release-lock.json`，所有 worktree 都看得到；被別人持有時停止並問使用者，不得刪除別人的鎖。
4. **部署候選版**：`node automation/release-from-main.mjs deploy --agent <名稱>`。只建立候選版（`--prod --skip-domain`，不 promote），並自動比對完整檔案樹；不符就標為 rejected。2026-11-05 起 `vercel.json` 的 `git.deploymentEnabled` 同時設 `"**": false` 和 `"main": false`：所有 Git 分支的自動預覽／正式部署都關閉，包含 `codex/...` 等帶斜線分支，避免 PR 反覆觸發教材來源阻擋及失敗通知。新分支仍必須從最新 main 建立，以承接此設定；不要推送仍保有舊設定的歷史分支。這不影響 PR 或本 CLI 發布腳本，不需要為這項 Git 設定切換正式網站。不得重開 Git 自動部署，也不能停用發布前檢查來消除通知。
5. **promote**：`node automation/release-from-main.mjs promote --agent <名稱>`。promote 前會再確認正式版與 `origin/main` 沒變、比對仍通過；promote 後確認正式網址已指向候選版，釋放鎖並寫入 `release-history.ndjson`。只差換行的檔（`core.autocrlf=true` 造成）會列為 `eolOnly`，不算失敗；內容不同就會擋下。正式版有 11 個混合換行檔已在 `.gitattributes` 標 `-text`。
6. **收尾**：把 promote 輸出的 `handoffRow` 經 PR 加到 [agent-handoff.md](agent-handoff.md) 頂部的發布紀錄，並讀回關鍵頁面；確認收據已進 main、發布鎖已釋放後，必須完成下節的證據封存與工作目錄清理。放棄或失敗用 `abort --agent <名稱>` 釋放自己的鎖，保留未完成工作及排錯證據。回滾目標是紀錄中的基準部署，不必永久保留整份發布 checkout。
7. **資料庫函式**：函式變更寫成 `supabase/` 下的新 SQL 檔，經使用者同意後套用；套用後立刻執行 `node automation/db-schema-snapshot.mjs` 與 `node automation/db-snapshot-check.mjs --live`，兩者通過再把 `supabase/production-snapshot/` commit 進 `main`。重新安裝時最後套用 `supabase/production-snapshot/functions.sql`。**不可單獨重跑 `supabase/quiz-order-fix.sql`**，它會蓋掉 `quiz_action` 的學習包裝層。詳見 [快照說明](../../supabase/production-snapshot/README.md)。
8. **工具備註**：本機 Vercel CLI 設定在 `%APPDATA%\xdg.data\com.vercel.cli`，呼叫時加 `--global-config` 指向該資料夾；在 Git Bash 呼叫 `vercel api /v9/...` 要先設 `MSYS_NO_PATHCONV=1`，否則路徑會被改寫成 Windows 路徑，CLI 會改走登入流程。

## 發布後收尾：證據封存與工作目錄清理（2026-11-06 起）

每次正式發布完成後，由本次執行者完成以下收尾；開發、資料庫快照、乾淨 main 發布與收據 PR 所建立的工作目錄都要列入檢查。純文件任務在 PR 合併後同樣收尾，無須為文件修改另做 Vercel 部署。使用者已授權依本節常態執行，不必每次另問；授權只涵蓋已確認屬於本次工作、已完成且未使用的目錄，不能擴大成清除其他對話的工作。

### 1. 確認完成與清理範圍

- 正式驗證已通過、發布收據 PR 已進 `main`、發布鎖已釋放，才可清理發布工作目錄。驗證未通過或仍需排錯時保留，不能為回收空間把工作標成完成。
- 先 `git fetch origin`，以 `git worktree list --porcelain` 逐一列出本次工作目錄的**完整絕對路徑**、HEAD、分支、PR 與用途；記錄清理前各磁碟可用位元組。從最新 `origin/main` 建新工作目錄與只從乾淨 main 發布的規則不變。
- 主工作區、共用 Git 目錄、其他對話的目錄、共用依賴與教材來源不在清理範圍。不按日期、名稱前綴或整個父資料夾批次刪除；巢狀 worktree 也必須逐一確認登記與精確路徑，不得誤刪其主工作區。
- 每個候選都要確認：HEAD 已包含於最新 `origin/main`、沒有未提交修改或未追蹤檔案、未被鎖定、沒有未合併成果；**忽略檔案另行盤點，`git status` 乾淨不代表沒有私有證據**。
- 檢查其他對話狀態、程序工作目錄及命令列中的目標路徑、預覽服務、Claude／AGY worker 與檢視器；命令列只用於辨認歸屬，不輸出或保存可能含憑證的原文。對話未載入、回合結束或程序檢查沒命中，不能單獨作為安全刪除的證據。
- 未完成、有修改、未合併、鎖定、使用中或歸屬不明的目錄一律保留並說明原因；不為了清理強制停止服務或檢視器。正常測試收尾時先自行停止已確認不再需要的本次 worker／服務，再重新核對；仍在使用者與他人服務保持原狀。發布鎖被別人持有時停止並問使用者，不得移除鎖。

### 2. 分批處理與證據封存

1. **沒有忽略檔案的乾淨已合併目錄**：保存上述目錄及 Git 清單後，可直接使用正常 `git worktree remove <已核對的完整絕對路徑>` 移除。
2. **有忽略檔案的目錄**：先在 repo 外的本機私有位置封存必要證據，例如 `C:/Users/user/Documents/pc-master/worktree-evidence/<日期時間>/`；先確認目的磁碟空間與存取權限。只保留必要的獨有證據，不搬整份 checkout；`.chat-mode` 討論、來源指紋、SQL 套用前後比對、正式驗證與發布收據等不可因已 merge 就遺失。學生資料、私有題目與 `*.private.json` 不進公開 repo；權杖及密碼不是應封存的證據，不輸出或提交。
3. 每份封存保存原完整路徑、HEAD、分支、PR／發布及回滾識別、時間、追蹤檔案索引、封存檔案相對路徑／大小／SHA-256，以及 junction／符號連結的目標資訊。追蹤內容由可讀的 Git commit 還原；仍需保留且未進 Git 的成果不得只記檔名而不保存內容。
4. 排除可重建依賴副本與暫存前，先確認它們可重建且不含獨有證據；不能只憑 `tmp` 或 `automation/output` 名稱略過。**不得跟隨 junction／符號連結複製或刪除共用目標**，例如主工作區的 `tmp/quiz-runtime`。
5. 移除前必須驗證：封存可讀、檔案清單與數量及位元組符合、壓縮檔 CRC（若適用）、逐檔 SHA-256 與來源相同，並保存整份封存的 SHA-256。清理前再核對來源沒有變動；任何缺檔、差異、讀取失敗或權限問題均保留原目錄，不能宣稱封存完成。

### 3. 正常移除與最後複驗

- 在每次移除前重新確認精確絕對路徑仍位於核定工作目錄、沒有經過 reparse point、HEAD／Git 狀態／使用程序／發布鎖未變，且封存仍完整；條件有變就跳過。
- 只用正常 `git worktree remove <完整絕對路徑>`，不使用 `--force`，也不以 `Remove-Item -Recurse`、`rmdir /s` 或跨 shell 的字串拼接刪除整份目錄。若 Git 拒絕，先查原因；僅可在再次驗證後處理已封存且 SHA-256 相符的忽略檔案，再重試正常移除，不能順手刪掉新出現的內容。
- junction／符號連結只能在核對完整路徑與封存的目標後移除**連結本身**，不得遞迴進入目標；不能刪除共用依賴來讓工作目錄變乾淨。先保留分支與 Git commit，不附帶刪分支或執行垃圾回收。
- 確認移除的路徑與 worktree 登記皆已消失，保留目錄與共用依賴仍存在，原服務仍正常，封存再次讀回／雜湊驗證通過。`git worktree prune` 不是目錄清理工具；若需處理失效登記，先 `--dry-run`，不可用來掩蓋移除失敗。
- 量測清理後可用位元組，以前後差值回報**實際回收空間**；目錄邏輯大小只是估計，並註明其他同時執行的程式可能影響磁碟差值。記錄已清理／保留目錄、原因、封存位置與驗證結果到 repo 外的收尾收據，最終回覆摘要；公開交接只留不含私有資料的必要摘要。
- 收據 PR 的工作目錄與本次收尾用的工作目錄也要依同一規則處理，不能為了記錄清理不斷另開新副本。純收尾收據可留在 repo 外，不為它再建立網站部署或循環產生 PR。

本流程是發布完成後的必要工作，不啟用定時自動刪除、不清未完成或使用中的目錄，也不自動刪除封存證據。封存保存期限與舊封存清除另依使用者指示。

## 上線前必要檢查：努力樹升級目錄

**已接自動阻擋**：Vercel 專案與 `vercel.json` 的 Build Command 為 `node release/garden-preflight.mjs`。每次雲端來源建置都直接比對本次發布設定與正式資料庫；漏項、設定差異或讀取失敗會 exit 1，不能發布。凍結來源包在 deploy 前執行 `node automation/prepare-garden-release.mjs <發布包路徑>`，檢查通過才安裝雲端檢查檔案。詳 [自動發布關卡與實測證據](garden-release-gate-20261103.md)；不得用舊通過紀錄、`--prebuilt` 或覆寫建置指令跳過。

有新增／修改努力樹任務的發布，以下任一項未通過就不能宣稱完成上線：

- [ ] 以待發布來源與正式資料庫比對；執行 `node automation/audit-garden-catalog.mjs <snapshot-dir>`，缺項與設定差異為零。不能只查已完成任務或以本機舊設定作準。
- [ ] 已確認目錄遷移實際套用到正確正式專案；發布後以正式網站來源再核對一次，保留比對與套用結果。
- [ ] 隔離情境驗證未達標不升級、達標後進入努力樹自動升級並播放主場景成長動畫；既有花葉與來源保留，重整不重複播放首次動畫，仍可手動重播。
- [ ] 真正學生首次體驗未被測試消耗；不可為驗收永久寫入其成長已讀狀態。

完整流程見 [新頁面檢查表](new-page-checklist.md) 的「努力樹任務目錄同步」。

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
□ 若有「換一題」暖身：未答對不可點；答對後有簡短慶祝、可換新題；新題再次鎖定
□ 若有測驗：已選狀態明顯；滿分回饋正常；保存失敗不覆蓋答題結果
□ 若有解鎖邏輯：（若可以）打完最後一關，確認解鎖區塊出現
□ 若有過關慶祝畫面：實際點擊返回／繼續按鈕，遮罩消失，目標區段或頁面可操作
□ 若打字活動支援努力樹：活動設定已同步；完成紀錄對應本週葉片及魔王花，重新整理後仍一致
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
| 過關後點按鈕卻回不到課程 | 同頁錨點只捲動背景，慶祝遮罩未移除 | 檢查共用 typing 模組的連結點擊關閉遮罩流程，實測目標可操作 |
| 後台已完成，但努力樹沒有本週成果 | 活動設定漏登或課程／週次／活動鍵不一致 | 核對 `reward-tree-config.js` 與完成紀錄；修正設定後重讀，不重設學生紀錄 |
| `confetti is not defined` | 沒加 canvas-confetti CDN | 在 `<head>` 加入 CDN script |
| `levelsData` 第一關過不了（正確答案也不對） | `levelsData` 用了 `answer` 而非 `ans` | 把所有 `answer:` 改成 `ans:` |
