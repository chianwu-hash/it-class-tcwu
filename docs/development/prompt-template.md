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
- 頁面中引用 navbar.js 的 <script src> 必須加版本字串，格式：navbar.js?v=YYYYMMDD（今天日期）
- 不可手刻 nav HTML
- 不可在頁面中自行為 navbar 的登入 / 登出 / 重設進度按鈕綁事件，相關邏輯一律靠 initNavbarAuth()
- 不可用 localStorage 儲存學生進度
- 若有打字闖關：levelsData 欄位必須是 { id, ans }，不是 { id, answer }
- 若有打字闖關：必須同時呼叫 initNavbarAuth() 和 initTypingChallenge()
- 若有打字闖關：<head> 必須加入 canvas-confetti CDN

## 完成後必做驗證
- 驗證 navbar 顯示正常
- 驗證登入按鈕可用
- 若有打字闖關，驗證進度可保存與接回
- 若有解鎖流程，驗證初始鎖定與完成後解鎖
- 若有週次隱藏設定，驗證首頁與 navbar 同步
- 驗證頁面可正常開啟

## 完成後回報
請告訴我：
1. 判斷的頁面類型
2. 使用的 shared modules
3. 使用的 activityKey（若有）
4. 參考的頁面
5. 做了哪些驗證
6. 哪些地方沿用了原有功能，哪些地方是新寫的
```
