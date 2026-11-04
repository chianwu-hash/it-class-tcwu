# main 單一來源整合紀錄（2026-11-04）

目標：讓 `main` 成為正式網站與資料庫函式的唯一來源，之後所有 agent 都只從 `main` 發布（規則見 [dev-sop.md「發布規則：只從 main 發布」](dev-sop.md)，登記在 [agent-handoff.md](agent-handoff.md) 頂部）。

**本次沒有 promote、沒有改正式資料庫、沒有 push 到 `main`。** 對正式環境只做了唯讀查詢（Vercel 部署清單／檔案樹／檔案內容、Supabase 系統目錄）。

## 摘要

| 項目 | 結果 |
| --- | --- |
| 正式前端基準 | `dpl_BDJATgLLgbUKvQUNXZYYeu8d5L4p`（2026-11-04 10:18 promote，820 檔） |
| 整合分支 | `claude/main-unify-20261104`，以本機 `main`（`f967d75`）為底，併入 `origin/main`（`3ec8083`）與 10 條末端分支 |
| 前端比對 | `node automation/release-tree-diff.mjs --tree <正式樹> --ref claude/main-unify-20261104`：820 檔 **內容差異 0、缺檔 0**；523 檔位元組相同、297 檔只差換行（git 以 LF 保存、正式版為 CRLF） |
| 資料庫 | `supabase/production-snapshot/`：120 函式、80 表、21 policy、9 trigger；`db-snapshot-check.mjs --live` 與正式資料庫 120／120 md5 相同 |
| 主工作區 | 753 項未 commit 修改**沒有動**，逐項分類在 [main-unify-20261104-main-worktree.tsv](main-unify-20261104-main-worktree.tsv) |

## 整合方式

1. 從所有 `claude/*`、`codex/*` 分支找出「不被其他分支包含」的末端分支，依日期合併：`codex/quiz-zhuyin-repair`、`codex/grade6-week09-release`、`codex/quiz-mixed-fraction-layout`、`codex/tucheng-grade4-20261101`、`codex/garden-release-gate-20261103`、`codex/garden-gate-proof-20261103`、`codex/zhongzheng-grade9-convert-20261102`、`codex/past-exam-production`、`codex/vercel-textbook-publisher-fix-20261104`、`claude/quiz-load-batch4`。其餘分支都已被這 10 條包含。
2. 沒有合併的舊分支：`experiment/builtin-image-workflow`（5/12）、`feature/reward-tree-pet`（6/1），兩者都以 5 月的舊 commit 為底；整合分支覆蓋後已與正式版相同，不需要它們。是否刪除留待使用者決定。
3. 用 Vercel 檔案樹的 SHA1 逐檔比對，差異檔直接從正式部署下載（`automation/release-fetch-files.mjs`，下載後驗 SHA1）覆蓋進分支。
4. 正式版有 11 個檔同一檔內混用 CRLF 與 LF，git 換行正規化後無法還原，已在 `.gitattributes` 標 `-text` 以原始位元組保存。

## 1. 正式版與合併結果的差異（96 檔）

合併 10 條末端分支後（`bd9a784`），與正式版 `dpl_BDJATgLLgbUKvQUNXZYYeu8d5L4p` 比對：820 檔中 637 檔相同、87 檔只差換行、63 檔內容不同、33 檔分支沒有。下表依「正式版內容實際出現在哪裡」分組（SHA1 相符，容許 CRLF／LF 差異）；這 96 檔已全部從部署下載並覆蓋（`d4cce66`）。

| 來源 | 檔數 | 檔案 |
| --- | --- | --- |
| 未 commit：foundation-keyboard-fix-20261102（已修改）、foundation-milestones-20261102（已修改） | 19 | `admin-progress.html`<br>`grade3/115-1/mouse-double-click.html`<br>`grade3/115-1/mouse-left-click.html`<br>`grade3/115-1/mouse-right-click.html`<br>`grade3/115-1/navbar.js`<br>`grade3/115-1/week01.html`<br>`grade3/115-1/week02-mail.html`<br>`grade3/115-1/week02.html`<br>`grade3/115-1/week03.html`<br>`grade3/115-1/week04.html`<br>`grade3/115-1/week05.html`<br>`grade3/115-1/week06.html`<br>`grade3/115-1/week07.html`<br>`grade3/115-1/week08.html`<br>`grade3/115-1/week09.html`<br>`shared/reward-tree-config.js`<br>`shared/reward-tree-model.js`<br>`shared/reward-tree-renderer.js`<br>`shared/typing-foundation-rewards.js` |
| 未 commit：it-class-tcwu（未追蹤） | 19 | `grade3/115-1/partner-practice.html`＊<br>`grade4/115-1/partner-practice.html`＊<br>`grade6/115-1/partner-practice.html`＊<br>`grade9/115-1/partner-practice.html`＊<br>`shared/partner-pilot/app.mjs`＊<br>`shared/partner-pilot/bank-media.js`＊<br>`shared/partner-pilot/image-lightbox.js`＊<br>`shared/partner-pilot/learning.js`＊<br>`shared/partner-pilot/official-render.js`＊<br>`shared/partner-pilot/past-answer.js`＊<br>`shared/partner-pilot/past-content.js`＊<br>`shared/partner-pilot/past-results.js`＊<br>`shared/partner-pilot/quiz-past-input.js`＊<br>`shared/partner-pilot/quiz-past-manual.js`＊<br>`shared/partner-pilot/quiz-past-underlines.js`＊<br>`shared/partner-pilot/quiz-source-crop.js`＊<br>`shared/partner-pilot/rich-content.js`＊<br>`shared/partner-pilot/style.css`＊<br>`shared/quiz-partner-pilot-entry.mjs`＊ |
| 未 commit：foundation-keyboard-fix-20261102（未追蹤）、foundation-milestones-20261102（未追蹤） | 15 | `garden/growth/growth.mjs`<br>`garden/growth/index.html`<br>`garden/scene-cat.html`<br>`garden/scene-pets.html`<br>`garden/stage.html`<br>`grade3/115-1/learning.html`<br>`grade3/115-1/past-exam-review.html`<br>`grade3/115-1/past-exam.html`<br>`grade6/115-1/past-exam.html`<br>`shared/effort-garden-v2.mjs`<br>`shared/garden-stage.mjs`<br>`shared/reward-source-colors.mjs`＊<br>`shared/typing-foundation-milestone-ui.mjs`＊<br>`shared/typing-foundation-milestones.css`＊<br>`shared/typing-foundation-milestones.mjs`＊ |
| 只在正式部署內（任何分支與 worktree 都沒有相同內容） | 8 | `grade3/115-1/quiz-library.html`<br>`grade4/115-1/quiz-library.html`<br>`grade6/115-1/quiz-library.html`<br>`grade6/115-1/typing-foundation.html`<br>`grade9/115-1/quiz-library.html`<br>`prototypes/typing-foundation/level1/app.js`<br>`shared/typing-foundation-page.js`<br>`vercel.json` |
| 未 commit：it-class-tcwu（未追蹤）、foundation-keyboard-fix-20261102（未追蹤）、foundation-milestones-20261102（未追蹤） | 6 | `grade3/115-1/materials/week10/week10-offline.html`＊<br>`grade3/115-1/materials/week10/week10-prompts.txt`＊<br>`grade3/115-1/week10-content.mjs`＊<br>`grade3/115-1/week10.css`＊<br>`grade3/115-1/week10.html`＊<br>`grade3/115-1/week10.js`＊ |
| 未 commit：foundation-keyboard-fix-20261102（已修改） | 4 | `grade3/115-1/zhuyin-foundation.html`<br>`grade6/115-1/zhuyin-foundation.html`<br>`my-tree.html`<br>`shared/zhuyin-foundation-app.js` |
| 未 commit：effort-level2-release-20261031（與該 worktree HEAD 相同）、effort-tree-release-20261030（與該 worktree HEAD 相同）、foundation-keyboard-fix-20261102（已修改）、foundation-milestones-20261102（已修改） | 4 | `shared/activity-progress.js`<br>`shared/navbar-auth.js`<br>`shared/reading-api.js`<br>`shared/typing-foundation-progress.js` |
| 未 commit：foundation-keyboard-fix-20261102（未追蹤） | 4 | `prototypes/typing-foundation/level1/foundation-keyboard.css`＊<br>`prototypes/typing-foundation/level1/foundation-keyboard.mjs`＊<br>`shared/typing-foundation-map-rewards.css`＊<br>`shared/typing-foundation-map-rewards.mjs`＊ |
| 分支：`codex/past-extension-release-20261102`、`codex/past-grade3-learning-release-20261102`、`codex/test-identity-grade9-20261102` 等 7 條 | 3 | `grade3/115-1/quiz.html`<br>`grade6/115-1/quiz.html`<br>`shared/quiz-wrong-questions.mjs` |
| 分支：`codex/zhongzheng-grade9-convert-20261102` | 3 | `shared/quiz-module.js`<br>`shared/quiz-past-content.mjs`<br>`shared/quiz-past-entry.mjs` |
| 未 commit：it-class-tcwu（已修改） | 2 | `grade3/115-1/typing-foundation.html`<br>`prototypes/typing-foundation/level1/index.html` |
| 分支：`claude/admiring-sinoussi-ef040b`、`claude/quiz-load-batch4`、`codex/admin-learning-push-20261101` 等 36 條 | 2 | `grade6/LessonPlan/115-1/Week 08.md`<br>`shared/quiz-workspace.mjs` |
| 未 commit：it-class-tcwu（已修改）、effort-level2-release-20261031（與該 worktree HEAD 相同）、effort-tree-release-20261030（與該 worktree HEAD 相同）、foundation-keyboard-fix-20261102（已修改）、foundation-milestones-20261102（已修改） | 2 | `shared/homework-api.js`<br>`shared/typing-challenge.js` |
| 分支：`claude/quiz-load-batch4`、`codex/admin-learning-push-20261101`、`codex/effort-level2-expansion-20261031` 等 23 條 | 1 | `.vercelignore` |
| 分支：`claude/admiring-sinoussi-ef040b`、`claude/quiz-load-batch4`、`codex/admin-learning-push-20261101` 等 34 條 | 1 | `package.json` |
| 分支：`codex/past-grade3-learning-release-20261102`、`codex/test-identity-grade9-20261102`、`codex/zhongzheng-grade9-20261102` 等 6 條 | 1 | `shared/quiz-past-learning-review.mjs` |
| 未 commit：it-class-tcwu（與該 worktree HEAD 相同） | 1 | `shared/quiz-past-ui.mjs` |
| 分支：`codex/test-identity-grade9-20261102`、`codex/zhongzheng-grade9-20261102`、`codex/zhongzheng-grade9-audit-20261102` 等 5 條 | 1 | `shared/quiz-student.mjs` |

＊ 合併結果沒有這個檔。「分支」表示正式版內容在該分支 tip 找得到，但合併時被其他分支較新的修改取代；這些較新修改**沒有發布**，已被正式版覆蓋（仍保留在原分支）。

## 2. 合併衝突的暫定處理（60 檔）

規則：`.md` 取兩邊聯集，其他檔暫取較晚合併的分支。部署檔最後一律以正式版覆蓋，所以這裡只影響**不會部署**的檔（測試、文件、自動化），需要時再由原作者覆核。

| 分支 | 處理 | 檔案 |
| --- | --- | --- |
| `codex/quiz-mixed-fraction-layout` | 聯集 | `docs/development/agent-handoff.md` |
| `codex/quiz-mixed-fraction-layout` | 取該分支 | `grade6/115-1/index.html` |
| `codex/tucheng-grade4-20261101` | 聯集 | `docs/development/agent-handoff.md` |
| `codex/tucheng-grade4-20261101` | 取該分支 | `my-tree.html` |
| `codex/zhongzheng-grade9-convert-20261102` | 聯集 | `docs/development/agent-handoff.md` |
| `codex/zhongzheng-grade9-convert-20261102` | 聯集 | `docs/development/past-exam-playbook.md` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `grade3/115-1/index.html` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `grade3/115-1/past-exam.html` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `grade3/115-1/quiz-library.html` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `grade3/115-1/quiz.html` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `grade4/115-1/index.html` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `grade4/115-1/quiz-library.html` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `grade4/115-1/quiz.html` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `grade6/115-1/index.html` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `grade6/115-1/quiz-library.html` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `grade6/115-1/quiz.html` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `index.html` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `my-tree.html` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `shared/course-context.js` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `shared/garden-unlock-notice.mjs` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `shared/quiz-api.mjs` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `shared/quiz-grade-route.mjs` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `shared/quiz-leaf-celebration.mjs` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `shared/quiz-library.mjs` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `shared/quiz-module.js` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `shared/quiz-past-catalog.mjs` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `shared/quiz-past-content.mjs` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `shared/quiz-past-entry.mjs` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `shared/quiz-past-exams.mjs` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `shared/quiz-past-input.mjs` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `shared/quiz-past-style.css` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `shared/quiz-past-ui.mjs` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `shared/quiz-rewards.mjs` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `shared/quiz-server.mjs` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `shared/quiz-student.mjs` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `shared/quiz-wrong-questions.mjs` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `shared/reward-tree-config.js` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `shared/reward-tree-model.js` |
| `codex/zhongzheng-grade9-convert-20261102` | 取該分支 | `shared/test-identity-switch.js` |
| `codex/past-exam-production` | 聯集 | `docs/development/agent-handoff.md` |
| `codex/past-exam-production` | 聯集 | `docs/development/past-exam-job-template.md` |
| `codex/past-exam-production` | 聯集 | `docs/development/past-exam-playbook.md` |
| `codex/past-exam-production` | 取該分支 | `grade3/115-1/past-exam.html` |
| `codex/past-exam-production` | 取該分支 | `grade6/115-1/past-exam.html` |
| `codex/past-exam-production` | 取該分支 | `shared/quiz-module.js` |
| `codex/past-exam-production` | 取該分支 | `shared/quiz-past-content.mjs` |
| `codex/past-exam-production` | 取該分支 | `shared/quiz-past-entry.mjs` |
| `codex/past-exam-production` | 取該分支 | `shared/quiz-past-exams.mjs` |
| `codex/past-exam-production` | 取該分支 | `shared/quiz-past-learning-review.mjs` |
| `codex/past-exam-production` | 取該分支 | `shared/quiz-past-ui.mjs` |
| `codex/past-exam-production` | 取該分支 | `shared/quiz-wrong-questions.mjs` |
| `codex/vercel-textbook-publisher-fix-20261104` | 取該分支 | `.vercelignore` |
| `codex/vercel-textbook-publisher-fix-20261104` | 取該分支 | `automation/prepare-garden-release.mjs` |
| `codex/vercel-textbook-publisher-fix-20261104` | 取該分支 | `automation/tests/garden-release-gate.test.mjs` |
| `codex/vercel-textbook-publisher-fix-20261104` | 取該分支 | `package.json` |
| `codex/vercel-textbook-publisher-fix-20261104` | 取該分支 | `release/garden-preflight.mjs` |
| `codex/vercel-textbook-publisher-fix-20261104` | 取該分支 | `vercel.json` |
| `claude/quiz-load-batch4` | 取該分支 | `grade3/115-1/quiz.html` |
| `claude/quiz-load-batch4` | 取該分支 | `grade6/115-1/quiz.html` |
| `claude/quiz-load-batch4` | 取該分支 | `shared/quiz-student.mjs` |

## 3. 從分支移除的 6 個可部署檔

這些檔案會被部署（不在 `.vercelignore` 內），但正式版沒有。為了讓 `main` 部署結果與正式版相同，已從整合分支移除；內容仍在原分支。

| 檔案 | 來源 commit |
| --- | --- |
| `garden/preview/surprise-v1.html` | `c5ba6a9`（`codex/pet-surprise-20261101` 一系） |
| `grade6/115-1/images/week09/prompt.txt`、`prompt-revision.txt` | `404ed65`（`codex/grade6-week09-release`） |
| `grade6/LessonPlan/115-1/Week 09.md` | `404ed65`（同上） |
| `shared/past-extension-preview.css`、`.mjs` | `4e6bbb9`（`codex/past-extension-release-20261102` 一系） |

若要保留，請改放到 `.vercelignore` 排除的位置（例如 `docs/`），或決定發布它們。

## 4. 資料庫

- 匯出：`node automation/db-schema-snapshot.mjs`（`supabase-personal db query --linked`，只查 `pg_proc`、`pg_class`、`pg_policies`、`pg_trigger` 等系統目錄，沒有讀任何資料表內容）。快照內的 email 只有已存在於 repo 的教師帳號與 Drive 連線限制，沒有學生資料或憑證。
- `supabase/quiz.sql` 的 `quiz_action` 兩處「找下一題」改為 `with ordinality ... order by ord limit 1`，與正式版 `quiz_action_before_learning` 相同。
- 重裝順序：先跑舊 `supabase/*.sql`，**最後**跑 `supabase/production-snapshot/functions.sql`。`quiz-order-fix.sql` 與 `quiz.sql` 會重新定義沒有學習包裝層的 `quiz_action`，檢查腳本會列為警告；不可在正式資料庫單獨重跑。
- 正式資料庫裡 `quiz_partner_pilot_*`、`garden_*` 等函式的原始 SQL 檔（如 `quiz_partner_pilot.sql`、`garden-preferences.sql`、`grade3_week10_typing.sql`）只存在主工作區未追蹤檔中；定義已收進快照，但原始檔是否納入 `main` 需使用者決定。

## 5. 測試結果（整合分支，2026-11-04）

| 測試 | 結果 |
| --- | --- |
| `node --test automation/tests/quiz-snapshot-order.test.mjs` | 3／3 通過：舊 `quiz.sql` 偵測、對照組重現 `question_order`、套用快照後強制 hash join 依序答 10 題成功且跳題被擋 |
| `node --test automation/tests/quiz-order-fix.test.mjs` | 2／2 通過（修正前案例改為明確裝回舊寫法再重現） |
| `node automation/db-snapshot-check.mjs --live` | ok，120／120 函式 md5 與正式資料庫相同 |
| 全部 87 個 `*.test.mjs`／`*.test.cjs` 逐檔執行 | 65 檔通過、22 檔失敗 |

22 檔失敗中，19 檔在覆蓋正式版之前（`bd9a784`）就失敗，屬於環境因素：缺 ignored 私有輸出包（`automation/output/past-*/…private.json`）、PGlite 放在 `%TEMP%\codex-drive-validation` 或寫死 `D:/projects/it-class-tcwu/tmp/quiz-runtime`、測試身分 SQL 雜湊檢查（`test_identity_source_changed`）、`grade6-boss` 斷言。這些需在原作者環境重跑。

覆蓋正式版後才失敗的 3 檔，原因都是「分支上的測試對應的是沒有發布的版本」：

- `automation/tests/garden-release-gate.test.mjs` 第 11 項：分支 `vercel.json` 有 `git.deploymentEnabled` 設定，正式版沒有。
- `automation/typing-foundation-model.test.mjs`、`automation/tests/past-flower-model.test.mjs`：正式版 `shared/*` 匯入了 `./typing-foundation-milestones.mjs`（Codex worktree 未 commit 的版本），測試用 data URL 載入模組時無法解析相對路徑。

瀏覽器測試（`*-browser.cjs`）本次沒有跑。

## 6. 主工作區待決清單

`D:/projects/it-class-tcwu` 有 753 項未 commit 修改，**全部未動**。以 git 雜湊（含換行正規化）逐項與整合分支比對：

| 分類 | 項數 | 意義 |
| --- | --- | --- |
| 已與整合分支相同 | 105 | 內容已在分支內（多為努力樹目錄、滑鼠練習頁），可直接捨棄或保留 |
| 與整合分支不同 | 109 | 包含 45 個會部署的檔（`shared/*`、`grade3|grade6/115-1/*`、`index.html`、`vercel.json`、`supabase/quiz.sql` 等），**都與正式版不同**：可能是比正式版舊的版本，也可能是尚未發布的新工作，需逐項決定 |
| 整合分支沒有 | 486 | 未追蹤的新檔：文件 149、提示詞 62、教科書 PDF 56、圖片約 90、`supabase/` 新 SQL 7、測試 14 等 |
| 未追蹤資料夾 | 53 | 例如 `garden/`（75 檔）、`docs/references/`、`automation/figures/` |

完整清單（狀態、分類、路徑）：[main-unify-20261104-main-worktree.tsv](main-unify-20261104-main-worktree.tsv)。

## 7. 新增工具

| 檔案 | 用途 |
| --- | --- |
| `automation/release-tree-diff.mjs` | 正式檔案樹 vs 本機目錄或 git ref，分 same／eol／different／missing |
| `automation/release-fetch-files.mjs` | 依 SHA1 從部署下載指定檔並驗證（經 Vercel CLI，不讀權杖） |
| `automation/db-schema-snapshot.mjs` | 唯讀匯出 public schema 到 `supabase/production-snapshot/` |
| `automation/db-snapshot-check.mjs` | 快照雜湊、無 ORDER BY 的下一題查詢、學習包裝層警告；`--live` 比對正式 md5 |
| `automation/quiz-release-base.mjs`、`quiz-release-compare.mjs` | 來自 `claude/quiz-load-batch4`，已併入 |

## 8. 待使用者決定

1. 審核後把 `claude/main-unify-20261104` 併入 `main` 並 push（本機 `main` 與 `origin/main` 目前分歧：本機多 4 個 commit、`origin` 多 `3ec8083`，整合分支已同時包含兩邊）。
2. 主工作區 109 項「與整合分支不同」的檔案逐項決定：捨棄、或另開分支經 PR 進 `main`。
3. 第 3 節 6 個移除檔是否保留。
4. Codex worktree（`foundation-keyboard-fix-20261102`、`foundation-milestones-20261102`）仍有 76 個已上線但未 commit 的檔；整合分支已有正式版內容，請 Codex 確認後清理該 worktree，避免下次從舊內容發布。
5. 第一次從 `main` 發布時，因 CRLF 會有 297 檔 SHA1 改變但內容相同，依 dev-sop 第 5 步以 `release-tree-diff` 確認只在 `eolOnly` 再放行。

## 9. 從乾淨 checkout 部署預覽（2026-11-04 12:xx，未 promote）

- GitHub 觸發的 Vercel 預覽**一定會失敗**：git clone 會帶入被追蹤的 `textbooks/`、S091、S092 資料夾，`.vercelignore` 只刪掉檔案、留下資料夾，`release/garden-preflight.mjs` 看到資料夾就擋。Codex 的分支也因此在 `vercel.json` 關掉自家分支的 Git 自動部署。正式發布一律用 CLI 從乾淨 checkout 上傳。
- 用 CLI 從乾淨 checkout 上傳時，`textbooks/` 規則仍會留下空資料夾，因此在 `release/project-policy.json` 補上 `cliIgnorePatterns: ["textbooks"]`（比照 S091／S092），並以 `renderProjectIgnore` 重新產生 `.vercelignore`；另排除 `.gitattributes`。`automation/tests/release-report.test.mjs` 11／11 通過。
- 預覽 `dpl_24v5JeTrxVd48YtUPx3kZWxWTX7W`（commit `0b82917`）建置成功。`quiz-release-compare.mjs` 對正式版：820／820，無新增、無刪除；125 檔 SHA1 不同，其中 2 檔是預期的 `.vercelignore`、`release/project-policy.json`，其餘 123 檔經 `release-tree-diff.mjs` 確認只差換行，內容差異 0。
- 預覽網址回 302（Vercel 預覽保護需登入），頁面內容未以瀏覽器驗證。
