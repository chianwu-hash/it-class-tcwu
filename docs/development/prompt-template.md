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
4. 閱讀 docs/development/lesson-to-web-sop.md，依照標準流程確認目前做到哪一階段
5. 根據判斷出的類型，對照 docs/development/new-page-checklist.md，逐項確認功能契約
6. 找同類型的最近一頁作為結構參考，**必須先盤點該頁使用的 shared modules、登入流程、進度保存方式、解鎖方式**，確認理解後再開始實作（不可只看 HTML 結構）

## 硬性規定（不論何種類型都必須遵守）
- 頁面中引用 navbar.js 的 <script src> 必須加版本字串，格式：navbar.js?v=YYYYMMDD（今天日期）
- 不可手刻 nav HTML
- 不可在頁面中自行為 navbar 的登入 / 登出 / 重設進度按鈕綁事件，相關邏輯一律靠 initNavbarAuth()
- 不可用 localStorage 儲存學生進度
- 若有打字闖關：levelsData 欄位必須是 { id, ans }，不是 { id, answer }
- 若有打字闖關：必須同時呼叫 initNavbarAuth() 和 initTypingChallenge()
- 若有打字闖關：<head> 必須加入 canvas-confetti CDN
- 若有打字闖關：錯誤答案提示必須沿用或等效於既有精準提示邏輯，能指出第幾行、第幾個字附近、可能少字/多字，不可只給籠統提示

## 完成後必做驗證
- 驗證 navbar 顯示正常，登入按鈕點下去有觸發 OAuth 流程（不是靜默無反應）
- 若有打字闖關，驗證 student_progress 在 Supabase 確實寫入（不是只有畫面變化）
- 若有打字闖關，驗證重新整理後進度正確接回
- 若有打字闖關，故意輸入錯誤答案，驗證提示方向正確且能指出錯誤附近位置
- 若有解鎖流程，驗證完成前連結不可用、完成後才出現或可點
- 若有週次隱藏設定，驗證首頁與 navbar 同步
- 驗證頁面可正常開啟，console 無紅色錯誤

## 衝突時的處理方式
若教案需求與既有 shared modules 或 page type 契約不一致，**不可自行另做一套實作，必須先停下來回報衝突點與建議做法**，等確認後再繼續。

## 完成後回報
請告訴我：
1. 判斷的頁面類型
2. 使用的 shared modules
3. 使用的 activityKey（若有）
4. 參考的頁面
5. 做了哪些驗證
6. 哪些地方沿用了原有功能，哪些地方是新寫的
7. 請把本次最重要的 1 到 3 個新增或修改檔案明確列出來，不要只講路徑上下文；若 IDE 支援，這樣比較容易出現可直接開啟的檔案卡片
```
