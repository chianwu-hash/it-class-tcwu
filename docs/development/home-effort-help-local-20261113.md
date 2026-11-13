# 首頁努力橫列移入努力樹：本機未發布

使用者核准移除首頁「看我的努力樹／練習努力與說明」獨立橫列，原導覽列努力樹入口不變；說明更新到努力樹頁面。最新origin/main 2f6ee5f新建worktree `home-effort-help-20261113`、branch `codex/home-effort-help-20261113`，帶入兩版未發布首頁原型，重建產物並保留main課本翻頁方向修正。未在主工作區編輯，未push／PR／部署或修改正式資料。

## 最終介面與資料契約

- 首頁移除整個摘要容器，library entry不再載入quiz-learning模組；夥伴區直接接未完成練習。原learning.html主動選重點流程不改，quiz-learning.mjs還原main版本。
- 實際my-tree.html頁首下新增原生details「努力怎麼累積？」，預設收起，桌機完整寬度／規則兩欄、手機一欄，不擠入窄側欄，也不新增首頁導覽按鈕。
- 保留累積紀錄、進度、手動更新、錯題及原三年級選重點入口。文案明示延伸不同題數不是所有作答總數，分開說明延伸葉、整份卷、考古卷及夥伴紀念。其他課堂成果仍依各活動規則，不改計葉或評分。
- 新quiz-effort-help.mjs只讀，不發獎、不寫進度。初始摘要沿用努力樹既有quizTreeData回傳learning，不另加初始RPC；更新按鈕只讀現有learning summary。數字來自後端，不從頁面自行授予獎勵。
- 原登入／名冊／course權限保留；載入、登出與換課程reset清除文字和連結，跨人／跨課程與晚到更新不接受。只在115上三／四／六／九年級顯示，歷史課程不套本規則，教師檢視不掛載。未登入只讀公開說明，個人紀錄與更新操作不可用。

## 本機試用與限制

最新控制頁：<http://localhost:8925/automation/fixtures/quiz-home-preview.html>，可切首頁／努力樹說明、桌／手機、情境與年級。直接說明：<http://localhost:8925/my-tree.html?course=grade3-115-1&preview_home=1&open_help=1&preview=preview-effort-review>。

loopback server在明確preview query下使用真實my-tree HTML/CSS及同一help元件，移除真auth／garden bootstrap、換成合成只讀摘要，頁面明示非正式花葉。這段轉換僅在automation伺服器，不進正式HTML，不能當成真OAuth、樹成長或獎勵載入驗收。只綁127.0.0.1，無正式代理，不讀寫學生資料。8923／8924舊原型保留對照。

## 驗證

- 49項努力說明瀏覽器檢查通過，1280／390：首頁無孤立列、原導航入口、銜接距離、原生details、17題／1葉／再3題、四類規則、手動更新、失敗保留、錯題／重點入口、觸控尺寸、登出、跨人／跨課程、延遲更新與歷史課程隱藏；pageerror零。
- 80項首頁操作回歸通過，包含個人卷／考古／組卷／邀請／進度，第4題送出後回首頁4／20。未向真人發訊息或送答。
- 14程式檢查、21產物核對、實際my-tree inline module及新模組語法檢查通過。已檢視桌／手機說明截圖；證據在ignored `.chat-mode/effort-help/`與`.chat-mode/home-prototype/`。

保留工作樹及8925服務供使用者驗收；尚未發布。未來發布前需再驗正式登入與只讀資料路徑，本輪沒有碰正式auth、garden或成果。
