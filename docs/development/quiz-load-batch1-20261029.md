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
- 最後隔離重測 `bench-final` 保持原門檻：兩輪22人與30人全過；每組741筆答案、52葉、0筆非法計時完全一致。30人HTTP p95 264.822→149.076ms、max 551.845→216.441ms；同attempt持寫鎖時媒體驗權1213.06→1.49ms。全部樣本目錄DB p95 61.681→16.264ms、媒體37.389→25.533ms，總bytes約減15.3%；兩邊compact送答bytes完全相同。第一次尖峰未再出現，但不把它直接歸因於背景測試。
- 正式Supabase更新成功，只替換catalog／media_access、新增entry_context／私有media_visible；其他15個quiz函式逐字未變。94 attempts、485 answers、30 leaf_awards、468 timing、57 generated_papers的筆數與內容雜湊前後一致。新entry只開放authenticated，兩個私有helper均不能由authenticated／anon直接執行；三／六年級正式資料唯讀smoke通過，沒有正式學生送答。
- 功能commit `37017eb`，分支 `codex/quiz-load-batch1`；Vercel候選 `dpl_HGZTE2a2yduoYvKdi9tu6YiwTsqb` production／READY。先以CLI讀回24個修改／保留檔案SHA256及collector 204，才promote；正式 `https://it-class-tcwu.vercel.app` 已確認指向此版。
- 正式網址239個HTML／JS／MJS／CSS／WOFF2檔逐byte雜湊一致，舊／新診斷版本均204；正式來源的完整合成瀏覽器回歸再次通過。此瀏覽器使用實際發布HTML／模組／樣式，但Auth／RPC為合成替身；正式資料庫另以真實函式與既有資料唯讀檢查，不把兩者混稱真人全流程驗證。
- Vercel連接器404後使用已核對帳號／team／project的CLI；curl子命令會誤把--scope傳給curl，使用已核對 `.vercel/project.json` 的目錄與明確deployment ID讀回。沒有改用其他專案或帳號。

## 證據與限制

測試程式：`automation/quiz-load-batch1-bench.mjs`、`automation/tests/quiz-load-batch1.test.mjs`、`quiz-load-batch1-browser.cjs`、`quiz-diagnostics-batch.test.mjs`。ignored證據在獨立工作區的 `automation/output/quiz/batch1/`；初輪為bench2，最後重測為bench-final。

並行使用真實本機PostgreSQL、8條連線pool、相同2,906題及220卷歷史、合成學生登入後請求、真實兩秒閱讀限制。兩組都使用現行compact，沒有把昨天已上線的payload改善重複算作本次成果。包括圖片驗權、整卷回顧及同attempt媒體／送答交錯；不是真實Google OAuth或Supabase Auth／Nano／課堂WAN壓測，不能據此宣稱301事故底層根因已根治。

工作保留在 `C:/Users/user/.codex/worktrees/quiz-load-batch1/it-class-tcwu`，主工作區的未發布修改未混入；後續修改／發布應先讀此分支及交接，不可從仍含舊實作的主工作區直接整包部署。測試static server在驗收後停止，瀏覽器租約釋放；舊CLI sampler保持停止。
