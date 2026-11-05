# 學習檔案：考古題、延伸練習與四／九年級

> 已正式上線並完成真正教師Google登入複驗。最終前端部署：`dpl_8U7FN7B9qKdzmXZEi7NtmXvtjZGA`（乾淨main `f7f9ff5`），入口：https://it-class-tcwu.vercel.app/admin-learning.html 。下方「待辦」保留當時階段紀錄，以文末完成紀錄為準。

使用者授權補齊活動與逐題明細，驗證後可以上線。從最新 `origin/main`（`d5d892b`）建立新分支／worktree，不修改主工作區。

## 功能

- 課程新增土城四年級、中正國中九年級，沿用年度名冊與已驗證帳號對應；未連結／衝突仍不合併成果。
- 活動列表加入獨立 `quiz_past_*` 歷次作答及原本被排除的 `quiz_learning_sessions` 延伸卷。課堂卷、題庫練習、自組卷、考古題、延伸練習可依類型、科目與狀態在分頁前篩選。
- 考古題按每次作答的 immutable version 顯示原題、選項、原答、正解與人工參考；另顯示版本UUID。未答、答錯、自評／未判分分開處理。錯題篩選不含未答與人工題。手寫題保存的筆畫以共用唯讀畫圖元件呈現。
- 延伸卷沿用正常試卷的固定題序／選項順序與逐題原答，不修改學生作答、評分、揭答或獎勵流程。
- 教師媒體RPC先經所選學生／課程／作答版本驗權，再核對素材存在該固定版本，沿用既有簽章Edge，不新增Edge部署。
- 尚未套用的篩選變動會提示按「套用篩選」，避免下拉選擇與下方舊結果看似矛盾。

## 資料庫與驗證

`supabase/admin-learning-activities.sql` 只更新四個教師查詢函式，新增一個撤銷瀏覽器EXECUTE的內部考古題投影。安裝前核對原函式md5，拒絕覆蓋同期變更。`automation/build-admin-learning-activities.mjs` 從本次審核的正式快照建立migration；不是重裝歷史quiz SQL。

34項Node／PGlite測試通過，涵蓋四課程、重作歷史、舊版／新版隔離、人工題、延伸卷、全域篩選、分頁、匿名／學生／跨人拒絕、內部函式不可直接呼叫，以及媒體限定固定版本。既有個人／全班花葉與解鎖模型測試保留。

正式PostgreSQL交易回滾驗證通過；原函式md5 guard與四個課程的名冊、花園／全班查詢、實際考古題明細、錯題與版本媒體皆通過。17張學生／成長／獎勵相關表的交易前後摘要相同。此為資料庫驗證，Google登入與前端瀏覽器另行驗證，不冒稱兩者相同。

當時正式年度名冊：三年級132人、土城四年級1人、六年級47人、中正九年級1人。四／九年級目前並非完整班級匯入；只呈現現有名冊，不造學生資料。回滾查核在各年級第一頁內實際驗證考古紀錄三年級6筆、六年級9筆、九年級1筆；四年級當時無作答。該查核樣本未有延伸卷，延伸分支以合成資料驗證，不宣稱正式真實紀錄已覆蓋此分支。

唯讀報告在 `automation/output/admin-learning-activities-20261105/`（ignored），無密碼／票證。提交的證據只留數量與通過狀態，不含姓名、題目、原答或學生識別。

發布待辦：PR合併程式 → 從main套用本migration → 匯出正式schema快照及 `db-snapshot-check.mjs --live` → 快照PR → 乾淨main checkout透過 `release-from-main.mjs` start／deploy／promote → 真教師瀏覽器正式複驗及發布紀錄PR。

## 正式套用與前端候選驗證

PR #19 已合併為 `aa148c5`。從該main commit建立乾淨checkout，正式套用教師migration並重跑交易內查核，17張學生資料表摘要一致。匯出後 `db-snapshot-check.mjs --live` 通過；快照只變動本次四個教師函式與新增的內部detail helper，其他函式定義與權限不變。145個函式、97張表／view、21條policy與9個trigger。

前端候選以01租約瀏覽器在localhost直讀已合併的main程式，使用明示合成資料驗證選擇、勾選、排序、文字填答與人工手寫原答。1280／768／390px均無水平外溢，手寫筆畫可見且輸入／繪圖為唯讀。這個候選版面測試不冒稱真正Google登入。已保存[套用報告](evidence/admin-learning-activities-20261105/apply-report.json)與[合成資料瀏覽器報告](evidence/admin-learning-activities-20261105/synthetic-browser-report.json)。

## 正式發布與真教師複驗

PR #20 合併後從乾淨 `65d66f0` main checkout執行發布腳本。完整來源比較 `ok:true`：四個後台既有檔、新增活動renderer，以及main既有停用Git預覽的 `vercel.json` 同步，無其他差異。正式部署 `dpl_JE7dcnnqwx1qLhzjUaF9oHbAFjgy`，回滾基準 `dpl_Dxxyw8mmvX7ChCYmZsGVcr6Ex9Gw`。5個公開runtime檔HTTP與SHA256一致。

01獨立分頁經正常教師Google登入，確認預期教師後直接讀正式RPC。四課程名冊／篩選／班級花葉表皆通過；三、六、九年級實際考古題固定版本、逐題清單與錯題篩選通過，九年級31張圖片正常。1280／768／390px皆無頁面水平外溢，腳本錯誤0。四年級當時無考古作答，因此僅驗證現有名冊、無紀錄與篩選，未宣稱有實際明細可查。正式樣本未有延伸練習，類型篩選入口通過；逐題延伸卷與資料隔離仍以合成資料為證。

完整無個資證據：[正式瀏覽器報告](evidence/admin-learning-activities-20261105/formal-browser-report.json)、[公開檔案核對](evidence/admin-learning-activities-20261105/public-check.json)、[完整發布比對](evidence/admin-learning-activities-20261105/release-report.json)。自動化已移除攔截、斷線並釋放租約。

發布途中曾由CLI誤建一個以worktree名稱命名的專案，專案ID關卡擋下，未切換正式站；該誤建專案已刪除。明確link既有project後，清掉CLI自動產生的本機環境檔及其.gitignore變動，再經完整發布腳本完成。另一次比對正確攔下main新增的停用Git預覽設定；查明只是 `deploymentEnabled["**"]=false` 後，abort自己的鎖、重新登記已檢查的完整範圍，未繞過比較。

收尾複查發現人工題receipt的official依法保存null，因此renderer改用同一固定版本field內的reference作為參考顯示，保留未提供者的明示狀態；未更動資料庫或原答。新增null receipt／reference合成版面檢查，並在正式瀏覽器測試逐題比對原答與參考文字、自組卷篩選。此小修仍經PR、main乾淨checkout及發布腳本處理。

## 最終完成紀錄

PR #21 合併後，從乾淨main `f7f9ff5` 執行 `release-from-main` start／deploy／promote，三個前端變更檔完整比較 `ok:true`、eolOnly 0，正式別名確認指向 `dpl_8U7FN7B9qKdzmXZEi7NtmXvtjZGA`。回滾目標是第一輪部署 `dpl_JE7dcnnqwx1qLhzjUaF9oHbAFjgy`。第二輪沒有資料庫異動或Edge部署。

2026-11-05 11:50（臺灣時間）正式站再次以已確認的教師Google身分複驗。三、六、九年級實際考古題逐題的群組／題號、原答顯示與固定版本參考文字皆相符；九年級31張圖正常，錯題篩選不混未答／人工題。四個課程的考古題、延伸練習、自組卷篩選及班級彙總通過；1280／768／390px頁面無水平溢出，腳本錯誤0。四年級沒有可驗證的考古題作答，報告中的detailVerified／answersMatch為false表示未執行該分支，不代表讀取失敗；其他三年級為true。正式樣本沒有延伸卷，真實延伸明細仍未覆蓋，已由合成資料完整檢驗。

最終[正式瀏覽器報告](evidence/admin-learning-activities-20261105/formal-browser-report.json)、[5個公開runtime檔案核對](evidence/admin-learning-activities-20261105/public-check.json)、[參考答案補正發布紀錄](evidence/admin-learning-activities-20261105/reference-release-report.json)均保留。正式資料庫快照145函式再次 `--live` 通過。所有正式查閱皆為教師唯讀動作，未重置／補答／重評／發放學生獎勵。瀏覽器攔截、連線與租約已清理。

合成版面最後一次重跑在所有DOM斷言通過後，背景分頁截圖曾逾時；為測試器加入具體理由的單次前景授權，避免非作用中分頁影響後續截圖。正式瀏覽器測試亦補上等待首批列表回應後才更動篩選，避免測試器在初次載入期間競態操作。兩項皆只調整驗證工具，不改產品查詢或學生資料。
