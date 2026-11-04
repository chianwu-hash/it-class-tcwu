歷史紀錄：本文描述 2026-10-28／29 當時狀態，後續已由正式功能取代，現況以 main 與最新發布紀錄為準

# 考古題重作、首次達標給葉與歷次成績：本機實作

日期：2026-10-29。MEMKEY:考前練功坊-考古題前處理-cian請益

使用者已核准：未達60%可以重作；第一次單次完整作答達標後給葉；同份試卷只領一次，保留歷次成績。本輪實作於既有本機考古題試辦，不修改或部署正式學生／努力樹資料。

## 已實作規則

- 依固定原卷配分計算本次分數；本卷自動核對滿分92，55分未達標、56分達標。不同次正確答案不合併。
- 每次重作建立新attempt，原attempt的答案、固定版本與成績保留。未完成者也保留目前得分，標示未完成，不發葉。
- 畫圖須送出標示才算完整作答，僅保存自我核對紀錄，correct／score仍null。3個官方疑義欄位不列入完成或門檻。
- 同一本機練習者、練習學期、原卷識別，只給1片模擬葉；更換題目版本不重發。不同練習者／不同練習學期分開計算。
- 首次完整達標時發葉。之後低分不撤回、高分不重發。畫面列每次成績、達標／未達標／未完成，以及哪一次取得葉片。
- 本輪之前的試作保留，可接回完成成績，但不追補模擬葉；按重新作答另開新練習即可適用新規則。合成舊格式相容題不給模擬葉。

## 實作位置與原子性

`automation/nonchoice-pilot/practice-store.mjs`使用既有PGlite測試資料庫，新增`nonchoice_candidate.practice_scopes`、`practice_results`、`practice_leaves`。完成紀錄一attempt一列；葉片以`(learner_id,semester,paper_id)`主鍵限制唯一，並綁定首次符合條件的attempt。判定來自伺服器重建的本次作答，不信任客戶端傳入的成績、完成旗標或葉數。

`persistent-store.mjs`加入預設無作用的交易後處理與讀取裝飾介面；原五組試作不啟用新政策。新PracticeStore在同一筆交易內寫入最後一組收據／答案、完成成績與唯一葉片；任何一步失敗全部回滾。相同包重送只回原結果，不新增成績或葉片。

`bridge-server.mjs`以獨立HttpOnly本機練習者cookie保留多次作答的歸屬，重作只更換attempt cookie；送答及官方參考圖另驗attempt屬於目前練習者。cookie不輸出至前端JSON。這只是本機合成身分，**不是正式學生認證**；清除cookie後沒有正式帳號可找回資料，也不能以這個設計宣稱已完成正式努力樹防重領。

`app.mjs`與`bridge-practice.html`顯示本機模擬葉片與歷次成績。原是非O/X單次顯示、一般選擇代號及共同材料保持。

練習學期目前明確設為115-1，與原試卷的114-1來源學期分開；原卷ID不隨呈現版本變更。這符合先前建議的「同一學生、同一練習學期、同一份原卷只領一次」。

## 驗證

本輪29項不重複測試涵蓋原型8、既有持久交易4、轉接5、新規則5、既有SQL／圖文回歸5及HTTP2，均通過。新規則測試再於最後修正後重跑5項通過。

新規則測試使用同一份真實轉接包，包含：

1. 55→56→92→0分，歷次保留，只有第二次取得1葉；成功後重送不重發。
2. 兩次各46分且答對內容互補，仍不能合併成達標；自動欄92分但尚未送畫圖時不發葉。
3. 同練習者兩份達標attempt的最後一組並行呼叫，只有一筆葉片；另一本機練習者的歷史與獎勵獨立。這是PGlite交易測試，未宣稱完成正式多人壓測。
4. 故障注入在葉片寫入時丟例外，最後畫圖收據、答案及完成紀錄全部回滾；重送後僅一筆成果。
5. 磁碟重開、同原卷改版保留歷史且不重領；換練習學期獨立，舊完整試作92分保留但不追補葉，也不能被另一練習者接管。

```powershell
node --test automation/nonchoice-pilot/practice-store.test.mjs automation/nonchoice-pilot/persistent-store.test.mjs automation/nonchoice-pilot/bridge.test.mjs automation/nonchoice-pilot/engine.test.mjs
node --test automation/tests/quiz.test.mjs automation/tests/quiz-native-content.test.mjs
node --test automation/nonchoice-pilot/bridge-http.test.mjs
```

真Chrome另以本機合成API逐組完成55→56→92，透過實際重新作答按鈕建立新attempt、刷新接回及桌機／手機歷史表格驗證。測試資料與截圖在原試辦`bridge/qa/`的`practice-results.json`及`practice-history-1280.png`／`practice-history-390.png`。不是每個欄位都以滑鼠完成。

最終瀏覽器結果：55未達標、56首次取得1片、92不重領，歷史刷新仍在，1280／390無橫向溢出或JS錯誤；已實看手機截圖。初版腳本使用未啟用的Network事件等待，以及背景分頁的點擊等待而停住；改為DOM狀態等待並依租約授權啟用精確目標分頁後通過，沒有放寬正式防弊或開啟Network。測試程序結束、租約釋放；本機服務保留。

## 正式接入仍待完成

本機入口：<http://127.0.0.1:4412/practice/?bank=paper>。服務以獨立背景程序運行。

正式系統須將本機練習者映射為可信學生身分、同卷識別與學期、接入共用題型／正式RPC、組級閱讀時間與既有努力樹ledger，以及正式權限、媒體與回歸驗證。不得把本機cookie當正式帳號或把本機模擬葉片寫入正式成果。未發布、未改正式SQL／學生答案／進度；未新增依賴。

`qa/practice-integrity.json`保留與較早基準比對：中立來源、原題庫驗證器與SQL檔一致；`shared/quiz-server.mjs`與`shared/auth.js`已不同。本輪僅修改本機automation與相關文件，沒有修改或還原這兩份共用檔案，不宣稱整個工作區內容未變。

先前文件「考古題先不計葉」在本機試辦的決策已被本次核准規則取代；正式計葉仍未開啟。正式試卷的上線核准保留，不重複要求教師核准內容。
