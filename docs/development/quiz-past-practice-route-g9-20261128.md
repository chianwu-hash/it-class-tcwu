# 考古錯題延伸練習：九年級導向修正候選

**候選尚未發布，尚未完成正式學生延伸練習驗收。** 本批修正學生已從考古錯題選取學習重點後，正確的九年級練習網址被前端拒絕的情況。

## 已查明的入口缺口

正式快照的`public.quiz_learning`以目前學生年級產生`/grade{grade}/115-1/quiz.html?cloud=1&learning=1&session=...`，支援九年級既有固定延伸版本。`quiz-wrong-questions.mjs`已有`past_practice`呼叫，會經正式錯題detail及學習重點按鈕進入；但回傳網址檢查仍只接受`grade[36]`，所以正確的九年級連結會顯示「練習連結無效」。

這與個人原卷頁面未直接傳`onPractice`不同：錯題頁已接上既有正式練習RPC，毋須為此另建一條個人原卷練習權限。學生端仍讀固定內容，不即時呼叫AI。既有九年級理化14個固定練習版本及其隔離SQL證據，見[理化資料發布紀錄](zhongzheng-g9-physics-enrichment-20261119.md)；不能把舊HTTP／隔離SQL結果當成這個原生按鈕已通過正式瀏覽器驗收。

## 最小修改

- 在既有純函式模組`quiz-wrong-route.mjs`新增`pastPracticeHref`，接受三／四／六／九年級**目前頁面自己的年級**、同源的115上練習頁，保留原場次與練習參數。
- 錯題控制器沿用原RPC、request ID與身分／題目世代檢查，只將舊的三／六年級網址檢查換成此函式。
- 外站、其他年級、其他頁面、無效值與帶URL憑證的連結拒絕。此為導覽檢查，後端仍負責本人、年級、已答錯來源、固定版本及場次授權。
- 產生的16入口與manifest同批更新，不逐頁手改版本。本批沒有資料庫函式、題庫資料或權限修改；不套用PR #636 SQL。

## 驗證與邊界

純函式測試涵蓋四個年級的相對／絕對網址、原參數保持與拒絕分支，既有年級導向測試保持。`quiz:build`與`quiz:check`通過。

以原`initWrongQuestions`及原學習重點renderer、合成題目和模擬RPC驗證：三／四／六／九 × 1280／390px共8案，均實際點開錯題、重點及練習按鈕，導向正確年級、保留固定session並載入原練習頁。另2案拒絕跨年級及外站回傳，沒有導航。10案無未捕捉瀏覽器錯誤。這不是正式OAuth或正式判分，不含私有題目。

可重跑：

```text
node --test automation/tests/quiz-past-practice-route.test.mjs automation/tests/quiz-grade-route.test.mjs automation/tests/quiz-workshop.test.mjs
npm run quiz:build
npm run quiz:check
```

合成頁為`automation/fixtures/quiz-past-practice-route.html`，由既有loopback預覽server供應，不部署到Vercel。新共用導向契約已完成聚焦唯讀審查，未發現阻擋合併的問題；審查範圍包括年級型別、後端回傳網址、同源與精確路徑，以及遲到回應與request ID保護。審查者未代跑測試或正式驗收。依審查小觀察，合成頁的跨年級錯誤改為依目前年級選擇不同年級，避免三年級負向案例誤回同年級。PR／main／乾淨發布、完整檔案比對、正式九年級學生的錯題→重點→兩題練習→保存讀回，皆列待完成。

社會配題另行核固定來源與115教材後登錄；本修正不把未發布候選或沒有可靠題目的重點標為可練習。二段其餘考古卷、三段及四項適用入口的完整完成定義維持。
