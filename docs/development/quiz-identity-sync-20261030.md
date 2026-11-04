# 2026-10-30 測試身分切換與考前練功坊同步

## 問題與原因

同一個教師自有 Google 測試帳號可切換為三年級 30730 或六年級 60930。後端 `switch_test_identity` 已正確更新本人名冊，但 Google user ID 不變。練功坊原本把相同 user ID 的 auth 通知視為無須更新，導覽列也依 user ID 快取名冊，自組卷目錄則保留到 reset。因此其他已開啟分頁可能繼續顯示三年級身分、舊科目與卷清單。

Chrome 使用舊版正式來源與合成 Auth／RPC 重現：首頁切換成功、後端年級為 6，原分頁仍留在三年級，目錄仍為三年級。正式資料庫交易內驗證同一測試帳號依序切換 grade3 → grade6 → grade3，各次名冊班級為 307 → 609 → 307，卷清單年級為 3 → 6 → 3，目錄均僅回傳該年級五科。最後 rollback，沒有留下測試資料。

## 修正契約

- 切換按鈕先檢查 RPC 回傳班級／座號及目前 session，確認仍為原帳號後才通知其他頁面並導頁。錯誤訊息不能宣稱資料庫一定沒有改變，因為可能已送達但遺失回應。
- `test-identity-state.mjs` 只傳遞 user ID 與隨機修訂碼；不保存名冊、權限、答案或進度。透過 storage event／BroadcastChannel 同步，pageshow 僅在修訂碼改變時補接 BFCache 期間錯過的通知。
- 練功坊收到本人身分變更時鎖定舊畫面，清除卷清單、錯題、考古題與自組卷目錄，重新向後端確認年級並導往正確入口。既有測驗頁也重新驗證 entry context。
- 導覽列清除原名冊快取並隔離較早的查詢；quiz 頁面的名冊由自身 RPC 提供，避免另外查名冊造成競態。
- API 與媒體作用域記住發送時的身分修訂碼；同 user ID 切年級後，舊回應失效。呼叫端自訂媒體 valid 函數不能繞過此檢查。
- 一般 TOKEN_REFRESHED、focus、無變更的 pageshow 不重讀資料、不 reload；未更改 shared/auth.js、資料庫函數、RLS 或既有作答。

## 驗證

`node --test automation/tests/test-identity-state.test.mjs automation/tests/quiz-identity-request.test.mjs automation/tests/quiz-grade-route.test.mjs automation/tests/quiz-auth-media.test.mjs`：10 項通過。

`automation/tests/quiz-identity-switch-browser.cjs` 使用真實 HTML／模組及合成 Auth／RPC，僅操作租約內兩個精確 target。通過雙向年級切換、舊目錄失效、延遲卷清單／目錄回應隔離、組卷與已儲存卷卡片、BFCache 補接、切換失敗不通知、focus／token refresh 不額外重讀，以及 390px 版面。這不是本人 OAuth 登入或正式新增作答的測試。

測試腳本須允許 Chromium parent tab target 初始化，僅允許兩個指定 page target。轉頁檢查須容許 DOM 尚未建立；背景頁面的 timer／rAF 可能受節流，驗收顯示狀態前啟用自有目標頁。初始化的失敗紀錄與最終成功報告分別保留於 ignored `automation/output/quiz/identity-sync/`，不得將測試工具錯誤當作產品測試通過。

## 發布範圍

以目前正式 `dpl_TXYUw4KvyECaqRzrgSZCkrJAErLv` 的完整凍結來源為底，先核對 254 個公開檔案，再覆蓋本次 15 個執行檔（含新增身分通知模組及必要版本字串）。不從較舊或有其他未完成修改的主工作區整包部署。此修正放在獨立分支 `codex/quiz-identity-sync`，不混入先前注音修正提交。

正式 deployment：`dpl_BbRiddNNbQD1YrrPaPewqWSdxSnh`，已 promote 至 https://it-class-tcwu.vercel.app。候選 15 檔及正式 255 檔 SHA 核對通過；正式來源 Chrome 隔離 Auth／RPC 的完整驗證亦通過，pageerror 0。最後驗證證據見 ignored release reports。

更新前已載入舊模組的分頁須重新整理一次，之後的身分切換才能收到新通知。
