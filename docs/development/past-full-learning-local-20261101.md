# 114上三年級自然全卷解析、學習重點與書商配題（本機，2026-11-01）

使用者要求依新SOP補完整份，限本機驗證，不發布、不動正式學生資料。這次完成42題組、67作答欄位的固定解析，整理22共用學習重點，配44題康軒原始題庫；67欄均有重點及配題處理結果，沒有硬湊未配到的題。66個自動判分欄位可從「我的錯題」進入延伸，1題畫圖維持自核、解析留在原卷，不當成錯題或自動判對錯。

## 試用入口

[本機我的錯題](http://127.0.0.1:4497/grade3/115-1/quiz-library.html#wrong)

預先用合成學生1建立66欄錯答及1題畫圖自核，供直接挑題，並非真實學生紀錄。從「回看題目與解析」→選重點→練2題→底列「回這道錯題」，返回相同attempt/version/group/question；可重新整理接回。清單每頁20題、共4頁，也可回原卷查看逐欄解析與畫圖參考。原卷保留逐組作答與到錯題的連結，不另放練習入口。

含答案的完整教師內容總覽位於 ignored `automation/output/past-full-learning-20261101/preview.private.html`；這是本機靜態檢視，不是公開網頁或正式教師RPC。可搜尋題號／內容，展開學習重點與書商原題。學生互動仍從上述既有錯題頁進入。

## 來源與內容處理

- 原卷 `dingxi-114-1-g3-exam1-science` 沿用最新本機已發布內容快照，document SHA `f915d39c2e5cb1fb8f9adddef8e1d023c1c3c3b7f680173bc9efe69db280d78d`。原試卷、官方解答PDF各4頁重新核SHA，paper/key八張原頁實看；不重建舊整卷、不回退先前修訂。
- 保留原卷100分＝自動96分＋畫圖自核4分；既有浮力題④、隔薄紙／塑膠磁力true、輪生／乙等修訂不變。沒有更動正式題庫、學生答案／進度／歷次／葉片、SQL、Storage或部署。
- 書商來源是既有康軒115三上ISO，NA/1501/0101..0203，第一單元植物及第二單元生活中的力。原卷114、書商115，依實際考點連線，不宣稱教材年度／範圍完全相同。只抽相關1014份DOCX選44份原題；全為文字單選或是非，不需要新圖／音檔。ISO 4GB重新串流SHA驗證，44份原表3欄、metadata答案及DOCX SHA逐件驗；沒有看全44份Word排版，也不宣稱已將整片光碟匯入正式pool。
- 22共用重點涵蓋生物／設施、根形與吸水、莖、葉形葉脈及葉序、花構造與授粉、結果與種子、觀察安全與用途、受力現象、彈性、施力要素、磁極、隔物磁力、磁力比較及應用、浮力與水力。原卷解析均明示AI補充；書商原解析保留，未提供者另明示AI補充。
- s1-q13器材漏磁鐵卻既有核對O：保留核對值，說明缺件與塑膠硬幣非鐵製品，不用猜補器材替原句辯護。花圖s3-q06四欄：保留D/C/B/A原答，只中性列參考值，提醒指示線與答案對應有疑義，不依這張圖背位置；學科定義與可靠文字配題分開。這次不是正式勘誤，也沒有逐題等待教師確認。
- 非生物題最後一項、聽聲音、受力體積及鐵盒浮沉等，明示題幹範圍或條件，避免教成「生物不會死亡」「聲音與力無關」「體積永不變」「鐵製物一定沉」等錯誤通則。詳 `issues-and-decisions.private.json`。

## 程式與固定資料

新增全卷schema2解析sidecar；此schema2不是正式quiz文件格式或新migration。`past-learning-map.mjs`核對卷面hash、全部欄位、既有答案、來源證據、概念連線與自核型態；`past-learning-fixture.mjs`只在已揭答紀錄或已自核紀錄附解析。舊schema1單題格式仍可用。

`past-wrong-review.mjs`合併原有授權錯題與本卷本人已揭答correct=false欄位；先取得本人snapshot，再建立每欄詳情。保留共用題幹、原圖、選項代碼與當次回答；勾選、排序、集合、代碼、短答各自呈現，短答等價答案以「或」表示。完整來源識別防止相同qid或共用概念撞題。人工自核、答對、未答不收成錯題。

`past-publisher-practice.mjs`沿用真正schema1／quiz_action作答引擎，以本人來源作答＋版本＋題組＋欄位＋概念產生冪等練習。共用概念從不同原題開練會有各自session與返程，不誤回另一題。classroom模式不給額外葉片、不改原卷成績，延伸錯答不再遞迴收進這份清單。學生端只讀固定資料，沒有線上AI生成或即時配題。

## 驗證結果

### 測試順序與可重用證據

以下順序是本輪實際執行及補測流程，不是要求往後每卷重做程式開發。先備妥本機私有題包與測試依賴，禁止對正式服務套用合成作答。

| 階段 | 執行／核對內容 | 結果及證據 |
| --- | --- | --- |
| 原件與內容準備 | 看原卷與答案各4頁；核原PDF、ISO、44份DOCX三欄／metadata／SHA；逐欄解析連到共用重點 | 42組67欄、22重點44書商題；`source-manifest.private.json`、`publisher-manifest.private.json`、`content-manifest.private.json` |
| 舊功能相容 | `node --test automation/tests/past-wrong-compat.test.mjs` | 一般21＋考古1合併分頁20/2、篩選、詳情、原答案、舊schema1解析／配題／sourceProjection與跨人拒絕通過 |
| 代表小樣 | 全卷API腳本先提交9個代表題組，涵蓋圖文與非選、自核，再補剩餘題組 | 小樣先通過才補全卷；`sample-results.private.json`，不是先做完才追認小樣 |
| 全卷資料與判分 | `node automation/tests/past-full-learning-api.mjs`，目標為loopback4497 | 67解析、66錯題詳情、畫圖排除、22組44題正錯／重送／接回、來源及授權、原卷紀錄不變通過；`api-results.private.json` |
| 實際操作 | 取得AI Work Browser自有lease與精確target，透過共用`run-background.cjs`執行`automation/tests/past-full-learning-browser.cjs` | 9代表欄、桌面與390/360、鍵盤、原圖、44題加第二來源2題共46答；往返／刷新／登出通過；`browser-results.private.json`與截圖 |
| 複核後補測 | 依程式複核補自核型態、schema2 demo、友善欄號與短答呈現，加入原卷入口及共用概念第二來源 | 重跑相容、全卷API及完整瀏覽器；最後0初始化重試、0頁面錯誤，並非只引用修正前結果 |
| 交付檢查 | UTF-8、文件連結、固定資料雜湊、API／瀏覽器及記憶讀回收據 | `delivery-validation.private.json`；程式提交`2b0708d`，未推送部署 |

本機原圖共9檔（含自核參考），錯題詳情實際使用的原圖有7個不同檔案；兩者用途與計數不同。私有證據不在clone，重跑前先確認原件、packet與本機依賴真的存在，不以舊收據代替本次執行。

- 先9個代表題組小樣，再補42組全卷；67解析、66錯題detail、1自核排除、22重點44書商題的真正本機SQL/API均過。來源及自核標記變造拒絕，跨人、錯版、錯來源／概念、未答／正答／自核拒開練習；重送／接回及揭答前無答案過。7張錯題所需原圖授權與下載SHA過，原卷records／summary／practice深比不變。
- 一般21錯題＋1考古題合併20/2分頁／篩選／舊詳情與答案不變；舊schema1的learningReview、publisher project/start、sourceProjection及跨人拒絕也過。最初擴版把catalog缺grade當成NaN，已改成服務傳入年級；fixture學生2原本六年級的測試配置也已修為同年級後驗本人隔離，沒有改正式年級。
- 最新瀏覽器9個代表欄涵蓋單選、勾選、排序、圖示代碼、集合、短答、葉序／根圖／浮沉；1280／390／360皆無橫向溢出，原圖實際載入。22組44題加同概念第二來源2題，總46次書商作答均實點核對、混合正錯、重整接回及底列返回同一次同版本原錯題，再刷新仍一致。原卷連結實點到對應錯題、畫圖自核解析、鍵盤及登出清URL也過。
- 最新0次初始化重試、0 pageerror，522筆學生fetch只到本機固定資料服務，沒有呼叫AI。外部字型／圖示等一般瀏覽器資源不是此fetch計數的涵蓋範圍。這是合成auth＋本機PGlite與桌面模擬手機寬度，非真人OAuth、正式雲端或實體手機。
- 首輪第15組彈性頁停在初始化，沒有fetch／JSerror，單次reload恢復；原因未知。保留失敗與資源診斷，第二輪及最新完整重跑都過，沒有為此改產品或放寬判分。測試僅在無初始化、零fetch時允許一次reload，最新未用到。續作期間原工具PTY服務已停止，改以隱藏背景程序持續服務，先確認200才開新頁，非學生資料故障。

### 失敗、修正與恢復界線

| 情況 | 查明或處理 | 後續參考 |
| --- | --- | --- |
| 擴版後合併清單只有21題，預期22題 | 原catalog沒有grade，直接轉成NaN使考古題被排除；改由服務傳入年級 | 不從可選目錄欄位推定既有身分契約，修正後保留21＋1斷言並重跑通過 |
| 合成勾選題建立失敗`confirmation_required` | 測試送件缺`confirmed:true`；補完整既有提交契約 | 不刪除產品確認關卡來讓fixture通過 |
| 跨人測試回`paper_unavailable`而不是預期的attempt拒絕 | 合成學生2仍是六年級，先被年級擋住；兩名合成學生改為同年級後驗本人隔離 | 不將較早的年級拒絕誤當已證明同年級跨人隔離，不更改正式名冊 |
| 彈性練習頁初始化逾時 | 保存URL、空fetch、頁面狀態及資源診斷，reload恢復；原因未確認 | 不能斷言是題庫、授權或產品bug；最後完整重跑0retry通過 |
| 續作時4497拒絕連線、先開的分頁落在錯誤頁 | 確認服務已停止，再以隱藏背景程序啟動；待200後新開有效target | 記憶體DB會重建，需重新取得當前作答／版本，不硬用舊target或舊深連結 |
| Python工具意外重跑唯讀盤點 | `inspect.py`遮蔽標準模組，改名後新程序不再重跑 | 避免以標準模組名命名同資料夾小工具，不把工具問題當來源資料變動 |

只有上述初始化問題尚未確認根因；其餘列有具體修正與後續驗證。歷史單題試辦的記憶體不足處理另見單題報告，不能混記為本輪正式資料庫故障。

### 交給使用者試用的狀態

後續依使用者要求開啟排序題`s3-q02`「植物開花到果實成熟」，及看圖題`s3-q10-1`「辨認蔬菜軸根／鬚根」，兩者均驗到解析、學習重點按鈕，根圖實際載入。排序題留前景；沒有替使用者送出書商答案。當次網址及畫面狀態收據為`trial-opened.private.json`。

這一筆是「已開啟供試用」，**不是教師已親自完成兩題流程或已回報驗收通過**；目前沒有新的使用者試作結果。自動化46答測試和教師實測須分開記。網址含記憶體DB當次識別，關服務後以新入口重新取得，不把該收據當永久連結。

## AI複核與限制

Claude內容輪約159秒／12Read，核67欄／22重點／44書商及8原頁，無阻擋；其摘要提「30題組」與實檔42組不一致，數量依實檔，不採錯誤摘要。AGY約33秒只討論供給文字，工具邊界／canary／viewer與Git不變驗證過，沒有看圖判定勘誤。依建議中性處理花圖及其他小修文。Claude程式輪約143秒／11Read，無阻擋；實讀範圍及未讀／未跑測試如run/response記錄。Codex核實程式及所有執行結果，不把AI回覆當測試證據。

依程式輪補自核標記驗證、schema2單筆demo、友善欄號與單題標題，以及同概念第二來源、原卷入口、schema1 sourceProjection的缺口驗證，再重跑API與完整瀏覽器。預覽服務保留loopback Host／nonce與合成測試角色，圖片發網址時查本人SQL；本機圖片byte路徑及teacher測試入口不是正式認證邊界，不能把此fixture部署成正式服務。

通用正式持久化adapter、全部學校／科目的自動配題、新一輪換題、圖題／聽力延伸及正式撤回管理仍未實作。本卷所有內容雖已備妥，正式上線仍須另有授權並基於當時最新正式版本驗證。

輸出工具曾命名為 `inspect.py`，遮蔽Python標準模組而在產生結案檔時意外重跑唯讀盤點；已改名 `inspect-inputs.py`，新程序確認不再重跑。來源內容不變，未觸及正式資料。後續同類小工具避免與Python標準模組同名。

## 交付與重開

輸出根 `automation/output/past-full-learning-20261101/`：

- `questions-and-explanations.md`、`learning-map.private.json`、`publisher-practice.private.json`：可讀及結構化固定內容。
- `source-manifest.private.json`、`image-manifest.private.json`、`publisher-manifest.private.json`、`content-manifest.private.json`：原件、圖、原書商題、版本與SHA。
- `preview.private.html`、`issues-and-decisions.private.json`、`sample-results.private.json`、`api-results.private.json`、`browser-results.private.json`、手機截圖及失敗診斷。
- `timings-and-review.private.json`：實際可追溯時間與AI複核用量。上述原件、來源packet及QA均ignored，不在clone，不得假定只clone即已安裝資料。未安裝新依賴或執行Wayground完整安裝器。

在本worktree設定以下環境變數後啟動 `node automation/past-exam-local-server.mjs`；Windows背景啟動用隱藏視窗並將stdout/stderr留本機檔，先確認服務存活，不盲目再啟多個DB。

```text
PAST_LOCAL_PORT=4497
PAST_BUNDLE_PATH=automation/output/past-full-learning-20261101/source-bundle.private.json
PAST_LEARNING_REVIEW_PATH=automation/output/past-full-learning-20261101/learning-map.private.json
PAST_PUBLISHER_PRACTICE_PATH=automation/output/past-full-learning-20261101/publisher-practice.private.json
PAST_WRONG_REVIEW=1
PAST_SEED_WRONG_DEMO=all
```

PGlite在記憶體，關服務後本機作答消失；重開會有新runtime版本UUID，從不帶wrong_*的試用入口進入，不沿用舊深連結。來源內容hash不因runtime UUID改變。舊4495單題報告是歷史，本輪使用4497整合版。

## 耗時與人工

可追溯開始 2026-11-01T20:03:28.823961+08:00，結案記錄 2026-11-01T21:27:06.699696+08:00，牆鐘約83.6分鐘，**包含對話中斷及等待續作**，未逐階段計純操作工時，不能當每卷製作速度。AI複核執行時間另列；原件擷取、hash、格式及SQL／瀏覽器驗證可自動化，解析撰寫、概念連線、配題判讀與原頁目視由AI執行，沒有新增教師逐題簽核或真人全卷抽查。

22個共用重點重用44題，不替67欄各自再做一套。結案當時只彙整了AGY該次呼叫含邊界探針13,661 tokens；之後依使用者詢問，另查本聊天與兩個指定Claude session的本機用量metadata，補出以下整輪總量。仍無法可靠拆出純內容製作的邊際成本，也沒有量測新舊流程節省比例。學生線上使用不呼叫AI。

## 後補用量稽核與擴大量產評估

統計範圍為2026-11-01臺北時間20:02:54.718的全卷製作要求，到21:32:10.583整卷交付回覆；末次用量事件在回覆後48ms，納入本輪。包含對話中斷與等待，牆鐘約89.3分鐘；前述83.6分鐘是較早產生結案檔的時間點，兩者都不是純操作工時。不含更早單題MVP、後來開試用分頁或本次成本詢問。

| 執行部分 | 新輸入／快取建立 | 快取讀取 | 輸出 | 總token |
| --- | ---: | ---: | ---: | ---: |
| Codex內容、程式擴充、測試與交接 | 161,943 | 24,183,552 | 80,745 | 24,426,240 |
| Claude內容複核 | 79,752 | 348,044 | 11,663 | 439,459 |
| Claude程式複核 | 50,566 | 287,715 | 10,216 | 348,497 |
| AGY疑義討論與邊界探針 | 10,997 | 0 | 2,664 | 13,661 |
| 合計 | 303,258 | 24,819,311 | 105,288 | 25,227,857 |

快取讀取約98.38%；新輸入／快取建立＋輸出408,546。各模型用量按各自原始紀錄加總，作為量級參考，不是同一費率或實付帳單。長對話在多次呼叫裡重複帶入背景，使快取讀取累積；不能把總量當成全新內容量，也不能只用408,546宣稱快取免費。

方法：Codex取同聊天任務前後累積usage差；Claude以message.id去重並與cost-state.modelUsage token數核對；AGY取run.usage。已包含在output的思考tokens不再次加總。原始聊天、工具參數與無關對話未輸出。細節在ignored `automation/output/past-token-assessment-20261101/usage-audit.private.json`及`assessment.md`。快取分類參考[OpenAI官方說明](https://developers.openai.com/api/docs/guides/prompt-caching)，未套用API費率冒稱訂閱實付。

這次是內容與程式開發、測試、交接混合任務，**不把本次乘20當成正常量產預算**。後續可重用固定程式、自動驗證及經範圍核實的重點／配題池，使用精簡卷別製作包；只有改程式才另外審程式，AGY只處理實質分歧。另選兩份代表卷量測純內容成本是目前的建議，未經本輪記錄任務自動啟動新卷或改寫既定SOP。

目前只有本機可行性與自動測試證據，尚無正式學生使用或學習成效資料，不能宣稱已證明20卷的教育投資回報。原件、固定內容、工具開發、內容製作、模型用量與真人驗收各自留證，供後續實際比較。
