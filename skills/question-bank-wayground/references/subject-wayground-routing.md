# Subject Wayground Routing

這份文件記錄不同科目進 Wayground 時的建議路線。若實測結果與本文件衝突，以最新專案實測與人工驗收為準，並回寫本文件。

## 核心結論

| 科目 | 建議路線 | 原因 | 必做驗收 |
| --- | --- | --- | --- |
| 自然 | 使用 `unicode-plus` 題庫，直接匯入 | 化學式、離子、反應式與平衡符號以 Unicode 呈現最穩，直接匯入可避免 AI 改寫題意 | 匯入後檢查題數、答案、化學式與反應式顯示 |
| 數學 | 使用 Wayground AI 出題 | Wayground AI 可將分數、根號、次方、下標、函式、不等式等轉成較漂亮的公式排版 | 生成後用截圖或人工視覺檢查公式，再刪錯題與重複題 |

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
4. 使用 Wayground AI 出題，不直接把未審教材交給 Wayground AI。
5. 生成後必須檢查題數、範圍、答案與是否有重複題。
6. 公式驗收不能只看 DOM `innerText`，因為公式渲染後會被拆成純文字片段；請用截圖或人工視覺檢查。
7. 刪除錯題、重複題與 AI 多生題後，再設定時間與發布。

建議命令：

```bash
npm run wayground:generate -- automation/question-banks/<math-bank>.md --subject Mathematics --lang Chinese --grade 8 --count <count>
npm run wayground:check -- automation/question-banks/<math-bank>.md
npm run wayground:set-all-timers-2min
npm run wayground:publish
```

若 `wayground:check` 的純文字比對顯示數學式不一致，先不要直接判定失敗。請補做截圖或人工檢查；只有畫面顯示錯誤、題意改壞、答案錯誤或重複題時才需要修正或刪題。

## 目前實測紀錄

- 自然：`unicode-plus` 題庫直接匯入可保留 `H⁺`、`OH⁻`、`Na⁺`、`2NO₂(褐色) ⇌ N₂O₄(無色) + 熱` 等表達式。
- 數學：Wayground AI 出題可正確視覺渲染 `1/2`、`√2`、`3√5`、`x²`、`a₁`、`xₙ`、`f(x)=2x+1`、`∠ABC=90°`、`l ∥ m`、`AB ⟂ CD`、`-2 < x ≤ 5` 等常見表達式。
