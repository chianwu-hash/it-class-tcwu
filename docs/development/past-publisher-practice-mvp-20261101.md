# 單題學習重點接書商原題：本機 MVP

日期：2026-11-01。接續[單題解析 MVP](past-exam-learning-mvp-20261101.md)，使用者要求選重點後能練習書商對應題目，先在本機試用。本輪沒有發布、變更正式題庫／SQL／媒體／學生答案／進度或給葉規則。

## 操作方式與現況

預覽：<http://127.0.0.1:4493/grade3/115-1/past-exam.html?paper=dingxi-114-1-g3-exam1-science>。

保留本機 server，瀏覽器停在第 1 題已揭答的解析，並開啟第一個重點。操作：

1. 選「生物與非生物怎麼分？」或「分清楚設施和裡面的生物」。
2. 按「練習這個重點（2題）」，進入既有網站作答介面。
3. 逐題選答、送出，看正誤與解析；重整可以接回。
4. 底部「回原題解析」回到相同原卷作答，原卷成績不變。

每個重點目前固定 2 題，共 4 道書商原題，並非整個概念題池已自動建好。相同原作答＋重點再開會接回同一練習，不會反覆生成副本；尚未加上另開一輪或換一批題的功能。這是單題合法揭答後的練習，不是完整試卷完卷後推薦系統。

新連接使用 4493；舊 4491 單題解析預覽保留。資料庫僅在記憶體內，關閉 server 即消失；重新啟動後用不帶舊 attempt 的上述網址。

## 真正使用的書商來源

現有已準備的三上自然 pool 是翰林版，共 177 題，範圍為植物、磁鐵，未找到直接對應本題的題目，因此沒有用同科題硬配。

進一步查本機既有康軒三年級原始 ISO，發現自然題庫原本就在光碟中。先前 manifest 的 subjects 只是當時處理科目，不能當成整片光碟僅有那些科目。僅讀取相關章節 128 份 DOCX，挑出 4 題；沒有將整個康軒自然匯入正式平台。

- 書商／年級：康軒 115 上學期、三年級自然。
- 原生章節：`SUBJ_CODE=NA`、`CLASS_TERM=1501`、`LESN_NUM=0101`。
- 書商章節名稱：第 1 單元「多采多姿的植物」，活動 1「植物是什麼」。
- 光碟：`01_115(1)國小三年級題庫_1008.iso`。
- 實際讀取整片 ISO 核對 SHA-256：`e5b57fa94e72c5b56d795441ae6647d7b44d971a6b09923f0b9b0902a814eaf3`，符合既存來源 manifest。
- 原考古題仍是 114 上期中康軒三自然 `s1-q01`，答案 X，不改題、不改答案；按共同概念配到 115 書商題，沒有宣稱兩學年教材或全卷範圍完全相同。

| 本題局部概念 | 書商原題 ID | 內容與核對答案 | 解析來源 |
| --- | --- | --- | --- |
| 生物與非生物 | ENA1501000378 | 不會移動的植物是否非生物；╳ | 書商原詳解 |
| 生物與非生物 | ENA1501000390 | 分辨樟樹、蜘蛛、鐵椅、小狗、百合花並計數；③／4 個 | 書商原詳解 |
| 分清設施與其中生物 | ENA1501000619 | 植物長在石縫，不讓石頭變植物；③ | 書商原詳解 |
| 分清設施與其中生物 | ENA1501000465 | 分辨一個情境是否只含生物；① | 原無詳解，明示「AI 整理，非書商原文」補充 |

每題保留原 DOCX、三欄文字（題目／答案／解析）、原題號、metadata 答案、ISO member、DOCX SHA、線上題目 ID 與答案映射。四份皆無 drawing／pict，這次不需裁圖或上傳媒體。○／╳轉 O／X、①②③④拆成固定選項，是格式轉接；學生頁沿用網站 A／B／C／D 標號，選項順序固定，raw 保留。

這兩個局部概念是依考古題整理的標籤，**不是書商原生 knowledge code**。115 書商 chapter `0101` 為來源章節，不能拿來冒充更細的知識標記。尚未將新題加入全站共用 pool／membership。

## 架構與保護界線

- `automation/lib/past-publisher-practice.mjs`：僅在 `PAST_PUBLISHER_PRACTICE_PATH` 啟用。檢查來源 paper／文件 hash／group／field，逐份 DOCX SHA；用本人 `quiz_past_action('resume')` 核對來源已合法揭答，才建立練習。
- 重用 `quiz_action` 的 save／publish／open／join／submit／resume 與 schema1 固定版本，沒有另建作答引擎。題庫及場次只存在隔離 PGlite。
- 每個練習綁定本人與原作答，額外 registry 擋住其他帳號直接 join／resume／entry_context；本人來源版本或概念不符亦拒絕。
- 相同請求冪等；相同來源作答、版本、重點的新請求也取得同一場次。並行開始共用 pending；失敗可重試。
- 原題回應只加上書商名稱、章節、題數及可練習狀態，不帶書商題目答案。進練習後由現有 SQL 按揭答規則提供核對答案與解析。
- 使用 `access_mode=classroom`，不改給葉規則；`quiz-rewards.sql` 既有邏輯僅讓 practice／self 有資格給葉，classroom 不在其中。本次 API 也確認兩題全對不給葉。不是只靠題數少來阻擋。
- `shared/quiz-past-learning-review.mjs` 顯示按鈕，`quiz-past-exams.mjs` 經既有 transport 開啟練習；回應晚到時核對登入世代／原作答，面板已關閉則不擅自導航。學生錯誤訊息使用繁體中文。
- 返回連結以同年級相對路徑、限定 paper 字元及完整 UUID 組成。`quiz-workspace.mjs` 的底列 clone 支援可選 shortLabel；未提供時仍顯示原本「回選卷」。
- 沒啟用書商包的原 MVP 沒有 concept.practice，便沒有書商練習按鈕。沒有修改正式 auth／SQL／進度路徑。

## 驗證與複核

證據：ignored `automation/output/past-learning-publisher-mvp-20261101/`。

| 檢查 | 結果／證據 |
| --- | --- |
| 來源與答案 | ISO 完整 SHA、4 DOCX SHA、原表答案與 metadata 相符；`source-manifest.private.json`、`selected-source-review.private.json`。 |
| 真本機 SQL／API | 兩概念四題正錯、開始／提交重試、接回；練習前無 answer／explanation；未答來源、錯版、錯概念及跨人拒絕；原卷 summary／practice／records 深比一致，葉片未增。`api-results.private.json`。 |
| 瀏覽器完整往返 | 兩個重點全部 4 題；混合正錯、重新整理、原卷返回；1280／390／360 無橫向溢出，pageerror 為空。`browser-results.json`。 |
| 視覺 | `source-mobile.png`、兩概念的 `*-1280.png`／`*-390.png`；Codex 目視來源入口及書商練習桌面／手機排版。 |
| Claude | CLI 2.1.289、訂閱 OAuth，session `past-publisher-mvp-20261101` 約 132 秒含 supervisor，13 Read，完成 marker／viewer／Git 前後一致；結論無阻擋本機交付。逐題比對原表 JSON 與線上 document，未親自看 Word 渲染或重算 SHA，也未執行測試。 |

Claude 回覆：`.chat-mode/sessions/past-publisher-mvp-20261101/turn-0001.response.md`。它看了來源入口與第一概念截圖，未看第二概念截圖、完整 UI diff、瀏覽器腳本及完整給葉 SQL；由 Codex 補核上述實際結果與 SQL。沒有把 AI 共識當成來源證據，也沒有新增教師逐題簽核。

工作區 `C:/Users/user/.codex/worktrees/past-exam-production/it-class-tcwu`，分支 `codex/past-exam-production`，審查基準 `8948b90b82cf17db7b96b6ecf33c92f08dfb6bee`；審查前後 Git 狀態一致，Codex 之後才補中文錯誤訊息及文件。原 `tmp/` 未追蹤檔保持原樣。已沿原記憶鍵 `考前練功坊-考古題前處理-cian請益` 更新並讀回全文比對，歷史保留；`memory-verified.private.json` 為收據。

第一輪瀏覽器選到了被既有 CSS 隱藏的 hero 返回連結，未能點擊；實際可見連結是底列 clone，且原碼會固定改寫「回選卷」。修正可選 shortLabel，並改用真實底列點擊後，兩組完整重驗通過。保留失敗紀錄 `browser-failure.json` 與較晚的成功收據，不把失敗寫成成功。這不是 auth／判分修正。

測試是合成帳號＋本機真 SQL，不是正式 OAuth、正式 Storage 或實體手機。這四題均為純文字，不代表圖片／聽力題的延伸也已通過。沒有完整開工計時，不以 Claude 秒數當總製作工時。

## 重開與交接

在本工作區設定：

```powershell
$env:PAST_LOCAL_PORT='4493'
$env:PAST_BUNDLE_PATH='automation/output/past-exams-autoreview-20261101/dingxi-114-1-g3-exam1-science/bundle.private.json'
$env:PAST_LEARNING_REVIEW_PATH='automation/fixtures/past-learning-g3-science-q01.json'
$env:PAST_PUBLISHER_PRACTICE_PATH='automation/output/past-learning-publisher-mvp-20261101/publisher-practice.private.json'
node automation/past-exam-local-server.mjs
```

API 測試：`automation/tests/past-publisher-api.mjs`，使用相同 packet 環境變數；可用 `PAST_TEST_ORIGIN` 指定本機網址。瀏覽器測試：`automation/tests/past-publisher-browser.cjs`，需取得新 AI Work Browser lease 與精確 target，透過共用 `run-background.cjs` 執行。已結束的自動化連線及 lease 釋放，保留頁面與 server 供使用者試用。

本機 packet、DOCX、ISO、metadata、QA 不在 clone 中。來源 packet 在 ignored 輸出內，啟動時會查原 DOCX SHA；不能只 clone 後宣稱資料已安裝。唯讀來源查證及選題腳本 `inspect-source.py`／`prepare-packet.py` 亦為本次私有作業證據，不是通用出版社匯入器。未安裝新依賴，也未執行完整 Wayground 安裝器。

## 尚未實作

全卷概念推薦、通用書商知識對應、自動挑選不同題目／新一輪練習、正式來源映射表與 RPC、撤回／勘誤的跨版本管理，以及圖表／聽力題的延伸，都仍須另做。正式化前應以當時最新正式程式及既有資料契約為基準，不能把這個本機合成 auth 服務直接部署。
