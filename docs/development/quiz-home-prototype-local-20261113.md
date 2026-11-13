# 考前練功坊首頁原型：本機驗收，未發布

使用者核准依Codex與Claude Fable5.2兩輪討論製作可操作首頁，桌機及手機均可試用；禁止上線。從最新origin/main 494a476建立獨立worktree `library-home-prototype-20261113`，branch `codex/library-home-prototype-20261113`。未修改主工作區，未push、PR、部署或變更正式資料。

## 呈現與保留契約

- 縮小頁首；夥伴練功改成精簡固定容器，保留找夥伴與接續入口及原資格檢查。
- 努力樹入口保留，原努力統計／更新／主動選學習重點／計葉說明收進details。沒有把局部累積數冒稱所有作答題數。
- 未完成個人練習最多先列兩份，其他可展開；仍包括自組及延伸卷。沒有最後作答時間，不稱為最近或AI推薦。範圍／科目／來源頁籤不會篩掉這一區。
- 練習來源、期末／期中／全部與科目集中在選卷區；手機自然分列、主要控制項至少44px。
- 老師卷按科目與單元做視覺分組，原paper-card、session ID、題數、難度、進度、詳情及操作節點完整保留；同組按題數排序。每份卷仍獨立，未合併成績、版本或評分。邀夥伴文字入口仍由原catalog映射注入，降為次要操作。
- 自組卷入口與既有表單移入「自己組卷」頁籤，仍可儲存、查看與刪除。查看剛存的卷時，明示篩選已切成全部。
- 考古卷、錯題、未知範圍收合與未開放限制沿用；不啟用新卷、不更動任何解析／課本對照／配題狀態。後端權限、作答、努力樹與保存流程保持原契約。

## 本機試用

- 試用控制頁：<http://localhost:8923/automation/fixtures/quiz-home-preview.html>，可切桌機／390px手機、已有進度／第一次進來、三／六年級。
- 直接首頁：<http://localhost:8923/grade3/115-1/quiz-library.html?preview_home=1&preview=preview-home-user-review&preview_case=returning>。
- 只綁127.0.0.1的既有preview伺服器擴充合成catalog，RPC限同源Origin，CSP connect-src self，沒有正式服務代理。合成資料按預覽命名空間／年級／使用者／情境隔離；UI明示非正式登入。
- 合成卷使用UUID以符合原答題入口，示範題與首頁進度可在記憶體內接續；重啟本機服務即清除，不使用localStorage或正式資料庫。
- 一般／考古答題及夥伴頁使用原介面與本機fixture；試用導航保留預覽參數。努力樹僅提供明示導覽示意，不讀寫正式成果。此證據不能代替真實登入／正式資料的發布驗收。

## 驗證

- `node --test automation/tests/quiz-workshop.test.mjs automation/tests/quiz-practice-scope.test.mjs`：14項通過（NODE_PATH使用既有本機runtime）。
- `npm run quiz:check`：四課程四入口21項產物核對通過。產物由共用shell／builder產生，不手改各年級HTML。
- `automation/tests/quiz-home-flows-browser.cjs`：80項通過，1280／390，三年級完整流程及六年級共用入口；同卷10／20排序、各自進度與邀請映射、切科目／範圍／頁籤、未知與未開卷、自組儲存／定位／刪除、登出鎖定、新生、觸控尺寸與手機篩選分列。
- 從20題卷已答3題接入第4題，送出後回首頁讀回4／20；未對真人送答或發送訊息。Browser pageerror零，正式遠端HTTPS在測試頁全阻擋。
- 實看桌機與手機截圖；修正手機範圍與科目被擠成兩條直欄，改為各佔一列。ignored證據在 `.chat-mode/home-prototype/`。
- 所有新檔與原型留在本worktree，本機8923服務保留給使用者驗收。未發布。
