---
name: wayground-question-bank-workflow
description: Use this skill when an AI needs to turn a validated local question bank into a published Wayground quiz set using the project's CDP browser automation flow. This skill covers prerequisite checks, local bank validation gates, the standard generate-check-delete-language-timer-publish sequence, natural-science UI differences, share-link collection, and grade page updates. Use it for recurring exam-bank work in this repository.
---

# Wayground Question Bank Workflow

Use this skill for any task that includes:
- preparing a local exam bank from textbook scope
- generating Wayground quizzes from markdown banks
- checking generated questions against the local bank
- deleting duplicate/broken questions
- setting quiz language to Chinese
- setting all timers to 2 minutes
- publishing quizzes
- updating `wayground.html` grade pages with final links

Do not use this skill to skip local validation or to log into Google with a Playwright-launched browser.

## Required context

Before doing any work, read:
- [Projects Workflow Guardrails](C:\Users\user\projects\WORKFLOW_GUARDRAILS.md)
- [Browser Automation SOP](C:\Users\user\projects\it-class-tcwu\docs\browser-automation-sop.md)
- [Wayground Tooling Reference](C:\Users\user\projects\it-class-tcwu\docs\skills\wayground-question-bank-workflow\references\tooling.md)
- [Question Bank Quality Spec](C:\Users\user\projects\it-class-tcwu\docs\skills\wayground-question-bank-workflow\references\question-bank-quality-spec.md)

## Hard rules

1. Local question-bank validation is mandatory before Wayground.
2. Use the user's already logged-in real Chrome over CDP. Do not launch a fresh login browser.
3. Do not treat Wayground as the primary content-review tool.
4. Do not put raw Chinese into PowerShell inline scripts or heredocs.
5. Do not use terminal-rendered Chinese as the final source of truth; use UTF-8 files, the page itself, or screenshots.
6. If a workflow has succeeded many times before, inspect page state first and make only minimal fixes.
7. Prefer reusing the current Wayground tab instead of opening many new tabs.

## Inputs this skill expects

- a validated local markdown bank in `automation/question-banks/`
- subject
- grade
- desired question count
- target grade page, for example `grade3/wayground.html` or `grade6/wayground.html`

## How to cite local files in handoff or status updates

When reporting files back to the user or the next AI:
- always include a plain Windows absolute path such as `C:\Users\user\projects\it-class-tcwu\automation\output\...`
- do not rely on editor-only or UI-only resource links as the only reference
- if a clickable local-file link is also available, include it only as a convenience layer, not as the sole path
- when listing multiple review outputs, give each file's full path explicitly

## Standard workflow

### 1. Confirm browser readiness

Use the already logged-in Chrome started with:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\chrome-cdp-profile"
```

Optionally smoke-test CDP:

```powershell
npm.cmd run browser:smoke
```

### 2. Validate the local bank first

Before Wayground, verify:
- scope matches the requested chapters/units/lessons
- answer key is correct
- there is only one best answer per question
- there are no obvious duplicates
- wording is clear
- difficulty split matches the request
- question count matches the request

Use the quality-spec reference as the default standard for:
- distractor strength
- duplicate-concept limits
- difficulty definitions
- subject-specific review rules

If there are suspected wrong answers, out-of-scope items, or clear duplicates, fix the local bank first.

### 2.5. Use Gemini as a second reviewer when quality matters

After the first local validation pass, run a second independent review with the already open Gemini tab.

This step is **mandatory** for:
- Social studies
- Chinese and other language subjects
- Any bank where more than half the questions involve judgment, values, or synthesis

For math and science banks with clear factual or calculation answers, this step is optional unless the bank contains many judgment-based items.

Use Gemini for:
- catching likely wrong answers
- spotting concept repetition
- identifying wording that may be too abstract or ambiguous for elementary students
- sanity-checking whether the intended hard questions are actually hard enough
- evaluating whether challenge question distractors could realistically cause hesitation

Use this only as a second-review layer.
Gemini does not replace the local bank as source of truth.

#### Gemini collaboration rules

1. Reuse the existing Gemini tab in the logged-in browser.
2. Prefer `思考型` mode before asking for quality review.
3. Do not open a fresh login browser just for Gemini.
4. Do not send terminal-mangled Chinese into Gemini; read the bank from the UTF-8 file first.
5. Ask Gemini to review the bank as an independent reviewer, not to rewrite everything by default.
6. Treat Gemini findings as review signals:
   - `definite errors`
   - `likely issues`
   - `minor suggestions`
7. Only patch the local bank after comparing Gemini's claims against the actual bank and scope.
8. Do not read Gemini results with `body.innerText()` as the final method; capture only the latest model-response container.

#### Recommended Gemini review prompt structure

Ask Gemini to:
- respond in Traditional Chinese
- review one bank at a time
- cite question numbers when possible
- separate findings into `definite errors`, `likely issues`, and `minor suggestions`
- focus on:
  - scope match
  - answer correctness
  - duplicate or overly repetitive concepts
  - ambiguity for elementary students
  - difficulty balance
  - distractor quality: for each challenge question, evaluate whether each wrong option could realistically cause a student who partially understands the material to hesitate — flag any option that only a completely uninformed student would choose

#### How to use Gemini results

If Gemini reports:
- a likely wrong answer
- a scope mismatch
- repeated concepts across multiple questions

then re-check the local bank and either:
- fix the bank
- mark the issue for human review
- or explicitly reject Gemini's claim if the textbook scope supports the current question

Do not push a bank into Wayground just because Gemini says it looks fine.
The bank still has to pass the local validation gate in this skill.

#### Capturing Gemini's latest reply reliably

Use the repository script:

```powershell
node automation/gemini-capture-latest-response.js --out .\automation\output\gemini-latest-response.txt
```

This script:
- connects to the existing Gemini tab over CDP
- waits for the latest answer to stabilize
- captures only the latest model-response container
- saves the response as UTF-8 text

This is the preferred way to read Gemini review output back into the workflow.
Avoid using whole-page text dumps except for quick debugging.

### 3. Generate the quiz in Wayground

Run:

```powershell
npm.cmd run wayground:generate -- .\automation\question-banks\xxx.md --subject 數學 --grade 三年級 --count 30
```

What the script does:
1. goes to `/admin/assessment`
2. clicks the AI card
3. clicks `文字或提示`
4. pastes the entire bank
5. selects language, subject, grade, count
6. clicks generate

### 4. Handle subject-specific UI differences

Natural science may insert an extra intermediate flow:
- subtopics page
- `生成測驗`
- `使用此測驗`

The current generate script already handles this. If the page behaves differently, inspect the page state before changing the script.

### 5. Check generated output against the bank

Run:

```powershell
npm.cmd run wayground:check -- .\automation\question-banks\xxx.md
```

Review:
- `duplicateCount`
- `mismatchCount`
- `extraCount`
- displayed vs expected question count

Use the generated files in `automation/output/` as the audit trail.

### 6. Delete duplicate or broken questions if needed

Run:

```powershell
npm.cmd run wayground:delete -- 21,20,19
```

Rules:
- pass explicit question numbers
- delete from large to small
- rerun `wayground:check` after deletion

### 7. Set quiz language to Chinese

Run:

```powershell
npm.cmd run wayground:set-language
```

### 8. Set every question to 2 minutes

Run:

```powershell
npm.cmd run wayground:set-all-timers-2min
```

### 9. Publish

Run:

```powershell
npm.cmd run wayground:publish
```

Success means the page leaves `/edit` and the quiz is no longer a draft.

### 10. Collect share links and update grade pages

If needed, collect links from the library and update the target grade page.

Examples:
- `grade3/wayground.html`
- `grade6/wayground.html`

Each entry should clearly include:
- subject
- range
- question count
- Wayground link

## Suggested review sequence for high-stakes quiz work

Use this order when the quiz will be published for real class use:

1. First local validation by the working AI
2. Optional second review with Gemini in `思考型`
3. Local bank fixes
4. Final local re-check
5. Wayground generation and platform checks

This keeps content review in the local-bank stage and avoids expensive rework on live Wayground quizzes.

## Naming rules

Quiz titles must be identifiable in the Wayground library at a glance.

Use a format like:
- `六年級數學期中題庫（單元三～四）`
- `三年級國語期中題庫（一～三課）`
- `六年級社會期中題庫（2-1～2-3）`

Avoid vague titles with no grade or range.

## If a live quiz needs edits later

Use this decision rule:
- one small fix: direct Wayground edit is acceptable
- multiple content fixes: correct the local bank first and usually regenerate

After any live edit:
1. save
2. verify the page result visually
3. republish
4. confirm it is no longer a draft

## Commit and push

If repository files were changed:

```powershell
python C:\Users\user\projects\tools\preflight_guardrails.py
```

Then:
1. stage only relevant files
2. commit with a clear message
3. push

## Short command set

```powershell
npm.cmd run browser:smoke
npm.cmd run wayground:generate -- .\automation\question-banks\xxx.md --subject 數學 --grade 三年級 --count 30
npm.cmd run wayground:check -- .\automation\question-banks\xxx.md
npm.cmd run wayground:delete -- 21,20,19
npm.cmd run wayground:check -- .\automation\question-banks\xxx.md
npm.cmd run wayground:set-language
npm.cmd run wayground:set-all-timers-2min
npm.cmd run wayground:publish
python C:\Users\user\projects\tools\preflight_guardrails.py
```
