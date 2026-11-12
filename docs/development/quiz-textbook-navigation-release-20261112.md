# 課本前後翻閱修正發布收據

2026-11-12，PR185合併main `dd9e3af7750347ec0e2209cfa7b6015ca99aa1e6` 後，由新乾淨main執行發布腳本部署、完整樹比對及promote。正式 `dpl_7j5nfys6Ex7Guecp1rKY98LFh77j`，回滾 `dpl_BrTBJPdhMUbcWzpU3h58UN5BLbJL`，發布鎖已釋放。

使用者第110頁只能看一頁，確認根因是實際排序碼sequence逐頁不同，舊閱讀器誤當導航分組。修正前後鍵依同書已披露頁面的印刷頁排序，下拉列所有已授權本書頁並標示本題參考；完整拉頁不拆、跨書隔離、媒體驗權及閱讀位置保留。只有已註冊可讀頁，不冒稱全冊已提供，也不擴張教材授權。

10項study SQL／前端／建置及導航回歸、21生成產物與49項一般／個人考古桌機1280／手機390檢查通過。瀏覽器刻意使用每頁不同sequence、亂序與另一bookId以重現根因；檢查前後翻、首末頁、頁碼選單、回本題頁、拉頁及位置保留。合成身分及圖片，不冒稱正式學生OAuth或真教材供圖驗收。

完整樹19修改、0新增／刪除、額外差異0；正式24來源SHA讀回一致。無SQL、資料庫、學生作答、教材上傳、Worker／RLS或考古卷enabled變更。

[來源與修正](quiz-textbook-navigation-20261112.md)／[機器可讀收據](quiz-textbook-navigation-release-20261112.json)。私有metadata及檢查證據在`C:/Users/user/ai-now/textbook-page-navigation-20261112/`。
