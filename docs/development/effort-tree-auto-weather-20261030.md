# 努力樹學生介面自動天氣（2026-10-30）

使用者最新核定：學生不自行選日夜、雨勢或場景參數；首次進入且尚未選擇時，主動請求瀏覽器定位授權。允許就使用所在地附近，拒絕或定位失敗才預設頂溪國小；已選過則沿用瀏覽器權限。

- 使用 Permissions API 查詢既有 geolocation 權限。prompt 呼叫 getCurrentPosition 觸發瀏覽器原生授權；granted 直接定位；denied 不重複詢問、使用學校。Permissions API 不支援／查詢失敗時，仍交由 getCurrentPosition 原生處理授權。未另存一套同意或拒絕旗標，不覆蓋瀏覽器設定。
- 監聽權限變化：允許後定位，撤銷後取消未完成定位並回學校，遲到回應不覆蓋學校位置。離頁移除監聽，bfcache 回來重新查權限。
- 沿用低精度定位、座標粗化為 0.02 度，不保存精確座標、不持續追蹤。天氣仍每 20 分鐘更新、失敗備援及背景停查；日夜依當地時間及日出日落。
- 學生頁移除手動地點按鈕、自動天氣勾選框；測試控制容器 hidden＋inert，不可見且不進入鍵盤焦點。保留其內部節點給既有動畫引擎初始化，不是權限限制或安全機制。URL weather 參數不再設定初始天氣。
- 保留暫停／減少動態；雷聲仍預設關閉。場景不改獎勵、花葉、升級、登入或作答資料。

8 個 Node 測試全過；Chrome 模擬已允許／已拒絕／首次允許／首次拒絕／逾時／遲到定位／天氣中斷，撤權切回學校、45 葉10花、390px 無水平溢出，零 JS 錯誤。定位各狀況為 fixture 驗證，不冒稱已操作使用者作業系統的原生授權視窗。

正式部署 `dpl_3nBhT5jpMZmC7UQjXw2sKJLqtwhm`，以當時正式 `dpl_877EgV3NBbzUr8MLXRSwgBCasA8R` 完整 536 檔為底，只改 stage.html 和 garden-live-weather-ui.mjs，新增 garden-auto-location.mjs，另 534 檔 UID 相同。production skip-domain 後確認內容與正式基準才 promote。證據位於忽略目錄 automation/output/quiz/garden-auto-weather/。

最新修正發布 `dpl_4oeG1iffwaRjs2MfN5opZpSgnFLr`，以 `dpl_3nBhT5jpMZmC7UQjXw2sKJLqtwhm` 完整 537 檔來源為底，僅變更 garden-auto-location.mjs 與 garden-live-weather-ui.mjs，535 檔保持。新證據位於 automation/output/quiz/garden-first-location/。

本規則取代上次實作的「不主動詢問」政策。瀏覽器可能依安全設定、安靜通知或既有決定抑制提示；頁面請求原生權限，不自行仿造提示視窗。拒絕或定位失敗仍可完整使用學校天氣。
