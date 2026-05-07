# Wayground Workflow Troubleshooting

這份文件記錄已知的手動介入點、Wayground UI 變動造成的腳本失敗，以及常見排錯步驟。

若遇到新問題，請在本文件補充，不要直接改腳本邏輯後就算了。

---

## 目錄

- [CDP 連線失敗](#cdp-連線失敗)
- [wayground:set-all-timers-2min 失敗](#waygoundset-all-timers-2min-失敗)
- [wayground:generate 卡在中間頁面](#waygoundgenerate-卡在中間頁面)
- [wayground:collect-links 讀不到剪貼簿](#waygoundcollect-links-讀不到剪貼簿)
- [wayground:import 回傳 API 錯誤](#waygoundimport-回傳-api-錯誤)
- [匯入後題數與本地題庫不符](#匯入後題數與本地題庫不符)

---

## CDP 連線失敗

**症狀：** `No browser context found via CDP` 或 `connect ECONNREFUSED 127.0.0.1:9222`

**原因：** Chrome 未在 CDP 模式下啟動，或 port 不正確。

**處理：**
1. 確認 Chrome 已用 `--remote-debugging-port=9222` 啟動，或確認你要使用的實際 port
2. 在瀏覽器開啟 `http://127.0.0.1:9222/json` 確認有 tab 列表
3. 確認 Wayground 已在該 Chrome 中登入
4. 若不是使用 `9222`，執行指令時設定 `CDP_URL`，例如：

```bash
CDP_URL=http://127.0.0.1:18801 npm run wayground:inspect
```

---

## wayground:set-all-timers-2min 失敗

**症狀：** `Could not find timer dropdown for question N`

**原因：** Wayground 更新後計時器元素的 CSS class 改變。此腳本依賴 Tailwind utility class 選取器，容易因版本升級而失效。

**處理（短期）：**
1. 開啟 `automation/wayground-cdp-inspect.js` 截圖，確認目前 UI 結構
2. 手動在 Wayground 介面設定計時器
3. 在此文件記錄 UI 變動日期

**處理（長期）：**
- 若 Wayground 提供 `data-testid` 或 `aria-label` 供計時器操作，改用這些選取器取代 CSS class
- 詳見 [automation/wayground-set-all-timers-2min.js](../automation/wayground-set-all-timers-2min.js) 中的 trigger 選取邏輯

---

## wayground:generate 卡在中間頁面

**症狀：** 腳本停在 `advanceAfterFirstGenerate`，未能進入 `/admin/quiz/` 頁面

**原因：** Wayground AI 出題流程有兩個可能的中間頁面：
- `subtopics-container`：副主題確認頁
- `use-quiz-button`：使用測驗按鈕頁

腳本已內建偵測邏輯，但若 UI 新增其他中間頁面，會在 180 秒後 timeout。

**處理：**
1. 手動在 Chrome 完成剩餘步驟，進入 `/admin/quiz/` 頁面
2. 之後的 `wayground:check`、`wayground:set-all-timers-2min`、`wayground:publish` 仍可正常執行
3. 若發現新的中間頁面，在此記錄 `data-testid` 供後續更新腳本

---

## wayground:collect-links 讀不到剪貼簿

**症狀：** `navigator.clipboard.readText()` 回傳空字串或丟出錯誤

**原因：** Chrome 的剪貼簿存取需要使用者授權，部分 CDP 環境下無法自動取得。

**處理：**
1. 在 Chrome 中手動開啟 `wayground.com/admin/my-library/createdByMe`
2. 手動點每個測驗的 share 按鈕，複製連結
3. 把連結手動填入 `automation/output/wayground-links.json`

---

## wayground:import 回傳 API 錯誤

**症狀：** `Wayground import failed at create: ...`

**常見原因與處理：**

| 狀況 | 處理 |
|---|---|
| `401 Unauthorized` | 重新登入 Wayground，確認 session cookie 仍有效 |
| `400 Bad Request` | 檢查題庫 Markdown 格式，確認 A/B/C/D 選項與答案都存在 |
| `題目缺少答案` | 腳本 parse 時會在 import 前拋出，檢查 `答案：X` 格式 |
| 匯入成功但題數為 0 | 可能是 Wayground API 變動，改用 `wayground:generate` 流程 |

---

## 匯入後題數與本地題庫不符

**症狀：** `wayground:check` 回報 mismatch 或 extra

**原因：**
- AI 出題流程：Wayground 可能修改題目或增減題數，這是預期行為，需人工確認
- 直接匯入流程：理論上 1:1 對應，若有差異表示 API 有問題

**處理：**
1. 執行 `wayground:check` 取得完整比對報告（`automation/output/wayground-generated-check.md`）
2. 確認差異是否在可接受範圍
3. 若有錯誤題目，用 `wayground:delete` 刪除後補題
4. 若大量不符，刪除該測驗重新來過
