# 英打基礎鍵盤圖修復 — 2026-11-02

已修正並發布正式站。正式部署 `dpl_8XuMsA2hHnNZ1neaFqtW8DbKPfF4`，前一版 `dpl_3RgDuUnZVoWziyvxek7XNfj4w9oG`。

## 原因與修正

英打基礎頁把共用按鍵提示當作舊版三排字母鍵盤，依固定列索引再追加數字、分號、標點、空白及左右 Shift。共用提示現在已提供完整鍵盤與分段字卡，舊追加邏輯導致按鍵重複、列索引錯置，並混入字卡工具介面及不相容樣式。

移除舊追加邏輯，改為本課固定實體鍵盤元件：五列、54 個唯一打字及操作鍵；數字、上排、基準列、下排、空白各自定位，左右 Shift 各一鍵，保留 F／J 定位、左右手配色及目前按鍵高亮。列寬依標準鍵帽比例配置，樣式限縮於本課鍵盤，不修改每週課程的共用提示工具。三、六年級英打基礎共用修復，更新入口快取版本。

## 驗證

- 本機與正式瀏覽器 1280／768／390px 檢查：54 個鍵唯一、沒有按鍵重疊、沒有超出鍵盤或水平頁面溢出；空白鍵獨立一列，左右 Shift 位置正確，沒有分段字卡混入。
- 標準鍵盤真實按鍵事件可推進題目；大小寫關卡的 Shift 提示正確。正式三、六年級英打入口皆載入修正版，里程碑區保留，pageerror 為 0。桌面截圖已目視檢查。
- 實際輸入、存檔及進度程式從 `const keyElements` 起至檔尾與前一正式版本完全一致；沒有 SQL、登入、存檔、教師測試身分或學生成果變更。未重做原生注音／Google OAuth／全班負載測試。
- 以最新正式完整來源組包，只修改 5 檔、新增元件與樣式 2 檔；其餘 **800 個來源檔原樣保留**。807 個雲端來源 SHA1 全部吻合；正式786個可服務公開檔內容雜湊一致，16個既有排除PDF維持404。先驗待發布版本再promote，沒有commit/push。

## 接續與證據

實作：`D:/projects/.codex-worktrees/foundation-keyboard-fix-20261102`，分支 `codex/foundation-keyboard-fix-20261102`。主工作區的其他修改保留。

證據：ignored `tmp/foundation-keyboard-release-20261102/`，含baseline、manifest、完整publish、local／live browser結果與截圖、verified、public。控制腳本ignored `tmp/keyboard-release.mjs`。未匯出session或token。

入口：[三年級英打基礎](https://it-class-tcwu.vercel.app/grade3/115-1/typing-foundation.html)。發布後重新整理即可讀取新版本。後續發布仍須以當下最新正式來源整合；回復前先核對當下project與aliases，避免覆蓋其他更新。
