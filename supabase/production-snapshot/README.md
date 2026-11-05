# 正式版資料庫快照（public schema）

來源：Supabase 專案 `upxgyusodibaqcrocdzj`，2026-11-05 以 `automation/db-schema-snapshot.mjs` 唯讀匯出（只查系統目錄，不含任何資料列）。本次只擴充夥伴練功圖片描述函式的來源URL、內容校驗碼與媒體後端資訊；原小隊／揭答授權、所有函式權限與其他函式定義不變。

| 檔案 | 內容 |
| --- | --- |
| `functions.sql` | 145 個函式的 `pg_get_functiondef()` 原文＋正式版 EXECUTE 權限（先對 `public, anon, authenticated, service_role` 全部撤銷，再依正式 ACL 授權），可直接重放 |
| `schema.json` | 97 張表／view 的欄位、constraint、index、RLS 開關與 ACL；21 條 policy、9 個 trigger、sequence、type、extension |
| `manifest.json` | 每個函式的 md5、SECURITY DEFINER、ACL，以及 `functions.sql` 的 SHA256 |

整個資料夾在 `.gitattributes` 標為 `-text`，checkout 後位元組不變，雜湊才能比對。

## 為什麼需要

`supabase/*.sql` 是逐檔手動套用的歷史紀錄，不是可重放的 migration：

- `quiz.sql` 原本的 `quiz_action` 找下一題時 `LIMIT 1` 沒有 `ORDER BY`（10/30 題序事故）。本分支已把兩處改成 `with ordinality ... order by ord limit 1`，與正式版相同。
- `quiz-learning.sql` 會把「當下的」`quiz_action` 改名為 `quiz_action_before_learning`，再建立學習包裝層。因此重裝順序錯了，舊 bug 會被包進 `_before_learning`。
- `quiz-order-fix.sql` 定義的是 `quiz_action` 本體（不是 `_before_learning`）。**在正式資料庫重跑它會蓋掉學習包裝層**，不可單獨重跑。

## 適用範圍：函式還原，不是完整重建

`functions.sql` 的用途是**在已有完整 schema 的資料庫上**，把所有函式與 EXECUTE 權限還原到正式版（例如有人重跑了舊 SQL 檔，或要確認沒有退回舊版 `quiz_action`）。目前**無法**只靠本 repo 從空資料庫重建正式庫：

- 有 8 張正式表在任何 `supabase/*.sql` 都找不到建表敘述，定義只記錄在 `schema.json`：`book_wishes`、`content_comments`、`device_activity`、`reading_test_resets`、`sync_devices`、`sync_pairing_codes`、`sync_profiles`、`sync_states`。`db-snapshot-check.mjs` 會自動列出這類表。
- 舊 SQL 檔沒有經過「從空庫依序重放」的驗證，部分檔案還有正式函式雜湊保護（例如 `foundation_milestones.sql` 會先檢查 `garden_growth` 的 md5，不符就中止），不能當成可任意重跑的腳本。
- 規則資料：`foundation_milestones.sql` 會寫入 `foundation_milestone_policy`（啟用時間預設為執行當下）與 `foundation_milestone_definitions`（英打、注音各三個里程碑）；重建時啟用時間會與正式版不同，會影響「啟用後才計算」的獎勵。

## 在既有資料庫上還原函式

1. 確認目標資料庫的表與 policy 已存在（必要時依各 SQL 檔紀錄的順序補建）。
2. **最後**套用 `supabase/production-snapshot/functions.sql`，讓每個函式回到正式版定義與權限。
3. 執行 `node automation/db-snapshot-check.mjs`；若連到該資料庫，加 `--live` 比對函式 md5、EXECUTE 權限與 SECURITY DEFINER。

## 更新快照

函式變更套用到正式資料庫之後（且只在那之後）：

```bash
node automation/db-schema-snapshot.mjs
```

```bash
node automation/db-snapshot-check.mjs --live
```

兩者都通過再把三個檔案 commit 進 `main`。`--live` 有差異（定義、權限或 SECURITY DEFINER），代表有人改了正式資料庫卻沒更新快照，先查清楚再發布。

## 檢查與測試

- `automation/db-snapshot-check.mjs`：快照雜湊一致；快照與所有 `supabase/*.sql` 都沒有「無 ORDER BY 的下一題查詢」；列出會蓋掉學習包裝層的檔案（警告）。
- `automation/tests/quiz-snapshot-order.test.mjs`：重放舊檔後套用快照，在 `enable_nestloop=off` 等強制 hash join 的設定下依序作答 10 題全部成功、跳題仍被擋；對照組（快照拿掉 ORDER BY）在第 1 題就出現 `question_order`。
