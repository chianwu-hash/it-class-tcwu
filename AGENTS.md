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

處理考古題來源、轉錄、審查或發布（含其他學校）時，另讀：

- `docs/development/past-exam-playbook.md`：現行製作流程；政策變更時優先於舊案例報告。
- `docs/development/past-exam-job-template.md`：由執行者填寫的任務及證據範本，不是逐題教師簽核關卡。

考古題製作須同步完成解析、學習重點與書商配題的處理／複核紀錄並固定版本；學生線上只讀固定資料，不即時呼叫 AI。缺可靠配題如實標記，不硬配、不冒稱已可練習。正式能力以現有 schema／adapter 為準，不把本機單題 MVP 當通用已上線功能。

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

## 發布與資料庫規則（2026-11-04 起，優先於任何舊文件或舊對話中的發布方式）

`main` 是正式網站與資料庫函式的唯一來源。完整步驟見 `docs/development/dev-sop.md`「發布規則：只從 main 發布」。

- **開始工作**：一律先 `git fetch`，從最新 `origin/main` 開新分支／新 worktree。不要在主工作區 `D:\projects\it-class-tcwu` 直接改檔，也不要沿用舊 worktree 或舊分支繼續發布。
- **進 main**：修改經 PR 合併進 `main`；不可直接 push 到 `main`。
- **只從 main 發布**：部署來源必須是 `main` 的乾淨 checkout，用 Vercel CLI 上傳。舊的凍結發布包、功能分支、有未 commit 修改的目錄都不能部署。`main` 已關閉 Vercel Git 自動部署（`vercel.json` 的 `git.deploymentEnabled.main: false`），不得移除；GitHub 上 Vercel 預覽顯示失敗是預期的。
- **一次一個發布**：部署或 promote 前，先在 `docs/development/agent-handoff.md` 頂部「發布登記」新增一列「發布中」；表上已有別人「發布中」就停止並問使用者。完成、失敗或放棄都要更新狀態。
- **promote 前比對**：以當下正式部署為基準，用 `automation/quiz-release-compare.mjs <正式樹> <候選樹> <預期修改檔...> --added … --removed … --eol-dir <部署目錄>` 比對完整檔案樹，必須 `ok: true`；promote 前再確認正式部署 ID 沒變。
- **資料庫函式**：改函式要寫成 `supabase/` 下的 SQL 檔，經使用者同意後才套用到正式庫；套用後執行 `node automation/db-schema-snapshot.mjs` 與 `node automation/db-snapshot-check.mjs --live`，通過後把 `supabase/production-snapshot/` 一併 commit。不可單獨重跑 `supabase/quiz-order-fix.sql`（會蓋掉 `quiz_action` 的學習包裝層）。
- **公開 repo**：不 commit 課本 PDF、學生資料、權杖、`*.private.json` 或私有輸出。

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

