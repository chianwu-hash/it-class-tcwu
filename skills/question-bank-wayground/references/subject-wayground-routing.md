# Subject Wayground Routing

這份文件記錄不同科目進 Wayground 時的建議路線。若實測結果與本文件衝突，以最新專案實測與人工驗收為準，並回寫本文件。

## 核心結論

| 科目 | 建議路線 | 原因 | 必做驗收 |
| --- | --- | --- | --- |
| 自然 | 使用 `unicode-plus` 題庫，直接匯入 | 化學式、離子、反應式與平衡符號以 Unicode 呈現最穩，直接匯入可避免 AI 改寫題意 | 匯入後檢查題數、答案、化學式與反應式顯示 |
| 數學 | 公式型題目使用 Wayground AI；含圖片連結的圖表題使用直接匯入 | Wayground AI 可將常見公式轉成較漂亮的公式排版；但圖片題需要保留本地已驗證的 Cloudinary media，不宜交給 AI 改寫 | 公式題生成後用截圖或人工視覺檢查；圖片題匯入後檢查 `query.media`、Cloudinary URL、畫面裁切與圖題一致 |

## 自然科 SOP

1. 先依 `TEXTBOOK_TO_BANK_SOP.md` 產出本地 Markdown 題庫。
2. 公式與化學符號改用 `unicode-plus` 寫法，不用 Markdown 反引號包住。
3. 常用寫法：
   - 離子：`H⁺`、`OH⁻`、`Na⁺`
   - 化學式：`NO₂`、`N₂O₄`
   - 可逆反應：`2NO₂(褐色) ⇌ N₂O₄(無色) + 熱`
4. 通過本地初審、誘答選項自審與必要的二審後，使用直接匯入。
5. 匯入後檢查題數、答案唯一性、化學式與反應式顯示，再設定時間與發布。

建議命令：

```bash
npm run wayground:import -- automation/question-banks/<science-bank-unicode-plus>.md --subject Science --lang Chinese --grade 8
npm run wayground:check -- automation/question-banks/<science-bank-unicode-plus>.md
npm run wayground:set-all-timers-2min
npm run wayground:publish
```

## 數學科 SOP

1. 先依 `TEXTBOOK_TO_BANK_SOP.md` 產出本地 Markdown 題庫。
2. 數學表達式以簡潔、可被 Wayground AI 轉換的形式書寫。
3. 常用寫法：
   - 分數：`1/2`，必要時也可用 `½`
   - 根號：`√2`、`3√5`
   - 次方與下標：`x²`、`a₁`、`xₙ`
   - 函式：`f(x)=2x+1`、`g(x)=x²-3`
   - 幾何與不等式：`∠ABC=90°`、`l ∥ m`、`AB ⟂ CD`、`-2 < x ≤ 5`
4. 公式型或純文字數學題可使用 Wayground AI 出題，不直接把未審教材交給 Wayground AI。
5. 生成後必須檢查題數、範圍、答案與是否有重複題。
6. 公式驗收不能只看 DOM `innerText`，因為公式渲染後會被拆成純文字片段；請用截圖或人工視覺檢查。
7. 刪除錯題、重複題與 AI 多生題後，再設定時間與發布。

### 數學圖表題

若題庫含 `圖片：https://...`，表示該題使用已驗證的 Cloudinary 圖表。此時優先使用直接匯入，不走 Wayground AI 生成，避免 AI 改寫題意或遺失圖片。

數學圖表題流程：

1. 藍圖先標記視覺需求：無、表格、輔助圖或必須圖。
2. 必須圖需建立 figure spec，包含圖形型態、數值、單位、標籤、答案驗算與使用題號。
3. 幾何圖、立體圖、展開圖、複合形體、切割圖、挖空形體與任何影響答案的圖表，進 imagegen 前必須先建立 `structureDraft`。
4. 高風險精準圖的 `structureDraft` 階段必須納入 Gemini CLI：可由 Gemini CLI 直接產生 SVG 草圖，或由 Codex 先產草圖後請 Gemini CLI 做幾何/拓撲審查與修正建議。
5. `structureDraft` 可為 SVG、PNG 簡圖、座標草稿或其他可檢查的結構草圖；目標是固定幾何拓撲與標示位置，不追求美觀。
6. 不得只用自然語言 prompt 直接進 imagegen 產生上述高風險圖型。
7. 若 SVG 或簡圖成品不適合正式考題，可用 imagegen 依草圖重繪。
8. imagegen prompt 需明確禁止不必要鋪色、陰影、漸層、局部色塊與額外文字，並保留 `structureDraft` 的幾何拓撲。
9. 圖片上傳 Cloudinary 後，在題庫題目下方寫：

```markdown
圖片：https://res.cloudinary.com/...
```

10. 匯入前跑 figure manifest 驗證，確認本地圖檔、Cloudinary URL、圖中標籤、驗算與 `structureDraft` 都完整。
11. 使用 `wayground:import` 直接匯入。
12. 匯入後跑 `wayground:check`，確認 `mediaMismatchCount` 為 0，再用畫面抽查裁切與圖題一致。
13. 發布前產出 `automation/output/<bank-name>-visual-review.html`，集中呈現題目、圖片、figure spec、structureDraft、Gemini CLI / Claude CLI 視覺審查、Wayground 檢查結果與截圖或連結。

`structureDraft` 硬門檻：

- figure manifest 必須記錄 `structureDraft.type` 與 `structureDraft.path`；若使用座標草稿，需記錄足以重建圖形的座標或結構描述。
- 高風險精準圖必須在 visual review notes 或 manifest 記錄 Gemini CLI 的 `structureDraft` 參與結果：prompt 路徑、輸出草圖路徑、採用/不採用理由與人工審查狀態。
- 若 Gemini CLI 逾時、額度不足、無法讀圖或輸出不完整，必須記錄 fallback 原因；除非人工明確核准，不得跳過 `structureDraft` gate 直接進 imagegen。
- 高風險圖型缺少 `structureDraft` 時，狀態不得標為 `visual-review-passed`。
- 若 validator 尚未支援 `structureDraft` 欄位，人工紀錄仍必須在 visual review notes 明確列出草圖路徑與草圖審查結果。
- 三角柱、複合柱體、空心柱、半圓柱與展開圖不得只因標籤正確就通過；必須確認幾何物件本身成立。
- 若同一高風險圖在 Gemini CLI 參與後仍連續兩輪人工 FAIL，停止盲目修圖，升級為題目設計審查：改投影方式、改 2D 圖、改文字題、換題，或尋找正確參考圖後重新建立草圖。

圖表視覺驗收必查：

- 圖中標籤與 figure spec 完全一致。
- 幾何物件本身成立；不可只檢查標籤與數字。
- 立體圖需檢查底面/頂面、前後全等面、對應邊、共同高度、連接稜與遮擋關係是否合理。
- 文字沒有裁切。
- 箭頭、量測線、導引線位置正確。
- 若題意不需要鋪色，就不要鋪色。
- 任何鋪色不得造成液面、截面、局部體積或指定區域的誤讀。

Gemini CLI 與 Claude CLI 已實測可讀取本地 PNG 圖檔並辨識簡單數學圖表，可作為圖表審查主力。不過新流程剛啟用，正式發布前仍不可完全跳過人工 gate。若兩個 CLI 審查都通過、描述一致、manifest 與 Wayground check 都通過，人工可只看 visual review summary 與異常項；若遇到新圖型、鋪色、箭頭、切面、透視、AI 審查分歧或 Wayground 顯示疑慮，必須人工逐題看圖。

生圖工具分流：

- 數學精準圖表預設使用 Codex 內建 `imagegen`，逐張生成、逐張審查。
- 不使用 ChatGPT browser image workflow 作為預設工具；該 workflow 僅用於課堂插圖、簡報圖、非答案關鍵視覺，或使用者明確指定的 fallback。
- 若因特殊原因改走 ChatGPT browser workflow，必須記錄原因，並仍需通過 Gemini / Claude 視覺審查與人工 gate。

### 數學表格題

表格題可在本地題庫使用 Markdown 表格，方便審稿：

```markdown
| 柱體 | 底面積 | 柱高 |
|---|---:|---:|
| 甲 | 24 | 5 |
| 乙 | 18 | 8 |
```

Wayground 不會自動渲染 Markdown 表格；`wayground:import` 會將 Markdown 表格轉成帶 inline style 的 HTML table。匯入後必須確認：

- 題目 DOM 中有 `table`。
- 表格有欄名與資料列。
- 畫面不是管線文字。
- 表格資料、題目答案與本地驗算一致。

建議命令：

```bash
npm run wayground:import -- automation/question-banks/<math-bank>.md --subject Mathematics --lang Chinese --grade 8
npm run wayground:check -- automation/question-banks/<math-bank>.md
npm run wayground:set-all-timers-2min
npm run wayground:publish
```

若 `wayground:check` 的純文字比對顯示數學式不一致，先不要直接判定失敗。請補做截圖或人工檢查；只有畫面顯示錯誤、題意改壞、答案錯誤或重複題時才需要修正或刪題。

圖片題或表格題的 `wayground:check` 必須同時看文字、`mediaMismatchCount` 與 `tableMismatchCount`。三者都通過後，仍需以截圖或人工視覺抽查確認沒有裁切、錯位或表格排版問題。

## 目前實測紀錄

- 自然：`unicode-plus` 題庫直接匯入可保留 `H⁺`、`OH⁻`、`Na⁺`、`2NO₂(褐色) ⇌ N₂O₄(無色) + 熱` 等表達式。
- 數學：Wayground AI 出題可正確視覺渲染 `1/2`、`√2`、`3√5`、`x²`、`a₁`、`xₙ`、`f(x)=2x+1`、`∠ABC=90°`、`l ∥ m`、`AB ⟂ CD`、`-2 < x ≤ 5` 等常見表達式。
- 數學圖表題：`圖片：https://...` 可由 `wayground:import` 匯入為題目 `query.media`。實測紀錄：`automation/output/grade6-math-u6-image-question-test-report.md`。
- 數學表格題：HTML `<table>` 與 inline style 可在 Wayground 題幹保留；Markdown 表格需由 `wayground:import` 轉成 HTML table。實測紀錄：`automation/output/wayground-table-format-test-report.md`。
