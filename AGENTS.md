# Codex Project Instructions

This repository is a course website for elementary information classes. Work carefully: classroom pages are used live, so a page that looks correct but breaks auth, progress, visibility, or unlock behavior is not acceptable.

## Required Reading

Before implementing or reviewing course pages, read these files:

- `docs/development/dev-sop.md`
- `docs/development/shared-modules.md`
- `docs/development/page-types.md`
- `docs/development/new-page-checklist.md`
- `docs/development/high-risk-changes.md`
- `docs/development/agent-handoff.md`

For new week pages, also read:

- `docs/development/prompt-template.md`

## Core Rules

- Do not hand-code navigation HTML. Use the grade `navbar.js` files and shared navbar modules.
- Do not bind navbar login, logout, or reset buttons directly in page code. Use `initNavbarAuth()`.
- Do not store student progress in `localStorage`. Use the shared progress modules, usually `initTypingChallenge()`.
- If a typing challenge is needed, use `levelsData` objects with `{ id, ans }`, not `{ id, answer }`.
- If a page has typing challenge progress, verify the `student_progress` write path, not just the visual UI.
- If requirements conflict with existing shared modules or page type contracts, stop and report the conflict before inventing a separate implementation.
- Prefer the newest same-type page as reference, but inspect its modules, auth flow, progress flow, and unlock behavior before copying structure.

## Project Skills And Workflows

- For ChatGPT browser-based image generation, read `skills/chatgpt-image-workflow/SKILL.md` first. This project has an npm wrapper: `npm run chatgpt:image-batch -- --cdp-url http://127.0.0.1:9333 --prompt-file <prompt.txt> ...`.
- For Chinese prompts on Windows, always use UTF-8 prompt files instead of inline PowerShell text.

## Collaboration With Claude Code

Use `docs/development/agent-handoff.md` as the shared handoff file between Codex, Claude Code, and the user.

When you need to hand work to Claude Code:

1. Update the handoff file with the goal, current state, files touched, blockers, and exact next action.
2. Do not ask Claude Code to infer hidden context from chat history.
3. Include file ownership if both agents may work in the repo.
4. After Claude Code works, read the handoff file and verify with `rg` or direct file inspection before accepting claims.

When receiving work from Claude Code:

1. Verify the actual file contents.
2. Prefer `rg` checks for required symbols, imports, activity keys, and forbidden patterns.
3. Do not rely only on natural-language summaries.

## Git Hygiene

- The worktree may contain unrelated untracked textbooks, images, or generated files. Do not stage or modify them unless the user asks.
- Stage only files that belong to the requested change.
- Never revert user changes without explicit permission.
- Do not amend commits unless explicitly requested.

