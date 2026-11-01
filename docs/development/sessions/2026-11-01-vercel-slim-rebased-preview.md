# 最新正式版整合瘦身與雲端預覽驗收

2026/11/1（臺灣時間），最終核對：2026-11-01T10:46:29.938Z（UTC）。本次依使用者要求以最新正式版重建候選，保留新後台，只建立預覽，沒有正式 deploy、promote、rollback、刪除部署、Git commit 或 push。

## 最終基準與候選

- 正式基準：`dpl_4LsmuQBTztjPS3vvG6a8nXLQd93w`。
- 完整來源快照：`C:/Users/user/projects/it-class-tcwu/automation/output/test-identity-three-buttons-20261101/frontend/publish`；781 個來源檔全數與雲端 manifest SHA-1 相符，沒有整包覆蓋目前工作區。
- [最終預覽站](https://it-class-tcwu-o6v0sey84-chianwu-4755s-projects.vercel.app)
- 預覽 ID：`dpl_HanAtZKNenwRgCaHmGQMpLTeB3EZ`，READY、target=null、productionUrl=null。
- 781 → 749 檔，748 個保留檔內容不變，唯一變更為候選包的 `.vercelignore`。本機主工作區的排除檔未被這個候選取代。
- 只排除原定 16 張 PNG 與 16 份課本來源 PDF，避免上傳 264,209,821 bytes（264.21 MB）；候選來源 35,398,171 bytes。這是來源檔案大小，不能當作 Vercel 已回收儲存或帳務降幅。
- 公開教案使用的 v2 PNG、WebP、花園動態資產與中英打所需 prototypes 內容保留。重新掃描公開說明、程式與編碼連結，未發現指向排除檔的引用。

## 保留的新功能

新後台的 admin-learning.html、admin-progress.html 與六個 shared/admin-learning 模組／樣式均與正式基準相同。另保留四年級 past-exam.html、三個考古題相關模組，以及最新教師測試身分直接切換模組和四個首頁。

本次把上述必要檔加入 automation/vercel-slim-policy.json 的保留檢查。準備工具同時核對專案 production 與正式短、長網址別名；不同步或基準已更新即中止，不覆蓋其他發布。

## 最終預覽實測

| 項目 | 結果 |
| --- | --- |
| 來源與公開內容 | 749 個雲端來源與候選逐檔 SHA-1 相同；638 個靜態檔回讀相同，106 個 HTML 精確扣除本次 Vercel feedback 注入後相同。package.json 與 package-lock.json 為非公開 metadata，回 404。 |
| 排除 | 32 個排除檔全部 404。 |
| 教師登入與新後台 | 正常 Google 教師登入；三／六年級名冊、摘要、週次、打字事件、原答順序、逐題圖片與錯題篩選共 14 項通過。只讀取正式既有紀錄，不改答案、分數、解鎖或成果。 |
| 全班成果 | 兩班共 43 列與伺服器讀回及既有共用模型相符；葉花、等級、功能解鎖、排序、搜尋、重新整理、末位學生明細、390px 及過期切班回應保護通過。 |
| 權限 | 未登入與學校測試學生身分均看不到教師工作區；清除本預覽本機登入後，測驗無題目，中英打不可操作，努力樹不載入個人成果。 |
| 學生 Google 登入 | 正常帳號選擇回到本預覽，使用教師自己的學校測試帳號；沒有轉移、輸出或儲存 token／session。 |
| 三種測試身分 | 新版直接切換介面可在四、六、三年級間切換並核對班級，最後回到原四年級身分。 |
| 測驗 | 另建 5 題英語測試卷；各題圖片可讀、提交皆 200。第 2 題重整接續、第 5 題重整仍 5／5。 |
| 四年級考古題 | 既有雲端清單讀回 8 份開放卷，連結均為四年級頁面；未逐份重新作答考古題。 |
| 中英打 | 各重練已解鎖的三行小關，錯鍵與完成提示正常；前後 load 資料完全相同，start/save 均為 0，重整能接回原進度。 |
| 努力樹 | 六年級一級成果與 WebP 正常；三年級 64 葉、12 花、橘寶與小窩 ready=true、assetIssues=[]。390px 截圖已目視，無橫向溢出。 |
| API | 天氣 API 200、學校場景正常；診斷 API GET 405，符合原契約。 |

鍵盤驗收為自動化 UI 操作，速度不作真人學習或效能評量；注音驗的是實體鍵位流程，沒有測 Windows 原生輸入法選字，也沒有逐一重做全部十二關。一般學生正式帳號未被用來代答。

## 暫時設定與測試資料收尾

沿用使用者已明確核准的同範圍做法，驗收期間只暫加唯一預覽 /index.html 回跳 URL 與唯一媒體 Origin；沒有使用萬用字元、變更 Site URL、函式程式或其他金鑰。每次換預覽均先撤回舊項目，再暫加新項目。

最終已移除本預覽的回跳 URL，重新整理核對原 7 條 URL 集合和 Site URL 完全相同；全部 15 個設定 digest 前後相同。quiz-media 與 admin-learning-media 的正式 Origin OPTIONS 均 204，最終預覽 Origin 均恢復 403。管理平台更新時間等 metadata 可能因暫改而變動；核對的是設定值。

因此預覽的 Google 登入及驗權媒體不再永久放行。沒有全域登出正式站，只移除預覽 origin 的本機登入狀態。

兩輪學生實測各建立一份 5 題卷，均透過本人 UI 移除；原 2 份自組卷、23 份老師卷集合保留。依網站既有刪卷規則，兩輪共 10 筆教師測試作答與錯題紀錄保留，不直接 SQL 清除，也沒有重設中英打或發放葉片。

## 同步發布與最終確認

本次先以新後台版 FNy 建立預覽，查核期間另一工作加入土城四年級考古題並發布 Dn1，之後又發布教師身分直接切換介面的 4Lsmu。因而共建立三個候選預覽，最後重新整合到 4Lsmu；沒有回退任何其他工作。前兩個預覽只留作歷程，不能當作本次最終候選。

最終專案 production、it-class-tcwu.vercel.app 與 it-class-tcwu-chianwu-4755s-projects.vercel.app 都仍指向上述 4Lsmu 基準；20 個正式關鍵頁面／模組均 200 且內容與該基準相同。六項準備工具保護測試全部通過。

任何後續正式發布仍須先重查當下基準；若又有新發布，準備工具會拒絕沿用過期候選。本次沒有將候選發布到正式站，也沒有提交或推送 Git。

## 證據與檔案

最終私有證據：D:/ai-browser/logs/vercel-slim-final-preview-20261101/。

- final-result.json：聚合通過結果與檔案／設定／正式站保護檢查。
- preflight.json、preview-source-guard.json、cloud-assets.json、html-content-check.json：來源、dry-run、雲端位元組與排除。
- real-google-live-report.json、class-rewards-browser-report.json、admin-student-lock.json、admin-anonymous.json：新後台唯讀與權限。
- quiz-submit.json、qa-cleanup.json、grade4-past-catalog.json：學生端保存、清單與收尾。
- english-review.json、chinese-review.json、tree-initial.json、garden-preview.json、garden-preview-mobile.png、anonymous-locks.json：中英打、努力樹與未登入保護。
- auth-config-before.json、auth-config-restored.json、secret-digests-before.json、secret-digests-restored.json、cors-restored.json：暫時設定精確還原。
- production-final-check.json、project-final.json、aliases-final.json：正式站最後核對。

中間歷程位於 D:/ai-browser/logs/vercel-slim-rebase-preview-20261101/ 與 D:/ai-browser/logs/vercel-slim-latest-preview-20261101/。私有樣本、名稱、答案、登入狀態與整包快照不加入 Git。歷程 action-last-error.json 不是最終結果；以上述 final-result.json 為準。

## 後續授權的 Git 保存

使用者隨後核准提交本次瘦身規則、準備工具及驗收紀錄；前文「未提交 Git」描述的是雲端驗收完成當時。

本次提交範圍只含以下六檔，未納入其他後台、課程、教材、圖片或私有證據：

- automation/vercel-slim-policy.json
- automation/prepare-vercel-slim-release.cjs
- automation/tests/vercel-slim-release.test.cjs
- docs/development/sessions/2026-11-01-vercel-slim-candidate.md
- docs/development/sessions/2026-11-01-vercel-slim-preview.md
- docs/development/sessions/2026-11-01-vercel-slim-rebased-preview.md

提交前重新執行六項準備工具保護測試，全部通過；執行既有 pre-commit 呼叫的 tools/preflight.ps1，96 個 PowerShell 檔全部為 ASCII，agent-sync-state.json 字串值檢查通過。正式提交仍使用原有 pre-commit，不略過或修改 hook；不推送 Git，也不部署正式站。
