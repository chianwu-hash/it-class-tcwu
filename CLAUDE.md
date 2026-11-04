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

## 發布與資料庫規則（2026-11-04 起，優先於任何舊文件或舊對話中的發布方式）

`main` 是正式網站與資料庫函式的唯一來源。完整步驟見 `docs/development/dev-sop.md`「發布規則：只從 main 發布」。

- **開始工作**：一律先 `git fetch`，從最新 `origin/main` 開新分支／新 worktree。不要在主工作區 `D:\projects\it-class-tcwu` 直接改檔，也不要沿用舊 worktree 或舊分支繼續發布。
- **進 main**：修改經 PR 合併進 `main`；不可直接 push 到 `main`。
- **只從 main 發布**：部署來源必須是 `main` 的乾淨 checkout，用 Vercel CLI 上傳。舊的凍結發布包、功能分支、有未 commit 修改的目錄都不能部署。`main` 已關閉 Vercel Git 自動部署（`vercel.json` 的 `git.deploymentEnabled.main: false`），不得移除；GitHub 上 Vercel 預覽顯示失敗是預期的。
- **一次一個發布**：部署或 promote 前，先在 `docs/development/agent-handoff.md` 頂部「發布登記」新增一列「發布中」；表上已有別人「發布中」就停止並問使用者。完成、失敗或放棄都要更新狀態。
- **promote 前比對**：以當下正式部署為基準，用 `automation/quiz-release-compare.mjs <正式樹> <候選樹> <預期修改檔...> --added … --removed … --eol-dir <部署目錄>` 比對完整檔案樹，必須 `ok: true`；promote 前再確認正式部署 ID 沒變。
- **資料庫函式**：改函式要寫成 `supabase/` 下的 SQL 檔，經使用者同意後才套用到正式庫；套用後執行 `node automation/db-schema-snapshot.mjs` 與 `node automation/db-snapshot-check.mjs --live`，通過後把 `supabase/production-snapshot/` 一併 commit。不可單獨重跑 `supabase/quiz-order-fix.sql`（會蓋掉 `quiz_action` 的學習包裝層）。
- **公開 repo**：不 commit 課本 PDF、學生資料、權杖、`*.private.json` 或私有輸出。

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

