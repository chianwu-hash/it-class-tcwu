# week06 Quiz Minimal Integration Plan

Date: 2026-03-18
Branch: refactor/site-foundation

## Goal
Move grade3 week06 quiz flow to `shared/quiz-module.js` with the smallest possible blast radius.

## Constraints
- Do not rewrite large Chinese inline script blocks in one pass.
- Do not change quiz content, scoring rules, or UI layout.
- Do not change typing challenge, email task, or surrounding page structure.
- Preserve existing Supabase table usage:
  - week_code = "06"
  - activity_key = QUIZ_KEY
  - current_level = 5
  - completed = true
  - score = quiz score

## Current Stable State
- week06 auth already uses `shared/auth.js`.
- week06 typing already uses `shared/typing-challenge.js`.
- week06 quiz still uses page-local logic.
- `shared/quiz-module.js` is validated by `docs/refactor/quiz-sandbox.html`.

## Integration Boundary
Only replace these local quiz responsibilities:
- render quiz questions
- option selection
- unanswered guard
- score calculation
- result rendering
- completed-state rendering

Keep these hooks page-local:
- `loadQuizProgress()`
- `saveQuizProgress(score)`
- `getQuizUser()`
- `handleWeek06AuthUpdate(session)`
- week06-specific quiz messages and result text

## Required Mapping
Map current week06 DOM to quiz module selectors:
- lock -> `quiz-lock`
- content -> `quiz-content`
- container -> `quiz-container`
- statusBanner -> `quiz-status-banner`
- statusText -> `quiz-status-text`

Map current week06 data to module questions:
- `quizRawData[].q` -> `questionHtml`
- `quizRawData[].opts` -> `options`

## Required Messages Override
week06 must override all user-facing strings instead of relying on module defaults.
Required keys:
- `questionLabel`
- `submitButton`
- `submittedButton`
- `unansweredAlert`
- `scoreLabel`
- `completedBanner`
- `unauthenticated`
- `resultMessages.perfect`
- `resultMessages.great`
- `resultMessages.good`
- `resultMessages.retry`

## Safe Migration Steps
1. Add `import { initQuizModule } from "../shared/quiz-module.js"` to week06 module script.
2. Keep `quizRawData`, `loadQuizProgress`, `saveQuizProgress`, and `getQuizUser` intact.
3. Introduce `const quiz = initQuizModule(...)` using week06 hooks and messages.
4. Replace `renderQuiz()` calls with `quiz.render()` or `quiz.handleAuthChange(...)`.
5. Keep `window.selectOption` and `window.submitQuiz`, but make them thin wrappers to the module.
6. Remove page-local quiz state only after wrappers work:
   - `selectedBtns`
   - `quizSubmitted`
   - `quizRendered`
   - `showQuizCompletedState()` implementation if fully covered by module
7. Test before any cleanup commit.

## Test Spec For This Integration
1. Unauthenticated state:
   - quiz lock is visible
   - login button still works
2. After login:
   - quiz unlocks
   - questions render
3. Option selection:
   - clicked option gets selected styling
   - switching option in same question updates selection
4. Submit guard:
   - cannot submit if unanswered questions remain
5. Submission:
   - score appears
   - result message appears
   - buttons become disabled
6. Persistence:
   - completed state and score return after reload
7. Regression guard:
   - typing challenge still works
   - email block still renders
   - no new mojibake in visible Chinese text

## Stop Conditions
Abort and revert immediately if any of these happen:
- visible Chinese UI text becomes `?` or mojibake
- quiz result area loses correct score rendering
- typing challenge regresses
- save/load to Supabase fails

## Recommendation
Do the integration in one small edit session using `apply_patch` only.
Do not use shell-based search/replace for Chinese literals.
