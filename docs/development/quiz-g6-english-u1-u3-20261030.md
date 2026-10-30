# 六年級英語本次範圍改為 Unit 1、Unit 3

使用者依六年級學生回報，指定本次考試為 Unit 1、Unit 3，要求同步更換老師準備的卷與自組卷。本次已正式套用，Unit 1 原卷與原 77 題不變，新增真正 Unit 3 的 77 題與一份 10 題老師卷。自組卷選單只提供 Unit 1、Unit 3；原 Unit 2 的 77 題暫不作新卷候選，原老師卷移出選卷清單，既有版本與作答仍可由原連結接續／回顧。

## 原始範圍與來源

版本為康軒 Wonder World 7，115 上學期：

| 網頁單元 | 原始書商章節 | 課名 | 可用題數 |
| --- | --- | --- | ---: |
| Unit 1 | `01` | Whale Watching | 77 |
| Unit 3 | `04` | From Farm to Table | 77 |

**原始章節 `03` 是 Review 1，不是 Unit 3。** 不能重命名原 Unit 2，也不能把 Review 1 的題目充作 Unit 3。本次另從原始光碟抽出 `CLASS_TERM=1507, LESN_NUM=04`，並以已存課本 U3 文字交叉確認標題與餐點／would like 學習內容。

光碟 `01_115(1)國小英語WW題庫_1008.iso` SHA-256：`f4976e21420fde2452b31ce471cfdef4d4f2cc17f292cb42f0b404950561e321`，重新計算吻合。章節 04 共 170 筆原題，選取 91 題有唯一子題的獨立單選，逐題核對 metadata 與原 Word 答案欄；14 題解析引用固定選項位置，沿用現有排除規則，不加入亂序選項的正式題庫。最後可用 77 題，難度為易 31、中 35、難 11，皆有原解析。

題幹、選項、解析採原生文字／表格／原圖，聽力使用同原題 ID 的原始 MP3，不生成替代語音。77 題共使用 39 張去重原圖、37 段原版音檔，圖片已解碼並檢視聯絡表，Word 答案與 metadata 交叉核對；沒有宣稱逐段人工聽辨全部音檔。

新老師卷為 10 題，2 易／6 中／2 難，包含 3 段聽力。以書商 Unit 3 知識代碼接上食物詞彙、would like 描述／問答、oi／oy 與原版安排的母音辨識；`knowledge_reliable=true`，符合既有解析、難度與不同題族規則的錯題可延伸。本次沒有重灌或覆蓋前次四科知識分類。

## 正式增量

- `quiz_courses.definition.units` 改為 `{1,3}`；新 Unit 3 pool 的 `unit_ids=[3]`，checks 保存 `publisher_chapter=04` 與原知識代碼。原 Unit 2 pool 只設 `usable=false`，其餘欄位與 membership 分類保留；原 Unit 1 完整保持不變。
- 新增 Unit 3 題庫、私有媒體登錄、bank、固定 version 與 practice session。班級沿用現有 Unit 1 的 603／604／609，不另擴大授權。
- 新增 `quiz_sessions.library_visible boolean not null default true`。僅原 Unit 2 老師卷設 false；`quiz_library_sessions` 只過濾 practice 的清單可見性。join／resume／錯題授權不以此標記拒絕舊卷，self／classroom 的既有權限保持原樣。不能以改 version_id、清空 class_codes 或刪除 session 來替換已作答試卷。
- `supabase/quiz-practice-visibility.sql` 保留現有函數定義，只對經檢查的清單條件加上 visibility 判定，不以舊版整份 SQL 覆蓋目前函數。未變更 Auth、RLS、評分、葉片或既有答案。目錄觸發器失效後，同交易預建三、六年級目錄。

Unit 3 老師場次：`6e6c4872-0388-4b35-80f7-fedfec2248db`，固定版本 `754a0d16-31e2-4a39-9d0a-ab93ae65ea92`。原 Unit 2 場次 `f622de1a-7cac-c028-0071-d775e7eb58f1` 保留，僅清單可見性關閉。

## 圖片與音檔發布

圖片沿用學校 Drive 私有檔案與 Cloudflare Worker。先以 Drive about 核對既有設定帳號，39 張逐檔上傳後下載驗 SHA；37 段音檔上傳 Supabase 私有 bucket，下載驗 SHA，未保存短效簽章 URL。

Cloudflare 工作瀏覽器先以可見帳號核對，再保存正在執行的兩個 module。只在 live `assets.mjs` 原有 5,777 筆上增補 39 筆，最後 5,816 筆；保留原 `worker.mjs`、設定及繼承全部既有 bindings，不將憑證重新注入瀏覽器。現有 Worker 與 repo 僅換行不同，但發布仍以即時取得的原始位元組為基準。新增 39 圖與一張舊圖均經 Worker 下載驗 SHA，未簽名／過期／私有快取路徑拒絕測試通過。

Worker 的 bind-by-name inherit 方式依 [Cloudflare API](https://developers.cloudflare.com/api/typescript/resources/workers/) 核對；程式不保存 secret 值。資料庫更新前，媒體已全部可用。本次不需 Vercel 前端部署。

## 驗證與學生紀錄

- 本機真實 SQL：Unit 1／Unit 3／混合三種範圍，易／中／難三種難度，5／10／15／20 四種題數，共 36 組自組卷。均限定要求單元、排除 Unit 2，重送同一 request_id 不重複建卷；Unit 2 新組卷請求拒絕。
- 本機另驗新老師卷 10 題、Unit 3 錯題延伸，以及原 Unit 2 的 attempt ID／答案與 resume 結果完全相同。清單隱藏不阻斷原連結。
- 正式 PostgreSQL 回復測試同樣 36 組；老師卷真 join 與 11 個圖片／音檔引用的 media access 驗權、實際既有 Unit 2 attempt resume 通過。測試資料由內層交易回復，外層最後 rollback，學生紀錄與受保護表摘要不變。
- 正式 apply 為 repeatable read 單一交易，預檢原 154 列 MD5、課程、兩份原 session 及目前 library 函數；任一內容已改就拒絕。寫後核對原有其他 quiz 表、其他題庫／membership、其他課程、原媒體與原試卷版本；只允許本次預定欄位及新紀錄。
- 正式重新匯出核對：原 154 題內容／分類保留，Unit 2 僅 usable 停用；新增 77 題符合已驗證 bundle，active 共 154 題；舊 Unit 1、Unit 2 固定文件保持不變，原 1,019 筆媒體登錄保留。
- 已用自有學校帳號完成 Google OAuth 並確認 60930，在正式網站看見老師卷 Unit 1／Unit 3、自組卷 `[1,3]` 與各 77 題；390px 無橫向溢出、pageerror 0。網頁驗收僅讀清單與題庫選單，沒有建立新試卷或作答。圖片、音檔的位元組與 SQL media access 已另驗，未冒稱網頁人工播放全部聽力。

本機測試 helper 會依字串重新安裝 batch4；當較新 migration 的 guard literal 包含舊函數名稱時，也可能被它誤判。`verify-local.mjs` 透過 PGlite 原始 exec 執行較新 migration，避免「測試後又被換回舊函數」的假失敗。source CRLF／LF 比較會先移除 CR，但不忽略其他函數差異。

## 檔案與後續

程式在 `automation/quiz-english-scope/`，範圍與書商章節對應由 `scope.json` 固定。`prepare.py` 可重做獨立來源抽取；不得對原本的 `all-midterm-local` 全目錄重跑舊批次工具，以免覆寫其他科人工修正。`quiz_native_docx.py` 將字型轉換留給明確傳入的 callback；英語處理不混入先前注音修正。

私有來源、原圖音檔、before／after、SQL、bundle、圖片服務基準、驗證與截圖在 ignored `automation/output/quiz/g6-english-u1-u3/`，不提交題幹、答案、Drive file ID、憑證或簽章 URL。正式已 apply，勿重跑同一 SQL；變更範圍須重新快照、核對與驗證。回復僅調回 course units、原 pool usable 與原老師卷可見性、隱藏本次新卷，保留所有學生紀錄與新舊不可變版本；不能整表還原。後續若需重跑舊 batch4 SQL，必須保留本次 visibility 規則。
