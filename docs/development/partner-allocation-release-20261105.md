# 考古題整包配題接線與驗證（2026-11-05）

將50份已核固定結構接到夥伴練功後端；保持40份啟用、10份停用，不修改題目、答案、原配分、60%門檻、紀念花／葉或個人練習。

## 行為

- 新考古集合室建立時採配題版本1，固定原卷版本與欄位；出發時按可作答來源目標數做確定性largest-pack-first，完整題組同人、共享field及配對詞庫保守同人，凍結到私有allocations表。
- 既有集合室包含未出發者仍為版本0，保留原逐欄輪配。普通10／20題及自組卷不變。
- source_allowed對新考古房要求有spec；缺版本／映射、欄位遺漏／重複、group／label／points不符都拒絕，不回退舊公式。
- 已被版本1小隊引用的副本／題目不可原地更改。停用仍可操作；換卷須發新版本及新副本，不覆蓋既有作答。
- 集合室題號、mine投影與送答／ask／mark權限均用同一owner_of。前端增加簡短說明及缺資料的中文指引，沒有更換答題或營地版面。
- 原來源盤點的allocationEnabled:false保留為歷史盤點狀態；實際server contract獨立生成於supabase/partner-allocation-plan.json，不直接將盤點檔當runtime adapter。

## 實作及交付

`automation/build-partner-allocation.py`從固定structure／decisions及`automation/templates/quiz-partner-allocation.sql`生成server-only計畫與單一交易SQL。正式只安裝`supabase/quiz-partner-allocation.sql`，程式、50筆metadata與commit前完整映射守衛同一交易；不手動分段安裝。SOP已補後續製卷／換版交付與驗收規則。

## 驗證

- 原結構17項合成正負測試通過；50卷compiler測試驗唯一完整field覆蓋、來源／版本、語意整包、storage coupling與共享詞庫同人。
- Node 23項回歸通過，涵蓋普通／自組、媒體／揭答、訊息／邀請、獎勵去重／訂正及新配題。新案例另驗2／3／4人、舊started／pending、snapshot題號一致、跨人answer／ask／mark拒絕、相同request重送、缺mapping／重複field／錯誤identity及副本凍結。
- 真正正式PostgreSQL交易內安裝單一候選SQL後ROLLBACK：40卷×2／3／4人＝120配置、6105欄mapping，整包同人、全部唯一覆蓋、每人非空、owner_of一致。
- 另用交易內16個合成Auth／名冊帳號，真正authenticated角色跨3／4／6／9年級共12案例，create→join→ready→start→snapshot、跨人answer拒絕、ask／mark通過；全部回滾，不留學生作答或獎勵。
- 最大差異是三年級113國語20子題文章：4人目標數10／11／11／20；不能為平均而拆文章。其餘119配置的差距見私有收據，不承諾全域最優。
- Claude兩輪supervised CLI唯讀複核（2.1.289／OAuth；375.624秒12次Read、202.044秒9次Read；各輪Git前後不變）。第一輪指出的安裝guard、唯一映射、版本／副本與測試基底缺口已修，最終未發現P1／P2阻擋。P3來源重複情境亦補唯一guard，並重跑真PG及新測試。Codex自行實跑測試，不冒稱Claude操作正式站。
- PostgreSQL 17.6真庫回滾測試前後19張既有資料表摘要完全相同，合成Auth帳號0筆。

## 限制

目前正式工作瀏覽器是教師帳號，實際確認系統拒絕進學生功能；未完成真人學生雙帳號、兩台實機與斷線重連互測。上述PG authenticated驗證和合成瀏覽器驗證不能替代這項。沒有重核原卷全部答案／媒體，沒有更換為原單人答題介面或收合營地（那是另一項已記錄方向）。名間口試仍未知，blocked及optional不變。

## 發布／回復

PR #35已合併main `d19d277`。正式發布腳本取得本輪鎖後，從乾淨main精確套用單一SQL（SHA256 `6741b0dce56d987cd6cd67582f874e30ac2f5dea44b40b83b489986cf9d500a9`）；50份spec及每份enabled副本guard通過。正式安裝後再次跑120配題配置及12 authenticated案例，全部ROLLBACK通過，19表摘要不變、合成Auth0。

已執行 `db-schema-snapshot.mjs` 與 `db-snapshot-check.mjs --live`，148函式一致；只新增3個allocation函式、修改owner_of／snapshot／source_allowed，無其他變動或刪除。2張私有RLS表、rooms版本欄位與4個trigger有完整schema快照。

snapshot PR #36合併後，從乾淨最新main `3a9f880`重新取得發布鎖，經release-from-main start→deploy→promote，2026-11-05T13:03:31.968Z正式為 `dpl_8PFEpMsmXtjVoW3iJvz82NBhMf4W`。完整檔案樹比對 `ok:true`，只改4個年級入口＋app／learning，共6檔；無其他變更、新增、刪除或換行例外。基準回滾是 `dpl_22JA3jB9gebvZeuVA376NPTcpfHZ`，發布鎖已釋放。

候選域受Vercel登入保護，使用既有CLI認證的`vercel curl`核對，不關閉／擴大保護。候選及正式6檔皆200，SHA256逐一與main來源完全相同。正式瀏覽器重載新版參數、pageerror為0；目前teacher正確拒絕學生功能。沒有真人雙帳號互測的宣稱。

正式SQL後讀回50份spec、40份啟用副本2035欄、10停用來源不變；對既有started v0小隊488欄逐一比較原owner公式，差異0。148函式snapshot/live-check再驗通過；19表摘要仍不變，合成Auth0。摘要收據見[驗證JSON](partner-allocation-verification-20261105.json)。

如需回退前端可回到發布腳本記錄的基準deployment；後端不要刪除allocations或改回新房的owner公式，以免學生換手。新版本新房暫停，既有凍結作答與紀念保留，再經修正遷移處理。
