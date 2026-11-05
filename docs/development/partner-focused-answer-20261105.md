# 夥伴練功：答題優先、營地按需展開

## 修改範圍

依使用者指示，先完成 Claude 修改前討論（`focused-answer-discuss-20261105`，CLI 2.1.289，12 次只讀工具，exit 0），再在 `codex/partner-focused-answer-20261105` 實作。基底 `05b9179`。尚未發布；正式網站與資料庫維持原版。

- 一般／自組題一次顯示一題，沿用原單選的 ABCD、選取與答案回饋；前後切題、跳題、訂正與儲存退出。
- 個人練習與小隊只共用純單選呈現 `quiz-choice.mjs`，不共用個人場次、儲存或判分控制器。
- 考古沿用原有文字、注音鍵盤、選項、順序、手寫與自我核對元件；本人同原卷段落的欄位一起顯示。這是閱讀分頁，後端完整題組配題不變。
- 主畫面不再並排營地。桌面右側抽屜、手機全高面板，按「問夥伴」直接寫該題請教，也能只開營地看訊息。回覆後仍留在營地，可按「回到答題」或 Esc 收起。
- 新請教／回覆本人請教顯示 5 秒合併提示，不搶焦點；一般聊天只累積數字。初始快照不播放歷史提示。看見已展開討論串底部且前景停留 1 秒，才清除該次快照的未讀；只是開面板不會全清。
- 訊息與進度更新保留題目、音訊、手寫、輸入框與回覆草稿 DOM；切題才重建答題區。儲存退出保留目前題目，接續時營地收起。
- 營地內有成功／錯誤訊息與原請求重送按鈕；沿用 app 的 requestId。圖片改用原生 dialog 燈箱，能在營地上方開啟。

## 本機體驗

```powershell
node automation/partner-focused-preview.mjs
```

開啟 `http://localhost:8816/`。只含合成題目／小隊、記憶體內操作，不連正式登入、資料庫或努力樹。上方「隔離預覽工具」可模擬夥伴請教、聊天與全組完成。重新整理即重置。

## 驗證紀錄

- `npm run quiz:test`：11 項通過（原個人練習、權限、揭答、媒體與 SQL）。
- focused／self／media／production：13 項通過，包含 2～4 人、訂正、重試、花葉與私人答案隔離。
- stability／原 message-attention：8 項通過。
- 隔離 Chrome 瀏覽器：主流程 17、已讀／共用選項 7、送答／訂正／回顧 12、邊界修正 10，共 46 個檢查通過。涵蓋選取與草稿、IME 事件、同請求重試、等待重送時新增草稿保留、雙層 Esc／離房清理、手寫、音訊（含回顧）、共同回顧、360／390px 手機及無例外。證據暫存 `.chat-mode/evidence/partner-focused-browser/`，不進 repo。
- 已讀補驗確認只開摘要不清、展開到底一秒才清、關閉取消計時，以及內層聊天沒捲到底不清；純單選補驗保留原 option ID、選取、正誤與 callback。

## AGY 複核與處理

Claude 修改後複核未執行：額度限制至 23:40。使用者改指定 AGY，透過 chat-mode 的 AGY supplied-text discussion（無 repo 工具）複核必要程式。首輪成功 session `focused-answer-agy-20261105-02`，實際版本 1.5.1，模型 `gemini-4-argon-medium`，工具邊界探針通過、Git 前後相同。

- 採納 mounted guard 的 `return` 改 `continue`，避免未來局部掛載遇到第一個已掛載 host 就跳過其他欄位；原本一次掛載所有新 host 時並不會漏掉後題。補測混合已掛載／新 host 通過。
- 營地送出／重送時只鎖提交按鈕，保留輸入法與文字；成功後只清已送內容，送出後繼續新增的草稿不會被清掉。一般 peer snapshot 本身沒有把輸入框 disable；這項屬送出期間防護，未宣稱復現每次 peer 更新斷字。
- 回顧播放音訊或開燈箱時，延後替換回顧區；暫停／播完／關閉後補繪，避免隊友分享中斷播放。
- AGY 因片段截斷而質疑燈箱關閉綁定；完整程式已有 `lightboxClose.addEventListener('click', closeLightbox)`。雙層 Esc 與離房清理實測均能關閉並還原捲動；另外防止舊 close event 關掉剛重開的燈箱。
- `createLearningUI` 在 app 只建立一次，`clear()` 用於重進小隊而不是 destroy；不能每次 clear 移除永久 listener 卻不重掛。尚未引入多實例 controller。

後續 AGY 最終結案（`focused-answer-agy-closeout-20261105`，1.5.1，工具邊界通過、Git 不變）結論：所提供程式與證據中沒有程式層阻擋。已補上同步幾何檢查（外層營地與內層聊天裁切），以及燈箱 `beforetoggle` 立即取消／關閉重啟已讀計時。另 2 個燈箱計時補測通過，共 48 個瀏覽器檢查；7 個已讀檢查在最後修正後重跑通過。這是 supplied-text 複核，不是 AGY 自行操作瀏覽器驗收。

使用者新增語音與畫圖請教評估，另見 `partner-camp-media-proposal-20261105.md`；此輪僅規劃，未變更正式訊息 schema 或上傳服務。

瀏覽器可重跑：取得 AI 工作瀏覽器租約與精確分頁 ID 後，透過 `D:/ai-browser/run-background.cjs --lease-id <lease> automation/tests/quiz-partner-focused-browser.cjs <target>`。不得改用未登記瀏覽器。

## 還沒驗證的界線

尚未做本輪介面的真人兩帳號／兩機同步，以及真實注音輸入法操作；IME 自動測試只模擬 composition 事件。隔離測試使用合成 RPC 行為，不能當成正式後端端到端驗證。沒有修改配題 SQL、題庫資料、花葉政策或學生進度；不用資料庫 migration。
