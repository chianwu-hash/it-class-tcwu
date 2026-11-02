# 三年級10卷固定解析與延伸內容包（2026-11-02，本機）

本輪補齊113、114學年度上學期期中三年級五科的固定解析與重點處理，沿用正式啟用的10個不可變版本。沒有改原題、判分、正式成績、葉片或學生進度，沒有發布。114自然沿用前輪成果，其餘9卷新增501欄解析。

## 實際覆蓋

|學年／科目|解析欄位|卷內重點|有配題|缺可靠題目／素材|配題配置次數|
|---|---:|---:|---:|---:|---:|
|113國語|59|9|8|1|16|
|113英語|49|12|4|8|8|
|113數學|63|12|8|4|16|
|113自然|41|19|18|1|36|
|113社會|52|10|10|0|20|
|114國語|64|11|8|3|16|
|114英語|49|12|3|9|6|
|114數學|54|13|9|4|18|
|114自然（沿用）|67|22|22|0|44|
|114社會|70|11|8|3|16|
|合計|568|131|98|33|196|

196是固定配題配置次數，跨卷／重點有重用；來源去重為119份書商原始題檔，不代表196道獨立原題。98組中114數學「比較方案」只涵蓋基礎大小與求差，沒有冒稱覆蓋時間／金額取捨的完整說理。

全部568欄均處理解析及學習重點；**書商延伸沒有全數完成**。缺項主要為英語原音圖、字母／數字拼寫及表格閱讀，另有畫指定長度、數線、特定短語仿寫、意義段、公告閱讀及活動階段等。每卷缺項保留具體原因，沒有開始練習按鈕。自核題不列錯題；部分自核專用重點只有教師內容試看，現有學生adapter尚無入口。

## 內容及來源處理

- 正式資料僅讀取目前啟用版本、來源與書商候選；來源PDF／解答20份及124個既有音圖資產均核實實際檔案SHA-256。沒有重新製播或上傳媒體。
- SQL JSONB會改變物件鍵順序。不能把重新序列化的結果當原始版本SHA，也不能放寬validator；以SHA找到原始有序bundle，再比較正規化物件與正式doc相等。
- 每欄保留paper、version、group、question、來源頁與官方raw。手核題沒有自動答案，必須以`expectedAnswer:null`及完全相同`reference`驗證，不假造可自動判分答案。
- 書商題保留原題及選項、原始答案、原詳解、原檔／metadata／SHA；格式轉換另記錄。新增解說及少量課文依賴題的補充閱讀均明示AI整理。補充閱讀依提供的115康軒同文教材並留SHA，不冒充113／114原書商附文。
- 113自然撤換與原卷相同／近似的草本莖、浩克火車題，根的配題涵蓋吸水與固定，磁極配題改為實際異極相吸／同極相斥，浮力補上用途。磁浮閱讀沒有拿一般磁鐵拾物硬配。
- 國語重複閱讀概念合併；短語辨識不冒稱所有仿寫均涵蓋；英語問年齡不代替數字拼字。113社會既有核准補答及英語改編／官方聽力來源如實標示，不再要求教師重審已定案事項。

## 複核與驗證

Codex獨立解題及查原件，Claude透過chat-mode唯讀複核：自然／英語、社會、數學／國語各一輪，配題三輪。保留六份run／response與雜湊；Claude實讀供給內容及部分原頁，沒有宣稱逐一自行打開全部DOCX。Codex另核對原始答案與來源位元組。無尚待表決的實質分歧，未為例行問題再呼叫AGY。

- `node --test automation/tests/past-learning-map-validation.test.mjs`：新舊schema、手核／畫圖、參考被改、答案被改、來源被改與誤標題型。
- `node automation/validate-grade3-past-learning.mjs`：10卷568欄，合成PGlite實際送出全卷、本人隔離、揭答前無解析與答案、冪等開始／送出、選重點及回同次同版本同題。188個練習欄位走錯題返程；另8個自核專用配題欄位單獨檢查作答，不冒稱已有學生錯題入口。原卷records、summary、practice前後相同。
- 教師內容頁逐欄渲染及桌面／390／360視窗驗證另留私有收據與截圖。這是內容驗收頁，不是正式學生OAuth／努力樹／手機實機驗收。
- 本輪不驗證或啟用新的延伸葉。先前正式轉接候選在另一worktree；其Vercel帳號權限403阻擋仍須處理，不可宣稱本輪內容已上線。

## 私有交付與重開

工作樹：`C:/Users/user/.codex/worktrees/past-exam-production/it-class-tcwu`。
輸出：`automation/output/past-grade3-learning-20261102/`（ignored，不隨clone取得）。

各卷包含`source-bundle.private.json`、`source-manifest.private.json`、`learning-map.private.json`、`publisher-practice.private.json`、`publisher-manifest.private.json`、`questions-and-explanations.md`及原頁PNG。整批保留`content-manifest.private.json`、`ordered-source-proof.private.json`、`publisher-source-proof.private.json`、`media-manifest.private.json`、`issues-and-limitations.md`、`claude-review-proof.private.json`、`validation.private.json`與`browser-qa.private.json`。

本機教師預覽：`http://127.0.0.1:4503/`。重開執行：

```powershell
node automation/output/past-grade3-learning-20261102/serve_preview.mjs
```

僅127.0.0.1、GET與精確檔案allowlist，沒有正式登入／學生寫入，也不呼叫外部AI。含答案，不可把這個教師頁直接公開。正式化須使用現有授權、揭答與版本流程，不能部署fixture。驗證其他私有輸出時可設定`PAST_G3_LEARNING_ROOT`，驗證器預期恰為本批10卷。

## 耗時與可重用經驗

批次起始收據為2026-11-02 12:59臺北時間；內容凍結14:02，其後另完成交付驗證及文件。總起訖與自動測試收據保存在私有輸出，不把Claude秒數當整體製作工時。沒有完整階段工時及本輪token計量，無法精算純解析成本。教師本輪未逐題投入，內容判讀／配題及複核由AI完成；缺素材如實留下，沒有用關鍵字相近來湊數。

程式適合做版本／SHA核對、候選篩選、格式轉換、覆蓋檢查與返程測試；原題語意、教材內容、學習技能相合與反例仍要離線判讀複核。下批優先復用已核實概念與原題來源，僅重核改動部分。學生端只讀固定版本資料，零即時AI。
