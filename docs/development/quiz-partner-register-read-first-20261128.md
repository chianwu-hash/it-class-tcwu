# 夥伴目錄逾時：相同本人登錄的行鎖修正候選

本批接續[九年級社會教材導向正式驗證](zhongzheng-g9-social-partner-study-entry-20261128.md)。**SQL候選尚未套用正式庫；已完成隔離測試、精確回滾及集中唯讀審查，待正式套用核准。** 不把本機鎖行為改善宣稱為正式目錄逾時已消除。

## 正式觀察與可證實範圍

正式九年級專用學生從原生選卷頁讀取：有2次access請求，但只有1次catalog請求；access均成功，catalog約8098.5ms後回HTTP500、SQLSTATE `57014`及statement timeout，該頁沒有夥伴選卷連結。這次不是多個catalog由同一頁重送造成。

同一時段10次唯讀活動抽樣，4次看到夥伴RPC仍在執行並有`tuple`／`transactionid`鎖等待，最長已執行約6.94秒。只保存PID、等待類型、時間及阻擋關係，不保存原始SQL參數、帳戶或學生資料。此證據尚未把每個等待精確定位到同一張表，不能排除其他慢查詢或鎖來源。

正式`partner_pilot.register_self()`的定義指紋仍為 `38ed977b2ca39d46bf998afd312eb291`。它先檢查當下資格，再用名冊產生本人顯示名稱，最後執行`INSERT ... ON CONFLICT DO UPDATE ... WHERE`。即使更新條件不成立，隔離的真PostgreSQL仍可重現本人列被鎖住；後續同一人的請求會等前一個交易結束。

## 最小修改與不變條件

[候選SQL](../../supabase/quiz-partner-register-read-first.sql)保留原本資格與名冊查詢；確認已有同一個本人ID、完全相同名稱且active的登錄時直接返回。需要新增、更新姓名或重新啟用時仍走原upsert。不得以已有allowed-user資料代替當下Google、名冊、教師身分與服務啟用檢查。

不改題目、固定版本、作答、分工、獎勵、全站設定、函式簽名或呼叫端。`CREATE OR REPLACE`保留擁有者與ACL，測試核對security definer、search_path、volatility、strictness及ACL全值保持。沒有對學生新增執行私有函式的權限。

| 項目 | 固定值 |
| --- | --- |
| 原函式MD5 | `38ed977b2ca39d46bf998afd312eb291` |
| 候選函式MD5 | `dc06cd3396d2567036e43b8c3eb2a4ea` |
| 遷移SQL SHA-256 | `87f49708c87871615bd63178bc8e9bd6fc461387e2b98132ced4a4b05470570a` |
| 回滾SQL SHA-256 | `7e361ec0094048048ca387a9d8bfe3058b297fa5e78275247145eca90058a615` |

遷移與[回滾SQL](../../supabase/quiz-partner-register-read-first-rollback.sql)均有交易、執行前來源指紋及執行後結果指紋守衛。來源有其他變更即拒絕，不覆蓋未知版本。回滾還原原始函式定義及權限，不刪資料。

## 已完成驗證

真PostgreSQL 17的兩個獨立連線，以正式快照函式及合成身分測試，通過：

- 舊版：連線一在交易內重複登錄相同資料，連線二在250ms測試用lock_timeout下遇`55P03`；這是刻意持有交易的鎖測試，不是正式延遲或效能倍率。
- 候選版：連線一交易仍開啟時，連線二能完成相同登錄，登錄列全值保持。
- 初次同時登錄仍由唯一鍵協調；第二個請求在首個提交後成功，最後只有一列。姓名變更及inactive登錄仍會同步。
- 服務停用、教師、未知身分拒絕；正式公開函式的authenticated入口可用，匿名入口與直接呼叫私有函式拒絕。
- 回滾後原始函式定義、ACL與metadata全值相同，資料保持；中途有人改函式時回滾拒絕。

repo另有2項可重跑測試：

```text
npm run quiz:setup
node --test automation/tests/quiz-partner-register-read-first.test.mjs
```

其中以statement trigger核對：舊版即使資料相同仍發出寫入敘述，候選版不發出；同時驗證Google provider、信箱確認、服務停用及已有登錄時仍重新核資格。這2項使用PGlite，不能替代上述真PostgreSQL並行證據。原生測試伺服器已正常停止，未連Supabase或使用真學生身分。

集中Claude唯讀審查已完成，未發現可證實的阻擋問題；涵蓋SQL、回滾、測試、現行函式與表約束，Git狀態、HEAD與上游前後一致。依提醒在repo測試補上直接呼叫私有函式時的資格拒絕，不只經公開access入口測試；真PG原生證據原已包含直接拒絕。正式套用前仍須獨立核owner／ACL，MD5本身不含這兩項。

## 正式套用前後的待辦

1. 此新共用SQL契約已集中審查，PR先進main。正式套用須依本對話提供的AGENTS資料庫函式核准規則處理，不把先前另一份SQL的同意沿用到本修正。
2. 核准後由新建乾淨main checkout，核對live原函式、owner及ACL，先交易ROLLBACK演練，再journal記錄正式套用；未知結果先讀回，不盲目重送。
3. 核正式新函式與權限，全數資料守衛保持；執行`db-schema-snapshot.mjs`及`db-snapshot-check.mjs --live`，production snapshot經PR回main。
4. 正式OAuth重新核各適用年級的access、catalog、原生選卷與既有小隊接續，記錄延遲與錯誤；若仍逾時，繼續查其他根因，不調高timeout或移除授權。
5. 九年級社會仍須真小隊點出教材、兩人分工／送答／重載／回顧，以及可靠配題。這份修正不代表二段社會、整個二段或長線已完成。
