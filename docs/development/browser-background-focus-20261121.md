# 背景分頁的 activeElement 不能證明聚焦事件已觸發

本機持久工作瀏覽器的狀態投影測試遇到：呼叫input.focus()後，activeElement已指向指定欄位，但依focus事件移動的按鍵區仍留在第一欄。檢查資料、改為focusin與重跑仍失敗；沒有因此把失敗當成產品事件處理的缺陷。

以同一目前renderer、同一內容、同一持久瀏覽器完成A/B。背景新分頁的visibility為hidden、document.hasFocus()為false、activeElement吻合、focus事件0次，按鍵仍在原格；只啟用本輪精確測試分頁後，visibility為visible、hasFocus為true、原生focus事件1次，按鍵正確到第二格。沒有注入focus事件或mock。私有證據為manualslots2-focus-ab-proof.private.json。

[HTML Standard的聚焦API](https://html.spec.whatwg.org/multipage/interaction.html#dom-document-hasfocus-dev)區分activeElement與document.hasFocus的意義。上述本機A/B提供實際行為證據，不能由一般Playwright新context的焦點模擬推論目前CDP持久瀏覽器也相同。

後續驗證真實聚焦、按鍵列位置與focus listener前，依本機共享工具核租約及精確分頁，在保護入口取得本次Page.bringToFront授權後啟用該頁。保留背景行為作診斷對照，不能以偽造聚焦事件湊測試，也不因此改全域Chrome設定或接管其他分頁。一般純資料、API或非聚焦UI檢查可繼續在背景執行。

原逐input focus listener已還原並通過20個真來源狀態投影（兩來源各10種，含後補整數紅綠框核對）；暫試的delegated focusin沒有作為修正保留。兩輪Claude是唯讀程式複核，不曾親自操作此A/B或瀏覽器測試。
