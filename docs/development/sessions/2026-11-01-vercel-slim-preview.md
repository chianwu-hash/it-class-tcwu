# Vercel 瘦身雲端預覽驗收

最新正式版的重新整合與最終預覽，見 [後續驗收紀錄](2026-11-01-vercel-slim-rebased-preview.md)。本文件保留先前基準的歷史結果。

2026/11/1 約 17:23–18:02（臺灣時間）。使用者授權建立預覽，並分別核准暫時新增精確登入回跳 URL 與媒體來源，要求驗收後還原；未授權正式發布。

## 結果

預覽：<https://it-class-tcwu-nb88t3z9v-chianwu-4755s-projects.vercel.app>

部署 ID：`dpl_Gf6haTfxYJvZzVNexQwAK26VbwAt`，READY、target=null（preview），productionUrl=null。
來源基準：`dpl_8RRMxcuQ9ozADDWWC77BgYF5isFa`。

| 邊界 | 驗收結果 |
| --- | --- |
| 雲端來源 | 741 檔與本機候選逐檔 SHA-1 全相同；保留的 740 檔與正式基準相同，只有排除設定更新。 |
| 靜態資源 | 632 個非 HTML 資源回讀位元組相同；104 個 HTML 扣除已精確辨識的 Vercel feedback 工具列注入後，內容全相同。另 package.json、package-lock.json 回 404，屬建置中不公開的套件 metadata。 |
| 瘦身排除 | 16 張 PNG 與 16 份課本來源 PDF 全部回 404。 |
| Google 登入 | 由正常 Google 帳號選擇流程登入既有教師學校測試帳號，回到本預覽 /index.html，並讀回測試身分。沒有複製、輸出或轉移 token／session。 |
| 測驗 | 從預覽 UI 新增一份 5 題英語自組驗收卷，圖題正常載入，5 題實際保存與判分；重整後仍為 5／5。沒有代正式學生作答。短卷不計葉。 |
| 英打 | 六年級已完成的第一關正常接回；用已解鎖小關重練，測錯鍵提示、三行輸入、完成與重整。前後 load 回傳完全相同，start/save 次數均為 0。 |
| 中打 | 六年級已保存兩小關的注音鍵位進度正常接回；用已解鎖第一小關重練，錯鍵、三行輸入及重整接續通過。前後進度完全相同，start/save 次數均為 0。 |
| 一級努力樹 | 六年級 10 葉、1 花讀回，保留的 q80.webp 樹圖載入成功。 |
| 二級努力樹 | 三年級測試身分 64 葉、12 花、橘寶與小窩正常；場景 ready=true、assetIssues=[]。沒有變更寵物／小窩偏好或發放成果。 |
| 手機 | 二級花園 390px 畫面已目視，頁面無橫向溢出；樹、花葉、小窩與橘寶正常。 |
| 未登入保護 | 清除僅本次預覽 origin 的本機登入狀態後，測驗題目為 0 且顯示登入鎖；中英打 practice-card inert=true；努力樹不讀取個人成果／二級場景。未登出其他 origin 或使用者正式站工作階段。 |
| API | 預覽天氣 API 200，學校位置 day 場景；診斷 API GET 405，符合僅接受 POST 的原契約。 |

這次鍵盤輸入為自動化 UI 驗證，畫面的速度不是真人打字能力，不作效能或學生學習評量。中打本次測的是注音鍵位練習，沒有測 Windows 原生輸入法組字與候選字流程，也沒有逐一重做全部十二關或每份試卷。

## 兩項預覽專用設定及還原

原始 Google 登入從預覽回到正式站；Supabase URL Configuration 原有 7 條沒有這個預覽網址。使用者核准後，只暫加：

`https://it-class-tcwu-nb88t3z9v-chianwu-4755s-projects.vercel.app/index.html`

圖題首次讀取又遇到 quiz-media 的預覽 Origin 403 origin_denied，正式 Origin OPTIONS 204，與刪除圖片無關。經使用者另行核准，只暫時在 `QUIZ_ALLOWED_ORIGINS` 加入：

`https://it-class-tcwu-nb88t3z9v-chianwu-4755s-projects.vercel.app`

原值僅 localhost:3000、127.0.0.1:3000 與正式站。以既有文件中的已知非機密 URL 清單計算 SHA-256，核對雲端設定 digest 完全相同後才更新；沒有讀取／輸出其他秘密值，沒有修改媒體服務程式、來源資產名單、金鑰或資料庫結構。

驗收後已完成：

- 移除唯一臨時回跳 URL，重整管理頁再核對原有 7 條完全相同，Site URL 仍為 https://it-class-tcwu.vercel.app。
- 將媒體來源還原原字串，原設定 SHA-256 為 `37813f56ca4a52561745927c8942d14448bc582a7f4c73d6c63a8257322c5a5a`；雲端全部 15 個設定 digest 前後相同，沒有增加或移除設定。
- 設定管理平台的修改時間／函式版本 metadata 可能因更新而變動；所核對的是設定值，不宣稱平台 metadata 沒變。

臨時放行已移除，所以日後要重新執行此預覽的 Google 登入或驗權圖題，需重新取得暫時放行授權；這不是永久開放預覽來源的設定。

## 測試資料收尾

只使用既有教師學校測試帳號，測試身分由原四年級循環至六年級、三年級後還原四年級。測試名稱與 session ID 保留於私有 QA 證據，不放入公開記錄。

本次 5 題卷已透過本人自組卷 UI 移除；原有 2 份自組卷及 23 份老師卷連結保留。依既有網站刪卷規則，作答與錯題紀錄仍保留，故教師測試帳號留下本次 5 題驗收紀錄。沒有直接 SQL 清除紀錄、重設中英打、改寫學生進度或授予葉片。

驗收腳本曾遇到媒體尚未解碼即斷言、以題目角色欄誤判班級、把自組卷容器誤當老師卷容器等測試定位問題；修正腳本後，以後端保存後的 UI 重整讀回及獨立核對驗證，不修改網站 runtime 程式來迎合測試。私有目錄的舊 action-last-error.json 是歷程錯誤；以下列最終通過報告為準。

## 正式站與其他同步工作

本次只建立上述一個 preview，沒有執行 production deploy、promote、rollback、刪部署或 Git push。`it-class-tcwu.vercel.app` 在最後核對時仍指向原正式基準；9 個主要頁面／模組均 HTTP 200 且內容 SHA-1 與原基準相同。

但查核期間另有來源為 `automation/output/admin-learning-release-20261101/publish` 的工作建立 production 類型部署（例如 `dpl_28hg5JXTF6YbZ32Zz3LGPU9vnEgk`），團隊長網址別名隨之改動。它不是本次 preview；沒有將他人的發布回退或覆蓋，也不能宣稱全部別名都未變。

因此這個預覽只證明**原基準上的瘦身候選**通過本次驗收，不能直接拿來正式發布、覆蓋其他新功能。正式發布前必須重新取得當下實際正式來源並重新整合。已補強準備工具：除專案 production 欄位外，還核對常用短網址與團隊長網址別名；若不一致，工具中止，以免在同步發布期間沿用舊基準。新增保護測試後共 6 項全部通過；本次觀察到的別名不一致也確實被該檢查拒絕。

## 私有證據

目錄：`D:/ai-browser/logs/vercel-slim-preview-20261101/`。

- `deploy-preview.stdout.log`、`preview.json`、`preview-source-guard.json`：預覽目標與遠端來源。
- `cloud-assets.json`、`html-content-check.json`：全量資源回讀、平台注入辨識及排除結果。
- `login-verified.json`：正常 OAuth 回到預覽的證據。
- `quiz-submit.json`、`quiz-step-results.json`、`qa-cleanup.json`：保存、重整與測試卷收尾。
- `english-review.json`、`chinese-review.json`：重練、進度不變與雲端接續。
- `tree-initial.json`、`garden-preview.json`、兩張 garden-preview 截圖：努力樹場景與手機畫面。
- `anonymous-locks.json`：未登入保護。
- `auth-config-before.json`、`auth-config-temporary.json`、`auth-config-restored.json`：回跳 URL 暫加與復原。
- `secret-digests-before.json`、`secret-digests-temporary.json`、`secret-digests-restored.json`：設定 digest；不是秘密值。
- `public-production-check.json`、`aliases-now.json`、`project-now.json`、`other-deployment.json`、`concurrent-release-guard.json`：正式常用網址、同步工作與新版保護。

預覽與本機快照不整包加入 Git。本次紀錄及準備工具修改亦尚未提交。
