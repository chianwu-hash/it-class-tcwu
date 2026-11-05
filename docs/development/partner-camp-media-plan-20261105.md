# 夥伴練功：語音與畫圖請教企劃

狀態：企劃已先交 AGY 討論後才開始隔離原型。正式站、資料庫與 Storage 尚不變更。由最新 main `05b9179` 新建 worktree；以快轉納入答題優先草稿 PR #38（`7b83750`）作為設計與純元件相依，不當作 main 已有或正式已發布。

最新授權：使用者睡前要求有問題先與 AGY 討論，盡量修改完成，臺灣時間23:40喚醒，上線前與Claude複核、修好無問題後依既有流程發布。已建立本對話一次性23:40 heartbeat（`23-40`）。此授權涵蓋必要整合與發布，但不把未核定的自動刪除期限當成可執行政策；任何未通過或未實測項目須告知。

## 討論與目前證據

- AGY 修改前 session `camp-media-plan-20261105`，1.5.1／gemini-4-argon-medium，98秒，工具邊界通過、Git前後不變。結論沒有阻擋第一階段原型的重大決策。採納畫板即預覽、錄音最短0.8秒、重錄失敗保留舊稿、單一音訊播放、長筆畫接段及未來cleanup原子狀態鎖定等建議。WAV方案仍須實測裝置，不採納「徹底解決所有平台」的過度保證。
- 已有隔離原型 `node automation/partner-media-preview.mjs` → `http://localhost:8817/`。資料只在當頁，兩人是切換身分模擬，不是真兩機。
- `quiz-partner-media-compose.test.mjs` 六項通過：WAV格式／時長、畫圖限制、麥克風生命週期、遲到授權、失敗重錄／舊處理隔離、自動停止與拒絕／不支援。
- 隔離Chrome十四項通過：真MediaRecorder接合成音軌轉WAV、關閉保稿、無文字語音請教／畫圖回覆、原題串關聯、放大畫圖、失敗同requestId重送與新草稿保留、角色隔離、拒絕權限fallback、錄音中關閉、原題狀態、手機版及無例外。未擷取使用者環境聲音，未做真實麥克風／iPad／Android／兩機互播。
- AGY 正式接線設計 session `camp-media-backend-20261105`，70秒，邊界與Git檢查通過，確認無重大決策需停。採納所有權／目的／題號／串號綁定、service-only finalize、固定鎖順序、已存草稿狀態與送出清理。實作採「複製舊snapshot body後原地替換原function」保留OID，避免rename舊OID呼叫繞過wrapper；不照抄建議中的qid文字型別或thread UUID，沿用真實integer／bigint。
- 已完成正式元件接線、增量 SQL、私有媒體 Edge handler；截至本紀錄仍未套正式庫／部署。`quiz-partner-message-sql.test.mjs` 使用真authenticated/anon/service_role權限，驗證私有草稿、同requestId去重、錯誤payload拒絕、附件原子連結、跨人／跨房／跨目的拒絕，原answers/awards/leaves一致。Edge另5項測試驗證授權、格式、私有service-only存取、重試hash驗證及瀏覽器validator一致。
- `http://localhost:8818/?actor=1` 與 `?actor=2`：兩獨立頁面、合成Auth、真PGlite SQL、記憶體Storage與正式Edge handler／learning／營地元件，10個整合檢查通過。純語音請教→另一頁播放→純畫圖回覆→對方放大→保留原答案→保存未送語音草稿→接回試聽與發布，server草稿附件引用清除，390px無水平溢出。這不是實際Google帳號／Supabase雲端／兩部裝置。
- 新功能相關15項Node測試＋原個人11項＋既有partner15項通過（共41項）；Browser原型14＋整合10。最新小修另重跑6項錄音生命週期測試通過。背景頁面測試原先因waitForFunction預設RAF而逾時，已改5秒polling並重跑通過，非應用程式登入故障。
- 已唯讀確認正式Storage objects現有兩條policy均僅限homework-thumbnails，沒有會開放新訊息bucket的廣泛authenticated/anon政策。新bucket不新增客戶端直接Storage政策，服務端讀寫前先由caller-scoped RPC驗證。
- AGY 實作複核 `camp-media-implementation-20261105` 已完成，沒有提出可重現的部署阻擋；不是AGY自行操作正式站。之後另補SQL舊草稿malformed資料安全清理、相同文字草稿清除、儲存退出saveEpoch隔離、同頁單一錄音／暫停題目音訊、預覽非同步綁定當次UI與附件ID。整合10項及答題17項通過，最新Edge/SQL六項與所有新模組語法檢查通過；Claude23:40仍須看最新實際檔案。

## 上線前接續（23:40 Claude 複核後）

1. 先確認 AGY 實作複核與所有必要檢查通過，更新本紀錄與agent-handoff；原答題PR38與本輪相依PR均經PR進main，不直接push main。
2. 使用全新乾淨main worktree。先確認無別人發布鎖、來源與Supabase project ref `upxgyusodibaqcrocdzj`；本輪增量SQL為 `supabase/quiz-partner-message-media.sql`，一次性交易，不能重跑整份歷史production SQL。僅在Claude核對、使用者最新發布授權範圍內套用。
3. 由main部署 `quiz-partner-message-media` Edge function，Auth /user＋caller-scoped RPC自行驗證JWT；config verify_jwt=false。私有bucket與SQL服務權限先到位，才切前端。
4. SQL變更後執行 `automation/db-schema-snapshot.mjs` 與 `db-snapshot-check.mjs --live`，核對預期新增4個function＋修改learning_snapshot，舊student表／花葉資料不變；snapshot經PR回main。任何不符先停，不能跳過。
5. 從更新後乾淨main worktree執行release-from-main start/deploy/promote，全檔樹ok:true並確認基準正式部署未變。不得用本分支或舊發布包部署；回滾優先回舊前端（增量schema保留且無自動刪除）。
6. 正式無登入請求須拒絕，正式資產與snapshot核對；如果真實兩帳號／麥克風／平板尚未測，明確標未驗證。不能寫「已完成真人兩機實測」。發布後handoffRow經PR補登。

## 1. 目的與範圍

三年級打字較慢，學生能用自己方便的方式說明卡在哪一步、回應夥伴。主畫面維持答題優先；「問夥伴」才開營地，關閉後接原題。文字、短語音與畫圖皆為有效表達，文字可略過；不依訊息量、聲音長度或圖的張數排行／加葉花。

第一階段：隔離合成小隊，實際錄音／試聽／重錄／送出、實際畫圖／復原／送出、接收播放／放大、模擬換人與回原題再試。所有資料只在當頁記憶體，明示重新整理會清空，不假裝已有雲端保存或兩機同步。

第二階段：確認操作後，另做 Supabase 私有訊息附件、儲存退出接續與多人同步。正式 SQL／Storage 政策經審查及使用者同意後，才套用正式庫；走 PR、main 與發布腳本。舊個人練習、題庫媒體、配題、60%／訂正／紀念葉花政策保持現有契約。

## 2. 三種表達的流程

營地輸入區提供「打字」「說一段」「畫給夥伴看」，同一則訊息最多一段語音＋一張畫圖＋選填文字，切換方式保留草稿。仍使用既有 ask／reply／chat 的目的類別，不把媒體型別混成新的討論串目的。

語音：點開始→麥克風允許→明顯錄音中／秒數→點停止或30秒自動停止→試聽、重錄或移除→送出。錄音完成不自動送出。收件人自行點播放；任何新訊息都不自動播放或自動開營地。

畫圖：開啟空白紙→畫算式／箭頭／圖示→復原、清除→預覽後送出。首版固定一種清楚的深色筆，不堆工具。原題圈畫列第二步，必須使用該房間原題的授權媒體與尺寸，不上傳任意圖片或外部網址。訊息顯示縮圖／「放大畫圖」，不讓整張畫板佔滿所有對話。

範例：小禾錄「我知道每盒六枝，但不知道先加還是先減」→小晴畫兩盒與拿走五枝，配一句短提示→小禾收起營地，自己選答案。原題作答與提示附件各自記錄，提示不等於完成答題。

## 3. 錄音生命週期

狀態：idle → requesting → recording → processing → ready；另有 denied／unsupported／error。只有 ready 且音檔有有效長度才能送出。限制30秒、標準化後不超過1MiB；顯示處理中並允許取消，避免連按造成兩份錄音。

點開始前不啟用麥克風。關閉營地、切換模擬身分／題目、離房、登出、隱藏頁面時立即停止音軌；已錄下的片段經停止後留同一位使用者／同一題的草稿，離房／登出則釋放不外洩給下一位。若授權視窗很晚才允許，利用 generation token 把遲到的 stream 立刻 stop，不能在關閉後偷偷繼續錄。

重錄先確認會替換原片段；取消重錄或新錄音失敗仍保留上一段可用草稿。處理完舊錄音的非同步回應不得覆寫新草稿。所有 MediaStream tracks、AudioContext、Object URL 與 timer 都有對稱釋放。送出／等待重送時保留後續輸入的新草稿，成功只清除此次提交的版本。

## 4. 格式與大小（待 AGY 核對的技術選擇）

瀏覽器以 MediaRecorder 偵測可用 MIME（WebM／MP4等），不假定跨裝置都能互播。建議首版處理後統一成 WAV PCM16、單聲道16kHz，30秒約960,044 bytes，方便互播與伺服器精確驗證長度；須先在目標瀏覽器確認 decodeAudioData／OfflineAudioContext 能處理自身錄製輸出及處理時間，失敗就保留原草稿並提示重試，不悄悄上傳未支援容器。

伺服器未來只接受指定 RIFF/WAVE PCM 格式，驗證 bytes、channels、sample rate、bits、data chunk／長度與30秒限制，不採信客戶端 duration 或 Content-Type。若實測不適合 WAV，可另議受限格式＋伺服器驗證工作；不能只依副檔名放行。

## 5. 畫圖契約

沿用現有手寫板的正規化座標／SVG polyline 呈現概念，另抽獨立純編輯器，這輪不改原考古題確認與判分模組。草稿格式：`{version:1, strokes:[[[x,y],...],...]}`，座標有限數且在0～1之間。建議上限80筆、每筆128點、序列化256KiB。只由固定程式畫線，不接收任意SVG／HTML。空白畫板不算有效附件；觸控以 Pointer Events 操作，畫板以外可正常捲動。

## 6. 正式資料與權限規劃

儲存空間：現有 Supabase 專案 `upxgyusodibaqcrocdzj`，新增私有 bucket（建議識別名 `partner-message-media`），和題庫媒體分開。音檔在 Storage；資料庫放 attachment ID、room、owner、type、byte count、duration／尺寸、object key、state、timestamps；畫圖可為限制格式的JSON物件。快照只回小型 metadata，點播放／放大才讀取內容。

訊息仍用 ask/reply/chat＋`text`＋`attachmentIds`。驗證「非空文字或至少一個已驗證有效附件」，允許純語音／純畫圖。附件只能被上傳者連結到同一房間／同一目的的訊息；reply 必須指向該房間有效請教串。讀取前核對當前登入與原小隊權限，簽署短效媒體讀取授權；不得公開bucket、永久公開URL、把service key交給前端，或繞用題庫媒體服務。

上傳分三步：建立 upload intent（含clientAttachmentId）→上傳到不可變暫存key→後端驗證後 finalize；送訊息時原子連結 ready 附件與 note，沿用固定 requestId。失敗重送沿用原attachment ID／requestId，不能重複訊息或覆寫別人的物件。處理上傳成功但note失敗的孤兒檔；cleanup必須重查仍未linked、仍已到期，避免刪掉剛發布的附件。

## 7. 草稿與保存期限

隔離原型：當頁記憶體保存，關閉營地不清，重整會清；不要使用 localStorage／公開repo保存學生語音。

正式版：JSON save_draft 只存附件ID，不塞 Blob／base64。手動「儲存退出」先完成私有暫存附件與草稿版本寫入，成功後才退出；上傳失敗留在原頁並可重試。只有房間與上傳者本人能取未送草稿。聲音不得因切帳號出現在其他人的草稿。

建議期限（未核定，不執行刪除）：未連結暫存24小時；已送附件保留至該學期結束後30天；共同紀錄冊可保留曾請教／回覆的文字摘要與附件到期標記，音檔到期不影響原學習紀錄或花葉。期限與學期來源需使用者核定後才啟用正式cleanup；不以本機日期猜學期結束日。老師回看權限另依現有管理契約設計，不擴大公開讀取。

## 8. 通知與學習紀錄

沿用答題優先通知：相關請教／回覆短提示、聊天只有badge。媒體訊息可以「已查看訊息」標未讀，不能聲稱「已聽完」「已學會」。不做語音自動轉字、不把學生音檔送外部AI。共同紀錄冊描述努力過程，不按發言量計分。

## 9. 實作順序與驗收

1. 企劃交 AGY 討論（本輪修改前），核對範圍、格式、生命週期、私有權限、草稿／重試與保存期限。
2. 隔離原型：實際錄音／畫圖、預覽、送給模擬夥伴、收合回題。兩位角色切換只模擬流程，明示不是兩機同步；可注入合成音軌驗證，不錄製使用者環境聲音作自動化測試。
3. 自動測試：遲到授權、拒絕、unsupported、30秒停止、關閉／隱藏後tracks皆stop、舊處理回應不覆蓋新草稿、錯誤後保留舊錄音；WAV bytes／duration格式限制；畫圖limits／序列化；無文字附件送出；失敗重送與新草稿保留；換人隔離與手機版。
4. 人工實機：學校Chrome/Chromebook、Android、iPad/Safari互錄互播、耳機／環境噪音、觸控捲動、螢幕鎖定與麥克風權限提示。未完成不可寫已通過。
5. 第二階段前提出正式SQL／Storage政策與保存期限的具體變更，使用者確認後才套用；更新live DB snapshot、驗證兩個真實帳號／兩機、再走main發布。此企劃不是正式資料庫套用或刪除授權。

參考：[MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)、[getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)、[OfflineAudioContext](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext)、[Supabase private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)。
