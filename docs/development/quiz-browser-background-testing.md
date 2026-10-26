# 問題：背景分頁測驗與媒體驗證停住

## 觸發與症狀

2026-10-24，本機題庫師生流程使用已登記的 Chrome CDP 分身測試。隱藏分頁的操作／條件等待可能停住，從未顯示的學生分頁音檔解碼逾時；把全部分頁先顯示一次，再統一載入音檔，仍有背景媒體未完成。

## 已嘗試的方式

- 原生 pointer click 與預設 rAF 等待在背景頁不可靠；教師預覽早期腳本曾停住。
- 改用 DOM 控制項事件與 MutationObserver 等待後，開場、送答、揭答及重整流程能繼續。
- 改 eager 圖片可確保目前題目圖片開始載入，但不解決音檔背景政策。
- 每頁先啟用後立刻切走，不能替代「保持可見直到原生媒體解碼完成」。

## 確認的原因與解法

Chromium 會延後背景媒體，不能把尚未顯示的背景頁當成 29 台都有可見視窗的學生電腦。逐頁透過已保護 session 的 `grantForegroundOnce('Page.bringToFront', reason)` 單次啟用，確認 `visibilityState=visible` 並等到 loadeddata，再切到下一頁，已能完成原生音檔解碼。不得改全域 Chrome 旗標或以裸 CDP 繞過租約。

- DOM 條件採 mutation 等待，不依背景 rAF；媒體改等原生 load／loadeddata 事件，另設 Node 側有界逾時。
- 頁面數量或 CPU 使用增加時，分開記錄媒體解碼、HTTP 集中傳輸、集中送答與畫面回應，不混成單一承載結論。
- 29 端 HTTP 直接集中送答已驗全部入帳，該次最慢回應 57ms；此為本機 PGlite／合成資料，不是正式 Supabase 指標。
- 各分頁原生解碼需要依序啟用；同時媒體傳輸另以 29 個同時 fetch 驗證。不得聲稱同一 Chrome 視窗有 29 個同時可見的頁面或已完成教室耳機聽測。
- 隱藏頁面同時送答曾出現部分 fetch 延遲約2.6～13.6秒，部分20秒逾時；移除媒體 CDP 攔截未解決。不能將全部延遲直接歸因於攔截器，也未據此改動產品逾時設定。
- 已通過的多人測試採 `--visible-submit`：依序啟用、送出，之後集中等待；29位皆保存，超額加入被拒絕。這個測試模式與「29個始終隱藏的分頁同時送答」不同。後者仍未通過，不能用前者冒稱修好了後者或完成29台教室電腦驗收。

官方依據：[Chrome 背景分頁計時器說明](https://developer.chrome.com/blog/background_tabs)、[Chromium 背景分頁載入政策原始碼](https://chromium.googlesource.com/chromium/src/+/32511bffa0fc2efd2217a056be89e5ea655a639b/chrome/browser/performance_manager/policies/background_tab_loading_policy.cc)。現場結果仍須依 `automation/output/quiz/` 的個別測試紀錄判斷，不以官方政策代替本機成功證據。

## 重用

`automation/tests/quiz-session-browser.cjs` 使用租約 worker、保留精確教師 TargetId、新建並保存每個學生 page，最後只關閉本次建立的學生頁。`--module-only` 只跑預設測驗／逐題練習與身分切換回歸，避免無理由重跑完整多人流程。
