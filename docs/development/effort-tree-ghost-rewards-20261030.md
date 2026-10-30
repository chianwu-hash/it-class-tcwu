# 第二級虛線花葉恢復（2026-10-30）

使用者指出第二級沒有第一級的虛線葉與花。原因是第二級Canvas只接已取得成果，沒有接 reward-tree-model 的 pendingLeaves／pendingFlowers。

已恢復未完成練習的標示，不是把所有空位畫成獎勵：沿原模式每次最多8片虛線葉、2朵虛線花，只對應實際尚未完成且有站內課程連結的項目，放在目前實心花葉之後可用掛點，滿槽不重疊。跨分區僅最後一區顯示；不增加成果或總數。兩樹型共用同一成果順序、各自掛點；日／夜分別用可辨識描邊。

點選Canvas虛線會送出對應待完成ID，父頁再以自己的模型白名單找站內grade3／6練習連結，不能任意導向外站。實心與虛線共同計算最近點，避免虛線誤選旁邊已取得成果。新增收合「繼續練習」連結清單，可用鍵盤操作。登出／換課程會清空清單，舊iframe訊息不處理。

本機合成：A／B、日／夜、55葉10花保持、8虛線葉2虛線花、點虛線回正確練習ID、390px不溢出、96葉24花滿槽不再疊虛線、零JS錯誤均通過。正式測試帳號只讀檢查，不點入練習或新增葉片；解鎖前一步維持。

正式 `dpl_J9cLJUUCH6GeoGqC7dj47jNFajzC`，基於當下 `dpl_CgFNve8sgdHtaykp7u26Suy4PAB9` 的完整539來源，只改 garden/stage.html 及 shared/effort-garden-v2.mjs，另537檔UID一致；基準未改才promote，正式內容及關鍵路由核對通過。未改SQL／獎勵／學生進度／解鎖條件。證據ignored automation/output/quiz/garden-ghost-rewards/。
