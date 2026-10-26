# Supabase私有題庫圖片：單張真實試傳

日期：2026-10-25。使用者明確要求先試做一次Supabase圖片上傳，並提醒既有Cloudinary圖床也要納入考量。

## 完成範圍

在課程網站設定的Supabase專案，透過已登入且可見帳號為`chianwu-hash`的Dashboard，核對組織、專案與專案識別一致後，建立私有儲存桶`quiz-media`，上傳一張分數單元教學圖。新增儲存桶與一個測試物件是本次實際雲端變更；沒有套用測驗SQL、部署Edge Function或發布網站，學生揭答驗權尚未接通真實雲端。

測試物件以`storage-smoke-20261025-`加檔案SHA-256命名，保留於桶內供後續核對。本次沒有新增學生／教師直接物件存取policy。Dashboard建立的桶目前使用預設50MB單檔上限與任意MIME類型；與`quiz-storage.sql`候選的8MiB／格式白名單設定不同，尚未套用候選設定。

## 實測結果

| 項目 | 結果 |
|---|---|
| 檔案 | PNG，26,432 bytes，1746 × 1167 |
| 私有桶上傳 | 成功，Dashboard列出1個物件 |
| Dashboard簽署下載 | HTTP 200，本次選用1天到期 |
| 下載內容 | SHA-256與本機原圖一致，已解碼目視核對 |
| 一般公開網址 | HTTP 400，無法讀取 |
| 未附簽署的下載網址 | HTTP 400，無法讀取 |
| 簽署網址保存 | 未寫入紀錄、原始碼、記憶或輸出 |

結果與本機原圖、下載核對圖位於Git忽略的`automation/output/quiz/hanlin-fractions-local/qa/storage-smoke/`，主要紀錄為`result.json`。目前通過的是Storage單張上傳／簽署下載／私有存取，不是學生登入、版本固定與答錯揭答的正式整合驗收。候選程式的60秒網址另依正式handler驗證，不能把本次Dashboard的1天有效期當成正式設定。

## 圖床分工待評估

專案已有Cloudinary圖床及`automation/upload-asset-to-cloudinary.py`、`automation/upload-infographic-to-cloudinary.py`流程；一般上傳參數未指定受控delivery type。後續容量與費用評估須同時考慮Cloudinary及Supabase，不把所有圖片預設放入Supabase。公開教材圖可評估沿用既有Cloudinary流程；需依作答狀態揭露的題目／解析素材，要驗證所選服務的權限與網址有效期。Cloudinary官方亦提供private／authenticated等控制，但不能把一般公開URL或隱藏網址當作揭答驗權。尚未決定全題庫最終分工，也沒有為本次提醒額外上傳Cloudinary。

參考：[Supabase私有儲存桶](https://supabase.com/docs/guides/storage/buckets/fundamentals)、[Cloudinary存取控制](https://cloudinary.com/documentation/control_access_to_media)。

## 後台操作診斷與重用

症狀：圖片上傳成功，但點「Get URL」沒有出現預期選單；後續監聽簽署請求亦逾時。

已確認第一個原因是Dashboard的Explorer宣傳浮層遮住按鈕。`elementFromPoint()`在Get URL按鈕中心命中宣傳卡片而非按鈕，關閉可見的`Close banner`後，真實點擊立即顯示到期選單。直接DOM click也不適合用來開啟該Radix下拉選單。第二個診斷點是原先過窄的簽署回應監聽條件未匹配實際後台請求；改為核對相同專案的Storage簽署回應後完成下載驗證。

重用順序：取得登記工作瀏覽器租約、固定精確頁籤，核對可見帳號與專案，檢查遮擋，再真實點擊Get URL → Custom expiry。只在記憶體內使用產生的檔案簽署網址，輸出狀態、檔案大小與雜湊即可；不讀取登入憑證、Cookie或既有剪貼簿。自動化完成後斷開連線並釋放租約。
