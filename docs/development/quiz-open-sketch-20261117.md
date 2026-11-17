# 原生手寫作答保存：正式 SQL 與共同回顧已驗收

**最新狀態：使用者已恢復工作。** 共同回顧缺少他人筆跡的問題已另獲 PR #298 SQL 核准並完成正式套用、快照 live check、正式回滾與桌手機驗收，見[正式共同回顧收據](quiz-peer-sketch-review-20261117.md)。下方 SSD 暫停與缺口敘述是當時歷史收據，不能當目前待辦。整科三上數學仍未完成、未新啟用題目。

使用者已核准 PR #295 的兩份 SQL，已從 main `9f232959` 的原始 Git blob 核 SHA 後依序套用。**尚未發布前端或啟用三年級數學新題；共同回顧仍有下述缺口，不是整科完成收據。** 使用者要求於此驗收節點暫停以升級 SSD，不再開新批次。

## 正式套用與暫停收據（2026-11-17）

- `quiz-open-sketch.sql` SHA256 `48c5328e38b72c3d94bd4001a146050a1b23ab854dfd82e4cde5ae0723ec3198`、`quiz-partner-open-sketch.sql` SHA256 `5bc588eb5e51819c7ba7cf0728838985aabc5e7d171ea7b0376d1421c0e422f2`，與核准 PR 的原始內容完全一致；不能因 Windows checkout 換行不同而重寫正式 SQL。兩檔均已成功套用，**不要再次套用**。
- 已執行 `db-schema-snapshot.mjs` 與 `db-snapshot-check.mjs --live`，180函式／112表／21政策／22觸發器，`ok:true`、失敗0。只更新核准的3函式、新增2私有helper及回應容量限制；既有函式ACL／RLS保持。
- 18父來源／36原答案位置＋18手寫區完成正式既有入口的合成身分大於2000字筆跡保存、相同請求重試、自評、接回、126項回讀及課本供圖RPC；座標／顏色與原始回應完全相同。另10項跨人／跨級／無身分／私有函式及資料表拒絕通過，原學生紀錄與原開放作答逐列雜湊保持。交易全部回滾，合成使用者、場次及題庫候選均未留在正式庫。正式回滾回應重放36組桌手機亦通過；不是Google JWT登入或正式前端發布。
- 正式夥伴入口以3個合成身分驗10題：正確分配、原筆跡保存、重試、兩人核對／完成、不自動判對／發獎及非成員／代答拒絕通過。原25個夥伴資料表記錄保持；合成使用者、房間、答案與請求全部回滾並查證清除。
- **未通過項目：正式共同回顧資料沒有帶出其他夥伴的原始筆跡。** 本機瀏覽器fixture曾提供`shared[].attempts`，但正式 `partner_pilot.learning_snapshot_pre_message_media` 的 shared 投影沒有該資料；不能把fixture通過冒稱正式完整驗收。本人筆跡存答與接回可用，其他成員的手寫回顧仍待處理。恢復後先確認已揭答／成員範圍的回應契約；若需改此函式，另備SQL與驗收並取得明確核准，本次兩檔核准不涵蓋它。
- 遷移產生器另固定套用前的函式fixture並正規化CRLF／LF，可於更新正式快照後重現原核准SQL；兩份SQL內容沒有改變。這是本機產生／回歸工具修正，不是新正式函式修改。
- 最新私有證據：`approved-sketch-application.private.json`、`handwriting18-permissions-live-acceptance.private.json`、`handwriting18-formal-browser-proof.private.json`、`partner-sketch-live-acceptance.private.json`、`sketch-after-live-check.private.log`。`handwriting18-security-live-rollback.private.json`實為舊6筆回歸，已在`discarded-proof-index.private.json`明確排除，不能當18筆證據。

上述證據皆位於 `D:/AI-Work/g3math-media-live-20261117/`。正式仍1128可抽來源；708剩餘來源及另考古51未啟用。前階段119筆來源要求／技術候選與18筆手寫候選分開保留，後者因共同回顧缺口仍不能算全驗收完成。新AI0、沒有新媒體上傳或前端部署。

## 契約

- 延伸既有 `type:open`／`self-review-v1`，明確新增 `fields[].input:sketch`；每個手寫欄保存原 `version:1`、strokes 與選用 colors 物件，不塞進250字文字欄或當頁計算紙。原文字開放題、自動判分題、歷史作答原值與版本保持。
- 沿用共用 sketch editor／SVG、原外層送出與既有自評。個人按原「送出答案」一起保存，之後對照參考與檢核重點完成自評；這類題目不自動判筆跡或最後數值正確，不算自動正確率。新候選會建立新 ID／固定版本，不把舊題或既有答案改成新格式。
- 每張1～80筆、每筆1～128點、座標有限且0～1、6種既有顏色；每份回應最多300,000 UTF-8 bytes。普通文字題仍走原2000字整份／250字每欄驗證。原子保存、相同請求重試與原始JSON回應保持；空白、越界、未知欄位、重複JSON鍵及過量筆跡由後端拒絕。
- 個人接回、整份回顧與夥伴共同回顧顯示已保存SVG，避免只列「已儲存」或物件文字。夥伴仍用原送出／訂正流程，筆跡不重複顯示，忙碌／待確認時鎖畫板；畫寫期間不因重新整理狀態重建畫板。
- 暫時尚未送出的個人筆跡仍是本頁草稿；不能宣稱已雲端保存。既有夥伴儲存退出沿用原草稿契約。作圖、塗色及連線原題仍須另核題圖底板／位置，不因能保存空白畫板就算全部適配。

## 本次已核准的 SQL 範圍

`supabase/quiz-open-sketch.sql` 新增2個私有驗證helper，更新 `quiz_open_validate`／`quiz_open_submit`，擴充 `quiz_open_responses_response_check` 容量；不改 RLS 或給前端資料表讀寫權。`supabase/quiz-partner-open-sketch.sql` 接著只更新 `partner_pilot.action_core` 的原生開放手寫驗證／容量分支；原單選、數值及文字路徑保持。

兩份均有精確正式函式 MD5 baseline 守衛、3秒鎖逾時及交易；已安裝或來源不同直接拒絕。透過 `node automation/build-quiz-open-sketch.mjs` 從固定的套用前函式fixture產生；本機測試使用**完全相同的生成SQL**，不以縮小版SQL冒稱正式已驗。本次已獲核准並套用、更新production snapshot／通過live check；其他新SQL仍須另行明確核准。前端仍走 PR→main→乾淨 main 發布腳本；不得直接從候選分支部署。

## 歷史候選本機驗收（正式結果及缺口以上方收據為準）

- 32項回歸通過，含開放自評、來源格式、手寫前後端驗證、超2000字實際筆跡保存、顏色／座標原值、相同請求冪等、接回、自評、舊資料逐列雜湊保持與權限。夥伴本機10道手寫題完成所有人提交／核對／完成，原個人資料保持；不自動判對、不可替別人送答／讀非成員房間、重複遷移拒絕。
- 個人桌機1280／手機390實際滑鼠／觸控，測送達但回應遺失→同請求重試→重整接回→整份回顧→登出清空，筆跡完全一致。使用隔離 PGlite 真正保存／接回與候選共用 renderer、正式共用樣式；合成身分，不是 Google JWT 或正式庫存答。
- 夥伴桌手機同一外層送出、傳輸鎖定、原筆跡、接回／共同回顧與不重複顯示通過。瀏覽器用合成action fixture；夥伴 SQL 的實際保存另由上述隔離資料庫測試驗證，不混稱正式房間驗收。
- 先前隔離18父來源／18目標／36原答案位置已產生含18手寫區候選，原題、來源版本、圖與固定解析保留；例答沿既有固定解析與教師數值鍵，不新增AI。18筆隔離DB保存／接回與自評通過，18筆桌手機共36組原圖載入／已保存筆跡／整份回顧／無橫向溢出通過；合成筆跡只驗保存與呈現，沒有冒稱完整數學手寫評閱。尚待正式核准後存答／媒體與整科驗收；仍不能解除正式發布關卡。
- 私有證據 `D:/AI-Work/g3math-media-live-20261117/`：`sketch-browser-proof.private.json`、`partner-sketch-browser-proof.private.json`、`handwriting18-candidate.private.json`、`handwriting18-local-proof.private.json`。來源篩檢118與新手寫18分開記錄，沒有正式啟用，不減708剩餘來源及另考古51。

新外部AI呼叫0。來源、暫存與測試都留D碟；測試server與租約於finally停止／釋放，自有分頁用後關閉。C維持約15 GiB，沒有另開可見終端視窗。
