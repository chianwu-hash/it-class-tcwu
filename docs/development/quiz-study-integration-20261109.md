# 課本對照與學生版解析：原答題介面整合

> 後續正式啟用工作見 [三年級29目標實測批次](grade3-notebook-study-release-20261109.md)。以下保留原六年級候選整合的歷史範圍；不能把其54張教材或7個示例當成本輪已啟用內容。

2026-11-09，程式整合及本機驗證完成，未發布、未套用正式資料庫或 Edge、未更新 Worker／上傳教材。

## 範圍與行為

一般題由原 `quiz-student` → `quiz-api` → `quiz-server` 啟動；考古卷由原 `quiz-past-entry` → `quiz-past-exams` → `quiz-past-ui` 啟動。不是原型專用頁或替換版答題控制器，沒有另造登入、進度、判分與草稿流程。既有16個入口仍由建置器產生。

- 有已核課本對照的題目，答前顯示「一起翻翻課本，找找線索吧！」、印刷頁碼與唯一的「翻課本找線索」。答後只留解析內對照入口。
- 課本沿用共用燈箱：首次適合寬度、整頁與完整拉頁、前後翻頁、本題參考頁、回本題頁、返回題目；以作答／內容版本／解析包／題目／課本頁保存目前頁面生命週期內的倍率及位置。不寫 localStorage。
- 一般題整份作答回顧中，各題都有自己的課本入口；多題及多書時不以相同印刷頁碼誤配其他書。
- 一般題在原已揭答回饋中優先使用固定學生版解析。考古卷依完整組的各欄位呈現「第（N）小題怎麼想？」；不改整組提交、官方答案、分數、開花或原自核政策。
- 作答介面不顯示教師學習重點選單；「我的錯題」原有的學習／延伸流程仍保留。教師分析資料仍在固定資料包，不被刪除。
- 無對照資料時不硬配課本；無學生版解析時沿用原已揭答解析，不在線上呼叫AI、不假造新版解析。缺供圖時可返回作答及重試。
- 登出、換人及版本改變會清理閱讀器、圖片與記憶；舊票證晚回應不能重新開圖。

## 原模組接線

`quiz-study-data.mjs` 驗證 snapshot 中 `study` 的 schema／kind／attemptId／versionId，拒絕外部或公開圖片網址，只接收虛擬私有媒體ID；學生解析另外核對該題是否已揭答。`quiz-study.mjs` 管理題目到課本 UI 轉接。`quiz-textbook-reader.mjs` 僅管理翻頁與閱讀記憶；縮放、平移及雙指仍由 `image-lightbox.js` 負責。

`quiz-server` 和 `quiz-past-ui` 直接讀原 snapshot 掛上轉接器。`quiz-api.resolveStudyPage` 與考古卷原 authenticated transport 將 `kind/attempt_id/version_id/url` 送到既有 `quiz-media`。課本讀圖使用獨立 `textbook` action，先由資料庫確認本人、內容版本及允許課本，再簽既有 Drive Worker 短效票證；不使用 Supabase Storage fallback、不轉送圖片內容。

共用 CSS 由 `release/quiz-workshop-build.mjs` 納入一般題與考古卷 bundle，指紋與 import map 經 `quiz:build` 更新。一般題圖的原燈箱模式維持。

## 後端候選：`supabase/quiz-study.sql`

新增私有、RLS隔離且不給匿名／學生直接讀寫的控制表：

| 表 | 用途 |
|---|---|
| `quiz_textbooks` | 教材固定版本、年級學年、來源SHA、啟用狀態 |
| `quiz_textbook_pages` | 印刷頁碼陣列、完整拉頁、實體翻頁序列、WebP SHA／bytes、私有來源紀錄 |
| `quiz_study_packages` | 一般／考古固定試卷版本的已核內容包；預設不啟用 |
| `quiz_study_items` | 題組／欄位、課本對照、學生解析、出處及教師備註 |
| `quiz_study_attempts` | 本次作答固定使用哪一個解析包，防止新包默默套到舊作答 |

候選遷移保留當時的 `quiz_action` 與 `quiz_past_snapshot` 為下層函式，只在回傳 snapshot 時附加白名單 `study`。一般題揭答以原 `reviews` 為準，因此保留共用題幹整組揭答／全卷揭答政策；考古解析以已保存的原卷欄位為準。課本可答前存取，解析／教師備註不可答前取得；學生永遠不回傳教師備註。

內容與頁面不可覆寫；啟用後不得追加 items／pages，已有作答固定使用的包不得事後增補。撤回舊包停止該作答的供圖，不自動換成新版。沒有可用包的原卷與舊題維持原 snapshot 行為。重複安裝會先核對仍是自己的 wrapper，避免蓋過其他遷移。

這是**未套用候選 SQL**。正式 `supabase/production-snapshot/` 仍代表線上現況，未偽造候選為正式快照；未執行 `--live`、正式函式套用或發布腳本。將來獲授權套用後，必須更新正式 snapshot 並跑 live check。

## 固定資料匯入

`node automation/build-quiz-study-import.mjs --packet <私有JSON> --out <.chat-mode或ai-now資料夾>` 只做離線產生，不連網、不執行SQL、不啟用任何資料。

輸入 schema1 的 `books[]` 與 `packages[]`。書含 UUID、grade／schoolYear／semester、title、sourceSha256、pages；頁含 id、printedPages（完整拉頁一起列）、sequence、sha256、bytes，另可附既有 Drive 回讀紀錄。包含 UUID、kind、正式固定 versionId、sourceDocumentSha256（資料庫 JSONB 文件的UTF-8 SHA-256）、reviewed、provenance、items；item 含 groupId（考古必填）、questionId、bookId、primaryPage、referencePages、studentExplanation、origin 與 teacherNotes。

產物 `study-import.private.sql` 在單一交易中重新核對來源版本文件 SHA 及每一題／欄位確實存在，來源不符整批回滾。另輸出 Worker 索引候選片段及缺件報告；不得把新增片段直接覆蓋既有 Worker 完整白名單。缺 Drive file ID 或回讀驗證的圖列 pending，仍不啟用。既有 Worker 已按圖片雜湊支援 WebP，無須另建公開圖床。

## 本輪驗證

- 24項 Node／隔離 PostgreSQL／媒體與建置檢查通過（23項相關套件加1項匯入器）。新 SQL 在 PGlite 真正安裝、重複安裝，驗本人／跨人、匿名、題目與版本、答前不洩漏解析、保留完整題組、自核不改分數、內容不可覆寫、撤回、舊作答包固定及私有表不可直接讀取。
- 原網址桌機1280px／手機390px整合44項通過，包含答前／答後單一入口、學生版解析、共用燈箱媒體請求、完整79–80拉頁、整份回顧多題對照、完整組選答、登出清圖及晚到票證隔離。初期測試命名空間重用造成已完成狀態，已改每輪獨立命名空間後重驗。
- 既有四課程／四入口350項瀏覽器回歸通過，JavaScript錯誤0；原型資料未啟用時舊流程維持。
- `quiz:check`、語法與 `git diff --check` 通過。未新增真人觸控／正式Google兩帳號／正式Drive冷圖／正式供圖驗證，不把合成驗證當正式上線證據。

瀏覽器收據位於 ignored `.chat-mode/science-prototype/study-integration-browser.json` 及 `.chat-mode/evidence/workshop/browser.json`。本機8880的原答題網址使用**合成身分、合成題目與課本示意圖**，不讀正式資料；前版8879仍是原自然私有素材原型。

## 啟用前仍需完成的具體資料工作

本輪整合的是可處理一般題及考古卷的程式與候選資料介面，**不代表所有題目已補完新版解析或課本對照**。現有私有樣本為3個一般題（含拉頁）及完整電磁鐵4個欄位，54張課本圖；其原型版本字串不是正式固定試卷 UUID，不能直接當正式資料匯入。

發布前須核對這些題目真正的 `quiz_versions`／`quiz_past_versions` UUID、文件SHA與欄位ID，產出已複核固定包；依私有 Drive 桌面版既有路徑核對 file ID、原圖bytes／SHA及Worker索引。之後才可依正式授權套用候選遷移／資料、更新Edge與Worker、驗證真學生供圖，再走 main-only PR／發布／snapshot流程。沒有新增上傳、改存Supabase、公開教材或呼叫AI。

工作樹 `C:/Users/user/.codex/worktrees/science-textbook-integration-20261109/it-class-tcwu`，分支 `codex/science-textbook-integration-20261109`，基於 `origin/main 3ce9bca`。主工作區未改，尚未 commit、push、PR或部署。
