# Puppeteer雙擊測試要用count

## 症狀與失敗嘗試

燈箱單擊、縮放、滾輪與拖曳正常，但 `mouse.click(...,{clickCount:2})`、先單擊再給clickCount及ElementHandle同參數都沒有收到dblclick；測試等待超時。加入事件觀察後確認不是縮放值計算錯，而是根本沒有dblclick事件。

## 根因與修正

本機Puppeteer Mouse.click實作解構的是 `count`，每一個真正按下／放開才由內部寫入CDP的 `clickCount`；外層舊參數會被預設count=1覆蓋。與[官方MouseClickOptions文件](https://pptr.dev/api/puppeteer.mouseclickoptions)一致：`count`才是要執行的點擊次數。不要混用[CDP Input.dispatchMouseEvent](https://chromedevtools.github.io/devtools-protocol/tot/Input/#method-dispatchMouseEvent)的clickCount與高層函式參數。

使用 `page.click('#lightbox-img',{count:2,delay:80})`，觀察真正原生dblclick、isTrusted與220%縮放，再驗重設、關閉和手機手勢。不得用 `dispatchEvent(new MouseEvent('dblclick'))` 冒充真實雙擊驗收，也不需修改共用燈箱或瀏覽器安全限制。這次遵照使用者免Claude複核指示，問題排查使用本機實作與官方文件，未啟動Claude。
