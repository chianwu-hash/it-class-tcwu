# Browser Automation SOP

最後更新：2026-04-27

## 1. 目的

這份 SOP 記錄目前專案可重複使用的瀏覽器自動化流程，重點是：

- 不要再用 Playwright 直接開新瀏覽器登入 Google
- 正確使用「手動登入的正式 Chrome + CDP」
- 讓 Wayground 出題流程可重複執行、可檢查、可修正、可發布
- 讓 NotebookLM、Gemini、ChatGPT 等已登入頁面自動化有固定入口

正式專案路徑：
- `C:\Users\user\projects\it-class-tcwu`

## 2. Google 登入原則

### 不要做的事
以下方式都可能被 Google 判定為不安全登入環境：

- Playwright 開的 `Chrome for Testing`
- Playwright 開的 `Edge`
- Playwright 開的正式 `Chrome`

### 正確做法
1. 手動開啟支援 CDP 的正式 Chrome
2. 在這個 Chrome 裡手動登入 Google / Wayground
3. 之後所有自動化都連到這個已登入的 Chrome

## 3. 啟動 CDP Chrome

在 PowerShell 執行：

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\chrome-cdp-profile"
```

啟動後：
1. 手動登入 Google
2. 打開 Wayground
3. 如果需要 NotebookLM、Gemini 或 ChatGPT，也在支援 CDP 的正式 Chrome 裡開啟

CDP 檢查入口：
- `http://localhost:9222/json`

補充：
- 本專案近期也常用 `9333` 作為已登入 ChatGPT 分頁的 CDP port
- ChatGPT 生圖流程預設檢查入口：`http://127.0.0.1:9333/json`

## 4. automation 目錄與主要腳本

位置：
- `automation/`

主要腳本：
- `automation/browser-smoke.js`
- `automation/notebooklm-open.js`
- `automation/notebooklm-ask.js`
- `automation/wayground-open.js`
- `automation/wayground-generate-from-bank.js`
- `automation/wayground-check-generated-quiz.js`
- `automation/wayground-delete-questions.js`
- `automation/wayground-set-language-chinese.js`
- `automation/wayground-set-all-timers-2min.js`
- `automation/wayground-publish.js`
- ChatGPT 生圖使用外部共用腳本，入口由 `package.json` 包成 `npm.cmd run chatgpt:image-batch`

PowerShell 請一律使用 `npm.cmd`：

```powershell
npm.cmd run browser:smoke
npm.cmd run notebooklm:ask -- --prompt "請根據這個筆記本中的來源，列出本週技能對應頁碼"
npm.cmd run wayground:open
npm.cmd run wayground:generate -- .\automation\question-banks\xxx.md
npm.cmd run wayground:check -- .\automation\question-banks\xxx.md
npm.cmd run wayground:delete -- 21,20,19
npm.cmd run wayground:set-language
npm.cmd run wayground:set-all-timers-2min
npm.cmd run wayground:publish
```

## 5. Wayground 完整流程

### 前置條件
- 已開啟支援 CDP 的正式 Chrome
- 已在 Chrome 內手動登入 Google / Wayground
- 題庫檔已準備完成，例如：
  - `automation/question-banks/grade3-chinese-midterm-lessons1-3-v2.md`

### 標準流程
1. 產生題目：`wayground:generate`
2. 檢查結果：`wayground:check`
3. 如有重複題或壞題，先判斷要刪哪些題號
4. 刪題：`wayground:delete`
5. 再檢查一次：`wayground:check`
6. 右上角「設定」把語言改成中文：`wayground:set-language`
7. 把所有題目的答題時間改成 2 分鐘：`wayground:set-all-timers-2min`
8. 發布：`wayground:publish`

## 6. 題數異常與重複題處理原則

Wayground AI 有時不會完全照指定題數生成，常見情況：

- 30 題要求，實際生成 32 題或 33 題
- 中間插入重複題
- 出現壞掉題或空題

### 正確處理原則
- 先跑 `wayground:check`
- 不要直接刪尾端題目
- 優先刪除「中間重複或壞掉」的題目
- 刪題時要用「明確題號」並且**由大到小刪**

原因：
- 如果先刪前面的題，後面的題號會往前補，容易刪錯
- 由大到小刪，可以保持前面題號不變

範例：
- 要刪 `19`、`18`
- 正確順序：先刪 `19`，再刪 `18`

## 7. wayground:check 的用途

腳本：
- `automation/wayground-check-generated-quiz.js`

用途：
- 讀目前 Wayground 編輯頁的題目數
- 抓每題題幹與順序
- 與原始題庫比對
- 輸出：
  - `duplicateCount`
  - `mismatchCount`
  - `extraCount`

輸出位置：
- `automation/output/wayground-generated-check.json`
- `automation/output/wayground-generated-check.md`
- `automation/output/wayground-generated-check.png`

## 8. wayground:delete 的用途

腳本：
- `automation/wayground-delete-questions.js`

用途：
- 刪除指定題號
- 內部會自動轉成由大到小執行

範例：

```powershell
npm.cmd run wayground:delete -- 21,20,19
```

## 9. 語言改中文

腳本：
- `automation/wayground-set-language-chinese.js`

用途：
- 打開右上角設定
- 找到語言欄位
- 選擇：`中文 (Zhōngwén), 汉语, 漢語`
- 按下保存

目前已知可用 selector：
- `publish-modal-language-input-select-box-option-32`

## 10. 每題答題時間改成 2 分鐘

腳本：
- `automation/wayground-set-all-timers-2min.js`

用途：
- 直接在題目列表頁面操作每題左上角的時間下拉
- 把所有題目統一改成 `2 分鐘`
- 若部分題目已經是 2 分鐘，會自動略過

驗證結果重點：
- `all2Min: true`
- `remaining30Sec: []`

## 11. 發布

腳本：
- `automation/wayground-publish.js`

用途：
- 在編輯頁按下 `發布`
- 成功後網址會從：
  - `/admin/quiz/<id>/edit?...`
- 變成：
  - `/admin/quiz/<id>`

這代表測驗已離開編輯頁，進入正式 quiz 頁。

## 12. 題庫規則（目前已確認）

以三年級國語為例：
- 可先由教冊 PDF 轉成文字檔
- 再由 AI 根據文字檔整理成題庫
- 題庫存放在：
  - `automation/question-banks/`

如果使用者說「字音字形」，這裡的定義是：
- `字音` = 注音
- `字形` = 國字、正確字形

不要把詞語意思題誤當成字音字形題。

## 13. 已驗證可行的完整流程

目前已實際驗證成功的流程：
1. 用題庫生成 Wayground 題目
2. 檢查題數與重複題
3. 刪除指定重複題
4. 再檢查一次，確認對齊原始題庫
5. 設定語言為中文
6. 批次把所有題目時間改成 2 分鐘
7. 發布

這條流程目前可重複使用。

## 14. NotebookLM 問答與擷取

腳本：
- `automation/notebooklm-ask.js`

用途：
- 連到已登入的正式 Chrome（CDP `9222`）
- 找到目前開著的 NotebookLM 筆記本分頁
- 把提示詞送進底部對話框
- 等待最新回答穩定
- 輸出純文字回答

支援三種輸入提示詞方式：

1. `--prompt "..."`  
2. `--prompt-file path/to/prompt.txt`  
3. PowerShell 管線輸入

範例：

```powershell
@'
請根據這個筆記本中的來源，列出本週技能與對應頁碼。
'@ | npm.cmd run notebooklm:ask -- --out automation/output/notebooklm-latest-response.txt
```

預設輸出：

- `automation/output/notebooklm-latest-response.txt`
- `automation/output/notebooklm-latest-response.json`
- `automation/output/notebooklm-after-ask.png`

注意：
- 必須先手動打開對應的 NotebookLM 筆記本
- 腳本會操作目前最後一個 NotebookLM 筆記本頁面
- 若回答格式之後要回寫教案 / HTML，請再接 `notebooklm:page-refs`
- 若提示詞含中文，優先使用 `--prompt-file`；PowerShell 管線有機會把中文轉成亂碼，導致 NotebookLM 收到錯誤內容

## 15. ChatGPT 生圖自動化

用途：

- 透過已登入 ChatGPT 分頁生成課程資訊圖卡、教學圖片或簡報主視覺
- 特別適合需要使用 ChatGPT 圖像生成能力、或 Gemini 下載不穩時替代

使用前先讀：

- `skills/chatgpt-image-workflow/SKILL.md`
- `docs/image-and-preview-card-sop.md`

入口：

- `npm.cmd run chatgpt:image-batch`

範例：

```powershell
npm.cmd run chatgpt:image-batch -- --cdp-url http://127.0.0.1:9333 --prompt-file automation/prompts/week12-safety-card.txt --count 1 --min-images 1 --output-dir grade3/images/week12 --output-prefix week12-safety-card --meta automation/output/week12-safety-card.json
```

固定規則：

- ChatGPT 頁面必須先由使用者手動登入並保持開啟
- 中文提示詞一律放 UTF-8 `.txt`，用 `--prompt-file`
- 不要把中文 prompt 放進 PowerShell inline / here-string
- `--reuse-chat` 只在刻意延續同一段對話時使用
- 生圖後檢查 metadata 與實際圖片檔，再接壓圖與 Cloudinary 流程
