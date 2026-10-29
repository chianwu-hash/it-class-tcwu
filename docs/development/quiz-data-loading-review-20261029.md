# 考前練功坊：完整資料讀取檢視與Claude三輪討論

日期：2026-10-29。使用者要求完整檢視模組，避免載入過量資料、只取必要資訊，並先與Claude討論再動手。本輪完成讀取路徑盤點與設計討論；沒有修改或部署產品、SQL、設定或學生資料，沒有壓測或功能驗收。

## 結論

應同時減少**不必要的回傳、重複請求、資料庫重算與持鎖時間**。小JSON不代表後端便宜，前端分頁也不代表SQL只處理那一頁。

最值得先改的是：

1. 自組卷目錄按需載入，後端同時改一次彙整，避免只是把整班重算延後。
2. 作答頁不用整份選卷清單確認身分，改拿最小的身分／年級／本卷顯示資訊。
3. 同一題在送答前後不要重複申請相同圖片票證；票證只在當頁、同一授權情境內短效重用。
4. 圖片驗權不應為拿一個網址而做整份resume、解析投影及獎勵檢查。
5. 下一批處理錯題內部全量整理、選卷版本中繼資料與教師版本歷史。

保留已有的compact送答、錯題20筆分頁、固定版本、雲端接續、揭答、防弊及原一葉規則。暫不全面改成逐題下載，也不直接改增量reviews或刪除授權檢查。

這些是從程式確認的成本放大點，**不是已證實301事故唯一底層根因**。主機CPU／swap／儲存與平台排程的先後仍未釐清。

## 檢視基準與證據

- 正式前端：947fced加4個診斷檔，對應`dpl_5Jnyi4oDCDLTL23SHUYszmJhrfvt`的已驗收發布包；排除工作區尚未上線的半葉、花園、身分快取及schema2。
- 後端：本輪透過已登入Supabase頁面，直接唯讀取得19個正式SQL函式定義。沒有再次執行會初始化管理登入角色的CLI快照。
- Edge與Worker：依947fced原始碼檢視，沒有向雲端逐byte核對；不能把repo分支或環境變數猜測當正式現況。
- Claude Code 2.1.289，訂閱OAuth，chat-mode supervisor；三輪皆completed，同Claude session，觀看器啟動與完成標記均已核對。Claude只有Read／Glob／Grep，未獲Shell、網路、憑證、寫檔或再派代理權限；讀取工具不等於OS路徑隔離。
- 凍結證據repo共101個初始證據檔，`master`／`5494446b6fc39a83c9953d333d2c28bee478a723`；三輪前後Git狀態均乾淨且HEAD相同。Codex在寫結果文件前另驗主repo HEAD及status與討論前一致。
- session：`20261029-quiz-data-audit-1793241037245`；Claude session：`7b4cd721-f2fc-42dd-8d37-1fb9e267df1a`。原始往返與run在ignored `.chat-mode/exchange/<session>/evidence/.chat-mode/sessions/<session>/`；驗證摘要在ignored `automation/output/quiz/diagnostics-20261029/module-review-validation.json`。

## 完整讀取流程與必要資料

下列位置以凍結正式來源為準，本機dirty檔案未必完全相同。

| 流程 | 現況與已確認成本 | 此刻需要的資料／處置 |
|---|---|---|
| OAuth返回、navbar | 原有SDK session；導覽列用本人名冊RPC；同帳號事件已有去重 | 保留既有登入與名冊核對。SDK getSession多半是本機讀取，不能每次算成Auth網路請求 |
| 選卷初載 | `quiz-library:110,121`讀全清單，再呼叫catalog，組卷表單仍收起 | 先顯示清單與進度；目錄等展開時才讀 |
| 自組卷目錄 | 正式資料重建約4.2KB，5科21單元22角色；每人重算各科單元／總數／可延伸性 | 同頁同版本成功讀取後復用，後端一次base join再分別彙整 |
| 更新進度／返回 | 更新按鈕直接傳MouseEvent給load，refreshComposer缺省為true；返回頁面也重跑 | 更新進度不重抓靜態目錄；這不是JS解構例外 |
| 老師卷／我的卷、科目篩選 | 已只在前端切換／篩選 | 保留，不加新請求 |
| 組卷／組卷成功 | 後端已先做一次本人作答次數快照；有request_id冪等；成功後不重抓catalog | 保留現有抽題／配比／新卷清單新鮮度。候選排序是否另優化須再量測 |
| 作答入口 | `quiz-student:69–76`取全部可見卷，僅用role、grade、本卷subject | 用薄entry_context，不算其他卷進度，也不建立attempt |
| join／resume | 回整份無答案document、本人responses、已開放reviews與leaf；重新進頁會再join | 第一波保留，不能說整個attempt只join一次。是否分段取題先量測 |
| 看題／送答 | view_question記錄閱讀起點；compact已省document，但仍帶累積responses／reviews | 保留防弊及compact；不為少一次請求就刪計時，不先改增量回應 |
| 畫面重畫／媒體 | pending、成功、錯誤render重建DOM，`quiz-render:90`立即申請票證；沒有in-flight合併 | 同情境同URL合併，保留仍有效的媒體節點與票證；懶載圖片屬性不等於延後驗權 |
| 媒體後端 | 正式`quiz_media_access`為驗一個URL，呼叫完整resume，持本人FOR SHARE並做文件／reviews／leaf | 獨立最小授權投影，保留原本人／名冊／版本／揭答規則，避免整份投影及不必要列鎖 |
| 整卷回顧／燈箱／音檔 | 整卷一次渲染全部媒體；燈箱再簽票；音檔preload=none仍會先取票 | 保留完整回顧，分段／可視才啟動驗權，併發可配置並實測；有效票可重用，音訊切題仍須停止 |
| 錯題清單 | 回傳20筆合理，但SQL先jsonb_agg全部符合條件的items，再算facet／count／分頁 | 先限定本人、答錯及可揭答範圍，再按頁找題目；不是只把JSON再縮小 |
| 錯題明細／延伸 | detail先全量items，再整份resume，最後只取一題；延伸交易內又重用detail | 一題最小投影，並回can_extend；共用同一套可靠來源與揭答資格判斷 |
| 努力樹／leaf | rewards專用清單已較合理；媒體resume仍經leaf純讀分支 | 只先從媒體路徑移除無關leaf工作；join／resume／submit發葉與讀取語意先保留 |
| 教師版本／預覽 | versions一次回所有完整document；預覽按下才啟動媒體；存檔／匯入驗證loadMedia=false | 第二批改版本清單只傳metadata，選中才取一版。預覽並非開頁就自動簽全圖 |
| 教師監看 | 顯示時8秒輪詢；hidden只多延8秒，仍會發請求 | 隱藏時停止，由已啟用監看的可見狀態恢復；不對所有頁面加入refocus重載 |
| 診斷 | 每事件序列化最多300列並寫sessionStorage；collector送Vercel | 批次／防抖記錄；原每分鐘CLI角色初始化快照已停，不能重啟舊流程 |

補充：三年級quiz navbar已有quizMode提早返回，不讀週次可見性；一般課程首頁讀week_visibility的負載不能全算成quiz模組發出的請求。`quiz-workspace`只做排版，沒有新資料請求。

## 分批修改方案

### 第一波A：降低重複請求與觀察干擾

- catalog第一次展開才載入；共用in-flight promise，同頁同帳號同版本成功讀取最多一次。更新進度不重算；失敗仍可重試。
- 錯題延伸不能因catalog未載入就消失：過渡期間，打開錯題明細時才ensureCatalog；暫時讀不到時由後端按原規則判斷，顯示可理解的錯誤，不能錯藏仍可用功能。下一波用detail的can_extend解除依賴。
- 媒體以呼叫當刻的不可變context合併請求。pending不重建整題；成功只補新揭答內容，保留有效題幹／選項媒體。
- 整卷回顧可視才取媒體票證，設定可配置併發上限；不先斷言4或6最適合。原文、題組與回顧內容都保留。
- 診斷寫入改批次；教師hidden真正停止輪詢。

### 第一波B：直接減少已定位的DB工作

每項可獨立驗證與發布，不把大型結構遷移混在一起。

**catalog一次彙整**：保持現有函式簽名／JSON契約。先從未展開的base算total及extension_available，再從unit_ids展開算各單元數；一題多單元不可重複算total，空unit_ids也不可被漏算。保留無membership舊三上數學fallback、total=0科目排除、coalesce(knowledge_reliable,true)、科目及數字單元排序、頂層數學欄位與name_characters。版本快照表留下一波。

**薄entry_context**：由受控action或RPC共用private身分helper；不把私有helper開放給客戶端。回role／grade及可見本卷的subject／version_id，不讀其他卷進度，不建attempt。先保持原年級導向再join；教師／非名冊限制不能改。可見性須對齊join而非library：classroom不在library清單卻仍應可進；已從自組清單移除但既有連結仍可接續的行為也要保留。場次不可見時不洩露subject／version，仍提供本人role／grade讓原導向先完成，再由join維持原錯誤處理。

**媒體最小helper**：只驗本人attempt、名冊、session、版本及URL是否在當下允許內容中。題幹／材料／選項按原規則；解析必須符合原題組或整卷揭答。保留教師owner捷徑。不只驗asset owner／version就放出所有解析，不投影整卷，不跑leaf，不取本人FOR SHARE。helper不對外授權執行；須與原resume逐條做權限等價比對後，才可判定能移除此讀鎖。

### 第二波：避免清單與單題操作的全量重算

- 不可變版本的題數、title、catalog在固定版本／組卷時產生metadata，減少清單反覆展開大document。
- library依預設卷與本人自組卷規劃查詢；若再分頁，須另外保留繼續練習候選、總數、篩選與新卷定位，不能只截斷前N筆就稱完成。
- wrong list先篩選再做必要投影；detail只查那一題，回can_extend及version_id，延伸共用新判斷。
- 教師versions改metadata清單＋選中取一版；預覽保留按需載入。
- 正式索引尚未本輪核實；先用EXPLAIN與同負載比較，再決定是否補索引，不依程式外觀就新增。

### 暫緩、先量測

逐題／分段取題、增量reviews、批次簽票、Edge改本地JWT驗證。這些牽涉額外往返、固定版本、揭答、新舊客戶端與斷線恢復；目前不列第一批。也不改題目內容、動畫外觀、半葉或花園。

## 三種重用邊界

| 資料 | 可接受方式 | 必須處理 |
|---|---|---|
| 靜態教材目錄 | 當頁記憶體；將來可用版本快照 | grade／catalog revision；教材、角色停用時失效。不能把學生資格一起永久快取 |
| 本人進度與錯題 | 當頁短時間重用；手動更新仍重查 | user、attempt、version、generation；換人／登出清空，送答／組卷／移除後更新；不得localStorage或sessionStorage存進度 |
| 媒體票證 | 記憶體內短效、同key共用promise | 完整key包含user、session、attempt、version、原URL、授權世代；失敗不快取，先捕捉context，不讀稍後被改寫的全域attemptId |

票證實際有效期不能混用：repo的Drive為300秒、Storage fallback為60秒；雲端分支尚未核實。以真實expires_at留安全邊際，缺少可確認期限時採保守短期限或不跨畫面重用，不延長已發票的壽命。既有票證本來就無法在發出後立即撤銷，不承諾快取會帶來即時撤銷。

舊wrong detail缺version_id。第一波只在當次不可變view context做in-flight合併，不跨detail借用結果；返回清單、換人／登出銷毀。第二波補version_id後才使用完整key，不為湊key額外查一次資料。renderer的新resolver參數採opt-in並保留舊預設，避免影響scored／practice與教師預覽。

## 驗收門檻（尚未執行）

1. 初進選卷catalog=0；同頁同版本成功最多1次，更新進度不重抓；錯題延伸不被誤藏。
2. 作答入口整份library請求=0，仍保留年級導向、科目樣式、classroom、非本人／錯誤連結及教師拒絕；不額外建立attempt。
3. 同完整context同URL的並發簽票=1；仍有效的票證不因busy／成功重畫而重簽。整卷回顧不一次同時啟動全部媒體。
4. catalog在含多單元題、空單元、缺membership、停用課程／角色等資料上JSON深比等價；媒體／wrong投影在未揭答／題組／整卷、他人attempt、關場及移除清單後等情境權限等價。
5. 同request_id遺失回應重送只保存一次；帳號切換舊回應／舊票不進新畫面；關場後新答案拒絕、既存答案可回看；原閱讀防弊與一葉規則不變。
6. 每階段比較請求數、回應bytes、DB p50／p95／max、pool wait、鎖等待、每URL簽票數；本機真正Postgres以同資料跑30人並行，納入圖片題、整卷回顧及同attempt媒體／送答交錯。
7. 合成登入完成後的並行測試不等於壓過Google OAuth或正式Nano。正式驗證有界、不做未授權全班壓測；不再用「下課後單人正常」推斷根治。
8. 舊客戶端、三／六年級、legacy scored／practice與原共用navbar／auth／進度契約都需回歸。

## 覆蓋、修正與限制

- Claude讀取了學生、教師主要資料入口／控制器、render／media／transport、Auth與navbar、19函式中主要資料／授權／判分路徑、Edge handler與簽票、Vercel collector等。Codex另核對Worker repo邏輯、教師初始化／匯入與驗證、week-visibility、動畫中的網路相關位置。
- 沒有逐項重審所有動畫SVG、所有舊週頁、完整第三方supabase-js內部鎖、正式索引及Edge／Worker雲端byte與環境設定。資料路徑檢視不等於全站功能／安全驗收。
- 已修正Claude首輪的過度說法：不是每張票固定7個DB查詢；catalog的exists可提早停止，不能說固定15次全掃；join會在重新進頁重做；約3.7KB/次是先前本機合成A/B，非304課堂實際封包；不能單憑揭答通常單調就宣稱跨人快取安全。
- 沒有採用「純前端移除library但暫時失去subject」方案，也沒有採用直接暴露private身分helper、跳過view_question或直接放寬媒體權限的方案。
- 三輪都是設計審查，沒有執行新測試或新量測。完成的是檢視與共識；實作、測試及正式主機根因認定仍待後續工作。

相關紀錄：[301課後查核](quiz-301-bottleneck-findings-20261029.md)、[昨天效能發布與限制](quiz-performance-20261028.md)。
