# 考古題全題型風格與手機檢查（2026-10-29）

使用者要求逐一檢查其他題型，排序、複選、畫圖與手機版都需統一考前練功房風格。本次接續前次風格修正，沒有變更原題內容、正解、配分、計分政策、私有媒體權限或正式學生紀錄。

## 題型與實際改動

| 題型 | 本卷題組 | 檢查／修正 |
| --- | --- | --- |
| 是非／單選 | 第1–29題組 | 原四色選項、已選與儲存狀態；逐題操作及送出 |
| 勾選敘述 | 第30、32–34、38題組 | 未確認時不得送出、確認後保留未勾選；各列補齊原四色背景，已選維持主題綠 |
| 排序 | 第31題組 | 四色卡、下拉與上下移按鈕、鍵盤 Enter 操作；順序送出結果一致 |
| 圖號／代碼填答 | 第35題組 | 四色欄位卡與共用字重；圖片、各欄選擇與送出 |
| 複選集合 | 第36、37、39題組 | 欄位卡、代號按鈕與按下陰影；選取／取消／重選與每欄集合保存。修正共用 fieldset 樣式把 padding 清掉的問題 |
| 畫圖 | 第40題組 | 統一工具列和方向鍵卡片；手機工具兩欄。測點選／觸控放點、兩點畫箭頭、復原、方向捷徑、清除與鍵盤；提交前無官方參考、提交後可見，正誤保持 null |

各控制項加捲動安全空間，保持固定底部操作列可用。題卡加上不含答案的 `data-kind`／`data-group-id`，供題型限定樣式與精確驗收。沒有新增前端計分或略過正式後端計時的入口。

## 驗收方法與證據界線

`automation/lib/past-exam-type-checks.cjs` 透過既有 browser harness 和隔離 localhost fixture 驗收，不以直接寫 DOM 值冒充點選。下拉使用 Puppeteer select 事件；按鈕、選項和畫圖使用實際滑鼠、鍵盤或 Chrome 觸控事件。

- 1280px 與 390px：每個尺寸走完全部40題組，80次實際作答／送出，並核對無橫向溢出、控制項至少44px、固定操作列、圖片載入。全卷92分，首次完成給1葉，第二次完整作答仍1葉。
- 360px：再檢查11個非選題組的版面，共91個題組／尺寸檢查。
- 5個非選題型各保留桌機／手機截圖，共10張，檔名為 mark、sequence、code、set、annotation 加尺寸。
- 正式來源驗收另外操作有圖片題組的同頁燈箱、放大及關閉。
- 正式來源最終一輪91檢查全部通過、10張截圖完整，程序exit 0；逐題進度在`types3-live/types-progress.jsonl`，最終結果在`types-report.json`。
- 66項既有與考古題回歸全部通過、零略過，約67.4秒。

手機驗證是 Chrome 390／360px 與 touch emulation，沒有宣稱用實體 iPhone／Android 實機或多種行動瀏覽器驗證。正式來源測試使用真 HTML／JS／CSS，auth、RPC、圖片與答案資料由本機隔離；沒有送假答案到正式資料庫。測試加速 view 時間只發生在 nonce 保護的 localhost fixture。

首輪工具曾用 Puppeteer focus 操作 SVG 而被拒絕，改用 SVG 支援的標準 focus 後鍵盤測試通過。本機91檢查完成後也曾在解除攔截／還原手機 viewport 時觸發請求競態；已改為 await 攔截回應、結束時關閉精確的自有測試分頁，避免重新載入正式身分。這兩項是測試工具修正，沒有拿首輪非零結束狀態當整體驗收成功。

正式來源初輪連線在 Puppeteer 初始化其他分頁時遇到 Network.enable timeout，尚未進入題型操作。驗收腳本透過共用 safe-client 支援的 Puppeteer connect 參數，限定 page target；保留 browser／tab 父層 target 才能連到指定 page，不初始化其他 page。仍使用原租約、保護入口與精確 target 斷言，沒有改共用瀏覽器設定或接管其他分頁。候選／正式檔案 SHA 與本機驗收證據不受此工具故障影響。

限定target仍不足以恢復；釋放01並取得空閒02後，新的空白HTML頁亦遇相同初始化逾時。依[Chrome DevTools背景分頁問題](https://github.com/ChromeDevTools/chrome-devtools-mcp/issues/1230)與[Puppeteer connect參數](https://pptr.dev/api/puppeteer.connectoptions)進行兩階段連線：先在 `networkEnabled:false` 下透過共用 safe-client 連上精確自有頁面，用受保護的 `grantForegroundOnce('Page.bringToFront', reason)` 喚醒，斷線後再以網路監測開啟的正常模式重連，才安裝請求攔截。此後恢復逐題操作。沒有關閉記憶體節省設定、重啟整個Chrome、讀取憑證或移除租約保護；底層Chrome原因未做進一步鑑定，不把相關issue當成這台機器已證實的根因。

## 發布與交接

部署 `dpl_9U4pQ8zsHwKcNbo6QHVb2Quezf18` 已 promote；14個候選相關runtime檔案與248個正式靜態檔SHA核對一致。以最新完整凍結包加本次少量 UI 修正，不使用 dirty 主工作區整包發布。正式網址沿用原自然考古題入口。

私有驗收資料放在 ignored `automation/output/past-exam-production/types3-*`；分支 `codex/past-exam-production`。本次不改 SQL 或 Edge；若需回復前端，可回到 `dpl_5kgNTUX2Hr3NqhbnykhnCenQDjyb`，保留學生歷次作答與領葉帳本。
