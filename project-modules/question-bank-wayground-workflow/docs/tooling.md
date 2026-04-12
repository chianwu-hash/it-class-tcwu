# Wayground Tooling Reference

This reference lists the portable files and scripts used by the Wayground question-bank workflow.

All paths below are relative to the target project root after this module is deployed.

## Core docs

- `docs/workflow/END_TO_END_FLOW.md`
- `docs/workflow/TEXTBOOK_TO_BANK_SOP.md`
- `docs/workflow/DISTRACTOR_SELF_REVIEW.md`
- `docs/workflow/WORKFLOW_SOP.md`
- `docs/workflow/question-bank-quality-spec.md`
- `docs/workflow/tooling.md`

If the target project has global guardrails or a browser automation SOP, follow those too. Do not hard-code paths from the source project.

## Question banks

- `automation/question-banks/`

Banks are Markdown files and remain the source of truth for quiz content.

## Output directory

- `automation/output/`

Common output artifacts:
- `wayground-generated-from-bank.json`
- `wayground-imported-from-bank.json`
- `wayground-generated-check.json`
- `wayground-generated-check.md`
- `wayground-generated-check.png`
- `wayground-after-delete.json`
- `wayground-language-chinese.json`
- `wayground-set-all-timers-2min.json`
- `wayground-publish.json`
- `wayground-links.json`

## Browser and Wayground scripts

- `automation/browser-smoke.js`
  - confirms Playwright can run

- `automation/wayground-open.js`
  - opens Wayground

- `automation/wayground-cdp-inspect.js`
  - captures current assessment-page DOM summary and screenshot

- `automation/wayground-generate-from-bank.js`
  - reads a Markdown bank and drives the assessment -> AI -> text prompt flow
  - supports `--language`, `--subject`, `--grade`, `--count`
  - includes handling for science subtopic / use-quiz intermediate pages

- `automation/wayground-import-from-bank.js`
  - imports a validated local bank directly through Wayground APIs
  - preferred over AI generation when preserving exact wording matters
  - supports `--subject`, `--lang`, `--grade`, `--publish`

- `automation/wayground-check-generated-quiz.js`
  - compares generated quiz cards with the local bank
  - reports duplicate, mismatch, and extra counts

- `automation/wayground-delete-questions.js`
  - deletes explicit question numbers, descending

- `automation/wayground-set-language-chinese.js`
  - opens settings and saves Chinese as the quiz language

- `automation/wayground-set-all-timers-2min.js`
  - updates every question timer to 2 minutes

- `automation/wayground-publish.js`
  - publishes the current quiz from the edit page

- `automation/wayground-collect-share-links.js`
  - copies share links from the Wayground library for quiz IDs in a JSON config
  - default config path: `automation/wayground-quizzes.json`
  - default output path: `automation/output/wayground-links.json`

- `automation/gemini-capture-latest-response.js`
  - captures only the latest Gemini model response from the current open Gemini tab
  - waits for the response text to stabilize before saving
  - preferred over full-page `body.innerText()` dumps when using Gemini as a second reviewer

## Quiz link config

Create this file from `templates/wayground-quizzes.sample.json`:

```text
automation/wayground-quizzes.json
```

Example:

```json
{
  "quizzes": [
    {
      "id": "replace-with-wayground-quiz-id",
      "title": "題庫標題",
      "subject": "科目",
      "range": "範圍",
      "count": 10
    }
  ]
}
```

Then run:

```powershell
npm.cmd run wayground:collect-links -- --config .\automation\wayground-quizzes.json --out .\automation\output\wayground-links.json
```

## Grade or course pages

The target project should set its entry page in `project.config.md`, for example:

```text
wayground/index.html
```

Do not assume the source project's grade pages exist in the target project.

## Pre-commit check

If the target project has a preflight or test command, run it before commit. If it does not, at least run a small browser smoke test and a Wayground import/check dry run before treating the deployment as complete.
