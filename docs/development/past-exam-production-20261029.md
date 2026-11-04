# 三年級自然考古題正式接入（2026-10-29）

可重用流程、工具適用範圍及踩坑經驗另見[考古題轉線上題庫作業指南](past-exam-playbook.md)。

使用者授權保留既有作答方式、統一網站風格，正式接入本份自然考古題，驗證重作、首次單次完整達標給葉與歷次成績後上線。本次授權取代先前的「僅本機試辦」限制，只涵蓋這一份試卷。

## 正式狀態

- 學生入口：https://it-class-tcwu.vercel.app/grade3/115-1/past-exam.html?paper=dingxi-114-1-g3-exam1-science
- 三年級選卷頁的「自然」分類加入入口；沿用 Google 登入、名冊驗證、共用導覽與三年級網站配色。
- 教師預覽：https://it-class-tcwu.vercel.app/grade3/115-1/past-exam-review.html 。限本卷擁有者教師，唯讀顯示來源頁、版本、SHA-256、官方答案與疑義。
- 正式部署：`dpl_6q3C3ZH7U23iuKQSoBHHeukFUCdm`，已 promote 至 `it-class-tcwu.vercel.app`。
- 紙本來源是 114 上三年級自然第一次評量、康軒第一至二單元；目前學習紀錄歸屬 115 上。穩定 paper ID：`dingxi-114-1-g3-exam1-science`。
- 正式版本：`2b25e1de-55fb-4768-8e93-b866856c16ca`，內容 SHA-256：`1536ce5703e91719a6f7503e2585c628b44eba2e91ffdc100fb601eea681fca8`。資料庫 `enabled=true` 已查證。

## 題目及獎勵契約

原卷 67 小題、100 分。實際提供 40 題組、64 作答欄位：63 自動核對欄位共 92 分，畫圖題 4 分採自核對，3 小題共 4 分保留待確認。`s2-q13`、`s3-q04-4`、`s3-q08-1` 不猜補、不進自動分母。原卷與解答的來源頁、原始版本、檔案 SHA-256 及校對紀錄保存在固定版本 provenance。

保留 O／X、單選、代碼、排序、複選集合與點選／箭頭畫圖方式。O／X 僅顯示一份標記；沒有共同題幹時不留空白框。畫圖需完成標示與自核對，答案與分數為 null，不誤標自動答對。

同一次作答完成全部可作答題組且自動分數達 60% 才合格；55／92 不合格、56／92 合格。不合併不同次答對題目。可重新作答，保留各次版本、答案、分數與完成狀態。獎勵唯一鍵為學生＋當前學年度／學期＋穩定原卷 ID；首次達標給 1 葉，後續達標不重給，改版不再領，後續低分不扣葉。既有努力樹以共用 rewards 入口讀取新葉，來源可連回該次作答。

## 實作界線

`initQuizModule({mode:'past-exam'})` 是本次獲授權的獨立考古題轉接模式。沿用既有 auth／transport／navbar／媒體權限／內容 renderer／努力樹 rewards 介面；原 scored、practice、server 行為維持。沒有把新題型硬塞進原 schema 1 或直接匯入交接報告的提案 schema。

`supabase/quiz-past-exams.sql` 新增七張受 RLS／撤權保護的私有表與正式 RPC。固定版本不可修改；題組送答、答案、完成狀態、首次葉片在同一交易處理。使用 server view 計時、白名單投影、完整型別與代碼驗證、相同 request_id／答案冪等重送；畫圖參數受圖片 SHA 與正規化座標驗證。學生只可讀自己作答；教師預覽限擁有者。正式媒體保留私有，官方畫圖參考圖在提交前不開放。

只包裝既有 `quiz_rewards` 與 `quiz_media_access`，備份為 `*_before_past` 並撤銷直接呼叫權限，其他既有函式定義不變。原 `quiz_action` 不動。Edge `quiz-media` 只增加新考古題圖片明確走 Supabase 私有簽名的條件，原 Drive 路徑維持。

既有 quiz SQL 重裝順序仍為核心／pool／wrong → batch1 → batch2 → batch3 → batch4；本考古題 SQL 必須最後處理。重新覆寫 rewards／media 原函式時須重新檢查兩個包裝與備份，不可盲目重裝舊 SQL。

## 發布與驗證證據

使用第四批完整凍結包（433 檔）為基礎，只疊加本次 13 個 runtime 檔案；沒有從 dirty 主工作區整包發布。原正式部署 `dpl_G6mqwLwCj3JqJ66HzQzuW1UqeyCu` 保留可回復。私有 QA 路徑為本工作區 `automation/output/past-exam-production`。

- 完整回歸：66 項通過，零失敗／零略過，64.9 秒。包含舊題型、身分、揭答、媒體、重送、權限與葉片相容，以及新增考古題的非法整組拒收、交易失敗回滾、版本不可變、參考圖隔離等。
- 真正 Supabase PostgreSQL：在交易內以隔離測試流程跑完 55→56→92，葉片 0→1→1，最後 rollback。測試後確認沒有保留測試 attempts／answers／leaves。
- 私有媒體：9 張圖片上傳後逐一下載比對 SHA-256；原卷及解答未公開上傳。
- 候選來源：13 個實際部署檔 SHA 核對。受 Vercel SSO 保護的候選透過 CLI 讀檔，沒有解除保護。
- 正式來源：247 個網頁、模組、樣式與字型 SHA 全數吻合；API 是執行端點，另於既有回歸驗證，不把 HTTP GET 405 當作靜態檔比對。
- 正式來源 Chrome 合成驗收：真實 HTML／JS／CSS，隔離 auth／RPC fixture；O／X 單次顯示、遺失成功回應後相同封包重送、55→56→92、一次給葉、三次成績、1280／390 無橫向溢出、題型切換與登出清圖文通過。沒有冒用真人做正式送答，也沒有正式壓測。
- 教師預覽正式來源 Chrome 合成驗收：40 題組、9 張圖片完整載入，來源 SHA 與 3 題疑義可見，零 JS 錯誤。使用隔離教師 auth／RPC，沒有宣稱重新進行真人 Google OAuth。
- 套用時既有答案、版本及舊葉片摘要一致，除兩個預定包裝外的原函式摘要一致。啟用後查詢新考古題 attempts／answers／leaves 各為 0。

首次候選驗收曾因測試工具嘗試讀取不存在的 favicon 而失敗；改為符合真實 404 行為後重跑通過。靜態 SHA 工具首輪曾誤含執行式 API；排除 API 後 247 靜態檔通過。這兩輪屬驗收工具修正，未冒稱首輪通過。

教師驗收曾出現背景等待逾時，後續發現共用 CDP client 按 URL 前綴選分頁，同網址多分頁時可能選到舊頁。精確 target 斷言阻止誤接；改用唯一 QA query 建立目標頁，核對 target 後啟用並用固定間隔等待，最終通過。沒有為此修改產品程式。

## 回復方式與交接

若新卷發生問題，先將本卷 enabled 設 false，保留所有已存在的歷次紀錄與唯一領葉帳本。前端可 promote 回 `dpl_G6mqwLwCj3JqJ66HzQzuW1UqeyCu`。若連 rewards／media 包裝也需回復，使用 ignored `cloud/before-functions.private.json` 的原函式定義；不要刪新紀錄表或改學生答案來回復。Edge 可回復本分支基底的單行條件。

程式位於 `codex/past-exam-production`／`C:/Users/user/.codex/worktrees/past-exam-production/it-class-tcwu`，基於 `claude/quiz-load-batch4`。主工作區另有花園等未發布工作，不可用其舊程式覆蓋本次正式版。

來源試辦資料、私有完整題庫、部署凍結包、來源圖、QA 記錄與雲端備份均為本機 ignored 檔案，clone 本分支不會自動取得。`past-exam-build.mjs` 與測試依賴該資料；重建時必須明確提供已校對來源及正確 owner，不能把預設合成 teacher UUID 寫入正式版。不要執行完整 Wayground 安裝器。
