# 全班剩餘解鎖條件：本機候選

> 後續使用者已授權上線，兩項更新均已發布並完成正式站複驗，見[正式發布紀錄](2026-11-01-admin-learning-class-unlock-gaps-release.md)。下方保留當時本機階段紀錄。

日期：2026-11-01。使用者要求全班彙總也顯示每人的剩餘解鎖條件，明確指定先在本機測試、不上線。本輪未部署網站、SQL或Edge，也未commit／push。

## 最新版面修正

使用者指出右側條件在寬表中被截掉，因此不再依賴橫向捲動。每位學生改為兩層排列：上層保留座號／姓名／葉花／半葉／等級／紀錄狀態摘要，下層在可用寬度內顯示「已解鎖功能」與「目前還差的解鎖條件」。條件可自然換行、整列自動增高，沒有固定高度截斷。

當後台內容區小於720px時，摘要改為附欄位標籤的三欄配置，功能與條件上下堆疊。桌機與手機皆不需要左右捲動。原有每位學生一個資料row與對應座號仍保留，排序、資料加總、差額計算及全部條件開關未變。

同一份本機實際資料重新驗證301全21人、604全22人，摘要／全部條件與來源一致，重新讀取與排序正常；1360、1264、1024、768、390px 五種視窗寬度下，頁面、班級容器與所有條件格皆無橫向外溢。另檢查手機所有欄位都在學生列的邊界內，條件元素沒有水平或垂直截斷。桌機與手機截圖已檢視，測試截圖暫時隱藏學生姓名，沒有更改實際資料。原正式發布包仍經SHA-256確認未變，未上線。

入口：`http://localhost:3000/admin-learning.html`。頁首明示本機候選，既有資料透過教師JWT與已部署的唯讀RPC查閱，不使用Management橋接，不提交學生答案或修改成長／解鎖紀錄。

- 班級表新增「目前還差的解鎖條件」。預設列升第二級差額與下一項目標，例如「還差1朵花」或「升二級後目前已新增3葉、1花；還差9葉或2花」。升級前後的成果仍由同一個人模型區分，不另造計算規則。
- 表格上方新增「顯示全班全部功能的剩餘條件」開關，可一次查看全班所有未解鎖／待同步／待確認項目的條件，無需逐人進入明細。相同狀態與條件合併列出功能名稱，已解鎖功能不重列為待解鎖。
- 未連結或帳號衝突不猜數量；舊快照待同步者不假報數字。切換摘要／全部只在記憶體重新呈現，不重查RPC；重新讀取保留檢視，切課程重設摘要。原排序、葉花合計與個人入口保留；最新版面改為摘要與條件分層，不再使用需橫向捲動的寬表。

修改：`admin-learning.html`、`shared/admin-learning.mjs`、`shared/admin-learning.css`、`shared/admin-learning-garden.mjs`。另新增 `automation/admin-learning-class-gaps-local.mjs`、`automation/tests/admin-learning-class-gaps-browser.cjs`，並補充 `automation/tests/admin-learning-rewards.test.mjs` 的完整條件不遺漏／不誤列與未知狀態測試。

準備及啟動：

```text
node automation/admin-learning-class-gaps-local.mjs --prepare
node automation/admin-learning-class-gaps-local.mjs --serve
```

候選獨立位於 ignored `automation/output/admin-learning-class-gaps-20261101/publish`，從已驗證正式包 `dpl_FNyxToDFZyB57RQuRzAyQbQnRfJD` 複製後只疊本輪4個runtime檔。原正式發布包SHA-256逐一確認未變；未執行正式發布腳本。後續若獲准上線，仍須重新擷取當時最新正式來源合併，不可直接以主工作樹或本候選整包覆蓋。

驗證：10項花葉／解鎖／班級差額模型測試通過；本機真正教師登入下抽查301全21人與604全22人，摘要與全部條件逐列對照共用模型一致，開關不多送查詢、依花朵排序、重新讀取保留檢視、切課程重設、390px頁面不外溢與表格內捲動均通過，頁面腳本錯誤0。初次測試曾遇CDP逾時；登入恢復後也修正測試攔截器必須在頁面初始化前注入，避免查詢adapter已捕獲原fetch而漏記回應，未因此改產品計算。

證據：ignored `automation/output/admin-learning-class-gaps-20261101/browser-report.json`、`candidate.json`、`grade3-conditions-only.png`、`grade6-conditions-only.png`。截圖僅條件欄，無學生姓名與答案。工作瀏覽器01的自動化連線、攔截器與租約均已釋放，本機服務保留供使用者查看。
