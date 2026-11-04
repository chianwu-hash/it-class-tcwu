# 連線偵錯全站開關：目前關閉

使用者要求增加偵錯開關並先關閉，待實班觀察後再決定是否開啟。

- 單一設定位於 `shared/connection-diagnostics.mjs` 的 `DIAGNOSTICS_ENABLED`，目前為 `false`。這是全站部署設定，不是讓學生自行開啟的按鈕；後續經使用者要求才改成 `true`，更新匯入鏈快取標記並重新部署。
- 前端關閉時不讀寫診斷 sessionStorage、不建立 UUID／事件、不計時、不掛診斷生命週期監聽、不啟動回傳 interval，也不顯示下載按鈕。diagnosticFetch 直接傳回原 fetcher，原請求及錯誤照常傳遞。
- 接收端動態匯入同一個設定，不另設容易不同步的開關。關閉時不解析／寫入診斷日誌，正常回 204，讓尚未重整的舊頁面清空已送佇列；HTTP method、來源及大小限制仍保留。
- 已開著的舊頁面需重新整理一次，才能停止舊程式的本機事件蒐集與回傳。接收端已立即停止記錄這些舊回傳。既有暫存不額外讀取／清除，分頁結束時由瀏覽器釋放。
- 不修改 SQL、Supabase 設定、學生資料、保存／重送／揭答、防弊、一葉或第三批優化；沒有重跑正式資料庫壓測。舊每分鐘 CLI sampler 仍停用。

## 驗證及發布

- 59 項完整候選模式回歸零失敗、零略過，之後新增接收端共用開關檢查，3 項偵錯專項全部通過。專項含關閉時禁止儲存／監聽／計時器／UUID／回傳，原 fetch 回應／錯誤直接傳遞、舊頁面接收端 204 且不寫日誌，以及開啟時仍正常批次持久化。沒有把兩次測試數量相加當成不重複測試數。
- 功能 `253d2bf`，分支 `codex/quiz-diagnostics-switch`，以第三批 `aba8a43`／`dpl_erUknwk6WfmcHuzphwQLi1oW8KRB` 的凍結發布包為底，只覆蓋 14 個產品及快取標記檔，未帶主工作區其他未發布內容。
- Vercel `dpl_9igJHMDmzwAeHQSqJHC3bbzeF1Gd`，候選 `https://it-class-tcwu-bkywblcho-chianwu-4755s-projects.vercel.app`，已 promote 至 `https://it-class-tcwu.vercel.app`。18 個候選檔與 239 個正式 HTML／JS／CSS／字型 SHA 一致；接收端冷啟動正常、四版舊回傳皆 204，確認 serverless 已包含共用設定模組。
- 正式來源瀏覽器驗證：關閉旗標、沒有下載按鈕、fetcher 原函式、沒有事件／診斷暫存寫入／診斷 interval，跨過 30 秒回傳週期仍沒有診斷上傳。只開無作答場次的練習清單，沒有真人送答。
- 私有驗證資料在 ignored `automation/output/quiz/diagnostics-switch/`：local-tests.log、release-manifest、staged-verification、live-verification、browser.json。自有驗證分頁於完成後關閉，租約釋放。

主工作區尚未合併新程式，後續沿本獨立分支接續，不能以舊主工作區整包部署覆蓋第三批優化或重新開啟偵錯。
