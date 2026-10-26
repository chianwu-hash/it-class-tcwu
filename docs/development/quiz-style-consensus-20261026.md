# 考前練功房：與課程網站延續風格的共識與實作

2026-10-26，使用者要求與 Claude 討論後，實作有共識的視覺調整。目標是讓考前練功房看得出屬於「謙大叔的電腦教室」，並保留練習區辨識度。

## 討論與權限

- Transport：chat-mode 的 Claude CLI supervisor，Claude Code 2.1.289、訂閱 OAuth，非 API 計費。兩輪唯讀討論，Codex 是唯一程式寫入者。
- Session：`20261026-quiz-style`，分支 `main`、基準 `3b97d3ce6a9c422001c1f9559b02f822176bfb0c`。兩輪均 completed、有完成標記，viewerStarted=true，Git before/after 與 Codex 獨立核對皆一致。
- 回覆：`.chat-mode/sessions/20261026-quiz-style/turn-0001.response.md`、`turn-0002.response.md`。Claude 第二輪明確回答「共識已成立」。這是設計討論，不冒稱 Claude 已審查改版後程式。
- 證據：固定三年級 `grade3/week20.html`、六年級 `grade6/week17.html` 視覺規範，以及目前根首頁／年級首頁／練功房的實際渲染。使用合成身分與示意題目，不提供學生資料、憑證或書商試題；Claude 無寫入、Shell、網路及部署權限。唯讀工具的非 OS 隔離限制已向使用者說明。

## 雙方共識

1. 延續 Noto Sans TC 400／700／900、漸層頁首、淺色頁底、圓形圖示、24px 白卡與柔合彩邊。選卷頁採 4px 彩邊；作答題目卡保持簡潔，不再加彩框。
2. 三年級延續青綠、六年級延續靛紫；兩者保留琥珀色 CTA／年級標籤與 `fa-dumbbell` 作為練功房識別。科目圖示搭配文字，不能只靠顏色辨識。
3. 選卷頁完整 hero 限桌面 200px／手機 150px；作答維持約 51px 的細頁首及滿版題目，不照搬大 hero。
4. Claude 提議的亮青綠 hero 白字對比不足，Codex 提出壓深同色相，第二輪獲同意：三年級 `#0e7490 → #047857`，六年級 `#6d28d9 → #4338ca`。白字最低 5.36:1；作答主按鈕三年級 `#0f766e`、六年級 `#6d28d9`。裝飾圖示避開說明文字，手機隱藏裝飾。
5. 不新增 Tailwind CDN／preflight；採 `body.quiz-skin` 限定作用範圍的共用 CSS，以穩定 nav 結構與 Auth ID 校準導覽。兩份年級 navbar 與共用 navbar 程式不改。
6. email 只留 navbar；hero 中仍保留身分 DOM，顯示學生練習／教師試答與保存說明。未登入、年級確認中或錯誤訊息仍可見。返回選卷連結 DOM 保留，只在 `#quiz-navbar:has(nav)` 成功出現時以 CSS 隱藏重複入口。
7. `data-grade` 由各年級 HTML 固定，表示頁面所屬年級。現有教師切換會前往另一年級頁面，所以主色隨新頁面改變，不重寫原切換流程。

## 實作範圍

- 新增 `shared/quiz-theme.css`：共用年級 tokens、navbar、精簡作答頁首及主色；只於練功模式加上 `quiz-skin` 啟用。
- `shared/quiz-library.css`：選卷頁 hero、科目卡、進度、按鈕及手機版，均限定在 `.quiz-library-page`。
- 三／六年級 `quiz-library.html`：載入字型與 theme，加入子區識別與語意結構。
- 三／六年級 `quiz.html`：載入 theme 與所屬年級屬性；原課堂模式沒有 skin class，因此不套新外觀。
- `shared/quiz-library.mjs`：卡片呈現與不重複的身分文案。
- `shared/quiz-student.mjs`：在 await 前啟用練功模式 skin、返回連結 class 與狀態文字；不改 RPC 呼叫、答案、保存或身分驗權。

不新增排行、倒數、積分、連勝或其他玩法。不變更名冊、資料表、版本、場次或作答紀錄；保留原生圖文公式、私有圖片、書商解析、選項四色、對綠錯橘、10 套動畫、燈箱與末題停留。

## 驗證

- `npm run quiz:test` 11 組通過。
- `style-qa/report.json`：兩年級 × 選卷／作答 × 1280／390px，共 8 個實際畫面。字型 900 與圖示有載入，無水平溢出；手機 navbar 約 91px、兩行。選卷 hero 約 196px／149px；作答細條約 51px，桌面題目起點約 179px，較改版前截圖約 196px 更靠前。
- 兩年級示意題均驗證答錯橘色、答對綠色、KaTeX、末題先停留回饋及重整接續；缺場次或 navbar 失敗時仍有返回入口；原課堂模式確認未加 skin。
- `style-qa/live-report.json`：真實學生仍有 16 卷與原已答 1 題；原圖及燈箱 80%→70% 正常，未另送真實答案。合成教師檢查切換／後台按鈕、登出鎖定與集中登入入口；減少動態設定生效。此處未冒稱重新進行真實 Google OAuth。
- `style-qa/ordinary-report.json`：原課堂模式在同一合成資料與 1280px 下，改版前後截圖 SHA-256 完全相同，且均未啟用 skin。
- 證據在 Git 忽略的 `automation/output/quiz/cloud-practice/style-qa/`，不是網站發布內容。正式發布核對於完成後補記。
