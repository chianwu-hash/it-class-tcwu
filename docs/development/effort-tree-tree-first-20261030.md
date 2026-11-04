# 努力樹優先的版面（2026-10-30）

使用者指定努力樹是頁面主角，應位於所有說明與可調參數上方。第二級改為實際 DOM 順序：外層場景在成長說明、重播／分區與來源清單之前；場景 iframe 內 canvas 在動畫控制及自動天氣資訊之前。保留語意順序，未用 CSS 視覺排序造成鍵盤順序不同。

桌面1440與手機390px驗證 canvas top=0、控制與天氣在 canvas 下方、外層說明在 iframe 下方、45葉10花完整、無水平溢出與頁面 JS 錯誤，成長重播可開關。正式帳號30730亦確認場景起於頁面約174px、canvas top=0、45葉10花；實際截圖已看。定位及天氣規則未改。

正式部署 `dpl_4BMs8XwYYy7Tx5Zr3BLBH8Ecrrt7`，基於當下正式 `dpl_4oeG1iffwaRjs2MfN5opZpSgnFLr` 完整537來源，只改 garden/stage.html 與 shared/effort-garden-v2.mjs，另535檔UID相同。guard確認基準未改後promote，正式內容與關鍵路由HTTP檢查通過。無DB、升級、獎勵、登入或作答修改。

證據：忽略目錄 automation/output/quiz/garden-tree-first/ 的 browser-qa.json、production-qa.json、live-browser-qa.json 與桌面、手機、正式截圖。最初驗證腳本直接取代已啟動動畫的頁面 DOM，產生測試自身 null 錯誤；改用無活動引擎的靜態文件建立獨立fixture後全部通過，未以產品修改掩蓋測試問題。
