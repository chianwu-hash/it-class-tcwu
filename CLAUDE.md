# Claude Code Project Instructions

This repository is a course website used in live elementary information classes. The priority is not only visual completion, but reliable classroom behavior: auth, progress records, unlock states, week visibility, and teacher backend checks must work.

## Required Reading

Before implementing or reviewing course pages, read:

- `docs/development/dev-sop.md`
- `docs/development/shared-modules.md`
- `docs/development/page-types.md`
- `docs/development/new-page-checklist.md`
- `docs/development/high-risk-changes.md`
- `docs/development/agent-handoff.md`

For new week pages, also read:

- `docs/development/prompt-template.md`

## Non-Negotiable Rules

- Do not hand-code nav HTML. Use the grade navbar files and shared navbar modules.
- Do not attach direct event listeners to navbar login, logout, or reset buttons. Use `initNavbarAuth()`.
- Do not use `localStorage` for student progress.
- Typing challenge pages must use `initTypingChallenge()` and write progress through the standard `student_progress` flow.
- Typing challenge `levelsData` must use `{ id, ans }`.
- Include the canvas-confetti CDN when using `initTypingChallenge()`.
- If a request conflicts with shared modules or page type contracts, stop and report the conflict instead of creating a parallel implementation.
- Verify claims against actual files with grep/search before reporting completion.

## Collaboration With Codex

Use `docs/development/agent-handoff.md` as the shared workspace between Claude Code, Codex, and the user.

When handing off to Codex:

1. Write the current goal and the exact next action.
2. List changed files and files intentionally left untouched.
3. Note validation already done and validation still needed.
4. Note any conflict with the SOP or shared modules.

When receiving Codex feedback:

1. Check the referenced files directly.
2. Use grep/search before accepting or rejecting a claim.
3. If Codex appears to be looking at stale information, update the handoff file with the exact grep evidence.

## Recommended Completion Report

At the end of a task, report:

- Page type and reference page used
- Shared modules used
- `weekCode` and `activityKey`, if applicable
- Files changed
- Verification performed
- Known residual risk or items not tested

