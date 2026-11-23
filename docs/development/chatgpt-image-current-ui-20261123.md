# ChatGPT圖卡：新介面辨識與同筆成品回收

## 症狀與確認原因

2026-11-23製作三年級第13週圖卡，舊流程先在帳號選單等待逾時，接著無法辨識圖片模式，送出後又誤報「image generation did not start」。對照實際DOM確認：

- 個人檔案浮層不再保證有`role=menu`；須確認可見的小容器同時包含預期帳號及登出選項。
- 對話／工作切換使用可見按鈕的`aria-pressed`，舊`data-tpp-toggle-value`選擇器缺席。
- 已選圖片工具為`data-system-hint-type="picture_v2"`、`data-system-hint-label="製作圖像"`。
- 圖片確實完成，但新成品是`img[alt="產生的圖片 1"]`的`blob:`網址；舊下載器只辨識既有backend圖片形態，漏收成品。
- `cdp-safe-client`依URL選頁可能先命中另一張自己建立的首頁；不能以targetUrl的同站配對當作精確target。Playwright的exactPage與Puppeteer工具必須對準同一個租約target ID。

## 解法與界線

本次局部driver在共享租約／worker入口內核對帳號、圖片工具標記與參考，保留pill插入完整UTF-8 prompt，沿既有單次送出及接受檢查；沒有重送已接受的請求。實驗driver留私有證據，不以尚未完整回歸的流程取代原共享入口。

舊成品偵測失敗時，從同一已接受對話讀取明確「產生的圖片」blob，沿原下載函式驗MIME、檔案魔術碼、bytes及SHA。不能把上傳的參考圖當成品；不能以頁面回覆文字或清空composer判斷已下載。

本次手動回收同一筆請求成功：原圖1672×941／1,829,010 bytes，逐字目視後壓1920×1080 WebP q80／173,192 bytes，上傳並回讀SHA一致。metadata保留舊偵測失敗與回收結果，未重送該筆已接受提示詞。公開圖卡資訊見`grade3/115-1/images/week13/infographic.json`。

可重用回收工具`automation/recover-chatgpt-image.cjs`只讀已接受對話的明確成品，要求共享runner、精確target、完整對話URL及新收據路徑，不發訊息、不重新生成。它整理自本次已驗下載流程；新UI的完整生圖入口仍待後續獨立回歸。原`weekly-infographic-image.cjs`保持原樣，避免本次網頁任務連帶改壞其他既有流程。

[Playwright導航與互動初始化說明](https://playwright.dev/docs/navigations#hydration)可作等待互動的參考；本次確認的是上述DOM／target／blob差異，不把所有逾時歸因於hydration。
