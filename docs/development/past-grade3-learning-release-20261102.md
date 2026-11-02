# 三年級10卷解析與延伸正式接線（2026-11-02）

狀態：**已正式啟用及發布**。正式讀回驗證：2026-11-02 15:37:01 臺北時間。部署`dpl_BUr4rAR7wjyiSWPgDh2VeRoQVBbC`，正式入口`https://it-class-tcwu.vercel.app/grade3/115-1/quiz-library.html#wrong`。10份原卷版本未變，568解析／98組配題開放，33缺項不開練習，既有學生資料於每次安裝／啟用交易內核實未變。

## 開放範圍與規則

- 113、114上學期期中三年級國語、英語、數學、自然、社會，共10個既有不可變版本；原題、核對答案、配分及原作答方式不變。
- 568欄固定解析、131個卷內重點；98組配196次書商題配置，來源去重119份題檔。33個重點缺可靠題目／音圖，原錯題可讀解析和原因，沒有練習按鈕；主動練習只列98個已配重點。一組比較方案明示僅基礎比較，未假稱完整取捨說理。
- 「我的錯題→解析→選重點→兩道書商練習→回同次、同版本、同題」；完整完成原卷後，滿分或自核題的已配重點也能主動練習。自核題不因而列入錯題。
- 延伸與自組5題卷共用同學生、同學期的積分池：每10道不同題1片延伸葉，答錯也算，同題跨卷／場次／選項排序／技術版本不重複。保留伺服器既有閱讀計時要求，原10題以上達60%的普通葉及原考古花各自維持。
- 從啟用後的新作答起認列，不回填既有歷史答案。不改原成績、既有獎勵、歷次、學生進度或花園門檻。長葉用既有慶祝動畫，刷新／相同送出重試不重播。

## 正式轉接與相容

沿前輪`eeb5e68`候選擴充10卷，以當時正式部署`dpl_6mgAi77pCSyWNmPZJvsd4R2Jf7j5`的781個實際來源為底，覆蓋26個公開runtime，總787檔。保留其餘761檔原SHA，不用舊Git工作區覆蓋正式後續功能。SQL與私有題包不在網站部署來源內。

`quiz_learning_maps/topics`綁定原version及source SHA；98個練習版本獨立登錄。source packet核對原位元組，SQL JSONB內容以物件相等核對，不能因鍵序不同改寫原SHA。書商catalog使用實際單一出版社，避免外包裝造成同一pool題再計分；混合出版社的包會被產製器拒絕。

資料表RLS及直接存取撤權，只有本人及已揭答／完卷來源可經RPC開練習；私有延伸場次不混入學生選卷、一般錯題、教師題庫／場次列表與學習檔案。獨立`quiz_monitor`也拒絕此類場次，backup函式對authenticated／anon撤權。既有library只列practice/self，classroom練習不列出；目前原引擎只以session_id取場，若未來增加join code等入口需同步檢查隔離。

新版API明示`learning_client:1`才併入考古錯題，未帶鍵或帶0的舊頁保留一般錯題資料契約；兩者均排除延伸錯答的遞迴收錄。年級／學期／版本與啟用前hash各有閘門。學生線上只讀固定內容，不呼叫AI。

## 驗證證據

- PGlite載入實際正式函式：10卷568欄、196次練習作答、119不同題積分，5＋5、與原pool的相同題去重、正錯送出及冪等、原10題普通葉與10朵原考古花、未啟用歷史不回填、本人／教師監看／年級切換隔離、無learning_client舊頁及教師列表。
- 真PostgreSQL逐卷交易回滾：10卷均通過。每卷合成身分／答案最後回滾，既有9張受保護學生資料表列數及內容摘要於交易內相同，合成身分沒有留存。由於管理API大小限制，拆為每卷有界交易，不降低驗證內容。
- 瀏覽器採正式runtime、合成登入及真本機SQL：10卷完整錯題返程、4組僅自核來源的主動練習、33未配重點不在主動練習、9→10慶祝與刷新不重播、原獎勵可見、登出清空、1280／390／360無橫向溢出及頁面錯誤。截圖已檢視；非手機實機或真人學生寫入測試。
- 候選：787個來源SHA1全部相合，26個實際HTTP內容逐一SHA256相合。以`vercel curl`讀保護部署，沒有關閉Deployment Protection。安裝後確認10 maps disabled、568解析、98 topics、RLS及backup／原資料表撤權；啟用前再核函式hash、10份map與98個document。
- Claude兩輪chat-mode唯讀複核，第二輪接受全部修補，沒有剩餘阻擋；run收據記錄viewer與Git前後相同。其結論不替代Codex測試，未宣稱Claude自行執行SQL或看過本輪原件。

## 安裝、部署及回復

使用者已授權驗證後發布。Vercel MCP一次性團隊連結即時顯示過期，改官方device login，由使用者完成；隔離CLI確認`chianwu-4755`及正確team/project，不更換全機原CLI帳號。CLI 65.8.0的curl會轉交global-config旗標，改以同任務的XDG設定路徑指向原隔離登入，沒有擷取token。

先安裝disabled migration，再逐卷交易登錄私有內容；每次均核既有學生資料摘要。production target候選不自動切正式網址。候選程式、SQL及內容驗證全過後，啟用精確10版本並promote同一個候選，不重建成另一份未測版本。後續不要單獨重跑舊quiz.sql覆蓋包裝層。

軟回復先關閉10份maps及`quiz_learning_settings.enabled`，再將正式alias回復原部署；不刪除作答、積分或新獎勵。新資料保留稽核，既有資料不重寫。硬回復涉及函式與其後依賴，需依當時現況另核，不能盲目刪表／還原舊SQL。

## 交接位置與限制

公開程式／文件在worktree `past-grade3-release/it-class-tcwu`、分支`codex/past-grade3-learning-release-20261102`；不要直接部署整個worktree。私有來源及證據在`past-exam-production/it-class-tcwu/automation/output/past-grade3-release-20261102/`，原內容包在相鄰`past-grade3-learning-20261102/`，不隨clone取得。

主要收據：`release-content`、`grade3-pglite-results`、`smoke-parts`、`cloud-rollback-proof`、`cloud-applied`、`installed-functions`、`grade3-browser-results`、`candidate-manifest`、`candidate-static-verified`、`candidate-verified`、`cloud-activated`及最後`production-verified`（皆private JSON）。私有資料、登入設定、含答案教師頁及fixture均不可提交或部署。

本輪操作曾遇管理API 413、單一交易`now()`與啟用時間不同於分次RPC的fixture差異、多表UNION／EXCEPT需子查詢括號，以及本機scaffold缺正式library欄位。均保留失敗收據並修正；沒有放寬資料保護或來源hash斷言。另修正延伸計數通知進入既有workspace提示列，避免多出grid row把題卡推下。
