原題未印選項的名稱／比較結果以既有short作答，不編造選項。六來源精確原件／真copy_self指紋共用四字起始欄，實際輸入向右延伸、換行增高；共同回顧用中性「這題保留的作答」，分數導覽轉可讀文字，完整題文仍上下排。六來源隔離全鏈與Claude二次複核完成，三型回顧函式均已核准套用；來源介面與啟用仍守整科門檻。詳[來源與驗收](quiz-short-answer-source-review-20261121.md)。

最重／最輕原標記：`item-marks`只讓精確來源使用原ˇ／○及留白操作；初始不預選，首次學生標記只帶入其餘未標記狀態，不代選極值。四來源16實體欄／14固定邏輯位置已做明確映射，個人16、錯答4、教材12＋12、小隊20提交／40回顧及原生錯答12／拒絕8通過。來源與正式函式啟用各守其核准及整科門檻。詳[來源與驗收](quiz-g3math-resume-20261120.md)。

原圖符號投影：`diagram-symbols`保留原符號與同圖倍率／完整天平，精確原件及copy_self指紋才啟用；figure固定在可見圖塊供延後載入，驗收逐張原圖SHA與放大返回。七來源19位置個人28／錯答7／幾何6已驗，教材21＋21已通過；未啟用或發布。詳[接續證據](quiz-g3math-resume-20261120.md)。

# 共用模組說明

## 原圖空格輸入（2026-11-21，候選待整科發布）

`quiz-image-blanks.mjs`由共用模板掛載已核定的原圖空格座標與原生text欄；原件及真copy_self指紋須精確相符，維持原圖、欄ID、fields-v1與媒體權限。原題代號／名詞是輸入輔助，先選格再填，不預選或送答；代號一字寬且觸控至少44px。圖區雙軸內捲，工具保留當前欄名；滑鼠／觸控保持輸入焦點，鍵盤返回不再強制捲動。回顧只搬移既有核對DOM，送答焦點對準該格的核對卡。工作區原本overflow:hidden會擋sticky，僅此精確模式改用overflow:clip保留裁切而不新增捲動祖先，必須以真頁面確認，不能只查CSS宣稱通過。詳[三來源證據與限制](quiz-image-blanks-20261121.md)。

## 奇偶數的原指定符號卡片（2026-11-21，候選待發布）

`deriveNumberSymbolTemplate`只投影已核定的原生數字轉錄及精確來源指紋：原題明定奇數○、偶數△或ˇ，各原欄名、數字及符號順序須逐一相符，不讀答案推測選項。`number-symbols`把原radio與原數字放同一卡，保留兩小題各自的符號規則、未選、鍵盤、原ID、同次送出及後端判分；手機兩欄，不受通用選答fieldset全寬規則影響。就地核對縮短文字但保留符號／文字及原欄名與可讀短提示，不只用顏色。這是數字分類標記，不能將幾何作圖或未核圖形題改為點符號；只有數字／空括號的圖片經原件、教師鍵、獨立計算及目視核定後轉原生文字，其他題意圖仍保留。詳[來源及完整隔離驗收](quiz-g3math-resume-20261120.md)。


## 小隊一般單選共同回顧（2026-11-21，候選待發布）

`partner-pilot/single-review.mjs`僅處理已開共同回顧、非past／非normal、2～8原選項的一般單選，沿原零起算索引與原後端correct核對負責人最新作答。缺回應只列參考，不猜選答；判分／參考矛盾採中性提示，不更改原判分。`review-layout`統一就地標註，核對狀態放在role=list之外，更新須保持單一提示；`past-results`只為past裝飾選項，避免雙路徑重複。SQL僅在reviewOpen後投影owner_of最新一筆，保留原配題、媒體、凍結及權限；多格、一般單選及簡答三範圍已分別核准套用，現行正式c430快照，不得重跑舊遷移。前端候選仍待整科發布。詳[實際套用與驗收](quiz-partner-short-approved-20261121.md)。


## 原句括號內圈選（2026-11-21，候選待發布）

`deriveInlineChoiceTemplate`只接受已核定、原句明印逗號分隔選項，且原生`single`欄位的選項數、內容與順序逐項吻合的多欄來源。`inline-choices`將原radio控制移回原句括號位置；精確`grouped` opt-in依原（1）（2）完整保留問題與其後另行印刷的選項、同一小題內①②不拆組，保留前後文、欄位／選項ID、鍵盤、一次送出與後端揭答；不依參考答案反推選項、不把未印選項的簡答題改選答。核對沿既有`quiz-fields-review`，原選項旁顯示選對、選錯及正確答案，錯值不覆寫；只在此模式縮小選項卡並去掉重複A／B及欄位摘要。只有一個圈選位置的新候選依既有canonical契約使用標準`single`，小隊沿真`copy_self`既有單選索引路徑，不能為模板強留一欄fields。詳[本輪來源與驗收](quiz-g3math-resume-20261120.md)。

## 原圖內多小題的顯示裁切（2026-11-21，候選待發布）

`deriveImagePanelTemplate`僅為精確核定的數學fields來源採用原圖像素範圍、原小題編號及欄位／單位對應；`image-panels`保留原圖文及媒體陣列，將同一不可變原圖以CSS顯示各小圖，原控制項與原單位同卡。沒有另存裁圖或依答案重畫；同一原面板各小圖使用相同倍率，不能各自拉滿而改變比較比例。原圖按鈕沿既有授權開完整原圖，個人／夥伴燈箱只為這個明示的按鈕容器處理焦點，保留一般圖片入口。原圖本身不再多一個Tab停點，鍵盤開關返回原按鈕；不變更答案、判分、一次送出或媒體權限。詳[來源與驗收](quiz-g3math-resume-20261120.md)。

## 分子填空與原小題的次分組（2026-11-21，候選待發布）

`quiz-answer-templates.mjs`的`fractionNumerators`僅為精確核定、全數學欄位的分組來源啟用：已依原WMF轉錄的空分子分數，移入原整數輸入欄，原印刷分母及分數線保持上下排，核對提示放在整個分數之外。原欄ID、數值型別、一次送出與後端判分保持，不要求重填已印好的分母。`subgroups`依原數字小題下的ㄅ／ㄆ／ㄇ與明確欄名歸屬分組，代號、原圖及原格同卡，未知或缺歸屬拒絕。沒有放寬題庫每段8張媒體的契約；公式轉原生文字，題意圖形仍保留原圖及放大入口。詳[來源與驗收](quiz-g3math-resume-20261120.md)。

## 數學看圖小題的原位分組（2026-11-20，候選待發布）

11/21補重量判讀／排序兩個精確來源。`groupMarker: 'bopomofo'`只在核定來源啟用原ㄅ／ㄆ／ㄇ分組，預設編號規則不變；`keepMassUnits`只在全數學欄位的分組模型，把原空格後的公斤／公克字面與原控制一起換行，不增減或重編答案欄。來源模型與夥伴複本必須完全吻合。原秤圖保留完整比例與放大入口，不能被工作區通用圖片高度上限縮成難辨刻度的縮圖。

`quiz-answer-templates.mjs`新增精確核定的`grouped-blanks`模型，依原編號、欄位歸屬及空格位置保留整個小題的圖文與輸入同卡。個人及夥伴共用原控制項，不改答案、保存或送出。自組卷複製媒體命名空間另有已核複本`partnerGuard`；未知指紋拒絕套用，不能替代原媒體授權。詳[來源與限制](quiz-g3math-resume-20261120.md)。一般fields小隊最新作答讀取已依核准正式套用，後續來源直接使用現行正式快照驗證，不再額外重套SQL。

## 單純造詞的簡潔解析（2026-11-19）

`quiz-word-meaning-review.mjs`以既有來源題型與模板指紋識別單純造詞，`quiz-word-meaning-guides.mjs`提供固定的簡短字義和多個例詞。`quiz-open-response.mjs`共用一字詞一卡，`quiz-server.mjs`及夥伴feedback／共同回顧在完整引導已可呈現時省去重複說明；缺來源、引導或授權仍沿原流程。原答案、原欄位、保存、自評與權限不變。詳[範圍與驗收](quiz-word-meaning-review-20261119.md)。

## 改錯題指示與欄名（2026-11-18）

`quiz-correction-presentation.mjs` 配合 NAS 核對後的 `quiz-correction-reviewed-sources.mjs`，以完整題文／欄位指紋補「填入正確的字」指示與有意義欄名，透過 `quiz-student-content.mjs` 接一般題共用呈現。故意錯字、原 ID、答案、固定版本及既有回應保持。未知來源不能由語感推測；來源或欄位換版後須重掃。

舊卷只有明確 `short`＋改錯字標題才補指示／欄名；已清楚指示、段落定位及其他型別保留。夥伴舊簡答沿原欄位保存，只補相同語意的標示。均沿用原外層一次送出，無 SQL／資料改寫。詳[核對與驗收](quiz-correction-instructions-20261118.md)。

## 共用排序卡片（2026-11-18）

`quiz-sequence.mjs`／`.css` 由 `quiz-fields.mjs` 輸入與回顧共用，夥伴沿原structured-answer入口。`quiz-sequence-model.mjs` 僅處理原ID陣列，初始不送變更、已答順序原樣讀回；拖曳／上移下移／鍵盤沿原onChange及一次送出。已答與回顧鎖住並顯示位置核對，拖曳取消／卸載清理。`quiz-sequence-presentation.mjs` 僅清理已核9版本的重複紙本控制與代號，保留2張時間軸原圖及原資料；共用解析改用內容引用。詳[契約與驗收](quiz-sequence-cards-20261118.md)。

## 已發卷的課本頁碼勘誤（2026-11-18）

`quiz-study-page-corrections.mjs` 由 `readQuizStudy()` 套用固定的題目／教材／原對照勘誤；只選伺服器已授權且指紋符合的正確頁。主頁標示與閱讀器使用相同context，無正確素材即隱去已知錯誤對照，不生成URL、不改歷史作答。現有一筆三年級國語95～96→94頁；詳[證據與限制](quiz-g3ch-page94-20261118.md)。

## 答案工具與浮動鍵盤（2026-11-18）

`quiz-input-keyboard.mjs`／`.css` 共用注音、標點與數學符號面板，`quiz-past-input.mjs` 保留相容匯出。工具按鈕分開排列；單一浮層標示答案格，可關閉／Esc／點外側收合，避開送出列並維持答案格可見。卸載或鎖定即清理；原完整符號、游標輸入與一次送出契約保持。詳[功能契約與驗收](quiz-floating-keyboard-20261118.md)。

## 勾選選項字級（2026-11-18）

`quiz-fields.css`讓set選項、明確都不選、閱讀／已答與回顧沿用單選的響應式字級，內層preview-content僅繼承字級及行高，不覆蓋國語字型。`quiz-fields.mjs`為set回顧加樣式類別，原資料／選項ID／勾選方式及外層一次送出保持。詳[實作與驗收](quiz-checkbox-font-20261118.md)。

## 期末短選項的紙本結尾句點（2026-11-18）

`quiz-choice-conversion.mjs` 串接 `quiz-option-periods.mjs`，僅對 `quiz-option-periods-reviewed.mjs` 已核定期末 ID、完整選項組與題文指紋做顯示投影。只去除明確短詞／數量組原末項的「。」；保留原來源、ID、正解、既有作答與亂序，個人／整份回顧／夥伴沿用原共用入口及原一次送出。期中、未知範圍、完整句子、引文與標點辨識題不擴大清理。新來源須由 `automation/audit-option-periods.mjs` 重掃後才能擴充清冊；詳[範圍、驗收與限制](quiz-final-option-periods-20261118.md)。

## 原生手寫開放作答（2026-11-17，SQL已套用，前端未發布）

`quiz-open-sketch.mjs`／`.css` 延伸 open 的 `input:sketch`，沿用共用 sketch editor；`quiz-open-response.mjs` 負責手寫輸入／已保存 SVG／既有自評。個人與 partner structured-answer 共用，原外層送出保持。核准SQL已套用，但正式共同回顧尚未提供他人筆跡，前端及新題均未發布／啟用；不能宣稱整條功能完成。筆跡保存不代表自動判對，舊文字與自動答案維持原契約。詳見[正式收據、缺口及暫停狀態](quiz-open-sketch-20261117.md)。

## 單選與多欄題內選項間距（2026-11-16）

`quiz-choice.css` 統一 `quiz-field.quiz-single-choice` 內的選項間距，沿用一般 single 的 workspace 12px／非 workspace 桌機14px、個人手機12px。不要只替期末或單一題型補 inline style；目視驗收須同時覆蓋期中、期末、保留歷史回應的 fields 舊卷、是非與多欄單選，另核對勾選型別、已選值及原外層單次送出保持。詳見[間距修正與驗收](quiz-option-spacing-20261116.md)。

## 練功坊首頁與努力說明（2026-11-13，已驗收並核准發布）

`quiz-library-home.mjs`只重排既有控制項與卷卡，同單元按科目／範圍／版本來源做視覺分組，各卷session ID、題數、進度及操作仍獨立；`quiz-subject-visual.mjs`提供本機SVG圖示。`quiz-library-home.css`及`quiz-library-home-style.css`由builder納入library bundle。保留三／六年級主題、原寵物WebP、各科分色與原導航，不因簡化移除。

首頁不再載入`quiz-learning.mjs`摘要，也不另放努力連結橫列。`my-tree.html`使用`quiz-effort-help.mjs`／`.css`提供原生details說明：初次摘要沿用既有quizTreeData.learning，手動更新僅讀learning summary；換人／換course／登出會reset，晚到回應不得覆蓋。說明不發獎、不寫進度，與原garden／auth分支分離；teacherView不掛載，歷史學期不套115上規則。learning.html的原主動選重點流程不變。實際正式部署識別以agent-handoff最新發布收據為準。

## 題目回報入口與表單（2026-11-13）

`createQuestionReport()`保留原表單、請求及重試狀態；答題頁使用`mountQuestionReport(host,box)`把按鈕掛到該題標題列右側，收合時表單外框不占版面。主控制器仍按本人attempt／題目保存同一box，重繪、揭答及整份回顧重新掛載同一按鈕，登出／換人依原Map生命週期清除。沒有標題列時保留原內嵌用法；不把回報送出事件綁到答案送出按鈕。

## 共用畫板與個人計算紙（2026-11-12，已驗收並核准發布）

`shared/sketch/editor.mjs`／`model.mjs`／`contract.mjs`及`editor.css`提取原夥伴畫板；舊partner入口保留re-export並共用核心。`createSketchEditor(host,{value,onChange,onSave,messages,toolbarHost})`回傳getValue、setDisabled、destroy，資料仍為原version:1／strokes／可選colors，最多80筆／每筆128點。可選toolbarHost讓個人計算紙把工具放入單列header，destroy會同步清掉外置工具；未指定則保留原夥伴結構。`shared/tool-icons.mjs`為原工具圖示的共用入口。

`quiz-scratchpad.mjs`由`createQuizWorkspace(root,{scratchpaper:true})`選用，apply須提供scratchpadKey及scratchpadLabel。一般題及個人考古UI提供本人／attempt／版本／題目或完整題組key；reset({forget:true})與destroy清除草稿。僅當頁記憶體，不混入送答／附件／AI／localStorage。詳見[契約、限制及本機驗證](quiz-shared-scratchpad-local-20261112.md)；實際正式狀態與部署識別以agent-handoff發布收據為準。

## 考前練功坊入口與呈現（2026-11-08 已正式發布）

三／四／六／九年級的選卷、普通個人、個人原卷及夥伴入口由 `quiz-workshop-config.mjs` 與 `shared/quiz-workshop/shells/` 產生，不逐頁改 HTML 或版本。執行 `npm run quiz:build`／`quiz:check`；建置會核對產物，資產 manifest 統一可達模組的版本別名，CSS bundle 展開巢狀依賴。名冊新消費者使用 `quiz-nav-identity.mjs`，舊 `grade6-nav-identity.js` 保留為同一實作。

三種作答模式共用 `quiz-workspace.mjs`、`quiz-choice.mjs`／`.css`，各自保留原 RPC／權限／草稿／提交粒度；原卷仍完整一組展示。課程設定只控制呈現，不能擴充後端授權。詳見 [架構清冊、擴充契約與驗證限制](quiz-workshop-modularization-20261108.md)。

> **2026-10-24 已核准新增**：`quiz-module.js` 的 opt-in `mode: 'server'` 交給 `quiz-server.mjs`；由 `server: { request, sessionId }` 接後端安全題目／送答／接回，不在前端接收未授權正解或評分。透過相同 `handleAuthChange(session)` 生命週期鎖定身分。新場次只記錄 `quiz_attempts/quiz_answers`，暫不接 `student_progress` 與努力樹。既有兩種模式維持原契約，詳見 [場次實作](quiz-implementation-20261024.md)。

> **2026-10-06 三年級轉換更新**：教師已指定第 06 週接 Google 登入與努力樹。第 02～06 週改用本人名冊核對、一次性舊成果接回與正式 `student_progress`；下文身分卡／不顯示努力樹的敘述僅適用轉換前。第 01 週免身分例外保留。以 [三年級 Google 契約](grade3-google-course.md) 與已填驗收契約為準；正式 SQL 與網站已於2026-10-06獲授權後完成切換；詳見 [正式切換紀錄](grade3-week06-release.md)。

> 基於實際程式碼，最後更新：2026-09-15
>
> **原則**：修改任何共用模組前，先看「高風險變更清單」（`high-risk-changes.md`）。

---

## `shared/auth.js`

**責任**：Supabase 客戶端建立、所有登入 / 登出 / session 操作的底層函數。所有模組的認證行為最終都走這裡。

**匯出**：
- 常數：`SUPABASE_URL`、`SUPABASE_ANON_KEY`、`TEACHER_EMAILS`、`AUTH_STORAGE_KEY`、`LOGIN_RETURN_KEY`、`supabase`
- 函數：`isTeacher(session)`、`getHomeRedirectUrl()`、`getAdminRedirectUrl()`、`requireHttpForAuth()`、`storeLoginReturn()`、`consumePendingRedirect()`、`signInWithGoogle()`、`beginCentralizedLogin()`、`signOutAndReload()`、`getSession()`、`resolveSession()`

**被誰 import**：
- `shared/navbar-auth.js`
- `shared/typing-challenge.js`
- `grade3/week06.html`（直接，操作 quiz student_progress）
- `grade3/week07.html`（直接，操作 quiz student_progress）
- `grade3/week06.quiz-adapter.js`
- `grade3/week07.quiz-adapter.js`
- `admin-progress.html`

**不可自行替代的理由**：
- `beginCentralizedLogin()` 在跳轉前會把 `returnTo` 寫入 `localStorage`，OAuth 完成後 index.html 才能跳回正確頁面。自己呼叫 `supabase.auth.signInWithOAuth()` 會跳回 index.html 根目錄，不會回到原始頁面。
- `requireHttpForAuth()` 在 `file://` 協定下會顯示警告並中止，防止 OAuth 在本機直接開檔案時靜默失敗。
- 分頁切回前景時，Supabase 可能重新觸發 auth event 或 token refresh。不要在 `onAuthStateChange`、`pageshow`、`visibilitychange`、`focus` 中無條件重讀資料或 reload；詳見 `supabase-tab-resume-incident.md`。

---

## `shared/image-lightbox.js` / `shared/image-lightbox.css`

**責任**：資訊圖卡同頁放大，視覺與操作取自六年級115-1第01週。新頁載入CSS，匯入並呼叫一次 `initImageLightbox()`，圖卡連結加 `data-image-lightbox`。模組提供縮放、百分比、拖曳、雙擊、雙指縮放、重設、置中、Esc／遮罩／按鈕關閉，以及焦點與捲動復原。不得依賴登入初始化或寫入進度。實作範例為 `grade6/115-1/week05.html`；驗收見 `lesson-to-web-sop.md` 第8.5節。

課本由 `quiz-textbook-reader.mjs` 共用：每次 `controller.open()` 傳入 `initialScale:.8`、`minScale:.2`、`zoomStep:.1`，不沿用一般題圖先建立燈箱時的限制。新頁以適合寬度的80%開啟，按「適合寬度」回100%；已讀頁優先恢復倍率與平移。這些參數只套用該次檢視，關閉後一般題圖維持原初始化設定。

翻頁方向由 `quiz-textbook-settings.mjs` 依已核教材ID設定，不依科目、年級或頁內文字的直橫排推測。RTL教材的左鍵是下一頁、右鍵是上一頁；頁碼與已授權頁排序仍遞增，完整拉頁不拆、不鏡射。未確認的教材維持LTR；新增版本須核對原頁後登記新ID。

## `shared/course-navbar.js`

**責任**：純 HTML 字串生成。根據 config 產生 nav 的 HTML，不做 DOM 操作，不做 auth。定義 `window.__buildCourseNavbarHtml()`。

**載入方式**：不透過 ES module import，而是被 `grade3/navbar.js` 和 `grade6/navbar.js` 以**同步 XMLHttpRequest + eval** 載入。

**被誰使用**：`grade3/navbar.js`、`grade6/navbar.js`

**關鍵 config 參數**：

| 參數 | 說明 |
|------|------|
| `activeWeeks` | 顯示在 navbar 的週次陣列 |
| `showAuthBarOnWeekPages` | 週頁面是否插入 authBarHtml |
| `showAuthBarOnHomePages` | 首頁是否插入 authBarHtml |
| `authBarHtml` | 登入按鈕 HTML，**必須包含 id="login-btn" 等固定 id** |

**不可自行替代的理由**：手刻 nav HTML 會跳過 week-visibility 重渲機制，nav 週次將不會跟後台同步。

---

## 導覽列學生身分：`shared/grade6-nav-identity.js`

檔名沿用歷史名稱，但目前由三、四、六、九年級共用。不要在頁面直接改寫 `#auth-status` 或自行串接姓名格式；登入／登出仍由 `navbar-auth.js` 負責，這個模組只呈現本人名冊資訊。

- 練功坊各頁使用同一模組 URL 與版本，避免不同 query 建立兩份 ES module 狀態。學生採 `expanded:true` 顯示「班級 班 座號 號 姓名」，Email放在title。六年級一般課程的compact模式保留。
- 選卷、答題、考古題已有本人名冊回應時，呼叫 `provideNavIdentity({userId,email,row})`，不另查名冊；row.email必須符合登入信箱。
- 夥伴練功的me回應沒有完整名冊欄位，於原onSessionResolved呼叫 `initGrade6NavIdentity({expanded:true,lookup:true})`，沿用同一模組的唯讀、快取與換帳號防護。lookup對本頁保持有效，較晚的navbar initializer不能將它關閉。
- 無名冊／教師或暫時讀取失敗時，保留原登入Email，不影響作答或權限；不以顯示文字推導權限。登出、換人與同帳號名冊更新必須清除舊顯示，遲到回應不能覆蓋新身分。

## `shared/navbar-auth.js`

**責任**：在 `document` 上設定點擊事件代理，管理 `#login-btn`、`#logout-btn`、`#auth-status`、`#reset-progress-btn`、`#admin-btn` 的顯示與行為。監聽 `course-navbar:rendered` 事件，在 navbar 重渲後刷新 UI 狀態。

**匯出**：`initNavbarAuth({ onResetProgress, onSessionResolved })`

**被誰 import**：
- grade3：舊學期週頁、現行 `grade3/115-1` Google週頁（由 `initGoogleCourseAuth()` 內含呼叫），以及Google登入前歷史身分卡頁；只有歷史身分卡分支不以Google session保存活動進度
- grade6：舊學期週頁、`grade6/115-1` 週頁與學期共用交作業入口

**關鍵設計**：使用 `document.addEventListener('click', handleClick)` 事件代理，**不是直接綁在按鈕元素上**，因此 grade3 navbar 重渲後 listener 不會消失。

**使用限制**：
- 舊 `grade6/navbar.js` 未定義 `authBarHtml`，但 `grade6/115-1/navbar.js` 已提供完整 auth bar。判斷時必須看學期資料夾，不能把舊學期限制套到 115-1。
- 三年級 115-1 課堂身分卡頁會由 `initClassCardAuth()` 隱藏 Google UI 並插入身分卡；不得讓背景 Google session 取代課堂身分卡或寫入 `student_progress`。
- 不可和自己手寫的 `#login-btn.addEventListener` 並存，會觸發兩次登入流程。

---

## `shared/typing-challenge.js`

2026-11-13 新增可選 `lockOnLoadError: true`：Google 正式進度讀取中或失敗時鎖住輸入／檢查，連直接呼叫 `checkLevel()` 也不保存；成功接回後才開放。六年級115-1第11週及兩個獨立魔王明確啟用，預設false，舊頁及既有adapter維持原行為。請提供對應 `progressMessages.loadError`，說明重新整理重試。驗收以保存回覆、下一關顯示及資料庫讀回為準，不能因輸入框先變readOnly就立即重整。

Claude複核後補強：同一關檢查以`checkingLevels`同步防重入，涵蓋auth等待與保存等待；保存失敗仍可重試，成功前的連點不會走readOnly慶祝分支，舊一關魔王也有回歸。啟用讀取失敗鎖定後，僅「同一使用者曾成功接回本活動」且框內有文字時，允許鎖定中手動儲存草稿；恢復草稿與正式送出仍鎖定。未成功讀取、未登入或換人都不開放此例外，草稿仍只進typing_drafts，不當成正式進度。

**責任**：管理多關卡打字練習的完整生命週期：session 解析、進度讀取、關卡解鎖、答案驗證、進度儲存、進度重置、慶祝動畫、auth UI 更新，以及 opt-in 的手動草稿暫存 / 回復。一般 Google 登入頁讀寫 Supabase `student_progress`；三年級 Google 登入前的課堂身分卡分支可透過 `guestProgress` adapter 讀寫 `guest_progress`。

**匯出**：`initTypingChallenge({ weekCode, activityKey, levelsData, levelEncouragements, buildHint, getWrongAnswerHtml, progressMessages, celebrationContent, draftOptions, afterAuthUpdate, autoScrollNext, requireAuth, guestProgress })`

**關卡完成後導覽**：`autoScrollNext` 預設為 `true`，維持既有「答對後自動移到下一關」行為。頁面若提供每關「再練習一次／前往下一關」雙按鈕，可設為 `false`，讓學生先在原卡片選擇；頁面端仍須自行顯示下一關按鈕，不能讓流程失去出口。

**被誰 import**：舊學期多個三年級週頁、`grade3/115-1/week02.html`、`week03.html`，以及 `grade6/115-1/week01.html`、`week02.html` 等打字頁。

**levelEncouragements 語氣**：三年級打字闖關需為每關提供阿德勒式鼓勵語，重點放在努力、策略、耐心、修正、檢查與進步，避免只寫「很棒」「太厲害」或單純宣布過關。

**levelsData 格式**（容易寫錯）：
```javascript
// 正確
{ id: 1, ans: "答案文字" }

// 錯誤（Codex 常犯）
{ id: 1, answer: "答案文字" }
```

**weekCode 格式**：兩位數字串，`"04"`、`"07"`、`"10"`，不是數字 `4`、`7`、`10`。

**activityKey 命名規則**：`typing_task_N`（N 需符合後台顯示的總關卡數）。`student_progress` 的唯一鍵是 `user_id + week_code + activity_key`；`guest_progress` 的唯一鍵是 `profile_id + course_id + week_code + activity_key`。不同週次可以使用相同 activityKey；重點是同一週內不要讓兩個活動共用相同 key。

**Navbar auth 邊界**：模組可更新打字闖關所需的 auth 顯示與 reset-progress 狀態，但不直接綁定 `#login-btn`、`#logout-btn`。登入 / 登出點擊一律交給 `initNavbarAuth()` 的事件代理。**因此，所有使用 `initTypingChallenge` 的頁面，必須同時呼叫 `initNavbarAuth()`。**課堂身分卡分支仍可呼叫 `initNavbarAuth()`，但 `initTypingChallenge({ requireAuth: false, guestProgress })` 不得讀取背景 Google session 或寫入 `student_progress`。

**未確認身分鎖定規則**：一般 Google 登入頁必須在未登入時鎖定 `#typing-levels-container` 內的輸入框與 `checkLevel` 按鈕。課堂身分卡分支須由頁面端在未確認身分卡前鎖定互動 UI，並把 `guestProgress` 傳入 `initTypingChallenge()`。`requireAuth: false` 時 shared typing 不會自動鎖定輸入框，頁面端必須用 `inert`、`disabled` 或等效橋接確實鎖住。學生不可在未確認身分狀態先完成關卡，避免完成後才發現沒有保存。

**手動草稿暫存**：三年級打字頁可用 `draftOptions: { enabled: true }` 啟用「儲存草稿 / 回復上次草稿」。草稿存到 `typing_drafts`，只保存學生尚未過關的輸入文字，不寫入 `student_progress`，不進入後台、成績或努力樹計算。第一版只允許手動儲存與手動回復；不可加入自動存檔、`setInterval`、`focus` / `visibilitychange` / `beforeunload` 存檔，避免和老師指令下的手動存檔打架。回復草稿必須由學生主動按鈕觸發，若輸入框已有文字需先確認，不可自動覆蓋。

**題目 / 答案字型**：模組會在 `#typing-levels-container`（含舊頁面的 `#levels-container`）內統一題目顯示區與輸入框 / 文字區的 `font-family`，避免英打題目因 `<pre>` 預設等寬字型而和答案區看起來不一致。

**禁止複製貼上**：這是週頁既有的 HTML 契約，不另外在 `typing-challenge.js` 造第二套攔截器。題目範例區使用 `select-none pointer-events-none`；輸入框／文字區使用 `onpaste="return false;" ondrop="return false;"`，並在學生可見說明明示需逐字輸入。自動測試要同時確認範例 `user-select: none`、paste/drop 事件被取消，以及一般鍵盤輸入仍正常。

**需要的外部 CDN**：`canvas-confetti`，必須在 `<head>` 加入，否則完成動畫會報 ReferenceError：
```html
<script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>
```

**不可自行替代的理由**：自寫邏輯容易只存 localStorage，後台看不到進度，且難以維護重置 / 接回進度的複雜狀態。一般頁的 `student_progress` 與課堂身分卡分支的 `guest_progress` 都是課堂核心路徑，必須能承受學生切到其他分頁後再回來送出；若一般 Google 登入頁保存邏輯要調整，先讀 `supabase-tab-resume-incident.md`。

---

## `shared/class-card-auth.js`

**責任**：提供三年級 Google 登入前的「課堂身分卡」入口，在 navbar 右上角取代 Google 登入，用班級座號與生日四碼確認目前使用電腦的學生。

**匯出**：`initClassCardAuth({ courseId, mode, fallbackRosterUrl, verifyStrategy, storagePrefix, onIdentityChanged })`

**使用規則**：
- 只用於學生尚未學會 Google 登入的低風險課堂練習頁。
- 同一頁 navbar 只能顯示課堂身分卡或 Google 登入其中一種。
- 身分卡可用 localStorage 保存臨時身分，讓學生不小心關閉或重開頁面後接回；活動進度不可存在 localStorage。
- 若使用生日四碼作為 RPC 驗證與後續進度寫入憑證，需在頁面文字清楚標示這不是 Google 登入，並在登出身分時清除 localStorage 身分。
- localStorage 可能殘留學生加入正式名冊前的 `sample-roster` 身分。初始化時應以同一張身分卡重新嘗試 RPC；若已可取得正式資料，自動升級為 `source: "rpc"` 再保存進度，避免 navbar 顯示姓名但 `createClassCardProgress()` 拒絕寫入。

---

## `shared/class-card-progress.js`

**責任**：提供課堂身分卡分支的進度 adapter。`createClassCardProgress({ courseId, weekCode, activityKey, total, getIdentity })` 回傳 `load()` / `save()`，經由 `get_guest_progress`、`upsert_guest_progress` RPC 讀寫 `guest_progress`。

**使用規則**：
- 只搭配 `initClassCardAuth()` 使用；沒有身分時不得保存進度。
- 不可退回 `student_progress`，也不可把活動進度寫進 localStorage。
- 教師後台要能查詢與重設對應 `guest_progress`；重設後學生頁重新整理應回到未完成。
- 若頁面曾使用 localStorage 暫存進度，改用本模組時要清除舊鍵。

---

## `shared/typing-tools.js`

**責任**：提供三年級中英打闖關頁面共用的浮動輔助工具，包含「標點符號表」與「中英文鍵盤圖」。標點符號表需以兩頁切換顯示，避免一張圖上下擠在同一視窗裡太小；鍵盤圖需支援中文鍵盤與英文鍵盤切換。

**匯出**：

- `initTypingTools({ showPunctuation, showKeyboard, keyboardGuide, getKeyboardTarget, getZhuyinTarget })`
- `renderEnglishKeyboardGuide(container, { target })`
- `renderBackspaceKeyHint(container)`、`renderCapsLockKeyHint(container)`、`renderShiftKeyHint(container)`

**被誰 import**：三年級多數中英打闖關頁，以及 `grade6/115-1/week01.html`、`week02.html` 等目前學期六年級打字頁。

**使用規則**：
- 教案要求鍵盤圖或標點表的中英打頁，需依實際巢狀路徑 import 並呼叫 `initTypingTools()`；115-1 週頁通常使用 `../../shared/typing-tools.js`。
- 預設同時顯示標點符號表與鍵盤圖；若特殊頁面只需要其中一項，可用 `showPunctuation: false` 或 `showKeyboard: false` 關閉。
- 初學英打頁若要讓「看鍵盤圖」依目前題目標出按鍵，使用 `keyboardGuide: true`，並以 `getKeyboardTarget()` 回傳目前單字。工具每次開啟都會重新讀取目標，不能把單字寫死在共用模組。
- 中打頁若要讓「看鍵盤圖」依目前題目標出注音鍵，傳入 `getZhuyinTarget()`，回傳 `{ text, zhuyin }`，`zhuyin` 為每字一個音節、以空白分隔（例如 `{ text: '小星', zhuyin: 'ㄒㄧㄠˇ ㄒㄧㄥ' }`）；沒有聲調符號的音節會自動標出空白鍵（一聲）。鍵位沿用 `zhuyin-foundation-curriculum.mjs` 的大千式 `zhuyinKeys`；注音由週頁提供並人工核對。未傳此參數的頁面仍顯示原本的靜態中／英鍵盤圖。2026-10-19 首次用於三年級第 08 週。
- 頁面內嵌的英文字母位置提示也必須優先呼叫 `renderEnglishKeyboardGuide(container, { target })`，不要複製另一份 QWERTY 鍵盤 HTML。此函式同時顯示鍵帽大寫、輸入小寫、黃色目標鍵與輸入順序。
- 需要提示 Backspace、Caps Lock 或 Shift 的位置時，使用對應的 `render*KeyHint()`；提示支援滑鼠移入、鍵盤焦點與手機觸控，頁面不要另畫一套鍵盤位置圖。
- 不要在單一週頁面複製浮動工具 HTML、`toggleFloatingKeyboard()`、`showKeyboardLayout()`、`toggleFloatingPunctuation()` 或 `showPunctuationPage()`。
- 此模組只建立輔助圖表 UI，不負責登入、解鎖或進度保存；打字進度仍必須交給 `initTypingChallenge()`。

**不可自行替代的理由**：鍵盤圖與標點符號表是跨週固定課堂工具，分散在各頁會造成圖片版本、裁切方式、手機顯示與事件綁定不一致，學生上課時容易遇到同一功能在不同週次行為不同。

---

## `shared/week-visibility.js`

**責任**：從 Supabase `week_visibility` 表讀取哪些週可見，套用到首頁週卡（隱藏 / 顯示），或提供 navbar.js 過濾 activeWeeks。

**匯出**：
- `extractWeekCodeFromHref(href)`
- `collectWeekCards(root)`
- `loadWeekVisibility(grade, courseId = null)`
- `applyWeekVisibilityRows(weekCards, rows)`
- `prioritizeLatestVisibleWeekCard(weekCards)`
- `applyWeekVisibilityToCards(grade, root = document, courseId = null)`（主入口）

**被誰 import**：
- `grade3/index.html`、`grade6/index.html`（舊學期首頁週卡；使用相容查詢）
- `grade3/115-1/index.html`、`grade6/115-1/index.html`（傳入明確 `courseId`）
- `grade3/navbar.js` 與 `grade3/115-1/navbar.js`（navbar 週次過濾，**這是觸發 navbar 重渲的來源**）
- 六年級 navbar：目前 `activeWeeks` 仍由各學期 navbar 明確設定；首頁週卡另由 `week_visibility` 控制

**學期隔離**：新學期一律傳入完整 `courseId`，例如 `loadWeekVisibility("grade3", "grade3-115-1")` 或 `applyWeekVisibilityToCards("grade6", root, "grade6-115-1")`。省略參數只供舊學期相容。

**重要注意**：grade3 navbar 在非同步載入 week-visibility 後會完整重渲 nav（`existingNav.remove()` + `insertAdjacentHTML`）。這會移除所有直接綁定在 nav 元素上的事件 listener。

---

## `shared/quiz-module.js`

2026-09-07 新增 opt-in `mode: "practice"`（第 2 週使用）：交由 `shared/quiz-practice.js` 逐題呈現，答錯提示重選，答對保存後手動下一題。`saveProgress(correctCount)` 在每題答對時呼叫；`loadProgress()` 回傳 `{ score, completed }` 接回。保存失敗停留原題重試，讀取失敗顯示重試按鈕。同一使用者重複 auth 通知不重畫。未指定 mode 的所有既有頁保留原本一次送出、評分流程。

`shared/activity-progress.js` 提供 `createActivityProgress({ courseId, weekCode, activityKey, total, getSession })` 的 `load()` / `save(score)`，供一般 Google 登入頁的逐題測驗和操作活動使用。明確限定 course_id，使用現有 auth token、RLS REST 寫入與 10 秒 timeout；不退回缺 course_id 的舊資料格式。課堂身分卡分支改用 `createClassCardProgress()`；打字仍使用 `initTypingChallenge()`。

**責任**：通用題目問答 UI 邏輯（選項顯示、作答、送出、評分）。不直接操作 Supabase，由使用方的 adapter 負責讀寫。

**登入規則**：只要是課程頁中的可點選測驗 / 小測驗，預設必須使用登入鎖定。一般頁未登入時顯示 lock 區塊，不渲染可作答題目；課堂身分卡分支未確認身分時也要鎖定。若只是口頭檢查，請做成靜態文字，不做互動選項。

**匯出**：`initQuizModule({ questions, selectors, messages, loadProgress, saveProgress, loadGuestProgress, saveGuestProgress, getCurrentUser, onRequireLogin, onAfterGrade, onAfterSubmit, optionLabelMode })`

**評分與保存回呼**：`onAfterGrade({ correct, total })` 在畫面完成評分後觸發，適合滿分動畫等只依賴答題結果的回饋；`onAfterSubmit({ correct, total })` 只在保存成功後觸發，適合完成 banner、重玩入口或其他需要確認已入帳的行為。保存失敗只能更新保存狀態提示，不得覆蓋既有分數、正誤或滿分訊息。

**Adapter 規則**：`quiz-module.js` 負責 UI 與評分流程，頁面可提供 `loadProgress` / `saveProgress` / `getCurrentUser` adapter 讀寫進度。一般 Google 登入頁寫入 `student_progress`；課堂身分卡分支寫入 `guest_progress`。這種頁面端 callback 是目前允許的整合方式，不視為繞過共用模組；但 adapter 不應重寫題目渲染、選項選取、評分或未登入鎖定 UI。若同一種 adapter 在多週重複，優先抽成週頁共用 adapter 檔。

**被誰 import**：
- `grade3/week06.quiz-adapter.js`
- `grade3/week07.quiz-adapter.js`
- `grade3/week11.quiz-adapter.js`
- `grade3/week12.html`
- `grade3/week13.html`
- `grade3/week14.html`
- `grade3/week15.html`
- `grade3/week16.html`

---

## `shared/classroom-controls.js`

**責任**：管理課堂即時控制旗標。適合老師上課時先鎖住外部連結、影片、活動入口，等進入指定階段再開放；學生端可用「更新狀態」按鈕手動同步，不需要輪詢。

**匯出**：`initClassroomLinkControl({ supabase, isTeacher, grade, weekCode, controlKey, container, linkSelector, statusText, statusIcon, refreshButton, teacherToggleButton, messages, toggleButtonHtml })`

**資料庫依賴**：`supabase/classroom_controls.sql`

- `public.classroom_controls`
- `public.get_classroom_control(p_grade, p_week_code, p_control_key)`
- `public.admin_set_classroom_control(p_grade, p_week_code, p_control_key, p_is_enabled)`

**被誰 import**：`grade3/week14.html`

**使用時機**：
- 景點、影片、外部網站等不想讓學生在課程前半段先點開。
- 老師需要用同一頁面即時開放 / 關閉，但不想用自動輪詢干擾既有登入、測驗或打字進度。

**使用規則**：
- 頁面仍需呼叫 `initNavbarAuth({ onSessionResolved })`，並在 callback 中把 session 傳給 `control.handleSession(session)`，老師按鈕才會依 `isTeacher(session)` 顯示。
- 學生端狀態更新採手動按鈕，不使用 `setInterval` 輪詢。
- `controlKey` 需具有語意且同一週內唯一，例如 `maps_links`、`video_links`、`practice_links`。
- 此模組只控制 UI 可點擊與 Supabase 開關旗標，不寫入 `student_progress`。

**最小使用範例**：

```javascript
const linkControl = initClassroomLinkControl({
    supabase,
    isTeacher,
    grade: "grade3",
    weekCode: "14",
    controlKey: "maps_links",
    container: "#maps-body",
    linkSelector: "a[target='_blank']",
    statusText: "#maps-links-status",
    statusIcon: "#maps-links-status-icon",
    refreshButton: "#maps-refresh-btn",
    teacherToggleButton: "#maps-teacher-toggle"
});

initNavbarAuth({
    onSessionResolved: (session) => linkControl.handleSession(session)
});
linkControl.load();
```

---

## 六年級 115-1 作業收件模組

**入口**：學生使用 `grade6/115-1/homework.html`，教師使用 `admin-homework.html`。

**主要模組**：

- `shared/homework-student.js`：列出作業、處理單檔選取、分段上傳、接續重試、縮圖與學生版本紀錄。
- `shared/homework-api.js`：統一呼叫 `homework_action`、`homework_review` 與 homework Edge Function；並提供 `homeworkTreeData()`。
- `shared/homework-dropzone.js`：檔案選擇與拖放 UI，不負責保存完成狀態。
- `shared/homework-review-ui.js`：作品預覽、批註、文字回饋及版本歷史。
- `shared/homework-thumbnails.js`：圖片縮圖產生、保存與讀取。

**功能契約**：

- 作業資料使用獨立 `homework_*` 表，不寫入 `student_progress` 或 localStorage。
- 學生必須使用名冊中的六年級學校 Google 帳號；教師帳號不能代替學生交件。
- 作業由教師在後台建立草稿並明確開放。週頁不得自動建立作業，也不得寫死 assignment ID。
- 同一作業重交會保留版本，最新版重新待評；網路重試不得產生重複作業或重複獎勵。
- 週頁只連向學期共用入口，並寫清楚「第幾週、作業名稱、檔名／格式、完成狀態」。不可在每個週頁複製上傳 UI 或直接呼叫 RPC。
- 努力樹由 `homeworkTreeData()` 依目前狀態推導：繳交一葉、最新版本過關再一葉，不產生花朵。

---

## 六年級 115-1 閱讀小卡模組

**主要模組**：

- `shared/reading-ui.js`：學生分享／修改、歷史版本、教師週次設定、班級檢視與評比。
- `shared/reading-api.js`：統一呼叫 `reading_action`，並提供 `readingTreeData()`。

**功能契約**：

- 閱讀小卡與作業共用 `grade6/115-1/homework.html#reading`，不是獨立週頁應自行重做的表單。
- 教師依行事曆建立明確週次與日期；沒上課的週保持缺號，已開放的舊週可補分享，除非教師暫停。
- 每位學生每個閱讀週次只有一張目前小卡；修改會保留不可變的歷史版本，不增加額外卡片或獎勵。
- 閱讀目前是自由分享制度：不列缺交、不顯示未分享人數、不使用逾期字眼。課堂可以安排全班共同體驗，但不可改變後台的自願參與語意。
- 努力樹由 `readingTreeData()` 推導：分享一葉、老師評為過關再一葉。`reading_<period_id>` 由模組產生，不在週頁硬寫。
- `chianwu@apps.ntpc.edu.tw` 是唯一可由教師後台清除閱讀測試紀錄的學生帳號。重設必須透過教師限定 RPC，在同一交易清除該帳號指定週次的事件、目前小卡與歷史版本，保留閱讀週次並寫入 `reading_test_resets` 稽核紀錄；一般學生不得顯示或呼叫此功能。
- 不在交作業頁嵌入第二棵努力樹；學生仍從年級 navbar 的共同入口查看。

---

## `shared/reward-tree-model.js` 與六年級動態資料

**責任**：把打字、測驗、作業與閱讀的既有資料轉成葉片／花朵顯示。週頁不得直接寫入努力樹資料。

六年級 115-1 載入方式：

- 靜態設定提供中英打等 `student_progress` 活動。
- `homeworkTreeData()` 動態加入非草稿作業與目前學生提交狀態。
- `readingTreeData()` 只為已分享的小卡建立活動，未分享的自由閱讀週不產生待完成活動。

三年級 115-1 在2026-10-06後已使用Google本人名冊與 `student_progress`，支援努力樹；第11週起顯式 `five-then-flower` 六關活動為前五關合計一葉、全過一葉一花。只有Google登入前歷史課堂身分卡分支的 `guest_progress` 不適用，不得以該歷史例外略過現行週頁驗收。

---

## grade3/navbar.js vs grade6/navbar.js 差異對照

| 項目 | grade3/navbar.js | grade6/navbar.js |
|------|-----------------|-----------------|
| 程式碼行數 | 105 行 | 30 行 |
| showAuthBarOnWeekPages | `true` | 未設定（預設 false） |
| authBarHtml | 已定義（含 5 個 id） | 未定義 |
| nav 重渲機制 | `existingNav.remove()` + 重新 insert | 直接 `insertAdjacentHTML beforebegin`（無移除） |
| week-visibility 非同步載入 | **是**（會觸發重渲） | **否** |
| CustomEvent `course-navbar:rendered` | **是**（重渲後派發） | **否** |
| activeWeeks | `[3,4,5,6,7,8,9,10]` | `[3,4,5,6,7,8,10]` |

**結論**：grade3 navbar 架構遠比 grade6 複雜。所有 grade3 auth 問題都要考慮「重渲後 listener 是否還在」。

上表描述舊學期根目錄 navbar。115-1 必須另看同學期檔案：

| 課程 | Navbar 身分現況 | 努力樹／作業入口 |
|---|---|---|
| `grade3-115-1` | 現行週頁以 `initGoogleCourseAuth()` 確認Google本人名冊（內含 `initNavbarAuth()`）；navbar 仍會因週次可見性重渲 | 已支援努力樹；沒有六年級作業／閱讀入口 |
| `grade6-115-1` | `authBarHtml` 與 `showAuthBarOnWeekPages: true` 已啟用，使用學校 Google 登入 | 顯示交作業與努力樹入口 |

## 固定答案與計算過程（2026-11-18，SQL及前端已正式發布）

- `quiz-fields.mjs` 沿用原欄位及一次送答，只有明確 opt-in 的 `fields` 題可另帶 `work:{input:'expression'|'sketch',label}`；一般算式用輸入／數字符號按鍵，來源明確要求直式才用手寫。共用 `quiz-work-response.mjs` 不新增內層送出或自評階段。
- 同一原生回應為 `{v:1,f:{原答案欄},w:計算過程}`。`quiz_fields_grade` 仍只判原答案欄；回饋限定「答案欄答對」，過程供核對參考解法。`w` 不是可判分的答案欄，也不是獨立 Map、文字塞圖或計算紙。未 opt-in 的舊題仍只接受原 `{v:1,f}`，舊卷與舊作答不改。
- 算式最多250字；直式沿用80筆／每筆128點／座標與顏色白名單，僅此類回應上限為300000 UTF-8 bytes。後端拒絕重複鍵、空白過程、未知鍵與跨規格值。`quiz-saved-work.sql` 只更新7個既有函式，保留權限與資料表，本案已獲核准並套用正式庫；後續新函式變更仍須逐次核准。
- 個人接回／整份回顧顯示原保存過程；夥伴同一畫面僅顯示一份，全組送答前不把作答過程洩漏給夥伴，完成後共同回顧讀最新已保存版本。逾時或回應遺失時只顯示待確認，不能冒稱已保存；沿用原 request ID 重試。離題、登出與重渲須釋放手寫控制器。

## 答題回饋動畫共用（2026-11-07）

- `shared/quiz-feedback-motion.mjs`／`.css` 是個人答題與夥伴練功十套角色、對錯動作、keyframe 與停止行為的共同來源；原樣由 quiz-server／quiz-student 抽出，避免新增第二套圖案與動畫。維護角色時修改這組檔案。
- 個人 `quiz-server.mjs` 沿用既有播放控制；夥伴 `partner-pilot/answer-feedback-motion.mjs` 只在成功 committed(answer) 後播放。同步更新與回看顯示靜態角色，不重複播放；換房／離開要 stop／clear，減少動態效果／背景依原播放器規則不強播。
- 沿用答題介面包含回饋動效，不能只檢查色卡與選項。新增共用入口時必須載入動畫 CSS，實際驗證 SVG、keyframe、播放及停止，不能只驗 class 名稱。


### 來源核定的題型說明與欄名（2026-11-18）

`quiz-task-instructions.mjs` 與無原題／解答的 `quiz-task-instructions-sources.mjs` 在 `convertStudentContent` 共用鏈補指示及泛用欄名；`quiz-open-response.mjs` 也從同一鏈讀取，涵蓋夥伴直接傳入原題的入口。`quiz-reading-presentation.mjs` 先解析未修改來源再裝飾呈現，不重算原圖位。`quiz-presentation-signature.mjs` 僅將同一 hash 的個人／夥伴媒體命名空間視為相同呈現來源，不改 URL 或授權。來源指紋不符即不套用；禁止以此更改答案、欄位 ID、保存或送出流程。詳[規則與驗收](quiz-task-instructions-20261118.md)。


### NAS原框詞與句子選項對位（2026-11-18）

`quiz-source-boxes.mjs`／`quiz-source-boxes-sources.mjs` 在共用呈現鏈依來源指紋補原框線；不改存檔schema或題目資料。已核定的詞義題使用既有 numbered reading／standalone 結構，使句子與選項同組；原題與原選項ID保持。`quiz-source-box-render.mjs` 是個人render與夥伴official-render共用的安全文字run畫框方式，`quiz-fields.css` 保證整個詞框及原小題內容可讀。新轉化時同步驗來源邊框與學生DOM，不能只保留純文字。詳[驗收](quiz-boxed-word-layout-20261118.md)。


### 共用連連看（2026-11-18；2026-11-19修正版已發布）

同部首開放題另使用`quiz-open-subquestions.mjs`與來源範圍登錄，在原open renderer／prompt鏈使各提示字緊鄰輸入框；原值／自評／一次送出不變。個人整份回顧與夥伴使用同一欄名；詳[驗收](quiz-open-subquestions-20261119.md)。

quiz-matching-model.mjs 管原值與連線、quiz-matching-presentation.mjs／sources 管來源指紋與裁圖，quiz-matching.mjs 為原生按鈕與SVG連線介面；quiz-matching-past.mjs／past-sources 接舊卷及夥伴純量／陣列。quiz-fields、舊卷個人／教師及夥伴作答／回顧共用，不另建送答API。樣式由 quiz-fields.css 匯入並納入workshop雜湊產物。補圖修正版兩函式SQL已獲本案核准並套用，授權快照補圖而不更新凍結題目；後續新SQL仍須核准。詳[驗收與限制](quiz-matching-20261118.md)。
# 閱讀作答工作區（2026-11-19）

`shared/quiz-reading-workbench.mjs`由原fields控制項建立文章／小題分區；桌機分別捲動，手機與低高度改為同一文章DOM的對話框。`quiz-reading-inline.mjs`與`quiz-reading-inline-sources.mjs`只在來源指紋、原欄序及標記相符時，把原填字格放在文章標記旁。個人、整份回顧與夥伴共用，保持原回應及一次送出。詳[來源與驗收](quiz-reading-inline-workspace-20261119.md)。

