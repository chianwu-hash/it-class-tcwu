# 六年級115-1第07週網頁製作紀錄

## 功能契約

- 依據：`grade6/LessonPlan/115-1/Week 07.md`。第06週國慶連假停課，接續第05週；班徽剩餘內容分兩週，本週主線 p.42～47。
- 頁面：`grade6/115-1/week07.html`（C類：說明＋中英打）、`week07-boss-zh.html`、`week07-boss-en.html`。視覺與功能沿用 `week05.html` 與第05週魔王頁；打字樣式直接引用 `week05-typing.css`。
- Navbar：當學期 `navbar.js?v=20261014`，activeWeeks 加 7；`initNavbarAuth()` 由 `week07-typing.js` 呼叫一次。
- 打字：`initTypingChallenge()`＋`initTypingTools()`＋手動草稿；canvas-confetti CDN 已載入。`courseId: grade6-115-1`、`weekCode: 07`；普通 `typing_task_5`，魔王 `typing_boss_zh_1`／`typing_boss_en_1`（與第05週同名鍵，以 weekCode 區分，資料表唯一鍵含 week_code）。`levelsData` 為 `{ id, ans }`，題目見 `week07-typing-data.js`。
- 作業：沿用第05週「第5週・我們的班徽（一）」重交，不新增作業；週頁只連 `homework.html`。
- 閱讀：選做、自由分享，連 `homework.html#reading`。第07週 reading period 需在教師後台建立（見待辦）。
- 努力樹：`shared/reward-tree-config.js` 新增 07 普通5關與兩個 boss 活動；魔王花園 `boss-garden.js` 補 `07:` 描述，花園自動收錄。
- 首頁：07 週卡為最新並標「本週」，05 移除最新標記；`admin-progress.html` grade6-115-1 預設週次加 07。
- 快取：`boss-garden.js?v=20261014`，花園內 reward-tree-config 匯入加版本字串；index、boss-garden 的 navbar 版本更新。其他舊週頁 navbar 版本未改。

## 驗證

- `node automation/tests/grade6-boss.test.cjs` 通過：新增第07週花朵與第05週獨立計算、重複列不重複給花、題目資料（5關、魔王10行／9行、無彎引號、無空行）、與第05週句子重疊僅限刻意複習的 Sentence B 兩行。
- `node automation/tests/grade6-week07-browser.cjs` 通過（本機靜態伺服器＋headless Chrome，auth 與 Supabase 以記憶體模擬，合成帳號）：匿名鎖定、草稿儲存與重新整理回復、儲存失敗不慶祝且可重試、魔王完成寫入 weekCode 07 且不碰 05、慶祝後回花園、花園4張卡、普通5關完成、首頁07為最新、navbar 05↔07、1280／390 無水平溢出、無 pageerror。
- 已目視 1280 全頁、390 英語魔王與魔王開花畫面截圖。
- `automation/tests/boss-garden-browser.cjs` 已把卡片數 2 改為 4，但此測試需工作瀏覽器 CDP 9232 與 localhost:3000，本次未執行。
- 未以真實學生帳號驗證；未 commit、push 或部署。
