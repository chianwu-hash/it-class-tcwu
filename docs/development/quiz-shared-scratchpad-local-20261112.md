# 共用畫板與答題計算紙：本地驗證

> 工具列已依後續使用者指示精簡，最新預覽8914與60項驗證見[新版紀錄](quiz-scratchpad-compact-local-20261112.md)。下方8913為原版保留對照；兩版均未發布。

2026-11-12，使用者指定先重用夥伴練功原畫板，提取共用模組後接答題介面，本輪只在本機驗證，禁止發布。

## 共用模組

- `shared/sketch/editor.mjs`：原SVG畫板、六色筆、整筆橡皮擦、復原、清除、滑鼠／手指／觸控筆；仍為最多80筆、每筆最多128點、20步目前編輯階段復原。保留`createSketchEditor(host,{value,onChange,onSave})`與`sketchImage(value)`，可選messages只調整情境文案。
- `shared/sketch/model.mjs`與`contract.mjs`：原筆色、掃掠橡皮擦及格式檢查，不改原`drawing_v1`資料格式與上傳契約。`shared/tool-icons.mjs`供共用工具圖示。
- `shared/sketch/editor.css`：從原夥伴媒體樣式提取畫板及工具列；原`message-media.css`引入此檔，不再各自實作。
- 原`partner-pilot/sketch-editor.mjs`、`sketch-model.mjs`、`tool-icons.mjs`保留相容re-export；原`media-contract.mjs`保留語音函式並re-export共用validateSketch。夥伴訊息及附件仍走原儲存／送出方式，本輪未改正式資料或後端。

## 計算紙接入

`shared/quiz-scratchpad.mjs`與CSS建立可收合、非阻擋題目操作的計算紙。工作區以scratchpaper opt-in，只有一般題與個人考古UI啟用；夥伴工作區不多插一個計算紙按鈕，原畫圖入口沿用共用核心。

桌機預設放右側、可調整尺寸；390手機為較大的浮動面板，可快速收起看題目。題目前有「計算紙」按鈕，保留六色筆、整筆橡皮擦、復原與清除。清除前確認，清除後可復原。

一般題以本人／attempt／version／question為隔離key；考古卷以attempt／version／完整group共用一張，不因子欄位切斷。切題與回看保留各自筆畫、收合再開保留、送答或查課本不丟草稿。完整切題後重建畫板，復原堆疊僅限目前編輯階段，先前筆畫仍可擦除及清除。

草稿僅存在該頁記憶體；不寫localStorage、正式答題草稿、附件或資料庫，不傳夥伴／AI。重新整理會清除；登出／換人立即清空並移除畫板。學生介面明示此限制。這是本輪原型的保存範圍，不冒稱跨裝置或刷新後接續。

## 驗證

19項既有畫筆／橡皮擦／格式、語音附件、study權限SQL／前端、課本導航及四課程建置測試通過；21生成產物核對通過。原夥伴的空畫圖／非法座標／超限拒絕、原色彩與語音行為保持。

`automation/tests/quiz-scratchpad-browser.cjs`經共用工作瀏覽器租約執行，1280桌機與390手機共50項通過：實際滑鼠及CDP觸控畫線、六色筆、整筆擦除、復原、清除／復原、收合、尺寸／桌機題目不被預設面板遮住、查課本、送答、前後題隔離／接回、完整考古題組、登出／換人清空、無橫向溢出、原夥伴畫板可畫且核心export為同一實作。另驗桌機調大後切手機仍適配且筆跡保留。草稿不混進送答封包。均為合成身分、假資料及本地RPC，未代正式學生作答。

首次桌機預設45vw略壓題目右緣，已改37vw、最多520px並重跑通過。手機工具列再調整間距，並處理桌機調整尺寸後切手機的inline寬高覆蓋，公開瀏覽器腳本完整50項重跑通過。正式網站、資料庫、教材、考古卷enabled與發布鎖均未改動。

## 本機試用

只綁127.0.0.1:8913，合成服務不代理遠端。

- 一般題：`http://localhost:8913/grade3/115-1/quiz.html?cloud=1&session=00000000-0000-4000-8000-000000000001&preview_study=1&preview=preview-scratchpad-user`
- 考古卷：`http://localhost:8913/grade3/115-1/past-exam.html?paper=synthetic&preview_study=1&preview=preview-scratchpad-past-user`
- 原夥伴畫板隔離原型：`http://localhost:8913/automation/fixtures/partner-media.html`

最終瀏覽器證據／截圖在本工作樹ignored `.chat-mode/shared-scratchpad/`；初步檢查與抽取程式另留本機`C:/Users/user/ai-now/shared-scratchpad-20261112/`。保留本工作樹及8913服務供驗收；若日後授權發布，須從最新main新建工作樹整合、PR及正式發布腳本，不直接用本機原型包部署。
