# 第二級努力樹空白修正（2026-10-30）

正式版：`dpl_877EgV3NBbzUr8MLXRSwgBCasA8R`。

## 原因與修正

父頁初始化會傳入預設花色 sunrise。stage 的 configure 直接改寫預載 flower Image 的 onload 和 src，若發生於原圖片尚未載完時，原 Promise 無法完成，導致 load.ready 永遠 false，僅有背景而無樹與花葉。

花色改用獨立 Image 載入，完成後再替換繪圖參照，不修改預載事件。以版本序號防止較早請求覆蓋最新花色；花色載入失敗保留既有花色與整棵樹。

## 驗證

- 人為延遲初始花朵圖 1.8 秒，舊版重現 ready=false；新版預設花色能正常就緒。
- 45 葉、10 花、樹幹實際像素與截圖確認；暖快取重載正常。
- 快速切色與亂序回應，最後選擇保持；花色 404 不影響樹。
- 390px 無水平溢位，零頁面 JavaScript 錯誤。
- 正式帳號 307 班 30 號：ready=true、45 葉 10 花、升級後 1 葉 0 花，無素材錯誤，實際截圖已確認。

發布基於當時正式版 `dpl_J9HvTo62HwJHyQCPxo83KYJK5oey` 的完整 536 檔來源，僅 `garden/stage.html` 改變，其餘 535 檔 UID 相同。先以 production skip-domain 部署，vercel curl 核對實際位元組，再確認正式基準未變後 promote。三年級考古題、題目回報模組、六年級第九週及三六年級作答頁皆 HTTP 200。未寫資料庫，未改 quiz_action，未重設升級紀錄。

本機證據：`automation/output/quiz/garden-render-fix/` 的 regression-qa.json、release-guard.json、production-qa.json、live-fixed.json 與截圖（忽略目錄，不提交學生資料）。

後續發布務必重新取得當下正式版完整來源，保留 Claude 的題序修正；不可部署舊快照。
