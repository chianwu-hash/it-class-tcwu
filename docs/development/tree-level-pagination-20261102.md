# 第二級努力樹隱藏第一級葉片分頁 — 2026-11-02

已修復並正式上線：`dpl_3YJRFMxaezLbCgd3GiMuTS1YgUxe`；前一版 `dpl_2Y3coNLmvKTHsDu7vbU3JX2HoxNB`。

## 原因與修正

第一級樹的葉片分頁原本建立在 `.tree-stage` 外，升級模組只隱藏樹本體，因此第二級樹仍看到「上一頁葉片／葉片第1/2頁／下一頁葉片」，點擊只會切換已隱藏的第一級葉片。

在 `my-tree.html` 新增 `#tree-level-one` 容器包住第一級樹及其分頁，把此容器交給原有升級模組管理。非同步成長資料確認前仍可使用第一級；確認第二級後一次隱藏本體與分頁。重設／切回第一級時沿用既有reset恢復整組。第一級的真正分頁邏輯與第二級的分區／來源清單／重播按鈕保持原樣，沒有新增平行狀態或觀察器。

## 驗證

- 本機使用實際HTML的分頁程式與既有升級模組，合成72葉14花。第一級兩頁可切換；RPC尚未完成時分頁可用；升級後分頁不可見；第二級控制仍可見；reset恢復原分頁及第2頁狀態；390px無水平溢出，0 pageerror。合成測試沒有寫入正式成果。
- 正式使用已登入的教師專用307-30，只讀努力樹，確認第二級場景ready、舊分頁確實隱藏、第二級控制可用、仍為72葉14花，手機版正常、0 pageerror。測試開始時身分已是307-30，因此不切換／改動原身分。正式截圖已目視檢查。
- 只修改 `my-tree.html`；其他808來源原樣保留。809雲端來源SHA1一致，788公開檔內容一致，16原排除PDF維持404；待發布版本READY並比對來源後才promote。沒有SQL、登入／成果規則變更、學生成果清除或寫入，未commit/push。

證據：ignored `tmp/tree-pager-release-20261102/`，含baseline／manifest／publish、verified、local/live browser結果與截圖、public；控制腳本 `tmp/tree-pager-release.mjs`。實作沿用隔離工作區 `D:/projects/.codex-worktrees/foundation-keyboard-fix-20261102`，分支 `codex/tree-level-pagination-20261102`；主工作區其他修改保留。後續發布須整合當下最新正式來源，勿整包發布舊Git／髒工作區。回復前先核對project與aliases沒有其他更新。
