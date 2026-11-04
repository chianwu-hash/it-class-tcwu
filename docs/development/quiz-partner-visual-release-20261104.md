# 夥伴練功視覺與共同營地正式整合

2026-11-04。使用者核准第二版融合視覺、六種不同情境與共同營地，要求和 Claude 商量、沒有問題就上線。本次將樣式接回真正夥伴流程，不部署本機示意頁。

## 變更

- 保留原 navbar／initNavbarAuth、題庫入口與權限；四個年級（3／4／6／9）延續原色系與黃色主按鈕。
- 淺色頁首、細框與規律字級，透明寵物落在頁面底線；六張情境各有不同人物數量、鏡位與道具，不作能力角色或獎品。
- 建立頁兔遞卡、等待頁狗伏等、入口貓狗招呼、空營地貓兔積木；有真實請教串時收起空圖，按題號沿用不同淡色區塊。回顧／紀錄圖在努力故事與原紀念物之後。
- 手機頁首與進度資訊收窄，過程說明可展開，主要操作與題目保留；可跳到營地並把焦點移至標題。收到新快照時仍能還原該焦點。
- 新增 `presentation.mjs`、`visual.css`、六張 `art/*-v1.webp`，小圖合計209,276 bytes。只用本機靜態圖，不新增 RPC、第三方圖片服務或3D引擎。

沒有 SQL／資料庫、auth、transport、重試、realtime、原計分／訂正／花葉或努力樹程式變更。原始生圖 PNG、私人資料、前端示意按鈕及假資料不進發布。

## Claude 複核

CLI 2.1.289／訂閱 OAuth，首輪 session `20261104-partner-visual-production`，實際讀 app、learning、樣式、入口及四個HTML。

首輪四項條件已實作：

1. 只改 hero 的標題／副文標記與獨立裝飾容器，保留 `#identity` 與原麵包屑。
2. auth、navbar-auth、transport、rich-content 等單例引用網址不變。
3. presentation 只由 app 載入；learning 使用可省略的 onStage 與 scene callback，舊 app 可使用新 learning。
4. 裝飾圖不在 rich-fragment／preview-content、不帶燈箱屬性或tabindex；使用空 alt、aria-hidden、lazy、固定尺寸。

Codex 是唯一寫入者，Claude 僅審查。第二輪 session `20261104-partner-visual-diff` 已完成，確認沒有必須先修的崩潰、auth、草稿、資料隔離或同步回歸問題，可進 PR/main 發布。它核對了實際差異與新增模組、scope、燈箱／媒體邊界及發布排除設定，沒有自行執行測試；測試由 Codex 執行。

## 已驗證

- `quiz-partner-stability` 與 `quiz-partner-production` 7／7。
- `QUIZ_PARTNER_STABILITY=1` production 2／2。
- 原 `npm run quiz:test` 11／11。
- 實際 app／learning／rich-content／past-answer 等模組，使用只在本機的合成 auth／transport：真快照有 ask 後收圖、回覆正確 thread/action、ack後只清理對應草稿、焦點／selection／選項／manual文字／details保留。
- save_draft／退出／重入還原草稿和 review view；finish 轉 book、原紀念花顯示、award 深連結、登出清空；舊 app 可使用新 learning。
- manual 題目底圖重畫共用快取，退出後再讀；圖片燈箱與裝飾圖分離。
- 四個年級 ×1180／768／390／320px 無橫向溢出、無重複id；入口原 permission/catalog/decorate/auth 生命週期正常；pageerror 0。
- 正式139函式 live snapshot 比對與94項努力樹目錄預檢通過，無資料庫或目錄改動。

忽略目錄 `.chat-mode/` 保留完整 CLI、PGlite、瀏覽器與截圖證據。瀏覽器是實際模組配合成傳輸，不宣稱真實學生 Google OAuth 多機／整班流量已測。這兩項原有現場驗證仍待學生使用時確認。

## 發布

PR #13 已合併，以乾淨 main `4fc3a4c` 執行 release-from-main start → deploy → promote，2026-11-04T15:11:09.852Z 正式部署 `dpl_G1bXq2cRCnBRJ2oQp8uffL3PaVSA`，回滾 `dpl_EGn9CwbxtAbHLhnGx6uNUoLjBsKd`。

完整檔案樹精確11修改、8新增、0刪除、0換行差異；19個本次檔案與7個保留的auth／media／努力樹關鍵檔，候選與正式共26檔逐位元組核對一致。資料庫函式未改，發布後139函式live再次通過。正式alias指向新部署，發布鎖已釋放。

正式既有學校Google工作階段的首頁檢查也通過：姓名identity保留、2/3/4人選項、建立表單、新CSS與透明圖、淺色頁首、無溢出、pageerror0。沒有提交任何表單、送答、回覆、領獎或開啟努力樹已讀。本次沒有重新執行真實學生多機或整班壓測，不能將這次單人首頁檢查等同多人驗收。
