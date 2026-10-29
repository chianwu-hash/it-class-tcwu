# 答題雙欄與固定操作列獨立發布

日期：2026-10-29。使用者授權整理左右雙欄及固定「下一題」操作列，確認通過後上線；半葉制度與努力花園排除。

## 範圍與行為

- 三、六年級現學期共用答題頁使用同一工作區。一般桌機短題約 60／40 雙欄，左側題目及選項，右側結果與解析；未揭答時只顯示中性提示。
- 送出、相同答案重試、下一題及末題的整份回顧入口位於底部固定操作列，預留正文空間。儲存失敗不出現下一題，最後題仍先顯示自己的結果。
- 系統提示及更新儲存狀態集中在可展開的提示區；失敗、儲存狀態、關場與閱讀時間不完整仍直接顯示。提示區支援鍵盤與 Escape。
- 長材料、簡答、手機及窄視窗採自然單欄；一般桌機的長選項／解析可在各自面板捲動。全文回顧維持自然長頁。保留原圖燈箱、表格、公式、聽力及十套回饋角色。
- 更換題目／保存後的焦點避免把桌機整頁捲離工作區；登出及銷毀模組清理工作區狀態與監聽。

產品範圍僅七檔：三、六年級 `quiz.html`、`shared/quiz-student.mjs`、`quiz-module.js`、`quiz-server.mjs`、新 `quiz-workspace.mjs` 與 `.css`。版本識別 `20261029-workspace`。

## 隔離方式

以已正式發布的 `b5ff031` 匯出乾淨快照，再加入七個產品檔。從尚未提交的混合版本移除半葉文字／計算／慶祝依賴、`onStateLoaded` 與 `entry_identity` 登入捷徑；學生入口只更新模組版本，沿用正式版的名冊及 `library_sessions` 核對流程。

未納入身分顯示快取、登入捷徑、組卷頁調整、半葉、花園、天氣、寵物、獎勵模型或任何 SQL。原正式一葉規則、`quiz-leaf-celebration.mjs`、auth、navbar、計分／保存 API 與資料庫均沿用基準。工作區其他修改保留，部分檔案只暫存本輪範圍。

## 驗證方式與限制

```powershell
node --test automation/tests/quiz.test.mjs automation/tests/quiz-auth-media.test.mjs automation/tests/quiz-native-content.test.mjs automation/tests/quiz-personal.test.mjs automation/tests/quiz-student-library.test.mjs automation/tests/quiz-grade-route.test.mjs automation/tests/quiz-compact.test.mjs
```

乾淨快照中 13 項既有回歸全部通過，涵蓋真實本機 SQL、登入權杖、權限／名冊／跨人隔離、保存與重送、整卷及題組揭答、媒體授權和精簡回應。產品模組另作語法檢查。

`automation/tests/quiz-workspace-release-browser.cjs` 使用租約工作瀏覽器，實際入口、原 navbar、共用控制器及樣式，以 `http://localhost:3000` 的攔截合成 Auth／RPC 回應驗證；不寫正式學生答案。支援 `QUIZ_WORKSPACE_ORIGIN`、`QUIZ_WORKSPACE_LIVE=1` 以正式主網址實際讀取靜態檔案，身分／作答仍全部攔截為合成資料。

桌機 1366×620、1920×930、390×844、320×600 及 683×384／deviceScaleFactor 2 驗證固定主操作及無水平溢出；後者為等效窄視窗，非原生瀏覽器縮放按鈕操作。桌機與手機截圖已實看。

驗證包含保存中、送達後回應遺失及相同 UUID 重試、重整接續、答太快、末題回饋與完整回顧、延後揭答、長材料／選項／解析、缺詳解、原有一葉慶祝、圖片燈箱、關場唯讀、換人後延遲回應隔離、登出清理、鍵盤提示區及 reduced-motion。十套回饋角色均在實際答題 DOM 驗證，新增十套輪測使用 reduced-motion，非宣稱逐套完整動畫藝術驗收。

聽力使用合成 WAV 驗證原播放器的播放及暫停；不冒稱本輪重測書商所有原版音檔。未使用真人 OAuth 或真實學生送答，沒有正式資料庫修改／壓測。

## 發布查核

發布前須確認本輪七檔以外的正式來源與基準一致，尤其保留剛上線的找字小幫手與草稿。提交檢查在乾淨快照執行原 pre-commit，不停用 hook、不修改其他暫存腳本。

正式發布經 `origin/main` 的既有 Vercel Git 整合。提交識別、部署 READY、正式網域指向、七檔讀回與未改檔保留驗證，以及正式主網址的合成瀏覽器結果，於發布後補記。私有驗證產物置於忽略的 `tmp/workspace-release-20261029/`，不提交 token、真實學生成果或題庫來源。
