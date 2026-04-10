# Question Bank Execution SOP

這份文件是六年級各科題庫工作的短版實作 SOP。
用途是讓接手的 AI 或人工檢查時，可以快速確認流程是否有照規則執行。

## 1. 先讀規則

開始前至少要讀：

- `C:\Users\user\projects\WORKFLOW_GUARDRAILS.md`
- `C:\Users\user\projects\it-class-tcwu\docs\skills\wayground-question-bank-workflow\SKILL.md`
- `C:\Users\user\projects\it-class-tcwu\docs\skills\wayground-question-bank-workflow\AI_HANDOFF_PROMPT.md`
- `C:\Users\user\projects\it-class-tcwu\docs\skills\wayground-question-bank-workflow\references\question-bank-quality-spec.md`

## 2. 先確認出題身份

出題時要把自己定位成：

- 熟悉台灣 108 課綱的老師
- 熟悉教材版本的任課老師
- 熟悉本校段考風格的老師
- 具備評量設計能力，但不站在命題後設視角

## 3. 依據順序不能亂

命題依據固定依這個順序：

1. 教材與教師手冊
2. 本次明確範圍
3. 本校歷屆段考卷
4. 108 課綱領綱
5. 108 課程手冊
6. 題庫品質規格

## 4. 題型結構也要對

不要只檢查內容範圍，還要檢查題型結構。

- 要保留本校常見題型結構的核心精神
- 不能把整份題庫壓成單一題型
- 若紙本題型不適合 Wayground 單選，應轉譯成最接近的單選形式
- 若轉譯後會失真、模糊或變成多答案，就不要硬出

## 5. 先做本地題庫

題庫先寫在：

- `C:\Users\user\projects\it-class-tcwu\automation\question-banks\`

在進 Wayground 前，必須先完成本地驗證。

## 6. 本地驗證必查項目

- 範圍是否正確
- 題數是否正確
- 答案是否唯一
- 題幹是否清楚
- 是否有重複題或概念過度重複
- 干擾項是否合理
- 挑戰題的干擾項是否至少有一個在課文某部分「部分成立」，不可全部採用顯然錯誤的道德命題
- 難度分配是否合理
- 題型結構是否仍貼近本校考風

## 7. Gemini 是第二審稿

- 先做本地初審
- 再用已登入 Chrome + CDP 的 Gemini 做第二審稿
- Gemini 只提供 review signals，不是最終裁判
- 若 Gemini 與教材衝突，先回教材核對

## 8. 題庫通過後才進 Wayground

Wayground 標準流程：

1. `generate`
2. `check`
3. `delete if needed`
4. `set-language`
5. `set-all-timers-2min`
6. `publish`

內容審稿在本地做，不把 Wayground 當內容審稿工具。

## 9. 回報檔案格式固定

回報題庫、審稿結果、輸出檔案時：

- 先給 Windows 絕對路徑
- 再附可點連結
- 不可只給內部協定連結或模糊檔名

格式參考：

- `C:\Users\user\projects\it-class-tcwu\docs\skills\wayground-question-bank-workflow\FILE_REFERENCE_RESPONSE_FORMAT.md`

## 10. 交付前最後檢查

- 是否已完成本地驗證
- 是否已完成必要的 Gemini 審稿
- 是否已清楚交代檔案位置
- 若有進 Wayground，是否已發布且非草稿
- 若有改 repo，commit 前是否已跑 preflight
