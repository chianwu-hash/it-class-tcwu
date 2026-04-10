# Grade 6 Prompt Composition Template

這份文件提供六年級題庫出題時可直接使用的組合模板。

使用順序：
1. 先貼上共用母提示詞
2. 再貼上對應科目的分科提示詞
3. 最後補上本次任務資訊

---

## 通用組合模板

請依照以下格式組合：

### A. 共用母提示詞

請貼上：
[grade6-question-bank-master-prompt.md](C:\Users\user\projects\it-class-tcwu\docs\skills\wayground-question-bank-workflow\prompts\common\grade6-question-bank-master-prompt.md)

### B. 分科提示詞

請依科目貼上其中一份：
- 國語：[grade6-chinese-prompt.md](C:\Users\user\projects\it-class-tcwu\docs\skills\wayground-question-bank-workflow\prompts\subjects\grade6-chinese-prompt.md)
- 英語：[grade6-english-prompt.md](C:\Users\user\projects\it-class-tcwu\docs\skills\wayground-question-bank-workflow\prompts\subjects\grade6-english-prompt.md)
- 數學：[grade6-math-prompt.md](C:\Users\user\projects\it-class-tcwu\docs\skills\wayground-question-bank-workflow\prompts\subjects\grade6-math-prompt.md)
- 自然：[grade6-science-prompt.md](C:\Users\user\projects\it-class-tcwu\docs\skills\wayground-question-bank-workflow\prompts\subjects\grade6-science-prompt.md)
- 社會：[grade6-social-prompt.md](C:\Users\user\projects\it-class-tcwu\docs\skills\wayground-question-bank-workflow\prompts\subjects\grade6-social-prompt.md)

### C. 本次任務資訊

請把下面這段作為任務補充貼在最後：

```text
本次要出的是六年級【科目】題庫。

教材版本與範圍：
- 【請填教材版本】
- 【請填課次 / 單元 / 章節】

命題依據：
- 以本次教材與教師手冊為第一依據
- 以本校已提供的 113下、114上六年級段考卷作為風格校準
- 以 108 課綱與課程手冊作為上位校正依據

題數與題型要求：
- 共【請填題數】題
- 【請填是否四選一、是否含題組、是否含判斷題等】

難度分配：
- 基礎題：【請填】
- 中等題：【請填】
- 挑戰題：【請填】

額外限制：
- 不得超出本次教材範圍
- 不得出後設題
- 不得出雙答案題
- 不得用荒謬選項充當干擾項

輸出要求：
- 依本專案題庫格式輸出
- 附上答案
- 出題後先自我檢查是否有重複、歧義、超綱或風格失真
```

---

## 最短實戰版

如果你要快速啟動某一科，可直接用這個三段式：

```text
1. 貼上共用母提示詞
2. 貼上對應科目的分科提示詞
3. 補上這次的教材範圍、題數、難度與輸出要求
```

這樣做的好處是：
- 角色定位固定
- 分科風格不會混掉
- 每次只需要改動本次範圍與題數，不需要重寫整套 prompt
