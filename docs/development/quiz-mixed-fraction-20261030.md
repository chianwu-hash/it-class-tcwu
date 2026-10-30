# 選項帶分數斷行修正（2026-10-30）

使用者回報六年級數學選項的帶分數被排成整數在上、分數在下。唯讀核對原題 `hanlin_g6_math_004cf065`：同一段的整數與 `\frac{1}{2}` 分別保存為原生 Word 文字片段，原始題庫結構正確。

根因是 `shared/quiz-student.css` 的 `#server-quiz .student-option .preview-content{display:block}` 遞迴套用到每個片段，優先權蓋過 `quiz-author.css` 的段落行內排版。題幹未在 student-option 之內，因此只有選項出現錯誤。

將規則限縮為 `.student-option .option-body > .preview-content`，僅令最外層內容佔列，段落／表格內仍沿用既有行內規則。沒有改分數字級、原題、正解、作答順序或任何資料庫資料。三／六年級答題頁為學生樣式加上 `20261030-inline-options` 快取版本。

驗證：

- 租約02 Chrome＋實際原題：先以原CSS重現三個帶分數選項斷行，再以新CSS檢查整數與分數 bounding boxes 同行、相鄰、垂直重疊；1103、1280、640、390、320px 皆通過，無橫向溢出及 pageerror。
- 同一渲染器與答題樣式下核對普通分數、整數、真正的兩段文字及原生表格，段落仍分開、表格結構保留。前後截圖已人工檢視。
- 正式學校測試帳號接回既有試卷，確認同一題 `hanlin_g6_math_004cf065`，1280／390px 的三個帶分數選項同行，回報按鈕保留、pageerror=0。未送出答案或回報，本次 view_question 攔截以避免更動閱讀計時。
- 以正式回報功能部署 `dpl_6JH1WxD6iF9fdCMH9Vhmduq49wWC` 的453個來源檔逐檔SHA1驗證為底，僅疊加CSS及兩個答題HTML。候選3檔SHA256通過後promote；正式353個公開檔SHA256通過，3檔變更、350檔保留。未部署SQL、Edge或Worker。

最終部署 `dpl_3K11Jh65ymHQqT1jpBmKdjYWtgE6`，正式網址 `https://it-class-tcwu.vercel.app`。使用者需重新整理原答題頁一次；既有作答、題目出錯回報與其他正式更新均保留。

測試在 `automation/tests/quiz-mixed-fraction-browser.cjs` 與 `quiz-mixed-fraction-live-browser.cjs`。發布檔案驗證工具 `automation/quiz-reports/verify-release.mjs` 增加選填輸出目錄參數，以重用既有SHA驗證。原題、媒體、截圖、原始CSS、發布清冊及證據放 ignored `automation/output/quiz/mixed-fraction/`，不提交正式題目或答案。
