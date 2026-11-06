# 教師檢視學生目前努力樹

狀態：已實作與本機合成驗證；尚未合併、套用正式 SQL 或發布。

## 使用流程

教師後台「學生個人學習檔案」選學生，帳號對應確認後，個人摘要上方出現「查看目前努力樹」。開啟獨立分頁，顯示名冊姓名、班級座號、課程、資料時間、花葉、來源與場景資訊。可手動重新讀取、分區查看樹冠、點花葉看來源。

入口為 `my-tree.html?teacherView=1&course=grade3-115-1&class_code=301&seat_no=1`；網址參數不是授權。三、四、六、九年級 115 上課程均經同一教師 API 驗權；未連結或對應衝突不顯示。此範例為合成座號。

## 與學生場景共用

- 第一級直接使用 `my-tree.html` 原本的 HTML、CSS、樹圖、花葉 renderer；教師路由在學生初始化前分流，不建立 `createGardenUpgrade`。
- 第二級直接使用 `garden/stage.html` 與原本寵物、小窩、動畫、來源互動。只傳入既有成果與已儲存配置，關閉隨機驚喜／探訪次數流程。
- 週次、基礎英中打里程碑、延伸葉、一般練功葉、考古花與夥伴紀念葉花沿用學生端 adapter 和穩定 reward ID。把 `quizTreeData` 與測試體驗資料的純轉換抽成共用函式，原學生網路流程不變。
- 保存的成長排序保留已移除獎勵的空位，新成果只在本次視圖補到尾端，不寫回排序。
- 成長資料版本過舊或從未同步升級時明示待學生端同步；教師不替學生遷移或升級。
- 學生的個人花色目前只存該裝置的 localStorage。教師採「學習來源配色」並明示限制，不讀教師裝置的花色冒充學生設定。寵物的隨機位置及即時天氣也不是遠端截圖。
- 教師來源說明不提供會開啟學生作答／交作業流程的操作連結；可讀來源文字。

## 唯讀與權限

新增 `public.admin_learning_tree(text,text,jsonb)`，程式位於 `supabase/admin-learning-tree.sql`。僅 authenticated 可執行，函式內仍要求已登入且 `is_teacher()`。只接受固定課程、班級、座號；重用 `admin_learning_rewards('garden_status',...)` 的參數白名單與名冊驗證，再於伺服器解析唯一已驗證帳號。

API 直接 SELECT 既有進度、獎勵、成長、選用寵物與樹型資料。不使用 `set_config` 假扮學生；不呼叫學生 `garden_growth`、`garden_companions`、`garden_tree_skin`、`garden_pet_visit` 或 `quiz_rewards`。不回傳學生 UUID、email 或其他成員的紀錄內容；夥伴紀念只取標題與已入帳數量。

登出或切換帳號會同步清空樹、iframe、來源及身分；AbortController 與 epoch 阻擋晚到回應。服務錯誤顯示無法讀取，不偽裝為零成果。手動重新讀取亦先清除舊畫面。

SQL 使用短 lock/statement timeout 與 `CREATE FUNCTION`，若函式已存在會停止，不覆寫另一份實作。沒有資料表變更，也沒有任何學生資料更新／刪除。

## 驗證結果

2026-11-06，本機合成資料：

- Node／SQL 41 項通過：新教師 reader、來源模型、名冊與角色隔離、對應衝突、拒絕任意 UUID、目前正式 reader 相依函式、夥伴來源最小投影、花葉原流程、後台唯讀與活動解析回歸。
- 新 reader 執行前後，public 與 partner_pilot 全部資料表的內容指紋一致；包含已存成長狀態，不消耗首次動畫的 seen_at。
- 瀏覽器 19 項通過：教師個人檔案入口、第一級花葉來源、第二級 cat/dog/rabbit × a/b 樹型、素材載入、390px 無水平溢出、切換學生立即清空、登出阻擋晚到結果、讀取失敗不假報零成果、只呼叫教師 RPC、無未捕捉例外。
- 真實 Google 教師登入與正式學生正向資料尚未驗證；需正式 reader 核准套用後補測。三、四、六、九年級來源語意沿用現有固定課程 adapter，瀏覽器合成場景主要使用三年級。
- 初次同時啟動三個舊 PGlite suite 記憶體不足，改用 `--test-concurrency=1` 全部通過。舊活動測試缺年級共用 helper／metadata／library_visible，已只補本機 fixture，相同案例復跑通過，未改正式權限邏輯。
- 首次背景瀏覽器工作未順利完成，停止自己註冊的 worker 並釋放租約；重跑啟用自己的精確目標分頁後通過。兩次均由租約工具清理本次暫存分頁，未操作既有分頁。

測試命令：

```powershell
node --test --test-concurrency=1 automation/tests/admin-student-tree.test.mjs automation/tests/admin-learning-readonly.test.mjs automation/tests/admin-learning.test.mjs automation/tests/admin-learning-activities.test.mjs automation/tests/admin-learning-rewards.test.mjs automation/tests/partner-keepsake-display.test.mjs
```

瀏覽器腳本 `automation/tests/admin-student-tree-browser.cjs` 只啟動 localhost 合成服務與假登入模組，須透過 `ai-browser-launch` 租約及 `D:/ai-browser/run-background.cjs` 執行。證據在本 worktree 的 ignored `.chat-mode/evidence/teacher-tree/`；不含正式學生資訊。最後補上的狀態 live region 與第一級圖檔失敗診斷已一併重跑瀏覽器驗證；延遲回應案例確認請求仍在途時登出，再驗證資料沒有回填。

## 待核准後的發布順序

目前只有實作授權，尚無本側邊對話的正式 SQL 套用／發布授權。依 AGENTS.md 先請使用者同意，再依 main 發布規則進行；不要拿主對話舊核准代用。

1. PR 複核與合併進 main；從最新 origin/main 建乾淨工作區。
2. 使用者核准後，只套 `supabase/admin-learning-tree.sql`，不可重播舊 SQL。
3. 更新 production snapshot，跑 `db-snapshot-check.mjs --live`；快照經 PR 進 main。正式教師／非教師拒絕與名冊正向來源查詢驗證須補做。
4. 再建乾淨 main 工作區，依 start/deploy/promote 發布腳本流程，完整樹比對 ok:true、正式 ID 未異動，鎖衝突停止。
5. 正式資產與教師實機驗收；handoffRow 經 PR 登記。完成發布與證據封存後，依 SOP 清理自己的已完成工作區。

若需回復，先回復前端發布，再經授權移除這次新增的教師 reader；學生 API、獎勵與學習資料不需回復，因本功能沒有改寫它們。
