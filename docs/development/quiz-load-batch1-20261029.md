# 考前練功坊第一批資料讀取減量

使用者於2026-10-29核准依Claude三輪討論方案分批修改；本機與真正PostgreSQL的30人並行驗證全部通過後才上線。保留原保存、相同答案重送、題組／整卷揭答、防弊與一葉規則。

## 基準與範圍

- 獨立工作區 `quiz-load-batch1`，基準947fced加正式診斷4檔，正式基準部署 `dpl_5Jnyi4oDCDLTL23SHUYszmJhrfvt`。主工作區未發布的半葉、花園、身分快取及schema2不納入。
- 目錄初進頁不請求；第一次展開或錯題延伸資格需要時才取，共用進行中請求，同帳號當頁重用。更新進度不重取；失敗可重試。
- 新增 `quiz_entry_context`，僅回本人年級與可加入本卷科目／版本，不讀全部試卷進度、不建立attempt，保留先年級導向後join。
- `quiz_pool_catalog`採一次base join，未展開的base算總數／可延伸，展開單元另算單元數。保留多單元、空單元、舊題無membership、停用課程及排序契約。
- `quiz_media_access`沿用原教師owner捷徑，改呼叫私有最小驗權helper；保留本人、名冊、場次、固定版本與揭答規則，不做整份resume／leaf、不取attempt的FOR SHARE。
- 媒體使用呼叫當刻的不可變scope；同scope同URL合併、記憶體內最多45秒重用（從請求開始算），換題／版本／帳號／登出銷毀。錯題缺version_id，僅當次view合併進行中請求，不跨detail重用。
- pending不重建整題；同題成功／失敗重畫保留內容與媒體節點。整卷回顧保留全文，可視才取媒體票證；併發上限可配置，本批使用3，不宣稱為最佳值。燈箱沿用scope。
- 診斷最多每秒批次寫sessionStorage，離頁即寫；僅診斷metadata，不存學生進度。collector相容舊、新版本。教師監看隱藏停止，返回僅恢復已啟用監看，明確暫停不被恢復。
- 原 `quiz_action`、submit、計時、判分與leaf函式不修改。第二批錯題SQL全量整理、版本metadata與逐題下載尚未進行。

## 驗證狀態

- 53項本機回歸通過，0跳過，包括舊完整／compact回應、題組揭答、重送、名冊與一葉規則。
- 新SQL舊、新函式逐條比對通過：目錄JSON、未揭答／題組／整卷解析、其他人attempt、教師owner、關場與名冊異動。確認quiz_action函式雜湊不變、私有helper不可直接執行。
- 真實租用Chrome：三／六入口、原名冊、失敗同request_id重送、遲到回應隔離、pending、解析、手機、燈箱、音檔／表格／公式與10種回饋通過。作答入口library=0；題幹送答前後簽票1次；燈箱不重簽；20個回顧媒體初始只啟動1個。hidden監看17秒無新請求，明確暫停仍保持。
- 第一輪PostgreSQL A/B含兩輪22人及一輪30人，答案／葉片等價、0錯誤，30人通過；22人第二輪單次max退步，整體門檻未通過，因此未部署。當時其他瀏覽器與PGlite驗證交錯，不能斷言尖峰原因；保留原報告，不隱藏失敗。另以相同門檻隔離重測，補同attempt持寫鎖時媒體讀取驗證。
- 正式部署與最終重測結果待補。

## 證據與限制

測試程式：`automation/quiz-load-batch1-bench.mjs`、`automation/tests/quiz-load-batch1.test.mjs`、`quiz-load-batch1-browser.cjs`、`quiz-diagnostics-batch.test.mjs`。ignored證據在獨立工作區的 `automation/output/quiz/batch1/`；初輪為bench2，最後重測為bench-final。

並行使用真實本機PostgreSQL、8條連線pool、相同2,906題及220卷歷史、合成學生登入後請求、真實兩秒閱讀限制。兩組都使用現行compact，沒有把昨天已上線的payload改善重複算作本次成果。包括圖片驗權、整卷回顧及同attempt媒體／送答交錯；不是真實Google OAuth或Supabase Auth／Nano／課堂WAN壓測，不能據此宣稱301事故底層根因已根治。
