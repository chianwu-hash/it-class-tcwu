# 中英打基礎里程碑花與來源配色：本機實作紀錄

2026-11-02。使用者已同意修改；已完成本機實作、正式上線與發布後驗收，詳見 [正式發布紀錄](typing-foundation-milestones-release-20261102.md)。

## 已完成的行為

| 練習 | 里程碑花條件 | 葉／花配色 |
| --- | --- | --- |
| 英打 | 依序全部完成第 1–4、1–9、1–12 大關，各得一朵花 | 藍葉、淺藍花 |
| 中打 | 依序全部完成第 1–5、1–8、1–12 大關，各得一朵花 | 紫葉、淺紫花 |

保留每個大關原有過關葉，合計最多 24 葉與 6 朵里程碑花。只採用雲端已完成的大關；檢查點、未達標或缺少前關都不會開花。三、六年級共用同一份里程碑定義，各學期課程的獎勵 ID 獨立。

基礎練習頁顯示三階段進度、已完成大關數與開花狀態。初次載入舊成果不播放新成就提示；成果相同時不重建狀態區。努力樹來源與無障礙名稱均保留「英打／中打」文字，不只靠顏色識別。第一級樹、第二級貓／狗／兔場景、成長重播皆採相同來源配色；仍可切回原有自選花色。已有花色偏好的瀏覽器保留自選模式；點選花色按鈕也會切換到自選模式。

## 儲存與相容性

- 不改登入、基礎練習的存檔或關卡解鎖流程，不新增學生進度的 localStorage。localStorage 只存顯示配色偏好。
- 原有過關葉 ID 不變；新花仍使用 `kind: flower`，不會被後端誤算成葉子。學生樹與教師摘要共用相同 adapter／model。
- 重練與重整不重複領取；教師重設後依目前完成紀錄收回相關葉與花。既有已取得的寵物解鎖時間保持原規則，不清除。
- 正式 SQL 遷移以唯讀取得的現行 `garden_growth` 定義生成，保留考古花、舊快照轉換、各年級、花園與寵物流程。新規則資料表啟用 RLS 並撤銷學生直接權限；內部獎勵函式不開放匿名／學生直接呼叫。
- 已升級的樹：規則啟用前取得的基礎里程碑花補入成長基準，不當成升級後新花，不因此直接觸發三朵新花解鎖寵物。啟用後才完成的里程碑依原規則計入新努力。
- SQL 可重跑；若線上 `garden_growth` 已有其他更新，定義雜湊檢查會中止。相同版本的里程碑定義被改動也會中止，不覆蓋他人更新。

## 驗證結果

1. `node --test automation/tests/foundation-milestones-db.test.mjs automation/tests/admin-learning-rewards.test.mjs`：16 項通過。包含前後端 ID 一致、24 葉 6 花、逐階先修、重設與恢復、舊成果補算、啟用後新花、已解鎖時間保留、SQL 重跑、版本衝突保護、匿名／教師／非本年級／未登入權限，以及既有教師摘要與花園回歸。
2. `node automation/check-foundation-syntax.mjs`：17 段產品瀏覽器程式語法通過。瀏覽器 `.js` 使用 module 模式檢查，不使用 Node 預設 CommonJS 模式。
3. 共用 AI 工作瀏覽器測試通過：第一級 24 葉 6 花、來源色與自選色、點選來源、模擬重設／恢復、貓／狗／兔場景、成長重播的來源資料與即時換色、390px 手機版無水平溢出、零 pageerror。全程採合成成果，未寫入正式學生成果。
4. 已目視檢查桌面、成長重播與手機截圖。證據：獨立工作區 `tmp/milestone-qa/browser.json` 與 `desktop.png`、`growth.png`、`mobile.png`。

前述為本機階段結果；正式 Google 登入、教師測試進度保存及發布後驗收另見正式發布紀錄。

## 工作區與後續發布

- 獨立工作區：`D:/projects/.codex-worktrees/foundation-milestones-20261102`。
- 分支：`codex/foundation-milestones-20261102`。
- 網站基底：已驗證的正式部署 `dpl_HNgV9o1A3A6Z3Q99qT2ECJTsTS5d`，共 799 個來源檔。主工作區原有其他未提交修改保留。
- 本次產品異動為基底上的 18 個修改檔與 5 個新檔，精確範圍與 SHA-256 在 `tmp/foundation-feature-manifest.json`；不要依工作區整份 `git diff` 發布，該基底本身包含比 Git HEAD 更新的正式內容。
- 本機合成預覽：`http://127.0.0.1:4326/automation/fixtures/foundation-milestones/preview.html`。伺服器停止後，可在上述工作區執行 `python -m http.server 4326 --bind 127.0.0.1`。
- SQL：`supabase/foundation_milestones.sql`；生成器：`automation/build-foundation-milestone-sql.mjs`。測試使用本機 PGlite；可透過 `FOUNDATION_PGLITE_PACKAGE` 指定其 package.json，或使用既有 `tmp/quiz-runtime` 安裝。
- 發布時必須再取得最新正式來源，只套用本次清單；重新比對正式函式並驗證 SQL，前後端一起驗收，再測正式登入、成果讀取／保存與樹的解鎖。已按最新正式來源完成發布，見正式發布紀錄。
