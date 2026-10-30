# 第二級努力樹樹型外觀（2026-10-30）

使用者指定原已繪製的另一種樹幹作為第二級可換皮膚，切換時播放成長風格的換頁過場。沿用既有透明 A／B 樹素材及各自96葉24花掛點，不生成新圖。

樹下方提供「第二級禮物・樹型外觀」：舒展大樹（A）、層層大樹（B）。預設A；選擇存於學生帳號，重新進入或更換裝置可保留，第一級沒有此選項。切換先儲存成功再播放約1.15秒暖光／舊影淡出與新樹舒展淡入。這是換裝過場，不稱再次升級，不消耗、不重發花葉。原成果順序與ID不變；切換期間暫停花葉點選，完成後使用新樹掛點尋找原來源。減少動態／頁面不可見直接切換；中途啟用減少動態或切走立即清理過場。

## 資料及風險邊界

- 新增獨立 garden_tree_skins 表及 garden_tree_skin(text) RPC。只存本人a/b外觀，不寫入學生作答、進度、成長紀錄或其他偏好表。
- 必須登入、已確認信箱、115三／六年級名冊、非教師並有本人garden_growth成長紀錄才能讀寫。解鎖的外觀偏好跨學期保留，仍只在目前成果達第二級的畫面呈現。
- RLS禁止前端直接表讀寫，匿名不能呼叫RPC。讀取預設不新增列；舊外觀相同的儲存不更新。前端離頁／換人／換課程的舊回應忽略，錯誤可重試。
- 實際正式庫沒有舊 garden_preferences RPC，因此採獨立加法功能，沒有重新安裝歷史SQL或覆寫作答函式。
- migration前後雜湊相同：garden_growth dd67324a…、quiz_action 7551903b…、quiz_rewards 5ae975c9…。正式權限檢查 no_anon／no_direct_read／signed_in_only 均true。

## 驗證及發布

PGlite驗證第二級門檻、本人預設／儲存、非法樹型／匿名／教師／第一級拒絕、RLS與原成長快照不變。瀏覽器1440／390px：樹優先版面、45葉10花不變、B過場確實播放、點B葉仍回原leaf-0來源、儲存失敗不換外觀、減少動態清理及直接切換、新場景恢復B、成長重播開關正常、零頁面JS錯誤。這些為合成fixtures。

正式 `dpl_2AHxbiKn7VCjJfHpBEquNH3hWQA9` 基於前正式 `dpl_4BMs8XwYYy7Tx5Zr3BLBH8Ecrrt7` 完整537來源，僅stage、effort-garden-v2的JS／CSS修改及新增garden-tree-skin.mjs，另534檔UID相同。先production skip-domain、guard確認基準未變才promote；正式HTTP與內容比對通過。證據位於忽略目錄 automation/output/quiz/garden-tree-skin/。

正式頁面核對30730測試帳號後，B外觀及重整後恢復B正常，45葉10花保持，截圖已確認；原先選擇為B，因此仍保留B，沒有更動其升級紀錄。
