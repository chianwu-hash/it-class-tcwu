# Wayground Tooling Reference

This reference lists the repository files and scripts used by the Wayground question-bank workflow.

## Core docs

- `C:\Users\user\projects\WORKFLOW_GUARDRAILS.md`
- `C:\Users\user\projects\it-class-tcwu\docs\browser-automation-sop.md`

## Question banks

- `C:\Users\user\projects\it-class-tcwu\automation\question-banks\`

Banks are stored as markdown files and are the source of truth for quiz content.

## Output directory

- `C:\Users\user\projects\it-class-tcwu\automation\output\`

Common output artifacts:
- `wayground-generated-from-bank.json`
- `wayground-generated-check.json`
- `wayground-generated-check.md`
- `wayground-generated-check.png`
- `wayground-after-delete.json`
- `wayground-language-chinese.json`
- `wayground-set-all-timers-2min.json`
- `wayground-publish.json`

## Browser and Wayground scripts

- `C:\Users\user\projects\it-class-tcwu\automation\browser-smoke.js`
  - confirms CDP connectivity

- `C:\Users\user\projects\it-class-tcwu\automation\wayground-open.js`
  - opens Wayground

- `C:\Users\user\projects\it-class-tcwu\automation\wayground-cdp-inspect.js`
  - captures current assessment-page DOM summary and screenshot

- `C:\Users\user\projects\it-class-tcwu\automation\wayground-generate-from-bank.js`
  - reads a markdown bank and drives the assessment -> AI -> text prompt flow
  - supports `--language`, `--subject`, `--grade`, `--count`
  - includes handling for science subtopic / use-quiz intermediate pages

- `C:\Users\user\projects\it-class-tcwu\automation\wayground-check-generated-quiz.js`
  - compares generated quiz cards with the local bank
  - reports duplicate, mismatch, and extra counts

- `C:\Users\user\projects\it-class-tcwu\automation\wayground-delete-questions.js`
  - deletes explicit question numbers, descending

- `C:\Users\user\projects\it-class-tcwu\automation\wayground-set-language-chinese.js`
  - opens settings and saves Chinese as the quiz language

- `C:\Users\user\projects\it-class-tcwu\automation\wayground-set-all-timers-2min.js`
  - updates every question timer to 2 minutes

- `C:\Users\user\projects\it-class-tcwu\automation\wayground-publish.js`
  - publishes the current quiz from the edit page

- `C:\Users\user\projects\it-class-tcwu\automation\wayground-collect-share-links.js`
  - copies share links from the Wayground library for known quiz IDs

- `C:\Users\user\projects\it-class-tcwu\automation\gemini-capture-latest-response.js`
  - captures only the latest Gemini model response from the current open Gemini tab
  - waits for the response text to stabilize before saving
  - preferred over full-page `body.innerText()` dumps when using Gemini as a second reviewer

## Grade pages

Common pages to update after publishing:
- `C:\Users\user\projects\it-class-tcwu\grade3\wayground.html`
- `C:\Users\user\projects\it-class-tcwu\grade6\wayground.html`

## Pre-commit check

- `C:\Users\user\projects\tools\preflight_guardrails.py`

Always run it before commit when repo files changed.
