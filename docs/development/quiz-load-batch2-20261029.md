# 考前練功坊第二批：錯題及固定版本讀取減量

使用者核准接續第一批，先完成本機測試及真正PostgreSQL的30人並行，全部通過後上線；原保存、相同答案重送、題組／整卷揭答、防弊、一葉及固定版本契約保留。

## 實作範圍

- 基準為第一批正式 `dpl_HGZTE2a2yduoYvKdi9tu6YiwTsqb`，功能37017eb／文件3eb27e5；在既有獨立工作區另開 `codex/quiz-load-batch2`。主工作區未發布的半葉、花園、schema2不納入。
- 正式唯讀取得19個quiz函式與25個既有索引，99份固定版本沒有重複題號。沒有啟動舊CLI每分鐘sampler。
- 新增私有 `quiz_version_meta`，每個固定版本一筆，只保存title／catalog／total、題號對應區塊與160字預覽、題組題號集合。沒有複製答案或完整題目，也沒有學生進度副本。發佈及自組卷插入版本時在同交易產生，既有版本一次回填；重跑冪等，版本回滾時摘要一併回滾。沒有替既有學生表新增推測性索引。
- 新 `quiz_library_sessions` 由本人資格及場次範圍讀摘要，再彙整本人進度，不反覆展開每份document。回應欄位／全部可見卷／科目篩選／接續／新卷定位保留，沒有任意截斷清單。舊quiz_action的library仍相容舊頁。
- 新私有 `quiz_wrong_refs` 先限定本人、目前名冊、年級、答錯及題組／整卷揭答資格；只產生小型參照。清單保留所有facet與篩選總數，僅20筆頁面才建JSON／取預覽。
- 錯題detail先限一個attempt／一題，只投影當時材料／題幹／選項／答案及解析；不再全量整理錯題、不做整份resume、不做leaf、不取FOR SHARE。保留當時選項順序、關場可回顧、移除自組卷後錯題留存。
- detail增加version_id／can_extend，前端不為延伸資格讀catalog；舊detail回應仍保留fallback。版本完整時票證沿用第一批同情境短效重用，返回清單或換人仍銷毀。
- `quiz_extension_source` 共用原可靠來源／固定版本別名／舊三上數學fallback／課程年級規則。compose僅將原來源查找段改呼叫此helper；保存、request_id、抽題排序／配比／補題及既存重送均未改。
- 教師 `quiz_version_browser` 只允許本人題庫；版本清單回metadata，按預覽才取一版完整document，用此版本開場僅需既有version_id。帳號／題庫切換後遲到回應不顯示，登出清空舊預覽。舊versions API保留。
- `quiz_action`、送答、判分、計時、揭答、leaf及第一批媒體驗權函式不改。診斷識別為20261029-load-batch2，collector相容前兩版。

## 已驗證及未通過紀錄

- 舊模式55項回歸及啟用候選讀取路徑的55項回歸皆0失敗、0跳過；最後精簡摘要／索引條件調整的3項定向檢查通過。候選全套測試以 `QUIZ_TEST_READ_BATCH2=1` 在舊fixture重裝SQL後重套本批，避免名義跑測試卻只測到舊函式；新等價測試則明確關閉自動套用，真正取得舊函式別名比對。
- 舊／新錯題JSON、題組／整卷未揭答、錯誤參數、本人／他人、名冊異動、關場、版次明細、私有table/helper權限、延伸同seed選題／卷名／配比及相同request_id重送、metadata回滾／重跑等價通過。
- 真實租用Chrome確認初進及刷新不讀catalog，新detail也不讀catalog；原選項、燈箱票證、遺失回應相同ID重送只建一卷、無候選隱藏延伸、舊detail fallback、換人遲到回應隔離通過。教師清單無document，選版本不取document，預覽只取一版，換人後遲到預覽不顯示。
- 第一批整套核心瀏覽器回歸重跑通過：三／六入口、保存／重送、閱讀過快、題組延後揭答、固定下一題、手機、公式／音檔／圖表、原一葉及hidden監看規則。
- 第一個Postgres候選採三張私有摘要表，正確性通過，但30人HTTP p95 79.566→100.817ms、max268.539→334.202ms，WAL595136→750848bytes，未通過，**未部署**。保留 `bench/` 與 `three-table-candidate.sql`；不能只用教師清單改善掩蓋學生退步。
- 改為每版本一筆後，`bench-compact` 的30人通過，但首輪22人及未修改送答的p95仍未過，報告保留。pg_stat_statements顯示metadata寫入平均約1.6ms，不能把全部首輪波動直接歸因於它；未放寬門檻。
- `bench-verify` 原門檻兩輪22人＋30人全過。另補強異常多一筆答案時，保留舊detail經resume要求的整卷答案數完全相符限制；定向等價通過後，用最後SQL SHA256鎖定再跑 `bench-final`，30人及所有鎖／教師讀取檢查全過。
- 最後30人兩組各2,101答案／30葉、0非法計時一致；HTTP p95 142.740→117.028ms、max598.145→533.171ms。library／錯題清單／錯題明細DB p95分別37.094→22.589、43.960→33.655、57.695→39.116ms。送答compact bytes完全相同；學生總bytes因新增必要version_id／can_extend略增約0.09%，不是本批整體payload縮減的主張。
- 同attempt持寫鎖時錯題明細1215.80→4.91ms；同題庫保存鎖下版本清單1291.29→2.58ms。31版的30次教師清單請求19,597,950→292,950bytes（減98.5%），DB p95 428.163→26.571ms。最後30人WAL576808→603824bytes（約增4.7%）；摘要維護有寫入成本，不宣稱零成本。
- 正式Supabase更新通過：只替換原compose／wrong_questions，新增6個helper／讀取函式、1個私有摘要表及trigger。其餘17個原quiz函式逐字不變。99份固定版本／887題回填99筆摘要，含索引共270336bytes（264KiB）；anon／authenticated均不能直接讀表或執行私有helper。
- 原90份bank、99份version、122場session、94份attempt、485筆answer、30筆leaf、468筆timing、57份generated及12筆name_counter的筆數與內容雜湊前後相同。正式三／六年級既有資料的library／錯題清單／明細，以及教師版本metadata／單版document的正規化雜湊均與更新前一致；沒有正式學生送答。
- 功能commit `9147b56`，分支 `codex/quiz-load-batch2`。Vercel候選 `dpl_GFRzHXKymQ3F1iVHg8L8U2xiARhq` production／READY，先以CLI讀回20個修改／保留檔案SHA256與collector204，才promote至 `https://it-class-tcwu.vercel.app`。
- 正式239個HTML／JS／MJS／CSS／WOFF2檔案逐byte一致，三個診斷版本均204；正式來源的新錯題／教師流程及第一批核心瀏覽器回歸再次全過。這些瀏覽器使用實際已發布HTML／模組／樣式，但Auth／RPC為合成替身；正式DB則另以真實函式及既有資料唯讀比對，不混稱真人全流程壓測。
- 本批已上線，仍未據此宣稱Nano尖峰已根治。自有4391測試server於驗收後停止，瀏覽器測試分頁清理及租約釋放；舊CLI sampler仍停止。

## 證據與限制

正式程式：`supabase/quiz-load-batch2.sql`。測試：`automation/tests/quiz-load-batch2.test.mjs`、`quiz-load-batch2-browser.cjs`、`automation/quiz-load-batch2-bench.mjs`。私有證據：本獨立工作區ignored `automation/output/quiz/batch2/`，包括唯讀正式函式／索引、失敗候選、瀏覽器及每個並行批次。

並行兩邊都用第一批實際正式函式、同2,906題／220卷／180份歷史attempt／1,800筆合成歷史答案、8條連線pool；兩輪22人交錯A/B及30人，真等2.1秒閱讀，加入兩頁錯題與單題回顧、媒體／送答交錯、同attempt持寫鎖的錯題讀取，以及同題庫持保存鎖的版本清單。另量測31個版次的30個教師並行讀請求；這是合成教師讀取壓力，不代表學生有教師權限。

這些測試不是真實Google OAuth／Supabase Auth／Nano／WAN壓測，不能宣稱301底層唯一根因已根治。正式驗證有界且不代真人學生作答、不做正式30人壓測、不調付費方案或pool／timeout。

後續請在 `C:/Users/user/.codex/worktrees/quiz-load-batch1/it-class-tcwu`／`codex/quiz-load-batch2` 接續；主工作區其他dirty程式未合併，不能直接整包覆蓋本次正式版。SQL安裝順序維持原quiz／media／wrong／pool／rewards，再batch1、batch2；若重裝舊pool或wrong檔，須重套batch2，避免退回全量讀取。
