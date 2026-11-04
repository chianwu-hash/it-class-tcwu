# 正式版資料庫快照（public schema）

來源：Supabase 專案 `upxgyusodibaqcrocdzj`，2026-11-04 以 `automation/db-schema-snapshot.mjs` 唯讀匯出（只查系統目錄，不含任何資料列）。

| 檔案 | 內容 |
| --- | --- |
| `functions.sql` | 120 個 public 函式的 `pg_get_functiondef()` 原文＋正式版 EXECUTE 權限，可直接重放 |
| `schema.json` | 80 張表／view 的欄位、constraint、index、RLS 開關與 ACL；21 條 policy、9 個 trigger、sequence、type、extension |
| `manifest.json` | 每個函式的 md5、SECURITY DEFINER、ACL，以及 `functions.sql` 的 SHA256 |

整個資料夾在 `.gitattributes` 標為 `-text`，checkout 後位元組不變，雜湊才能比對。

## 為什麼需要

`supabase/*.sql` 是逐檔手動套用的歷史紀錄，不是可重放的 migration：

- `quiz.sql` 原本的 `quiz_action` 找下一題時 `LIMIT 1` 沒有 `ORDER BY`（10/30 題序事故）。本分支已把兩處改成 `with ordinality ... order by ord limit 1`，與正式版相同。
- `quiz-learning.sql` 會把「當下的」`quiz_action` 改名為 `quiz_action_before_learning`，再建立學習包裝層。因此重裝順序錯了，舊 bug 會被包進 `_before_learning`。
- `quiz-order-fix.sql` 定義的是 `quiz_action` 本體（不是 `_before_learning`）。**在正式資料庫重跑它會蓋掉學習包裝層**，不可單獨重跑。

## 重新安裝順序

1. 依原本順序套用 `supabase/*.sql`（建立表、policy、trigger 與種子資料）。
2. **最後**套用 `supabase/production-snapshot/functions.sql`，讓每個函式回到正式版定義與權限。
3. 執行 `node automation/db-snapshot-check.mjs`；若連到該資料庫，加 `--live` 比對 md5。

## 更新快照

函式變更套用到正式資料庫之後（且只在那之後）：

```bash
node automation/db-schema-snapshot.mjs
```

```bash
node automation/db-snapshot-check.mjs --live
```

兩者都通過再把三個檔案 commit 進 `main`。`--live` 有差異，代表有人改了正式資料庫卻沒更新快照，先查清楚再發布。

## 檢查與測試

- `automation/db-snapshot-check.mjs`：快照雜湊一致；快照與所有 `supabase/*.sql` 都沒有「無 ORDER BY 的下一題查詢」；列出會蓋掉學習包裝層的檔案（警告）。
- `automation/tests/quiz-snapshot-order.test.mjs`：重放舊檔後套用快照，在 `enable_nestloop=off` 等強制 hash join 的設定下依序作答 10 題全部成功、跳題仍被擋；對照組（快照拿掉 ORDER BY）在第 1 題就出現 `question_order`。
