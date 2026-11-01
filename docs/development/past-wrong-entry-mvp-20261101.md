# 單題錯題延伸：既有「我的錯題」入口（2026-11-01，本機）

使用者指定把114上三年級自然 s1-q01 接入既有錯題區，從原錯答看解析、選學習重點、練書商題後回同一道。這次只做本機MVP，沒有發布、正式migration、媒體上傳或學生資料操作。

## 試用

`http://127.0.0.1:4495/grade3/115-1/quiz-library.html#wrong`

預先以合成學生1建立一筆答O的錯題，官方核對X。按「回看題目與解析」，選任一學習重點並練習兩題，底列「回這道錯題」會回相同錯答的詳情；重新整理亦保留這個來源。原卷保留解析與到錯題的連結，選重點／練習入口集中在我的錯題。重點與四題來源沿用前一輪康軒原始題庫節選，不新增推薦範圍。

## 實作界線

- 本機服務須明確啟用 `PAST_WRONG_REVIEW=1`，才安裝本機讀取adapter及「只接受錯答來源」的練習啟動條件。`PAST_SEED_WRONG_DEMO=1` 僅建立合成示範作答。
- `source_type=quiz/past_exam` 分流。考古題識別包含paper/version/group/question/attempt，避免不同試卷使用相同欄位id而混題；來源版本固定。
- 一般錯題仍由既有 `quiz_wrong_questions` 授權及揭答；考古題只查本人固定paper/version的候選，再以真正authenticated `quiz_past_action('resume')` 逐筆確認已揭答且correct=false。答對、未答、manual/null均不收。
- 合併後才套科目／單元篩選與20題分頁。此單題本機adapter逐頁讀一般錯題，不能直接當正式大量資料的查詢設計。
- 練習沿用schema1／quiz_action與quiz.html；classroom模式不給葉。本人、來源與版本驗證、冪等及獨立成績沿用前一輪。此次由這組延伸練習產生的錯題不再次混入清單，不建立遞迴推薦。
- 完整來源識別放在返程query，返回既有quiz-library的#wrong後重新向服務驗證，非讀取query中的答案。UI也保留登入世代及詳情世代檢查，換帳號／切題後不接受晚到的練習連結。
- 共用學習重點CSS從原卷專屬前綴抽出，沿用既有練功坊色彩、卡片與按鈕；原卷與錯題區共用同一個解析元件。

## 驗證

- `node automation/tests/past-wrong-api.mjs`：真本機SQL、跨人／錯版／來源類型拒絕、未答／正答不收、練習冪等、揭答前無書商答案、衍生錯題不重收、原卷records及summary深比不變、無葉片。
- `node --test automation/tests/past-wrong-compat.test.mjs`：21一般錯題＋1考古題合併後20/2分頁不重複，科目篩選、舊詳情與原答案保持不變。
- `past-wrong-browser.cjs`：從既有「我的錯題」進入，兩概念共四題混合正錯作答，練習接回、返回同完整來源URL及刷新、鍵盤Enter、登出清除；1280/390/360無橫向溢出。桌面與手機截圖已目視核對。屬桌面瀏覽器模擬寬度，非實體手機／真人OAuth。
- 對一般錯題相容測試，一度因主機可用虛擬記憶體不足而V8 Zone OOM；降低測試隔離／執行緒未解，關閉自有舊預覽及4495、採序列DB測試後通過。不是更動產品或放寬斷言使其通過。4491/4493已關閉，保留4495整合版。

## 重開方式與限制

從本worktree啟動 `node automation/past-exam-local-server.mjs`，設定：

```text
PAST_LOCAL_PORT=4495
PAST_BUNDLE_PATH=automation/output/past-exams-autoreview-20261101/dingxi-114-1-g3-exam1-science/bundle.private.json
PAST_LEARNING_REVIEW_PATH=automation/fixtures/past-learning-g3-science-q01.json
PAST_PUBLISHER_PRACTICE_PATH=automation/output/past-learning-publisher-mvp-20261101/publisher-practice.private.json
PAST_WRONG_REVIEW=1
PAST_SEED_WRONG_DEMO=1
```

PGlite只在記憶體，關閉／重開服務會清掉本機作答並產生新的版本UUID，不能拿舊詳情網址宣稱可續接；重新從不帶wrong_*參數的試用入口進入。ignored原件、書商packet/DOCX與驗證證據不在clone，須使用現有本機交接資料；沒有新的依賴安裝。這次不含正式adapter／通用自動配題／全卷推薦／新一輪延伸練習，須待使用者本機試用回饋再決定後續。


## Claude 複核與補正

`past-wrong-entry-20261101` 唯讀複核成功，約188秒／13 Read，Git前後一致、viewer已啟動；結論為本機MVP可交付，沒有阻擋問題。Claude實看程式與產出，未自行執行測試，部分媒體存取及測試全文未讀；純文字單題不受該媒體未審範圍影響。

Claude建議換帳號時清掉上一人的wrong_*。直接在每次reset清除會破壞首次登入從練習返回的深連結，Codex改為只在已載入過身分後的reset清除；初次載入保留來源、後續換帳號或測試身分則清除。自動還原失效時也移除參數並顯示重新選題提示。補正後重新跑API與兩概念四題完整瀏覽器流程，額外驗原卷無選重點／練習按鈕、原卷連結到同錯題、登出清除來源URL，全部通過。

Claude提到正式快取版本未更新：此次僅no-store本機試用，沒有上線包，因此不做形式上的快取鏈部署。若之後正式化，必須從當時正式版本建立候選，更新完整模組／CSS快取鏈及新增檔案清單，另做正式授權與資料契約驗證。Claude對「past_exam缺欄會退回quiz」的摘要不精確，實際函式是回傳null，未採用該說法。
