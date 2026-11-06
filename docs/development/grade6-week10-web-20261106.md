# 六年級第 10 週課程網頁

> 發布準備：使用者於2026-11-06授權依規定發布。已fetch，從最新 `origin/main` `13e977a` 建立 `codex/grade6-week10-publish-20261106`／`D:/projects/it-class-tcwu-worktrees/grade6-week10-publish-20261106`，帶入核定頁面、圖卡與頁碼標示，保留同期最新組隊入口。正式唯讀已確認 `grade6-115-1 / 08` 為 `is_visible:false`、`10` 為true，不需改動08狀態。發布結果另補。

> 樣式修訂：使用者指出初版灰綠風格偏離原有六年級週頁，已授權調整。當前交付移至新 worktree `D:/projects/it-class-tcwu-worktrees/grade6-week10-style-20261106`／分支 `codex/grade6-week10-style-20261106`，從最新 `origin/main` `2420b9b` 建立；保留最新夥伴營地正式版本，不沿用舊分支作為發布來源。下方初版製作／驗證為歷程，修訂結果見文末。

## 功能契約與實作範圍

- 來源：2026-11-06 使用者核定的第 10 週教案。本週班徽只做 p.45～47，重交由學生自行決定；最後約 15 分鐘做夥伴練功。中英打、閱讀小卡、魔王花園持續供在校與在家自主練習。
- 新 worktree：`D:/projects/it-class-tcwu-worktrees/grade6-week10-web-20261106`，分支 `codex/grade6-week10-web-20261106`，從 fetch 後的 `origin/main` `6b1b5ef` 建立。先前教案從規劃 worktree 複製進本次分支，未改主工作區。
- 頁型：B 類課程說明頁，`grade6/115-1/week10.html`。參考同學期第 08 週 Canva 任務、第 09 週入口與現行夥伴隊長／隊員流程；不複製第 09 週內嵌打字與初始化。
- 模組：同學期 `navbar.js`，`week10.js` 只呼叫 `initNavbarAuth()` 與 `initImageLightbox()`。不手刻導覽、不直接綁登入登出、不改 auth 或進度共用模組。
- 本頁無互動測驗、打字輸入、解鎖或進度寫入；不新增 `activityKey` 或努力樹目錄項目。中英打入口指向第 08 週原 5 關，另保留第 09 週接續入口；原 `08 / typing_task_5` 及兩個魔王識別不變，不遷移、重設或重複給獎勵。
- 作業：共用 `homework.html`，指明原第 05 週「我們的班徽（一）」；自選下載、重交，不另建第 10 週作業、不列本週缺交或補交要求。
- 閱讀：共用 `homework.html#reading`，自由分享，不列缺交；第 10 週期間規劃 2026-11-02～11-08。外部狀態結果待下方記錄，不以頁面連結存在代表已設定。
- 第 08 週：首頁本來沒有第 08 週卡、navbar 的 activeWeeks 也未列 8，維持不出現；原課程／題目／魔王頁保留供直接續練。只有 navbar 引用版本隨同學期其他頁一致更新，不刪檔或改題。
- 三處同步：首頁新增 10、唯一最新標記移至 10；navbar activeWeeks 加 10；教師後台 grade6-115-1 visibilityDefaults 加 `10`。不改其他學期週碼。
- 大型任務用預設展開的 details；課後入口常駐，不以班徽或打字完成鎖定夥伴入口。

## 資訊圖卡

- 路由：ChatGPT 工作瀏覽器分身 01，註冊 worker／租約，精確 target 綁定；可見帳號名稱 `codex THPS`，生成前已查看個人檔案選單；使用明確「製作圖像」模式與 UTF-8 prompt。
- 提示詞：`automation/prompts/grade6-week10-infographic.txt`。
- 成功送出一次、下載一次；本機 metadata 在 ignored `automation/output/grade6-week10-image.json`，原 PNG 不提交。
- 已目視檢查：繁體標題、校名班名、自選重交、雙人各用電腦、在家續練入口文字均正確；沒有官方校徽或吉祥物來源，沒有額外肢體或遮字。
- 正式資產：`grade6/115-1/images/week10/week10-infographic-1920x1080-q80.webp`，1920×1080、q80、161,778 bytes。
- Cloudinary 新建專屬 `115-1-week10` public ID（未覆蓋舊學期圖卡）：[正式圖片](https://res.cloudinary.com/dmqmjfqng/image/upload/v1793929649/it-class-tcwu/grade6/week10/115-1-week10-infographic-1920x1080-q80.webp)。本頁 img／燈箱 href 都使用此 WebP；本機保留同檔作為版本資產。

## 驗證與外部狀態

- 靜態：頁面所有本機連結及 fragment 存在，ID 唯一、UTF-8 可讀；`git diff --check` 通過。
- 本機伺服器：本次 worktree 的 `http://localhost:3000/grade6/115-1/week10.html`；不使用 file 協定。
- Chrome 1280／390px 19項檢查通過：圖卡載入、無水平溢出、固定入口、燈箱開啟／放大／縮小／pointer拖曳／置中／重設／Esc關閉／焦點恢復／重開重設、任務收合、手機關閉鈕可達、首頁唯一最新為10、08卡缺席及首頁進10，pageerror 0。結果在 ignored `automation/output/grade6-week10-browser.json`。
- 初輪背景截圖逾時，功能前4項已通過；依工作瀏覽器技能，對本次精確分頁授予單次前景啟用後重跑通過。沒有改用未註冊瀏覽器或把失敗當通過。
- 已目視桌機／手機全頁截圖，之後修正 Tailwind preflight 對標題字重及 `.outline` 工具類的衝突，改用專屬 `.btn-secondary`；最後再確認標題900、次按鈕無多餘outline、Cloudinary圖片載入及手機無溢出，更新兩張截圖。Cloudinary回讀161,778 bytes與本機SHA256一致。ES module語法檢查通過。
- 教師後台使用可見的 `chianwu@gmail.com`，建立第10週閱讀期間 2026-11-02～11-08、提供分享；同週原本不存在，未覆蓋其他週。教師後台回讀成功。由同帳號開學生入口，未列出小卡（教師身分並非名冊學生），因此不標記真正學生分享／修改驗證通過；未代寫任何閱讀內容或學生作答。實班學生端仍需確認，原分享服務未改動。
- 本機新後台以可見教師帳號確認 grade6-115-1 第10週，實際隱藏→本機首頁消失→顯示→本機首頁恢復，最終恢復顯示；第08週卡仍缺席，沒有改08可見性或任何學生進度。結果在 ignored `automation/output/grade6-week10-final.json`。
- 本頁只有既有服務入口，未重新測試原作業上傳、打字保存或夥伴完整雙人作答；沒有宣稱這些既有路徑已完成本輪真人驗證。本輪也沒有新增可計葉花活動，不需新增靜態任務目錄。
- 尚未進 main 或部署；若後續發布，須 PR/main 與新乾淨 main worktree 的 `release-from-main.mjs`，不可從本功能目錄直接發布。

## 恢復原有六年級風格

- 頁面以第09週 CSS 為視覺基準：紫／靛／藍綠漸層頁首、黃色標題強調、半透明重點卡；主區段恢復4px彩色粗框、圓形編號、粗體大標題。班徽淺藍、夥伴橘色，課後入口分為藍／綠／紫，首頁第10週卡同步為紫色系。
- 保留自選重交、固定練習入口、原進度與課後使用等所有核定內容；不重建閱讀期間、不重測或修改正式學生資料。
- 圖卡用第09週既有圖作為實際上傳的風格參考，重新生成同系列的水彩插畫、大字與分色圓角卡片。提示詞 `automation/prompts/grade6-week10-infographic-style.txt`，不沿用第09週票選內容或固定分鐘數。
- 新圖卡已完成：1920×1080 WebP q80、321,252 bytes，Cloudinary [style2正式圖片](https://res.cloudinary.com/dmqmjfqng/image/upload/v1793930896/it-class-tcwu/grade6/week10/115-1-week10-infographic-style2-1920x1080-q80.webp)，回讀SHA256與本機檔一致。替換本機版本資產及頁面的img／燈箱href，CSS版號更新為 `20261106-style2`。
- 第09週參考圖確實上傳；只送出一次新提示詞。wrapper未能從新的訊息容器辨識圖片而回報未開始，遵守不重送原則，回到原精確target／對話核對原prompt及generated-image-preview，等待圖片穩定10秒後下載原blob。PNG簽章／大小檢查通過，metadata在ignored `automation/output/grade6-week10-image-style/recovered.json`。沒有把參考圖當成生成結果。
- 已目視新圖卡：繁體文案、六年三班示意、自選重交、雙人操作及在家續練均清楚，沒有固定分鐘數、錯誤肢體或官方識別來源。
- 新worktree本機Chrome 1280／390px共23項通過：原有入口、圖片及燈箱操作、收合、首頁最新10／缺席08，另核對紫色漸層、4px粗框、標題900字重與3種分色練習卡；pageerror 0、無桌機／手機溢出。最終桌機頁首及手機全頁截圖已目視，結果在ignored `automation/output/grade6-week10-browser.json`。
- 本輪沒有重新設定正式閱讀或可見性；教學內容與服務入口保留。維持尚未部署正式站。
