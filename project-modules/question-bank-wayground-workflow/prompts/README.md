# Question Bank Prompt Templates

這個資料夾保存可搬移的「教材到題庫」prompt 模板。

## 結構

```text
prompts/
prompts/master-question-bank-prompt-template.md
prompts/subjects/
prompts/review/
```

## 使用順序

1. 先貼上 `master-question-bank-prompt-template.md`。
2. 再貼上對應科目的 `subjects/<subject>-prompt-template.md`。
3. 補上本次任務資料：年級、教材版本、範圍、題數、難度、題型、輸出格式。
4. 貼上教材文字、教師手冊重點、考試範圍、校內考風摘要。
5. 產出本地 Markdown 題庫。
6. 用 `review/gemini-review-prompt-template.md` 做第二審稿。

## 搬移規則

- 這些模板是通用模板，不綁定特定年級。
- 搬到新專案後，請依 `project.config.md` 改寫年級、教材版本與本校考風描述。
- 不要把來源專案的年級、教材版本或校內考風硬套到新專案，除非使用者明確要求。
