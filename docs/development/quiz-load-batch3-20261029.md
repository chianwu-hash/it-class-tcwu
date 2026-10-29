# 考前練功坊第三批：抽題、學生試卷組裝與教師監看

使用者授權第三批於本機測試及真正 PostgreSQL 的 30 人並行驗證全部通過後上線，保存、相同答案重送、題組／整卷揭答、防弊與原一葉規則保留。

## 範圍與契約

- 基準為第二批正式 `dpl_GFRzHXKymQ3F1iVHg8L8U2xiARhq`，功能 `9147b56`／文件 `f5c2c68`。沿既有獨立工作區開 `codex/quiz-load-batch3`；主工作區其他未發布內容不納入。
- `quiz_compose` 一次篩選可用課程／單元／可靠延伸候選，只保留題號、題組、單元、知識點、難度、歷次曝光及原 md5 排序。保存在本次函式呼叫的私有 composite array，不新增永久學生快取或題庫副本。每次選題只掃輕量候選，更新已選題組／知識點／單元計數，最後才取中選題目本文。
- 原曝光次數、知識點平衡、單元 JSONB 相等、延伸難度距離與 md5 排序不變。單元使用 JSONB dense_rank 分桶，保留數值格式差異下的 JSONB 相等語意。三難度配額、缺題補足順序、題組去重、課程／來源可靠性、命名亂數與相同 request_id 的既存重送不變。
- `quiz_student_document` 將來源題目展開一次，依固定 question_order 與 option_orders 組裝；保留同題號第一個來源、重複／缺漏順序的舊行為。仍明列 id／type／prompt／block_id／material／options 白名單，選項只含 id／content，不以刪除答案欄位方式過濾。
- 新 `quiz_monitor` 限已登入教師且場次為本人所有。先限該場 attempts，一次彙整 answered／last_submitted_at，保留原 status、學生資料與排序。前端 monitor 改走此 RPC，舊 `quiz_action('monitor')` 留供舊頁使用；教師關場及可見時每 8 秒／隱藏停止／手動暫停行為不改。
- `quiz_action`、保存、判分、計時、防弊、題組／整卷揭答、leaf、媒體授權及版本／錯題讀取函式維持原定義。沒有逐題下載、增量 reviews、批次媒體票證、Auth／Edge 改造、半葉／花園或 schema2。
- 診斷 release 改為 `20261029-load-batch3`，沿用批次持久化與既有採樣，不增加 Supabase 診斷寫入。collector 相容既有三版及新第三批。

## 驗證方式

- 完整候選模式回歸：58 項、零失敗、零略過。測試載入器只用一層升級重套，避免舊 fixture 重裝後覆蓋第三批。
- 新舊差異測試比對整份 JSON：三難度／5、10、20 題／稀疏補題／題組去重／固定命名與重送；學生亂序、題組、重複、缺漏與秘密欄位；教師空場、30 位學生、保存後、關場後、權限及重套。
- 既有候選模式回歸涵蓋三難度 5／10／15／20 題、曝光次數、跨科可靠延伸、保存／相同答案重送、重入、題組／整卷揭答、媒體、計時、防弊、一葉及 29 位學生名額競爭。
- 真正 PostgreSQL 17.6，兩個隔離本機資料庫，pool 8、shared_buffers 64MB；兩組均套第二批實際正式函式，僅 optimized 多套第三批。2,906 題、歷史試卷／1,800 筆歷史答案，兩輪 22 人及 30 人交錯 A/B，實等每題 2.1 秒，不繞過防弊。另有 30 人教師監看、學生持寫鎖時監看、學生試卷純投影及競爭檢查。
- 本機與正式來源 Chrome 使用真實產品 HTML／JS／CSS，Auth／RPC 為合成 fixture；覆蓋保存失敗、同 request 重送、揭答、換人、行動版、原一葉回饋、目錄按需、錯題延伸及新 monitor 路由。
- 首輪並行紀錄保留於 ignored `automation/output/quiz/batch3/bench`：30 人延遲未過，主機可用記憶體下降並出現磁碟流量上升；另外純投影量測腳本的 JSON 陣列參數序列化錯誤導致報告未完成。修正量測參數後，重新完整比較，不降低原延遲門檻。發行門檻使用 `bench-verify/report.json`。

重現：

```powershell
$env:QUIZ_TEST_READ_BATCH3='1'
$env:QUIZ_BASELINE_SQL=(Join-Path (Get-Location) 'supabase/quiz.sql')
node --test --test-concurrency=2 automation/tests/quiz*.test.mjs
node automation/quiz-load-batch3-bench.mjs --baseline-dir supabase --deployed-functions automation/output/quiz/batch2/sql-after.json --runtime D:/projects/it-class-tcwu/tmp/quiz-bench-runtime/package.json --output automation/output/quiz/batch3/bench-verify --pg-port 55442 --rounds 2
```

基準備份、授權題庫、資料庫、瀏覽器截圖及詳細量測均只留 ignored automation/output，沒有提交學生或授權題庫內容。這些驗證不等於 Google OAuth、Supabase Auth、正式 Nano 資源／教室網路壓測，不能據此宣稱 301 班底層瓶頸已根治。

## 發布狀態

- 最終 `bench-verify/report.json`：正確性與全部 15 個效能／回應契約門檻通過，2,697 答案／52 葉一致、沒有低於兩秒的接受計時。兩輪 22 人及 30 人皆零請求錯誤。

| 本機量測（毫秒） | 第二批基準 | 第三批 |
| --- | ---: | ---: |
| 第一輪 22 人 HTTP p95／max | 266.462／931.033 | 168.478／322.451 |
| 第二輪 22 人 HTTP p95／max | 167.064／252.748 | 182.989／215.605 |
| 30 人 HTTP p95／max | 290.928／847.712 | 199.320／247.919 |
| 組卷 DB 階段 p95（37 次） | 678.858 | 277.536 |
| 組卷 PostgreSQL 平均執行時間 | 313.60 | 68.46 |
| 30 次教師監看 DB 階段 p95 | 40.631 | 10.077 |
| 單獨試卷組裝查詢 p95（90 次） | 6.635 | 6.749 |

第二輪 22 人 p95 稍升，仍在原非退步門檻 `基準 × 1.10 + 3ms` 內；沒有宣稱每次請求都變快。單獨組裝量測含往返與結果解碼，時間大致持平，這項主要確保來源只展開一次、白名單與固定順序完全等價。教師監看回應位元組相同，學生 join／resume 與 compact submit 位元組也相同。

- 功能提交 `29539cd`。正式 SQL SHA256 `b0eafeeafb00b033ebdb5cb01d66afc092a2ca2310a3f094b83997c23cdc109c` 與通過量測的候選相同。九張既有資料表內容摘要前後一致：91 banks、100 versions、123 sessions、95 attempts、485 answers、30 leaf_awards、469 timing、58 generated、12 name_counters。學生三／六年級 library／錯題／明細、教師版本、全部本人場次 monitor 及既有 attempts 的學生試卷投影雜湊一致。
- 原 25 個 quiz 函式中，僅替換 compose／student_document；其餘 23 個定義不變，另加 quiz_monitor。monitor 僅 authenticated 可執行，仍檢查教師及場次所有權；學生投影函式與候選型別未開放直接執行／使用。
- Vercel `dpl_erUknwk6WfmcHuzphwQLi1oW8KRB`，候選網址 `https://it-class-tcwu-4hndeyjny-chianwu-4755s-projects.vercel.app`，已 promote 至 `https://it-class-tcwu.vercel.app`，production／READY。以第二批凍結發布包為底，只覆蓋 14 個產品／快取標記檔，未帶主工作區其他修改；18 個候選檔及 239 個正式 HTML／JS／CSS／字型 SHA 一致，四版 collector 都回 204。
- 正式來源新流程與核心 Chrome 都已通過，核心流程驗收紀錄在 `browser-core-live`；這仍是 Auth／RPC 合成 fixture，正式資料另以唯讀雜湊比對，沒有真人送答或正式 30 人壓測。自有 4391 測試 server 已停止，四個合成測試分頁已清理，瀏覽器租約已釋放。

詳細證據位於 ignored `automation/output/quiz/batch3/` 的 bench／bench-verify、sql-deployment、data-before／after、staged-verification／live-verification、browser／browser-core／browser-live／browser-core-live。舊每分鐘 CLI sampler 保持停止，沒有付費、pool、timeout 或正式學生資料調整。

重裝舊 quiz.sql／quiz-pool.sql／quiz-wrong-questions.sql 後，必須依序重套 batch1、batch2、batch3，避免覆蓋新版函式。後續應沿本工作區分支接續，不可用未合併的舊主工作區整包覆蓋正式版。
