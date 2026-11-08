# 考前練功坊共用架構與驗收

狀態：2026-11-08 使用者授權後已正式發布；[發布收據](quiz-workshop-release-20261108.json)。基準 `origin/main a51dbef`；分支 `codex/quiz-common-20261108`。本輪無 SQL、名冊、正式作答、配題或獎勵資料變更。

## 查核與改進清冊

網址中的年級代表入口位置，題卷來源的學校名稱代表題庫來源，兩者都不是學生授權依據。原卷整組與個人單題的分流，原本就會造成不同畫面；不能把這種差異當成土城或中正使用舊版夥伴系統。

| 層次 | 原本狀態 | 本次處理與保留邊界 |
|---|---|---|
| 四年級入口群 | 頂溪三／六、土城四、中正九，重複維護 HTML 與資產版本 | 4 份模式範本＋`quiz-workshop-config.mjs` 產生 16 個原網址入口；不改 query |
| 選卷與品牌 | 共用 `quiz-library.mjs`，入口的年級／科目下拉仍重複 | 由課程設定產生科目與年級；維持名冊確認後的後端選卷資料 |
| 普通個人 | `quiz-student` → `quiz-module` → `quiz-server`，已有共用 workspace／choice／motion | 保留控制器；標題與入口導覽資產改用課程設定 |
| 個人原卷 | `quiz-past-entry` → `quiz-module` past 分支 → `quiz-past-exams` → `quiz-past-ui` | 接上同一 workspace 與單選元件；完整原卷材料／所有欄位仍為同組；不拆題或改提交粒度 |
| 夥伴練功 | 四年級原已指向同一 `partner-pilot/app` 與 learning／workspace／choice | 保留 app、多人同步與計獎流程；只改身分模組的語意入口與結果樣式來源 |
| 名冊導覽 | `grade6-nav-identity.js` 實際供跨年級使用；曾有不同 query 模組別名 | 新增 `quiz-nav-identity.mjs` 語意入口，轉出同一既有實作；舊頁相容，不另建快取或事件 listener |
| 對錯選項樣式 | 個人及夥伴各有同樣的結果色與文字 CSS | `quiz-choice.css` 單一來源；原卷也使用相同正誤標示，保留原始選項 ID |
| 考古預設卷 | `quiz-past-entry` 含三年級預設卷 | 移至課程設定；只有三年級保留既有預設值，其他入口缺 paper 時維持提示選卷 |
| 土城注音 | 四年級 quiz 頁 inline style 放大原題注音字形 | 改成課程 `zhuyinImageScale` 與共用 CSS，保留放大需求 |
| 資產與快取 | 逐頁手動 `?v=`；同一模組可用不同版本字串初始化多次 | 產生傳遞依賴 import map，舊 query 別名解析為同一內容指紋；CSS 展開巢狀 import 並保留原媒體／字型路徑 |

本次順序為：盤點既有共用層 → 集中課程／入口與資產 → 原卷接共用呈現 → 保護不同資料流程 → 隔離驗證與可重現建置。沒有將各校控制器複製到另一個 shared 目錄，也沒有新增通用後端作答控制器。

## 單一來源與產物

- `shared/quiz-workshop-config.mjs`：課程 ID、原入口路徑、學校呈現名稱、年級標籤、科目、舊預設卷與注音閱讀輔助。**不授予權限。**
- `shared/quiz-workshop/shells/{quiz,past,partner,library}.html`：四種模式 DOM 契約。Navbar 仍呼叫原年級 `navbar.js`，登入仍由 `initNavbarAuth()` 管理。
- `automation/build-quiz-workshop.mjs`：由上述來源產生各年級入口、四種 CSS bundle 與資產 manifest。只讀取可達的模組依賴；navbar 的動態 import 也納入。
- `shared/quiz-workshop-entry.mjs`：先安裝 canonical import map，再載入原 navbar／控制器。普通 quiz 保留原有 local／classroom／cloud 導覽生命週期。
- `shared/quiz-workshop/generated/` 及 16 個 HTML 是可重現產物，禁止逐頁手改版本。執行 `npm run quiz:build`，再執行 `npm run quiz:check`。正式建置既有 `garden-preflight.mjs` 的 CLI 會先執行此核對；產物過期即擋下，沒有移除既有發布鎖與目錄檢查。

目前目標為支援 import map 的現代瀏覽器；本次以 Chrome 驗證。Safari／iPad 實機需另驗，不宣稱已通過。短效媒體授權仍沿用原 scope／過期與來源保護；manifest 不包含學生資料或私有媒體網址。

## 三種作答 adapter 契約

| 模式 | 狀態與提交擁有者 | 不可跨用 |
|---|---|---|
| 普通個人 | quiz-student／quiz-server／quiz-api；session、attempt、question ID、順序、閱讀時間、延後揭答與相同 request 重試 | 不寫入夥伴 room 或原卷 group；不改舊週頁 student_progress 契約 |
| 個人原卷 | quiz-past-exams 的 quiz_past_action 轉接；paper、固定 version、attempt、group、field；整組提交、手動草稿與自核 | 不將一組切成多個新題；不在 UI 判分；自核題不假標對錯或計分 |
| 夥伴 | partner-pilot app／learning／transport；room、qid、past group/field 映射、revision、私人草稿、訂正、review、finish、多人同步 | 不以個人 RPC 改小隊；不移動獎勵結算到共用呈現層；同步／回看不重播送答或紀念動畫 |

共用 workspace 只搬移既有 DOM 節點到題目、解析與操作區，保留事件、欄位 ID 與 packet 建立流程。多欄位原卷與自核／排序／配對組使用長頁，不限制題組閱讀高度；各欄回饋帶原欄位標籤。選項仍以原 ID 作答，○× 只是呈現。當前題組圖片主動載入，仍經原媒體 scope；不預取其他題組。

原有問題回報、KaTeX、數學輸入、原圖裁切、音訊、自核、草稿與固定解析元件保留。`auth.js`、`navbar-auth.js`、名冊實作、SQL、紀念動畫與獎勵計算均未修改。

## 新學校／新年級註冊契約

1. **先查後端能力及資料歸屬。** 現行 `production-snapshot/functions.sql` 中，`quiz_entry_context`、`quiz_session_class_allowed`、原卷與 `partner_pilot` 學生資格依 115 學年度名冊及 `^[3469][0-9]{2}$` 班碼處理。course 白名單亦明列 `grade3/4/6/9-115-1`。增加前端設定不代表新年級已獲支援。
2. 現行名冊／場次主要以學年度、年級、班碼與學生身分辨識；不可把題庫 `sourceSchool` 或本次 `school` 呈現名稱當隔離鍵。新增同年級的另一所學校，須先提出 school/course/enrollment、場次、原卷與小隊隔離方案及權限影響；本次沒有建立通用多校 schema。
3. 後端已支援且權限已驗證後，增加明確的課程註冊（grade、courseId、basePath、label、school、subjects 與必要閱讀輔助），使用既有 navbar 合約建立對應入口；重用同模式範本與呈現元件。不同學期／同年級多課程需要明確的路徑與 course resolver，不直接沿用目前 `workshopCourse(grade)` 的唯一性假設。
4. 逐一核對 quiz/原卷/夥伴 adapter 與相關年級白名單、my-tree 路由、題庫／原卷啟用、媒體授權、名冊讀回與課程規則。若需要新 SQL，另寫 migration、取得正式套用授權，再更新 production snapshot 並跑 `db-snapshot-check --live`；不重播舊 SQL。
5. `npm run quiz:build`／`quiz:check`，跑本文件矩陣及新身分負向測試。仍須 PR → main → 全新乾淨 main worktree → `release-from-main.mjs`；本文件不授權發布。

## 驗證與限制

可重跑命令：

```text
npm run quiz:check
node --test automation/tests/quiz-workshop.test.mjs
npm run quiz:test
node --test automation/tests/quiz-partner-production.test.mjs automation/tests/quiz-partner-outcomes.test.mjs automation/tests/quiz-partner-review-completion.test.mjs automation/tests/quiz-partner-drawing-draft.test.mjs automation/tests/partner-answer-feedback.test.mjs automation/tests/quiz-past-field-aids.test.mjs
node --test automation/tests/garden-release-gate.test.mjs automation/tests/release-from-main.test.mjs
npm run quiz:preview
```

預覽為 `http://localhost:8868/grade4/115-1/past-exam.html?paper=synthetic`，其他三個年級可用相同模式網址。**純合成驗收，不代表正式登入或真實判分。** 只監聽 loopback，不代理正式 API；使用原 HTML、原控制器與替代 auth／transport。普通個人、原卷、選卷測試走原控制器；夥伴先驗原 app 入口，再以既有 partner-feedback fixture 驅動真 learning UI，不能稱完整真實小隊後端流程。畫面、草稿與答案留在本機合成 store。

`automation/tests/quiz-workshop-browser.cjs` 必須透過共享 AI 工作瀏覽器租約的 `run-background.cjs` 執行；背景合成 DOM 事件驗證，不代表真人滑鼠、實體觸控或正式 Google 登入。測試涵蓋三／四／六／九 × 普通個人／原卷／夥伴／選卷 × 1280/390px，包含模組別名、navbar、橫向溢出、正誤回饋、下一題、原卷整組 packet、固定解析、草稿重載、換人清空、數學 UI、圖音載入、夥伴提交與 UI 重建清空；另模擬送達後丟失回應，核對沿用同一 request ID 重試。收據與截圖位於 ignored `.chat-mode/evidence/workshop/`。

最終合成瀏覽器 350 項、Node／隔離 SQL／發布關卡合計 66 項通過（[摘要收據](quiz-workshop-verification-20261108.json)）。既有普通測驗 11 項與夥伴模式 20 項（含隔離 SQL）通過；產物與發布關卡另外驗證。兩套舊 `quiz-past-drafts.test.mjs`／`quiz-past-exams.test.mjs` 依賴未納入 repo 的私人原卷題包；乾淨 worktree 無法執行，主工作區同名檔也不含所需 document，未偽造資料冒稱通過。原卷本次以合成瀏覽器驗 UI／packet／草稿接續，未重新驗真原卷後端全題判分。

未測：正式 Google 雙帳號、多房即時同步實機、真實舊作答連結、真題全卷、Safari／iPad、實體觸控與鍵盤、動畫可見播放。本次未修改動畫實作，也不以背景靜態 actor 當播放驗證。沒有切換正式帳號的測試年級、沒有操作既有紀念任務。正式發布前仍需安排這些適用的真登入回歸。
