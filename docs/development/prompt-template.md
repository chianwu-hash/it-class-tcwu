# 新週次頁面製作提示詞

> 使用方式：複製下方提示詞，把教案貼到最後，交給 Codex。
> 不需要填其他欄位，AI 會根據教案內容判斷類型並實作。

---

```
請根據我們剛剛討論的教案，製作本週的課程頁面。

## 開發前請先做
1. 閱讀 docs/development/dev-sop.md
2. 閱讀 docs/development/shared-modules.md
3. 閱讀 docs/development/page-types.md，判斷本頁屬於哪種類型
4. 根據判斷出的類型，對照 docs/development/new-page-checklist.md，逐項確認功能契約
5. 找同類型的最近一頁作為結構參考（不可只看版面，功能必須完整沿用）

## 硬性規定（不論何種類型都必須遵守）
- navbar.js 必須有版本字串，格式：navbar.js?v=YYYYMMDD（今天日期）
- 不可手刻 nav HTML
- 不可對按鈕直接使用 addEventListener，登入邏輯一律靠 initNavbarAuth()
- 不可用 localStorage 儲存學生進度
- 若有打字闖關：levelsData 欄位必須是 { id, ans }，不是 { id, answer }
- 若有打字闖關：必須同時呼叫 initNavbarAuth() 和 initTypingChallenge()
- 若有打字闖關：<head> 必須加入 canvas-confetti CDN
- 完成後告訴我：判斷的頁面類型、使用的 activityKey（若有）、參考的頁面

## 教案
[貼上教案]
```
