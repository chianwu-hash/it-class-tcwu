# 提示詞模板：類型 B（一般課程說明頁）

> 使用方式：複製以下提示詞，填入 `[ ]` 的欄位，交給 Codex。

---

```
請製作 [grade3 / grade6] 第 [XX] 週課程頁面。

## 參考檔案
- 版面與結構參考：[grade3/week09.html / grade6/week10.html]（同類型最近一頁）
- 開發規範：docs/development/dev-sop.md
- 模組說明：docs/development/shared-modules.md
- 頁面類型：docs/development/page-types.md 的「類型 B」

## 功能契約（不可省略）
- [ ] navbar.js 版本字串：navbar.js?v=[YYYYMMDD]
- [ ] import { initNavbarAuth } from "../shared/navbar-auth.js" 並呼叫
- [ ] 不對任何按鈕直接使用 addEventListener
- [ ] 不使用 localStorage
- [ ] 無打字闖關、無 student_progress、無 initTypingChallenge
- [ ] 若 [grade3]：確認 grade3/navbar.js 的 activeWeeks 已加入第 [XX] 週
- [ ] 若 [grade6]：確認 grade6/navbar.js 的 activeWeeks 已加入第 [XX] 週

## 本週內容
- 年級：[三年級 / 六年級]
- 週次：第 [XX] 週
- 標題：[XXXX]
- 本節課目標：[XXXX]
- 任務順序：
  1. [任務一說明]
  2. [任務二說明]
  3. [任務三說明]
- 外連資源（若有）：
  - [連結說明] → [URL]
- 老師提醒（若有）：[XXXX]
- 完成標準：[XXXX]

## 禁止事項
- 不可手刻 nav HTML
- 不可自己重寫登入邏輯
- navbar.js 必須有版本字串
- 不可只看版面，功能必須完整沿用
```
