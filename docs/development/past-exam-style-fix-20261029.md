# 考古題作答頁風格修正（2026-10-29）

使用者指出首次上線頁面與既有考前練功房差異很大。原先只同步配色，仍保留 prototype 的大標題、空白、重複說明與選項外觀，不能視為已統一風格。本次以 `quiz.html`／`quiz-student.css`／`quiz-theme.css`／`quiz-workspace.css` 的現有作答元件作為基準。

## 實際變更

- 載入既有 `quiz-author.css` 基礎樣式，沿用 Noto Sans TC／微軟正黑體、共用 navbar 與三年級主題；使用與練功房相同的「考前練功房」名稱。
- 新 `quiz-past-style.css` 取代學生頁的舊 prototype CSS；題文、選項、字重、間距、圓角、四色背景、陰影、已選及鍵盤焦點樣式與現有作答元件對齊。避免一般 `.student-wrap .material` 的紫色材料樣式覆蓋題文。
- 移除第二條重複頁首，原卷標題改成緊湊標題列；進度有實際 progress meter。首次進入優先顯示題目。
- 題組選單、成績紀錄／重作、規則分成可展開區塊。保留全卷計分、畫圖自核對、3疑義小題暫停及努力樹說明；移除同頁重複說明。
- 底部固定前後題組與送出按鈕，按鈕與題文不需互相追著捲動。O／X 僅各顯示一次，旁附「正確／不正確」，用既有選項徽章樣式呈現；原選項值不改。
- 只改顯示與操作元件外觀，沒有改 SQL、Edge、媒體、評分、重送封包、重作、歷次紀錄或一次給葉規則。

## 驗證及發布

- 66 項回歸全部通過、零失敗／零略過，約 59.5 秒。
- 本機 Chrome：桌機1280／手機390，題目第一屏可見、無橫向溢出、固定操作列、各題型切換、同封包重送、55→56→92分／葉0→1→1、歷史與登出清圖文通過。
- 增加實際樣式對照：同頁以原 `#server-quiz .student-option` 建立隔離參考節點，對比兩個選項的背景色、圓角、陰影、字體計算值；全部一致。這是原樣式的元件比對，不冒稱已重跑既有正式學生的整份測驗。
- 使用原正式完整發布包，只疊加本次顯示修正，候選14個相關 runtime 檔 SHA 核對通過。部署 `dpl_5kgNTUX2Hr3NqhbnykhnCenQDjyb` 已 promote，正式248個靜態檔 SHA 核對一致。
- 正式來源 Chrome 使用真 HTML／JS／CSS，auth／RPC 仍使用隔離 fixture，沒有正式學生測試寫入；證據在 ignored `automation/output/past-exam-production/style2-live`。

學生入口不變：<https://it-class-tcwu.vercel.app/grade3/115-1/past-exam.html?paper=dingxi-114-1-g3-exam1-science>。回復前端可 promote 至前版 `dpl_6q3C3ZH7U23iuKQSoBHHeukFUCdm`，不需回復資料庫。

不要直接重跑歷史 `past-exam-ui-build.py`，它依賴舊 prototype，可能覆蓋後續手動修正。可重用經驗已補進 [作業指南](past-exam-playbook.md)。
