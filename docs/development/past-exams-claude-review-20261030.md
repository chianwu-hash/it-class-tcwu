# 2026-10-30 考古題疑義第二輪複核

教師要求先由Codex與Claude核對容易判斷的疑義，再交由教師確認。本輪只產出本機建議與教師確認介面，沒有更動正式題庫、媒體、配分、學生答案、歷次成績或葉片；先前已獲核准的P04不重審。

## 可交付內容

本機目錄 `automation/output/past-exams-review-20261030/`：

- `考古題疑義審閱-Claude複核建議版.html`：主要審閱介面，保留原題、官方原記號、原頁影像、PDF、來源SHA，另列整合建議與實際查閱範圍。
- `review-data-claude.private.json`：37卡的結構化快照及四輪執行摘要。
- `Claude複核建議總表.md`：可搜尋的提案摘要，**不是教師確認紀錄**。
- `qa-claude-results.private.json`、桌機與手機截圖：本機驗收證據。

原審閱HTML及教師下載匯出檔未覆寫。新頁未預填同意；教師逐項按「同意此建議」才會填入完整建議，已有內容時另確認是否取代。手動填寫仍可使用。草稿依新快照雜湊在瀏覽器暫存，重新整理可讀回；暫存失敗會顯示提醒，**仍需匯出Markdown或JSON交回**。程式不直接讀取使用者目前分頁或瀏覽器草稿。

## 數量與決策邊界

現行40暫停欄＝13非聽力P欄＋27聽力欄。本頁37張卡含額外覆核事項，不等於37個暫停欄。

| 類別 | 卡數 | 範圍 |
| --- | ---: | --- |
| 明確答案建議 | 11 | P01、P02、P03、P05–P10、P12、C07 |
| 需確認處理方式 | 6 | P11、P13、P14、C01、C09、C22 |
| 建議維持現況 | 15 | 其餘有可辨答案、原配分或人工評量方式的C卡 |
| 缺稿先暫停 | 5 | A01、A03及其重疊子項C16–C18 |

C07與A02為同一道海豚聽力題，合併呈現。A01與A03共26欄；C16–C18是A03子集，不能重複計數。12組R人工參考題已開放，不另當成停用題重問。113六英頁首「下學期」誤植已有教師決定依目錄歸上期中，不再列未決事項。

## Claude執行與驗收

使用[chat-mode](D:/skill-vault/skills/chat-mode/SKILL.md)的CLI supervisor唯讀review；Claude Code 2.1.289，以OAuth訂閱登入。僅Read／Glob／Grep，無shell、網路、憑證、寫入及發布權限；已說明其讀取工具不是OS路徑沙箱。Codex是父專案唯一寫入者。

凍結來源包 `.chat-mode/pending-review-20261030` 為獨立Git，分支 `review/pending-20261030`，HEAD `2084533f9dafde3480d36e6027999f95bc1425eb`。50卡作上下文，151個去重來源檔SHA逐檔驗證。session `20261030-pending-answers-01` 分P13、C12、C10、A3四輪，共38筆建議（C07／A02重複一題）。四輪run完成、exit 0、唯一完成標記、`conversationViewerStarted: true`、Git未改皆已檢查。回覆與逐輪修正保留在來源包 `.chat-mode/sessions/`。

Claude主要看頁面影像，未逐份開啟PDF。Codex另外查看關鍵原頁、重算數學、比對字跡，並查[教育部「亂」](https://dict.revised.moe.edu.tw/dictView.jsp?ID=3850&q=1&word=%E4%BA%82)、[教育部「露出」](https://dict.revised.moe.edu.tw/dictView.jsp?ID=60835&q=1&word=%E9%9C%B2)、[國教院浮力教材](https://stv.naer.edu.tw/watch/299846)、[氣象署季風](https://edu.cwa.gov.tw/PopularScience/wt/wt_3.html)與[鋒面](https://pweb.cwa.gov.tw/PopularScience/kids/wt/wt_16.html)。查閱證據不等於所有課文與小圖皆已獨立求解：C06缺課文全文；C13颱風細路徑未逐線重描。

整合時撤回無原卷依據的新增政策：C04數線拆分分數／數位畫線±1mm、C08國家與食物拆各1分、C11末答與過程另分配。C01若無序比對需多重集合，不能用去重集合。P07需三個比值及比較，不能只答小蝦拿整題分數。P11若要④，建議明確改成「水的浮力」並交教師同意；P13若收乙要補原共同圖。缺完整發話稿不能從答案逆造「官方稿」。

## 相容與後續

新頁沿用 `past-exam-review-decisions/1` 匯出格式。C06與P04同卷，已比對新舊bundle除了P04外所有題組逐字一致，轉接至目前SHA `b905765fa5b7fad2fa17563bf4b9f8bdb9a5cdec97a5911e7691f023a0f948b2`；舊SHA另存。套用教師之後的確認仍應按題目ID、來源SHA及目前不可變版本逐題轉接，不能把舊bundle整份蓋回而撤銷P04。

重建腳本 `automation/past-exams-claude-review.py`，整合提案 `automation/past-exams-claude-review-20261030.json`，教師草稿功能 `automation/past-exams-review-draft.js`。來源包、原頁、教師確認及產物均為ignored本機資料，clone不含；不可假設安裝repo就有來源證據。腳本只重建**新頁**，但會改變新快照ID，因此教師開始填寫後不可任意重建；先匯出／備份，保留原快照。

本機Chrome經AI工作瀏覽器分身02的有效租約與註冊worker驗收，未碰使用者既有填寫分頁。驗收包含37卡／四類、顯式同意前匯出為空、同意後原文與SHA匯出、草稿reload回復、篩選、原頁圖旋轉、117個引用檔及1280／390／360無水平溢出，pageerror 0。手機是模擬，不是實體手機；草稿回復在隔離HTTP來源測過，file來源若不能暫存會顯示匯出提醒。QA只清除自身測試來源的草稿。測試分頁關閉、租約釋放、4889伺服器停止；以系統預設程式開啟本機HTML，無須維持伺服器。

本輪自14:49來源包凍結至15:18左右交付約29分鐘；四次Claude實際執行共530.227秒（約8分50秒），其餘為人工式原頁核對、公共來源查證、提案整合與本機驗收。後續等教師匯出／對話確認，再依明確授權建立新版本、驗證、發布；此批AI建議尚未核准。
