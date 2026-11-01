# 全班剩餘解鎖條件與版面：正式發布

2026-11-01，使用者確認本機版面後明確授權兩項更新一起上線。

正式入口：https://it-class-tcwu.vercel.app/admin-learning.html

以當時最新正式版本 `dpl_4ye54c9t4KsX1NeY66jUEjLXtJED` 的781檔完整來源建立獨立發布包，檔案均核對正式來源SHA-1；另外確認本次四檔在前次後台發布與最新正式版本之間沒有其他變更。只覆蓋 `admin-learning.html`、`shared/admin-learning.mjs`、`shared/admin-learning.css`、`shared/admin-learning-garden.mjs`，其餘777檔保持最新正式來源。沒有從主工作樹整包發布。

新版本：`dpl_AR83pSmHVKAugKxhSTaerQaFH4dB`。先建立不切換公開主網址的部署，逐檔核對來源，再 promote。切換後再次核對正式別名、781檔與公開網址四檔內容，全部一致。本次沒有SQL migration、Edge部署或學生資料寫入。

新增全班每人的剩餘解鎖條件，沿用個人模型。預設摘要，可一次展開全班所有條件。版面改為每人摘要在上、已解鎖功能與剩餘條件在下；窄螢幕上下排列，自然換行，不需橫向捲動。

正式站使用01工作瀏覽器獨立分頁，確認預期教師Google登入身分與真實名冊，直接呼叫正式唯讀RPC。301全21人及604全22人逐列摘要／全部條件與來源模型一致；全部條件分別173組及194組。開關不增加查詢，花朵排序、重新讀取保留檢視、切課程重設皆通過。1360、1264、1024、768、390px下，頁面、表格容器與全部條件格均無水平外溢，腳本錯誤0。桌機與手機截圖已人工檢視，條件自然換行且完整顯示；截圖隱藏姓名，不改資料。

10項花葉／等級／解鎖／班級差額模型測試全部通過。正式驗證證據在 ignored `automation/output/admin-learning-class-gaps-release-20261101/`：`baseline.json`、`source-guard.json`、`public-check.json`、`browser-report.json` 及隱藏姓名的桌機／手機截圖。瀏覽器測試結束已移除攔截、斷線並釋放租約。

## Git留存

正式站驗證的無個資原始JSON已另存至版本控制，避免只留在ignored輸出目錄：

- [正式瀏覽器驗證結果](evidence/admin-learning-class-gaps-20261101/browser-report.json)：兩班、五種寬度、摘要／全部條件、查詢與重新讀取結果。
- [發布來源核對](evidence/admin-learning-class-gaps-20261101/source-guard.json)：正式版本、基準版本、四檔範圍及其他來源保留結果。
- [公開網址檔案核對](evidence/admin-learning-class-gaps-20261101/public-check.json)：四檔公開內容核對結果與時間。

提交前重新執行四組Node測試，以 `node --test --test-concurrency=1 automation/tests/admin-learning.test.mjs automation/tests/admin-learning-readonly.test.mjs automation/tests/admin-learning-rewards.test.mjs automation/tests/admin-learning-live-server.test.mjs` 全29項通過。首次並行執行遇Node原生記憶體不足，改為依序執行後通過。發布工具的Vercel CLI包裝程式另納入 `automation/lib/admin-learning-vercel-api.ps1`，移除對ignored舊輸出目錄內腳本的依賴。本次僅Git提交，未重新發布或寫入正式資料。

發布工具補上直接執行判斷，避免匯入舊工具取得API函式時觸發其同名參數。首次準備曾觸發舊工具本機prepare並重建舊ignored候選；未觸發apply，沒有資料庫或正式站寫入。最終發布包獨立按最新正式來源hash建立，並通過逐檔guard。
