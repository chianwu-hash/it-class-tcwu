專案名稱：吳老師的電腦教室

1. 專案簡介

這是一個國小資訊課程的教學網站，目標受眾是小學生。風格需要活潑、色彩豐富、文字友善。

2. 技術架構 (Tech Stack)

核心語言：純 HTML5 + CSS3 + JavaScript (Vanilla JS)。

CSS 框架：Tailwind CSS (透過 CDN 引入)。

字體：Inter (英文) + Noto Sans TC (中文)。

圖示：使用 Emoji 或 SVG，不使用 FontAwesome。

3. 檔案結構規範

目前採用「模組化」結構（請 AI 產生代碼時遵守此路徑）：

/ (根目錄)：首頁 (index.html), 全域樣式 (styles.css)

/assets/images/：所有圖片

/lessons/typing/：打字相關課程

/lessons/hardware/：硬體相關課程 (如 keyboard.html)

/components/：共用元件 (header.html, footer.html)

4. 設計規範 (Design System)

主色調：

藍色 (Blue-600)：用於 Header、主要按鈕。

黃色 (Yellow-400)：用於強調、提示框。

淺色背景 (Blue-50 / Gray-100)：用於頁面底色。

互動：

按鈕要有 Hover 效果 (如 hover:scale-105)。

連結在新分頁開啟外部網站。

5. 開發注意事項

RWD：必須支援手機版 (Mobile First)，使用 Tailwind 的 md:, lg: 斷點。

無障礙：圖片必須有 alt 屬性。

預覽相容性：產生代碼時，優先考量單一檔案可預覽性，若需分拆檔案請特別說明。

給 AI 的指令：
請閱讀以上規範。在接下來的對話中，若我要求修改或新增頁面，請務必遵守上述的技術堆疊與設計風格，保持網站的一致性。