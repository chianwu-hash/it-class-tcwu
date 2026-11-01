# 學生學習檔案：真正 Google 登入與實際紀錄本機驗證

> 後續已獲使用者明確授權上線，正式發布見 [2026-11-01 發布紀錄](2026-11-01-admin-learning-production-release.md)。本文件「未上線」為前階段歷史狀態；正式站使用教師 RPC／媒體 Edge，並非本機 Management 橋接。

日期：2026-11-01。使用者明確要求「接著驗證真正的 Google 登入和實際學習紀錄串接，先在本機測試，暫時不要上線」。本節擴充先前的合成資料範圍，允許真正教師登入與既有學生紀錄唯讀查閱；仍未授權部署或修改學習紀錄。

## 結果與入口

### 最新：全班等級／功能與個人剩餘解鎖條件（本機完成，未上線）

- 使用者授權全班彙總直接顯示等級和已解鎖功能，並於本輪補充截圖要求個人功能區顯示「目前差哪些解鎖條件」。班級表新增「努力樹等級」「已解鎖功能」，直接列完整功能名稱，包含待同步升級、舊快照待確認、體驗等級、跨學期保留但本學期需二級才能使用等狀態；未連結／對應衝突不顯示假第一級或假未解鎖。
- 全班 `class_rewards` 仍單次 SQL 快照，改共用逐人的 `garden_status` 投影及嚴格驗證目錄，不逐人呼叫雲端。新增 `summarizeClassGardenRewards()`，直接共用個人 `summarizeGardenStatus()`；整班排序、重新讀取、快速切班、左側搜尋、超過20人完整名冊與個人入口皆保留。表格欄寬擴充且在自身區域左右捲動，手機不撐破頁面。
- 個人功能區現在動態顯示剩餘數量，例如 58 葉9花顯示「達到第二級還差 1 朵花」；寵物／小窩以升二級後的基準計算已新增成果，顯示「還差 9 片葉子或 2 朵花（擇一達成）」等差額。尚未升級者先列缺少的升級條件，再列升級後所需新增成果；不把升級前的成果當作升級後新增。原始一般門檻另保留供理解。
- 升級葉花條件為 AND；寵物／小窩葉花條件為 OR。轉換保留門檻若與一般門檻有兩條可行路徑，分別列出，不把不同路徑混成零差額。已達條件顯示待同步；舊快照需遷移者不猜剩餘數量。已解鎖紀錄、成長基準與學生成果均無寫入。
- 27 項 Node/PGlite 測試通過，新增全班與個人判定一致、隔人權限、未知狀態及剩餘條件測試。真正教師本機班級驗證301全21人、604全22人：逐列等級／功能與個人模型一致，排序、刷新、零筆搜尋不影響全班、表末學生個人明細一致、手機390px無頁面外溢、舊班回應不覆蓋新班皆通過。個人剩餘條件另外進行三／六年級實際畫面檢查。
- 修改僅本功能 reader／UI／CSS／garden模型與測試，入口仍 `http://localhost:3000/admin-learning.html`；無正式部署、資料庫遷移、學習成果或解鎖紀錄變更。證據使用既有 ignored `automation/output/admin-learning-20261101/`，班級報告不含姓名／答案，個人條件截圖只拍功能區。

### 最新：個人努力樹等級與已解鎖功能（本機完成，未上線）

- 使用者要求個人明細增加「目前努力樹在第幾級、已解鎖哪些功能」。個別花葉區新增等級、首次升級紀錄、已解鎖功能、待同步功能，以及其餘功能的門檻。包含花朵換色、第二級場景／天氣、成長紀念重播、樹型切換，以及正式目錄中的三寵物與六備用小窩；寵物原配小窩隨該寵物名稱合併列出。
- 不能使用 `gardenStage()` 當成已解鎖等級；該函式只判樹形外觀。目前正式成長功能為第一／二級，基本升級條件是 44 葉且 10 花。另尊重 `garden_growth` 的轉換保留門檻、升級基準、跨學期項目權限；成長體驗花葉會影響努力樹等級，但仍不混入上方學習成果總數。達條件卻沒有升級／項目紀錄時明示「待學生端同步」，不冒充已授權。舊 reward_version 快照顯示待同步確認，保留已存權限但不猜新解鎖。
- 本輪直接唯讀檢查正式 `garden_growth`／`garden_companions`／`garden_tree_skin`／`garden_item_catalog`／`garden_unlock_items`／`quiz_rewards` 的定義。正式函式已比主 repo 舊檔更新；不以主 repo 舊 `garden-growth.sql` 覆蓋正式函式。學生端 `get` 有寫入副作用，後台不呼叫它們，也不執行 claim／seen／ack／save。
- 新本機 `garden_status` 以同一 SELECT 快照取得既有花葉、當學期成長基準、全學期升級／寵物旗標與所有已存項目權限。`supabase_read_only_user` 無權執行私有目錄函式，因此只讀其函式定義，嚴格驗證為 immutable SQL 的七欄 VALUES，再將其常數目錄內嵌查詢；不改函式權限，不新增雲端函式，拒絕帶入其他函式／SELECT 或非 immutable 定義。讀取失敗不顯示假第一級。
- 同時依正式 `quiz_rewards` 現況補入 `quiz_past_leaves` 的過關花（一筆一花，不重計為葉片），分類為考古題；個別與全班統計共用此修正。正常練功半葉仍按原實際 ledger 計算。本機三／六年級週次目錄與正式 `garden_reward_catalog` 核對完全一致（12／15 個週次活動）。
- 新增 `shared/admin-learning-garden.mjs`、`automation/tests/admin-learning-garden-browser.cjs`；擴充本功能 reader／server、個人 UI／CSS、模型與既有測試。25 項 Node/PGlite 測試通過，涵蓋葉花 AND 門檻、無第三級誤判、待同步與已解鎖區分、跨學期權限、基準後新增成果、轉換門檻、舊快照、體驗資料、目錄白名單、隔人隔課與新動作教師驗權。
- 真 Google 教師登入本機抽查三／六年級：第一級與第二級、已解鎖清單、正式九項寵物／小窩目錄、條件展開與390px無外溢皆通過，腳本錯誤0。實際樣本未有已存寵物項目，該分支以合成資料驗證，不宣稱真學生寵物解鎖已實測。證據 ignored `automation/output/admin-learning-20261101/garden-status-browser-report.json`、`garden-status-only.png`（只拍功能區，無姓名或學生答案）。
- 本機服務已重啟，入口仍 `http://localhost:3000/admin-learning.html`。無學習成果、成長基準、解鎖紀錄或正式 schema 變更，未 commit／push／deploy；本節取代下方舊階段尚無等級／功能資訊的狀態。

### 最新：全班花葉彙總（本機完成，未上線）

- 使用者授權「全班的葉片和花朵彙總，可以依班級查看每位學生的數量，先在本機測試，不要上線」。頁面上方新增全班花葉彙總，可選班、依座號／葉片／花朵排序、手動重新讀取，點姓名開啟個別學習檔案；原個別統計保留。
- 新增本機 `class_rewards` 唯讀動作，使用單一 SQL、同一快照取得完整年度班級名冊與每人的既有 `rewards` 投影。不逐人打雲端 API，不受名冊每頁 20 人與左側姓名搜尋影響；不改候選或正式 RPC／RLS／判分／學習寫入。
- `summarizeClassRewards()` 共用個別花葉計算；全班總葉、總花、待累積半葉人數另列，半葉不跨學生湊整。未連結與帳號對應衝突者保留列，花葉顯示「—」，不冒充零或加入合計。每列狀態提醒未列入努力樹的活動或測試體驗；測試體驗不計學習成果。
- 班級與個別請求分開取消；切換個別學生不會中止全班讀取。班級／課程／登入切換會取消或捨棄舊班回應，清掉舊合計，避免混人混班。班級載入失敗清掉舊表並提供重試，不保留誤導總數。
- 22 項 Node/PGlite 測試通過，涵蓋完整 33 人合成班（含未連結、衝突）、個別投影一致、跨年級／任意分頁與搜尋拒絕、排序及半葉隔人計算；HTTP 額外驗證全班動作的匿名、學生、跨來源拒絕與真教師通過。
- 真教師登入的本機瀏覽器驗證兩班：301 全 21 人（20 人連結、1 人未連結）、604 全 22 人；逐列值／合計與共用模型一致，均涵蓋第 20 人之後的名冊。葉片／花朵／座號排序、左側零筆搜尋仍保留全班、手動更新、表末學生開啟個別檔案且數量一致、390px 橫向表格捲動及頁面無外溢通過。刻意延後 603 回應再切 604，舊班資料未覆蓋新班。腳本錯誤 0。實際總數只代表該讀取快照，不是全校逐班稽核。
- 證據 ignored `automation/output/admin-learning-20261101/class-rewards-browser-report.json`；`class-rewards-totals-only.png` 只拍班級控制與合計，未保存學生姓名表。新增測試 `automation/tests/admin-learning-class-rewards-browser.cjs`，其餘修改皆為本功能既有檔案。服務重啟後入口仍 `http://localhost:3000/admin-learning.html`，未 commit／push／deploy，未修改學生學習或獎勵紀錄。以下「尚未新增全班彙總」為前一階段歷史狀態，現已由本節取代。

### 後續：個別學生花葉統計（本機完成）

- 使用者詢問學生的葉片與花統計；本輪在相同本機實際資料頁新增「努力樹・花葉統計」，包含整片葉／花總數、待累積半葉、來源分類與逐筆花葉來源。只在 `local-readonly` 後端啟用，不改正式 RPC 或合成預覽的契約，未部署。
- 沿用 `reward-tree-config.js`、`deriveRewardTreeModel()`、`foundationTreeData()`、`wholeQuizLeaves()`、`homeworkTreeData()`、`readingTreeData()`。葉片由既有進度與獎勵紀錄推導，不把完成試卷數當作得葉數；六年級作業／閱讀使用目前版本評比，草稿、其他班級及尚未到期的閱讀不混入。
- 唯讀橋接新增 `rewards` SELECT，仍須 Auth/user 與 is_teacher 驗證，再以年度名冊連結唯一已驗證帳號。資料在同一 SELECT 快照取得，不呼叫可能更新成長狀態的 `garden_growth`／`garden_test_rewards`／獎勵發放 RPC。正式資料目前沒有 `quiz_leaf_awards.half_units` 欄位，透過 `to_jsonb(w)` 相容舊整葉紀錄（每筆 2 個半葉單位）；保留未來已有該欄位時的實際值，不執行半葉遷移。
- 指定測試帳號的 `garden_test_setup` 體驗花葉另列說明，不加進學習成果總數。Google 未連結／帳號對應衝突不計算，讀取失敗顯示錯誤與重試，不顯示假零值。切換學生、課程、登出或重新讀取均清掉舊統計，回應依 student epoch 防止混人。
- 新增 `shared/admin-learning-rewards.mjs`、`automation/tests/admin-learning-rewards.test.mjs`、`automation/tests/admin-learning-rewards-browser.cjs`，修改本功能頁面／CSS、控制器、唯讀 reader 與 server 白名單。統計模組僅於實際資料模式按需匯入，合成模式不因新增 adapters 載入正式 Auth。
- 21 項 Node/PGlite 測試通過，涵蓋新舊半葉欄位、隔人隔課、未連結／衝突、可見任務、目前評比、原有後台契約。真正教師登入下三、六年級各抽查一位，總數／分類加總／逐筆明細／390px 無水平溢出／腳本錯誤 0 通過。證據 ignored `automation/output/admin-learning-20261101/rewards-browser-report.json`；`rewards-only.png` 僅花葉統計區，無姓名、帳號或學生答案。這次不是全校逐人稽核，也尚未新增全班彙總表。
- 本機服務已重啟載入新 reader；入口仍 `http://localhost:3000/admin-learning.html`。無正式 schema、學生學習成果或獎勵紀錄變更，無 commit／push／deploy。

實際資料入口：`http://localhost:3000/admin-learning.html`。

啟動：`node automation/admin-learning-live-server.mjs`。僅綁定本機 loopback，啟動前確認 3000 沒有其他服務占用。本機頁首明示「本機實際資料驗證」，不是合成示範；原 `http://127.0.0.1:4472/admin-learning.html?local=1` 保留合成服務，不混用兩者。

真正 Google 流程：從未登入的本機後台按教師 Google 登入，經集中入口 `/index.html?login=1`、Google 帳號選單、Supabase Auth callback 回到原頁。實際確認教師 `chianwu@gmail.com`，無須輸入或擷取密碼。仍沿用 `shared/auth.js` 與既有 `shared/quiz-login-callback.mjs`，未重寫 OAuth、未將合成 Auth 模組用於這次驗證。

頁面重載能接回同一個真正 Google session。伺服器在每次實際讀取前，透過 Supabase `/auth/v1/user` 驗證憑證、已驗證 email 與指定教師，再呼叫既有 `is_teacher()` 核對教師權限。未登入實際端點返回 401。不存在把教師憑證改成學生憑證、模擬學生作答或在工具輸出貼出 token 的步驟。

## 正式環境缺口與本機讀取方式

已用唯讀端點確認 `public.admin_learning_action(text,text,jsonb)` **尚未安裝於正式資料庫**。因此不能把此輪結果稱為「已部署正式 RPC」或「正式 Edge 已發布」。

採用本機唯讀橋接：

1. `automation/admin-learning-live-server.mjs` 只允許已驗證教師呼叫有限的讀取動作，檢查 Host、Origin、輸入大小及課程，不提供任意 SQL、檔案或寫入入口。
2. `automation/lib/admin-learning-readonly-reader.mjs` 從同一份候選 `supabase/admin_learning.sql` 抽取 SELECT 投影，替換函式內變數為具型別的參數／CTE。沒有傳送 DDL、安裝臨時函式或變更正式 schema。與隔離資料庫中的候選 RPC 做逐動作一致性測試，名冊、摘要、週次、打字、事件、試卷、錯題篩選皆一致。
3. `automation/lib/admin-learning-live-query.mjs` 與 `supabase-personal-readonly.py` 經既有個人 Supabase CLI 預設 profile 的 Windows Credential Manager 認證，在子程序記憶體內使用管理憑證；先確認 Management profile 的 `primary_email` 是同一個教師帳號。憑證不回傳瀏覽器、不寫入程式碼／檔案／紀錄，不變更全域登入設定。
4. **只使用** Management API `/v1/projects/upxgyusodibaqcrocdzj/database/query/read-only`，不 fallback 到一般 query、CLI `db query`、新登入角色或任何資料變更。實際 `current_user` 回覆 `supabase_read_only_user`。查詢值走 `parameters`，不把姓名、搜尋字串或學生代碼拼入 SQL。

本機橋接限測試使用，並非建議把個人 Management credential 帶到正式前端或正式公開伺服器。未來上線仍要使用新增教師 RPC／媒體 Edge 的正式部署與權限驗收流程。

官方依據：[唯讀 SQL 端點](https://supabase.com/docs/reference/api/v1-read-only-query)（supabase_read_only_user、schema-qualified entity、參數），[Management profile 欄位](https://supabase.com/docs/reference/api/v1-get-profile)（primary_email）。本次有實際請求與角色回覆，未只依文件推論可用。

## 實際資料抽查

本機真正教師 UI 抽查三、六年級各一位同時有打字與測驗紀錄的學生；選擇器只在 ignored 私有測試檔中保留班級／座號，報告與本文件不保存學生姓名、email、UUID 或答案全文。

| 年級樣本 | 週次活動筆數 | 基礎練習進度筆數 | 展開關卡的事件數 | 試卷數 | 抽查試卷題數 | 成功載入圖片數 |
|---|---:|---:|---:|---:|---:|---:|
| 三年級 | 12 | 1 | 7 | 16 | 10 | 3 |
| 六年級 | 13 | 2 | 12 | 17 | 5 | 7 |

核對項目：

- 姓名以實際年度名冊為準；摘要數值與實際回應一致，無合成資料混入。
- 週次筆數與分頁回傳、打字關卡與事件明細／目前版本相符。
- 固定版本題目順序、當時選項順序與學生原始答案正確呈現。
- 真實錯題篩選只列已答且答錯，不把未答算錯。
- 390px 沒有水平溢出，沒有頁面腳本錯誤。
- 全部本機學習資料讀取回覆標示 `cloud-readonly`，未呼叫送答、重置、改分或獎勵動作。

共 14 類真正登入／實際紀錄瀏覽器檢查通過，紀錄為 ignored `automation/output/admin-learning-20261101/real-google-live-report.json`。只記錄通過項目、年級與數量，不存學生姓名、帳號或原答。這是兩位樣本的端到端驗證，不代表已逐人核對全部學生或證明正式庫併發容量。

## 實際圖片

未安裝新的 `admin-learning-media` Edge。透過本機 `/__learning-live-media` 先核對真正教師、選定學生、卷的固定版本及 URL，接著呼叫已部署 `quiz-media` 的 **read** 簽章流程；原有資產擁有者權限繼續生效，沒有放寬學生端圖片資格或新增 Storage key。這次兩份卷的 10 張實際圖片均能讀取，來源為既有 Drive worker。

前端對同一個明細內的重複 URL 復用短期 Promise，避免共用材料被重複驗權；失敗移除快取供手動重試。快取只在目前 dialog 的記憶體中，切學生／關閉即失效，不寫 localStorage。

第一次圖片檢查等待離屏的 lazy 圖全部載入而逾時，當時沒有媒體錯誤。已改為逐張捲入 dialog 可視範圍再驗證；完整重跑成功。沒有因此取消圖片延後載入或改動正式媒體設定。

已部署 signer 的既有 owner 檢查不因本機橋接而放寬；其他教師擁有的媒體不在本輪成功樣本範圍。未來正式新媒體 Edge 的跨教師授權仍需另外驗證，不能把這次結果當成新 Edge 已上線。

## 測試與檔案

新增：

- `automation/admin-learning-live-server.mjs`
- `automation/lib/admin-learning-live-query.mjs`
- `automation/lib/admin-learning-readonly-reader.mjs`
- `automation/lib/supabase-personal-readonly.py`
- `automation/tests/admin-learning-live-server.test.mjs`
- `automation/tests/admin-learning-readonly.test.mjs`
- `automation/tests/admin-learning-live-browser.cjs`

僅在本功能的 `shared/admin-learning-api.mjs`／`admin-learning.mjs` 加入由本機伺服器插入 meta 啟用的唯讀橋接選項及媒體復用；正式模式仍指向原候選 RPC。沒有改動共用 Auth、navbar、學生作答／判分、週次成果或努力樹。

`node --test automation/tests/admin-learning-live-server.test.mjs automation/tests/admin-learning-readonly.test.mjs automation/tests/admin-learning.test.mjs`：17 項通過。涵蓋真正伺服器的 Auth/user＋is_teacher 驗證順序（合成上游）、匿名／過期／學生／跨來源拒絕、唯讀模式未就緒、白名單、媒體檢查與既有 read signer、與候選 RPC 的全部 SELECT 一致性、未預期寫入／公共函式拒絕、原有功能回歸。

CLI readiness 的 `whoami` 只用於確認個人管理帳號，沒有執行 CLI 資料庫 query。沒有呼叫會初始化 `cli_login_postgres` 的命令；正式資料庫未執行本輪 DDL／遷移、未調效能或權限、未建立／刪除學生記錄。Google 登入本身會產生正常的 Auth session，與修改學生學習成果不同。

## 後續界線

目前為可供使用者查看的本機實際資料候選。保持 localhost:3000 的服務與已登入分頁，不保留任何瀏覽器自動化連線或占用。若本機服務停止，可重跑啟動命令；認證沿用使用者既有個人 CLI profile，不輸入或分享 token。

仍然 **未提交、未推送、未部署、未套正式 SQL**。後續可依使用者回饋修正；正式發布須先核對最新完整正式來源，再做正式 RPC／Edge 安裝、非教師拒絕與代表性資料／媒體回歸，不可從舊 main 或這個本機測試入口整包覆蓋正式站。
