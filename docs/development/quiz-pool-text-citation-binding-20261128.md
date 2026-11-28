# 自己組卷的已核文字引用繫結候選

## 問題與候選行為

九年級二段的教師卷已能準備「自寫解析＋已核教材名稱、章節、頁碼」文字學習包。自己組卷使用的 `quiz_pool_study_sources` 原約束卻只接受教材原頁連結，或明確的 `no_reliable_match`。已找到可靠教材的文字引用不能為了通過約束而偽裝成無可靠對照。

本候選讓新自組卷精確綁定已核文字引用，維持答後揭答。新增純資料形狀檢查 helper，擴充原 CHECK，並在既有組卷繫結函式補來源版本、課程年級、學年度及科目比對。原頁連結及明確無可靠對照的分支保留；不修改題池題目、原教師鍵、既有版本或作答，不上傳或註冊教冊原頁。

分支 `codex/g9-text-citation-binding-20261128` 從 2026-11-28 最新 `origin/main` 的 `9f4503f6` 建立獨立 worktree。這是候選 PR，尚未合併、套用正式資料庫、發布或做正式 OAuth。本案對函式變更的既有明示核准關卡仍保留；沒有以 repo 的新版可復原原則假定已取得本案核准。

## 文字引用資料契約

無原頁連結時，`book_id`、`primary_page` 為空，`reference_pages` 為空陣列，另使用以下明確狀態：

- `verified_text_citation_direct`：教材直接支持。
- `verified_text_citation_related`：相關觀念支持，另留推導理由。

`teacher_notes.text_citation` 固定保存 schema、課程 ID、年級、學年度、學期、教材標題、出版社、科目、來源版本與完整題目 SHA。`references` 為 1～20 筆，每筆含教材角色、PDF SHA、PDF 頁、教冊／課本印刷頁及章節。頁碼必須是正整數，文字不得空白，SHA 必須為 64 位小寫十六進位。完整題目 SHA 採 PostgreSQL `question::text` 的 UTF-8 SHA-256，不混用 JavaScript 另行排序序列化的指紋。

來源版本同時留在 `provenance.source_version`，且 `provenance.reviewed` 必須為布林 `true`。這只是資料輸入閘，不能代替逐題原件、教師鍵、教材原頁及 SHA 的實際核對。helper 不讀檔案、不接外部服務、不呼叫 AI，也不授權前端存取教師筆記。

新組卷仍須通過原有完整 JSONB 相等、可用題池、課程成員、課程啟用及教材連結檢查。文字引用分支另外要求：

1. 引用完整題目 SHA 與來源完整 JSONB 相符。
2. 引用來源版本與當前題池 `source_version` 相同。
3. 引用課程 ID 與來源課程相同，年級、學年度及科目與課程目錄相符。

學生只取得現有答後機制揭露的固定解析文字，不取得 `teacher_notes`、來源指紋或尚未揭答的解析。既有包與作答的固定繫結邏輯不變；啟用新來源不會補綁先前沒有學習包的自組卷。

## 交易與回復

兩份 SQL 均固定 LF；`.gitattributes` 避免 Windows checkout 改變函式指紋。安裝／回復先鎖定來源表，並核組卷函式、CHECK 與新增 helper 的完整指紋；未知並行修改拒絕執行。只允許已知舊版或本候選版，重裝與重複回復可用。

| 項目 | 原版 | 候選版 |
| --- | --- | --- |
| 組卷繫結函式 MD5 | `76fc3552b43d5989c17c8832938a3833` | `78d18e6366e891fd4a91ea53b322ced2` |
| 引用 CHECK MD5 | `fc94f18029f09b8ff0cdd3e56bcd0eff` | `435a724e9e48805057337bf23ea34bb0` |
| 純資料 helper MD5 | 不存在 | `b96ca30c9b45c4641ac5fd6c23191a53` |

安裝 SQL：[quiz-pool-study-text-citation.sql](../../supabase/quiz-pool-study-text-citation.sql)，SHA-256 `057d2c6cf9066c1ed5e4e886c72046d45bd3d1026e36b92bb0a54f359e9d08a0`。

回復 SQL：[quiz-pool-study-text-citation-rollback.sql](../../supabase/quiz-pool-study-text-citation-rollback.sql)，SHA-256 `ec00798466b4592cac1de65557863f4f8a8277ad6c5eb812d37904034cd60960`。

回復只適用於尚無新形狀來源資料，或另案資料回復完成的階段。若表內已有原 CHECK 不接受的新引用，腳本在修改函式或約束前以 `text_citation_sources_require_rollback_plan` 停止，不刪除來源、不改寫既有包或作答。後續資料匯入必須另備精確資料回復方案，不能把這份 schema 回復當成整批來源與作答的回復工具。

## 隔離驗證

執行 `node --test automation/tests/quiz-pool-study-text-citation.test.mjs`，3 個含多情境的測試案例通過。使用 repo 正式 schema／函式快照建立隔離 PGlite，只有合成身分、題目與教材，沒有讀取正式作答或登入帳號。

| 案例 | 已驗範圍 |
| --- | --- |
| 形狀、交易及並行守衛 | 17 組無效 metadata／複核資訊拒絕、5 種畸形 JSON 不通過；整份安裝交易回滾、重裝、重複回復、新引用存在時拒絕直接回復、未知 helper 修改拒絕安裝與回復 |
| 自組卷 RPC 與固定包 | 三／四／六／九年級的實際 `quiz_compose`、加入、送答及接回；重試不重建、答前不漏解析或教師筆記、答後揭露、跨使用者拒絕、舊固定包保持、先前未綁卷不補綁；版本、年級、學年度、科目、完整題目不符時不綁 |
| 原分支回歸 | 混合 3 筆原頁連結、2 筆明確無可靠對照，5 題照正式順序送答；原教材頁、引用與解析仍可讀，未以新 metadata 要求阻斷原頁來源 |

匿名及 authenticated 角色不能直接讀來源表或執行新增 helper；來源與已固定資料不可變守衛保留。這些是隔離資料庫及 RPC 證據，不是原生 PostgreSQL、正式 OAuth、實際媒體 HTTP 或桌手機畫面驗收。

## 尚待完成

- 原生 PostgreSQL 的安裝交易回滾與回復驗證、本案正式函式核准、PR 進 main；正式套用後另更新 snapshot 並跑 live check。
- 實際來源資料契約轉換、精確匯入／回復方案及正式讀回；本 PR 沒有帶入任何私有原題、答案、教材、帳戶或權杖。
- 夥伴卷目前複製固定原卷解析，尚需另驗來源版本繫結與答後揭露。本 SQL 不會自動更新既有夥伴卷。
- 中正九年級其餘科目、113／114考古卷的逐題對照、可靠配題，以及老師準備的卷／考古卷／自己組卷／夥伴練功四個適用正式學生入口。

本候選解決文字引用的自組卷資格與來源守衛，不表示數學或二段範圍已正式完成。
