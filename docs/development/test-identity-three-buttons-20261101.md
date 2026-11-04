# 三個測試身分：直接切換到另外兩個身分

2026-11-01，使用者指出學校測試帳號已有三個身分，每個身分應顯示兩顆切換按鈕。原共用模組雖已有三年級、土城四年級與六年級設定，仍以循環順序只產生一顆按鈕。

`shared/test-identity-switch.js`改為排除目前身分，為其餘兩個身分各產生一顆按鈕；按鈕保存明確目標年級，不再依循環推算。切換送出期間兩顆均停用，另以執行中旗標防止重複送出。保留既有帳號限制、RPC結果／session核對、跨分頁revision通知及正確年級首頁導向；失敗不發布成功通知，留在原頁顯示訊息並恢復按鈕。一般學生與未登入者不顯示也不呼叫切換RPC。

根首頁與三／四／六年級115上首頁的模組版本更新為`20261101-three-buttons`，讓舊瀏覽器重新取得修正版。沒有改Auth、SQL函式、RLS或學生進度資料。

驗證：`automation/tests/test-identity-three-buttons-browser.cjs`使用登記AI工作瀏覽器及合成Auth／RPC，六個方向在1280／390px各測一次，共12次；各身分恰好兩顆且排除自己、目的頁／班級一致、送出時兩顆停用、失敗可重試、session換人拒絕、一般帳號零RPC與手機無橫向溢出均通過。另以正式Supabase測試帳號做三個身分六方向的交易測試後rollback，名冊摘要不變。未冒稱正式真人OAuth驗證。

發布由最新正式`dpl_Dn1Kxt44tEYaxPbU866hc7EG7vNB`共781來源檔建立完整包，只疊本輪5檔。候選`dpl_6iQ8aWjvgYm8PUFbWnueSppPm5mC`通過後promote，正式`dpl_4LsmuQBTztjPS3vvG6a8nXLQd93w`；781個來源檔全比對、12個關鍵runtime回讀相符，包含四年級考古題入口。promote短暫別名傳播期間第一次讀到前版，待正式別名穩定後重驗通過。沒有覆蓋其他新發布內容。

私有證據：主工作區ignored `automation/output/test-identity-three-buttons-20261101/`，包含`browser/report.json`、桌機／手機截圖、`cloud-check.json`與`frontend/live-verified.json`。瀏覽器worker已結束並釋放租約。需重跑browser驗證時先取得租約與精確空白target，再透過`D:/ai-browser/run-background.cjs --lease-id <LeaseId> <測試腳本絕對路徑> <TargetId>`執行；不使用舊兩身分測試的裸Chrome入口。
