# 三年級學期中英打入口釋出（2026-10-06）

使用者指定比照六年級，在三年級學期共用導覽列提供「英打基礎」「中打基礎」。每週與首頁都可進入，不在第06週增加課程內容。兩軌各12大關，採學生本人 Google 課程身分並接到努力樹，完成一大關長一片葉、不長花。

保留既有難度：三年級英打第1～9大關8 WPM，第10～12大關10 WPM，小關90%不限速度、綜合95%連續兩組不同題。中打兩個年級皆不限速度，90%／95%連續兩組。三年級使用 starter_speed，但 starter 欄位仍是六年級選用起步模式的旗標；三年級 false 不代表採六年級標準速度。教師後台已開放三年級選項，門檻依課程顯示，可獨立匯出；週次及期末權重未調整。

## 正式釋出

- Vercel：`dpl_GumDNy7EF7nb4ijqg3ck2xYB9mVP`，已 promote 到 <https://it-class-tcwu.vercel.app>。
- 以前一份正式 Google 轉換釋出為基底，僅覆蓋14個宣告檔案，避免舊 Git HEAD 回退登入／舊成果接回流程。正式主網域下載14個檔案與私有發佈清單 SHA256 全部相符。
- 六年級課程／門檻沒有調整；兩個六年級入口的共用控制器版本有更新，共用控制器新增帳號變更鎖定及初始化錯誤處理。中英打 app 的 import 版本同步更新以避免沿用舊版封鎖三年級模組。
- 正式 SQL 只替換 `typing_foundation_action`，不重跑教材或進度表。`typing_foundation_grade3_google.sql` 檢查 Google 相依函式與24關 schema；實際正式安裝封裝另以舊函式 hash `acd92b9b1e6ddd943f6ca77821e306a4` 防止覆寫未審查變更，封裝及舊函式備份保存在私有 `foundation-install.sql`／`foundation-before.sql`，不放入教學網站。
- 三年級學生動作須通過 `grade3_google_ready()` 與115學年301～306名冊；匿名、教師、未綁定或錯年級帳號無法代闖關。教師 `admin_list/admin_reset` 沿用既有權限。

## 驗證

- PGlite 執行實際 foundation SQL：匿名／教師／未接回身分／名冊不符拒絕，兩軌各自 start/save/complete/unlock，六年級回歸；24關課程、出題題量、手指與門檻、努力樹單葉零花模型通過。
- `automation/tests/grade3-foundation-browser.cjs`：三、六年級中英打開始與儲存、課程路由、共用入口、390／1280無外溢；帳號變更即鎖定重載、匿名鎖定；三年級基礎樹2葉0花；教師切換六年級12 WPM／三年級8 WPM顯示正確。
- 第06週與02～05週合成回歸通過，含五次儲存、失敗重試、錯字提示、匿名及接回失敗鎖定、導覽事件、舊樹與貼上阻擋。
- 正式資料庫 actual30130 JWT claims 與 trusted binding：兩軌實際 start/save/complete、8 WPM英打與慢速中打、獨立下一關解鎖，全部同一交易 ROLLBACK。釋出後重驗亦通過。
- 正式資料庫六年級全12英打及12中打、暫停／低速中打、老師重置、兩軌互不影響完整合成回歸，ROLLBACK。舊測試曾因無 ORDER BY 的 JSON 陣列順序不同誤報 english_changed，已改為按 lesson_key 正規化後比較完整紀錄，修正後通過。
- 真正30130瀏覽器登入、本機頁面對正式RPC：中英打皆解除鎖定、顯示本人301／30與三年級規則，第二大關仍鎖定；未點開始或寫入學生進度。努力樹維持11葉2花。
- 釋出後計數：三年級 foundation0、六年級 foundation10、三年級 guest592／student9。測試未留下合成進度或改變學生既有成果。

## Claude 與限制

使用 chat-mode 唯讀 Claude CLI。第一輪因 Codex 在審查期間補測試，基線改變，被 supervisor 拒收；未把該輪當作通過。第二輪固定基線成功完成，未發現P0／P1，確認門檻／身分／兩軌／後台與樹串接；屬靜態來源檢查，未代替執行期驗證。第二輪後補齊快取鏈、完整版SQL相依檢查及SQL測試順序正規化；以上由 Codex 驗證，未宣稱 Claude 再次覆核。

正式網域檔案確認與本機真正Google學生RPC驗證分別完成；尚未替真實學生在正式網域另做一次Google OAuth，亦未代學生留下完成成果。真實注音輸入法選字與全班同時操作仍由課堂觀察。

本次未 commit／push；工作區有其他無關變更，僅限私有發佈封裝，後續應整合本釋出及前次Google釋出的宣告檔案到Git，避免舊主分支重新部署覆蓋成果。
