# Deployment Checklist

Use this checklist after copying the module into a new project.

## Files copied

- [ ] `automation/*.js` copied to `automation/`
- [ ] `PACKAGE_SCRIPTS_SNIPPET.json` scripts merged into `package.json`
- [ ] `docs/workflow/README.md` exists
- [ ] `docs/workflow/AI_DEPLOY_PROMPT.md` exists
- [ ] `docs/workflow/END_TO_END_FLOW.md` exists
- [ ] `docs/workflow/TEXTBOOK_TO_BANK_SOP.md` exists
- [ ] `docs/workflow/DISTRACTOR_SELF_REVIEW.md` exists
- [ ] `docs/workflow/WORKFLOW_SOP.md` exists
- [ ] `docs/workflow/question-bank-quality-spec.md` exists
- [ ] `docs/workflow/tooling.md` exists
- [ ] `prompts/` copied to `docs/workflow/prompts/templates/`
- [ ] `templates/wayground-quizzes.sample.json` copied to `templates/`

## Project setup

- [ ] `project.config.md` created from `PROJECT_CONFIG_TEMPLATE.md`
- [ ] `automation/question-banks/` exists
- [ ] `automation/output/gemini-reviews/` exists
- [ ] `docs/references/textbooks/` exists
- [ ] `docs/references/exams/` exists, if using exam-style calibration
- [ ] `wayground/` or the target quiz entry page folder exists
- [ ] Playwright installed

## Browser setup

- [ ] Chrome is opened with remote debugging on port `9222`
- [ ] User is already logged into Wayground in that Chrome profile
- [ ] User is already logged into Gemini if Gemini review will be used
- [ ] `npm.cmd run browser:smoke` succeeds
- [ ] `npm.cmd run wayground:inspect` succeeds when the logged-in browser is ready

## Textbook to bank trial

- [ ] A small textbook excerpt is placed in `docs/references/textbooks/`
- [ ] A 5 to 10 question sample bank is generated in `automation/question-banks/sample.md`
- [ ] Local validation is completed
- [ ] `docs/workflow/DISTRACTOR_SELF_REVIEW.md` is applied to difficult and high-risk medium questions
- [ ] Gemini second review is completed when required
- [ ] Any review findings are resolved in the local bank

## Wayground trial

- [ ] `npm.cmd run wayground:import -- .\automation\question-banks\sample.md --subject <subject> --lang Chinese --grade <grade>` succeeds
- [ ] `npm.cmd run wayground:check -- .\automation\question-banks\sample.md` succeeds
- [ ] `npm.cmd run wayground:set-all-timers-2min` succeeds
- [ ] `npm.cmd run wayground:publish` succeeds
- [ ] Quiz link is recorded
- [ ] Target quiz entry page is updated

## Portability check

- [ ] No source-project absolute paths remain in copied workflow docs
- [ ] No old grade, school, or exam-scope assumptions remain unless intentionally configured
- [ ] All final report paths are target-project paths
