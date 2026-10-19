# 六年級115-1第08週網頁製作紀錄

## 功能契約

- 依據：主工作目錄 `D:\projects\it-class-tcwu\grade6\LessonPlan\115-1\Week 08.md`（2026-10-19 修訂）。此教案尚未 commit，本機版直接以絕對路徑讀取。
- 頁面：`grade6/115-1/week08.html`（C類：課程說明＋中英打）、`week08-boss-zh.html`、`week08-boss-en.html`。從第07週對應檔複製調整；沿用 `week05-typing.css`。
- 任務順序：補做黑熊 p.42～44 → 校名班名 p.45～47 → 星星、複製、Shift複選與垂直平均分配 p.48～50 → 本週重點概念 → 下載PNG重交 → 快手 p.51～52、中英打與魔王。補做卡操作內文完整保留第07週黑熊卡。本週不使用任務圖片，不載入無用途的圖片燈箱。
- 頁首與收尾均明示主線做到 p.50、不管做到哪裡下課前都要交一次；p.51～52 是第09週主線，快手可先做。
- Navbar：`navbar.js?v=20261019`、activeWeeks 加 8；`initNavbarAuth()` 由 `week08-typing.js` 呼叫一次，頁面不手寫 nav、不直接綁登入登出。
- 打字：`initTypingChallenge()`＋`initTypingTools()`＋`draftOptions: { enabled: true }`，三頁均載入 canvas-confetti CDN。正式進度交共用模組寫 `student_progress`，手動草稿交共用模組寫 `typing_drafts`，不以 localStorage 存進度。
- 活動識別：`courseId: grade6-115-1`、`weekCode: 08`；普通 `typing_task_5`，國語 `typing_boss_zh_1`、英語 `typing_boss_en_1`。普通依序解鎖，魔王可自由進入，建議先完成普通關。
- 題目：`week08-typing-data.js` 直接擷取教案 levelsData／bossZh／bossEn；七個答案物件與教案程式區塊逐字相同，維持 `{ id, ans }`。普通5關；國語第6課〈珍珠奶茶〉第四、六、七段共7行；英語Unit 1〈Fun Facts about National Flags〉含國名標籤與問句共11行。
- 作業：只連 `homework.html`，沿用第05週「第5週・我們的班徽（一）」重交，不新增作業；看到「已繳交・待評」與自己的檔名才算完成。
- 閱讀：自由分享、不列缺交，只連 `homework.html#reading`；本週閱讀 period 留待獲授權的教師流程建立，不標為不適用。
- 努力樹：`shared/reward-tree-config.js` 六年級新增08普通5關及兩個 `rewardMode: boss` 活動；`boss-garden.js` 補08兩種描述（115學年度・康軒・國語・第6課／英語・Unit 1），花園自動收錄為6張卡。普通5關為4葉1花，兩個魔王各1花。
- 週卡三處：首頁08標本週且移除07最新標記、navbar activeWeeks、`admin-progress.html` grade6-115-1 visibilityDefaults.weeks 加08。
- 快取：index與boss-garden的navbar、boss-garden.js及其中reward-tree-config版本更新為20261019。未改其他舊週頁。
- 寫入範圍：僅權限信封允許的14個檔案；未修改共享auth／打字模組、homework、其他週頁、三年級或共用交接檔。

## 變更檔案

- `grade6/115-1/week08.html`：文字任務卡、主線／快手分流、重交與本週中英打入口。
- `grade6/115-1/week08-boss-zh.html`：珍奶奇蹟7行挑戰、段落與來源說明。
- `grade6/115-1/week08-boss-en.html`：National Flags 11行挑戰與國名標籤說明。
- `grade6/115-1/week08-typing-data.js`：教案原文普通與兩個魔王題目。
- `grade6/115-1/week08-typing.js`：沿用第07週共用初始化，活動隔離於08。
- `grade6/115-1/navbar.js`：加入第8週，更新版本字串。
- `grade6/115-1/index.html`：新增08本週卡，移除07本週標記。
- `shared/reward-tree-config.js`：登記08三個活動。
- `grade6/115-1/boss-garden.js`：08國語／英語花園描述與設定快取版本。
- `grade6/115-1/boss-garden.html`：navbar與花園程式快取版本。
- `admin-progress.html`：六年級115-1預設可管理週次加入08。
- `automation/tests/grade6-boss.test.cjs`：08獎勵、跨週隔離、重複與未完成紀錄、題目與設定檢查。
- `automation/tests/grade6-week08-browser.cjs`：本機合成登入與記憶體進度／草稿的瀏覽器測試。
- `docs/development/sessions/2026-10-19-grade6-week08-web.md`：本紀錄，取代範圍外handoff文件更新。

## 驗證

- `node automation/tests/grade6-boss.test.cjs`：通過。05／07／08獨立計算、重複列不重複給花、未完成不給花、課程隔離；08普通5關與魔王7／11行；無彎引號、空白行、刪節號或〇，活動設定與目的檔存在。
- `node automation/tests/grade6-week08-browser.cjs`：通過離線功能檢查。Chrome可正常啟動；auth與Supabase皆以記憶體模擬，僅合成帳號，無正式登入或資料寫入。
- 瀏覽器涵蓋：匿名鎖定、navbar登入事件代理、名冊合成身分顯示、錯字行列提示、阻擋貼上／拖入、手動草稿儲存與重整回復、保存失敗不慶祝且可重試、兩魔王完成寫08、慶祝返回花園、花園6張卡與教材標籤、普通5關保存與重新整理接回、重設普通不影響魔王、重設08魔王不碰05／07、首頁08唯一最新、navbar 07↔08、無pageerror。
- 測試伺服器已補 `.mjs` MIME，供現有共用鍵盤工具載入。初次沿用第07週伺服器時因缺此類型而逾時，修正後重跑通過。
- **明確略過**：1280／390正式版面、外部CDN及字型渲染。網路禁止，測試對Tailwind只提供hidden可見性工具，canvas-confetti為動畫計數替身，其餘外網請求一律阻擋；不能把功能通過視為正式樣式已驗收。未產生截圖檔。
- 額外靜態檢查通過：三頁CDN與版本、無手寫nav／圖片、唯一錨點與順序、黑熊卡操作內文與07相同、七個答案物件與教案原始陣列完全相符、ES module模式語法檢查、`git diff --check`。
- 直接以 `node --check 檔案.js` 初查時，因repo預設CommonJS而拒絕import/export；已改用 `node --input-type=module --check` 經stdin檢查，四個相關ES module均通過。不是瀏覽器語法錯誤。
- 定向Nowledge記憶搜尋未成功：網路連線被拒，未用記憶推定實作事實；教案與repo檔案為依據。

## 未做事項與人工確認

- 本次授權限本機，未建立閱讀 period、未建立任何作業、未使用正式資料庫／帳號，未部署，未執行git add／commit／push等Git狀態變更。
- 教案／SOP要求同次建立閱讀 period，權限信封明確禁止；依較高優先的本次指示保留為待辦。教師後續需建立grade6-115-1第08週閱讀period（2026-10-19～2026-10-25），由學生入口確認可見。
- 教師需核對第05週原作業收件狀態，並以實際學生驗證重交、進度保存、教師後台查詢／重設、閱讀顯示及首頁隱藏／顯示；記憶體測試不代表正式RLS或Google OAuth已驗證。
- 人工目視1280／390下的課程頁、兩個魔王頁、首頁與花園；確認字型、任務卡資訊層級、無水平溢出、CDN載入與慶祝動畫。
- Canva學生帳號的Noto Sans T Chinese、間距控制、透明背景選項，以及本週學生實際進度分布仍待教師確認。
