# 共用選項間距修正

`fields` 的單選欄位使用 `quiz-field quiz-single-choice`，內部缺少選項排列的 row-gap；個人／夥伴選項卡片又設為 margin:0，因此看起來緊貼。這不是期末專用規則。

本次只在 `shared/quiz-choice.css` 補共用樣式：結構化單選維持原本單欄，與一般 single 使用相同垂直間距；既有作答 workspace 12px、非 workspace 桌機14px，個人手機12px。卡片內容、原欄數、選項 ID、輸入型別、儲存／送出、題目／作答資料及外層 workspace 全部不改。勾選與文字欄位不套單選樣式。

CSS bundle 與三／四／六／九年級路由的資源雜湊由原 builder 重建，不逐頁改介面。發布檔案差異只含共用 CSS、四份生成 CSS 與16個入口的 CSS 資源版本。

## 驗收

- 使用實際 `initServerQuiz`、原 renderer 與 workspace，隔離合成資料及模擬 RPC，無正式學生送答。
- 1366桌機／390手機，期中 single、期末 single、舊期中 fields、舊期末 fields、舊是非、多欄單選及勾選共14案例。
- 73項檢查通過：實測選項邊界間距12px、無水平溢出、原單一固定送出、原回應格式與欄位值、儲存接回／鎖定、鍵盤方向鍵、非 workspace 的14／12px間距。桌手機截圖已目視核對。
- `node automation/build-quiz-workshop.mjs --check` 通過；沒有題目、作答、JavaScript 控制器、SQL 或資料庫寫入。
- 私有驗收證據：`D:/AI-Work/quiz-option-spacing-evidence-20261116/`。正式狀態依 agent-handoff 頂部發布收據。

## 正式收據

- PR #273 合併 main `b2d0e105`，從乾淨 main 經唯一腳本發布；正式 `dpl_3ghScPW7Rktt9TyfwBYYkRhWd75p`，回滾 `dpl_95B3nYwMhwUcB4Fa8LwndGsA8wGM`。
- 完整檔案樹21修改／0新增／0刪除，無額外內容差異，換行差異0；正式21檔HTTP 200且逐位元符合發布 main。發布鎖已釋放，測試分頁與本次程序已結束。
- 本次只調整樣式與生成資源版本，無題目、既有作答、控制器或資料庫寫入；長線新題轉化仍保持暫停。
