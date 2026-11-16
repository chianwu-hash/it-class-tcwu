# 背景驗收載圖：使用固定間隔等待

本次三年級國語原卷驗收，課本圖片已完成載入、自然寬953px、狀態已顯示可閱讀，背景測試卻持續等到逾時。單獨讀DOM能確認結果；調整視窗大小與重新載入都沒有解決。

原因是驗收使用`waitForFunction`預設的`requestAnimationFrame`輪詢，背景分頁不能依賴畫面更新時機。改為`waitForFunction(predicate, null, {polling:5000})`後，桌手機開課本、翻頁、回本題頁、關閉返回同次原答，11項通過。網站執行程式及外層介面沒有修改。

往後背景驗收須檢查實際圖片尺寸、可見性、印刷頁與返回狀態，不能只驗按鈕存在，也不能把等待逾時直接當作網站載圖失敗。先保存DOM、圖片與狀態證據，再縮小原因；不以反覆重載或改正式網站來繞過測試。

同日數學合成驗收另觀察到`img.decode()`的等待逾時，但錯誤後讀DOM時全部圖片已`complete:true`且自然寬大於0；恢復固定間隔檢查實際尺寸後通過。背景測試不把這個Promise完成與否當成唯一載圖證據，也不因而修改正式renderer。合成測試若使用nonce路徑限制，本機CSS內的絕對字型URL須限定重定位到同一nonce路徑；字型403是測試路徑配置問題，不能放寬整個伺服器存取守衛或誤報正式站字型失效。

Playwright對`raf`與數字間隔的定義見[官方Page API](https://playwright.dev/docs/api/class-page#page-wait-for-function)。本次私有證據在`D:/AI-Work/g3ch-past-resume-20261117/`，包含失敗狀態與`book-browser-proof.private.json`；沒有公開教材、簽章網址或學生資料。
