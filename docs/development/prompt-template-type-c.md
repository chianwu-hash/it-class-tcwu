# 提示詞模板：類型 C（打字闖關頁）

> 使用方式：複製以下提示詞，填入 `[ ]` 的欄位，交給 Codex。

---

```
請製作 grade3 第 [XX] 週課程頁面（打字闖關）。

## 參考檔案
- 版面與結構參考：grade3/week10.html（同類型最近一頁，完整沿用架構）
- 開發規範：docs/development/dev-sop.md
- 模組說明：docs/development/shared-modules.md
- 頁面類型：docs/development/page-types.md 的「類型 C」

## 功能契約（不可省略，每項都必須實作）
- [ ] <head> 加入 canvas-confetti CDN：
      <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>
- [ ] navbar.js 版本字串：navbar.js?v=[YYYYMMDD]
- [ ] 同時 import 並呼叫 initNavbarAuth()（防止 navbar 重渲後 listener 消失）
- [ ] 同時 import 並呼叫 initTypingChallenge()（不可用 localStorage 自寫進度邏輯）
- [ ] levelsData 欄位必須是 { id, ans }，不是 { id, answer }
- [ ] weekCode: "[XX]"（兩位數字串）
- [ ] activityKey: "typing_task_[關卡數]"
- [ ] 不對任何按鈕直接使用 addEventListener
- [ ] 確認 grade3/navbar.js 的 activeWeeks 已加入第 [XX] 週

## 本週內容
- 週次：第 [XX] 週
- 標題：[XXXX]
- 本節課目標：[XXXX]

## 打字闖關關卡設計
總關卡數：[N] 關
activityKey：typing_task_[N]

關卡列表：
1. 類型：[英打 / 中打]
   標題：[XXXX]
   答案（ans）：[XXXX]
   提示文字：[XXXX]
   過關鼓勵語：[XXXX]

2. 類型：[英打 / 中打]
   標題：[XXXX]
   答案（ans）：[XXXX]（多行用 \n 標示換行）
   提示文字：[XXXX]
   過關鼓勵語：[XXXX]

（依此格式繼續列出所有關卡）

## 完成後解鎖邏輯（若有）
- 解鎖條件：全 [N] 關完成
- 解鎖後顯示：[XXXX 區塊說明，例如：顯示 Wayground 題組入口]
- 實作方式：使用 MutationObserver 監聽 #progress-status，
  當 input-level[N].readOnly === true 時觸發解鎖 UI（參考 week10.html）

## 其他頁面內容（打字闖關以外）
- 今日任務說明：[XXXX]
- 老師提醒（若有）：[XXXX]
- 完成標準：[XXXX]

## 禁止事項
- 不可用 localStorage 儲存進度（必須接 initTypingChallenge → Supabase）
- 不可把 levelsData 的欄位寫成 answer，必須是 ans
- 不可只有 initTypingChallenge，必須同時呼叫 initNavbarAuth()
- 不可手刻 nav HTML
- 不可自己重寫登入邏輯
- navbar.js 必須有版本字串
```
