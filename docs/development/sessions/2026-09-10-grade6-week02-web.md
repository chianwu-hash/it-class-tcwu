# Grade 6 Week 02 course page completion

## Scope and contract

- User paused homework-system development and requested completing the Week 02 course page after rereading the development SOP.
- Page: `grade6/115-1/week02.html`; type C (typing challenge with lesson instructions); reference: `grade6/115-1/week01.html`.
- Existing lesson contract: `grade6/LessonPlan/115-1/Week 02.md`.
- Course `grade6-115-1`, week `02`, activity `typing_task_5`, five levels; authenticated progress goes through shared `initTypingChallenge` to `student_progress`. Manual drafts remain in the shared `typing_drafts` flow.
- Navbar uses grade navbar and `initNavbarAuth`; no page-specific login/logout/reset handlers. Existing homepage Week 02 card, navbar activeWeeks and admin five-level mapping are retained.
- No new task-completion gate: typing is positioned as a task after submission, without adding an unrequested database-dependent unlock.
- Four task sections use native details/summary, open by default. No new infographic required for these sequential instructions.

## Changes

- Added a reading walkthrough, direct Canva entry, detailed textbook text-template editing and class-name formatting steps.
- Added PNG download-folder guidance and submission / teacher feedback / resubmission-history guidance.
- Corrected lesson font spelling to the original p.26 screenshot: `可画方糖体-繁`.
- Added default disabled typing inputs/buttons so module-loading failure cannot leave active controls without authentication.
- Preserved all five existing language-text exercises and shared module integration; added a concise explanation of the progression from Week 01.

## Verification (2026-09-10)

- Required development documents and lesson-to-web SOP reviewed before the implementation, including the existing lesson's functional contract.
- S092 lesson 1 Markdown checked; original p.22, p.24 and p.26 images inspected for image category, scrolling, corner handles, template editing order and font spelling.
- Language passages retained from the previously approved lesson. Original 115 first-semester language textbook pages were not available in the local reference collection; their exact source transcription was not newly verified. The prior Claude review also checked agreement with the lesson, not original language textbook pages.
- Official reading platform entry `https://pts.ntpc.edu.tw/` responds; authenticated resource navigation remains teacher-led.
- JavaScript syntax, four balanced disclosure sections, five `{id, ans}` entries, no page-level localStorage progress, and admin `02:typing_task_5 = 5`: passed.
- Shared AI browser, localhost origin without login: five inputs disabled, login control present, correct locked message; four disclosures open by default; collapse/reopen passed.
- Desktop 1366×900 and mobile 390×844: no horizontal document overflow. Desktop screenshot inspected (`tmp/week02-desktop.png`).
- Live localhost-server page at 127.0.0.1, visibly signed in as teacher `chianwu@gmail.com`: checked that no preexisting Week 02 progress or drafts existed, tested incorrect answer hint, completed level 1 through the page's checkLevel handler, read persisted level 2 from Supabase with the correct course/week/activity, reloaded and confirmed resume at level 2.
- Removed only the newly created teacher test progress row with exact owner/course/week/activity/level/completed filters; deletion returned one row. No student progress was modified.
- Full five-level completion, OAuth login/logout round trip, and live student-account testing were not rerun in this content update.

## Result / next action

Local page is open in the shared AI Work Browser at `http://127.0.0.1:8126/grade6/115-1/week02.html` for user review. This update has not been deployed. Homework-system files and unrelated working-tree changes were left intact.
