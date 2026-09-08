# Vercel Deployment Storage Plan

Date: 2026-09-08

## Situation

Vercel sent a limit warning for the Hobby team `chianwu-4755's projects`.
Dashboard inspection showed:

- Team usage period: 2026-08-09 07:00 to 2026-09-08.
- Deployment Storage: 16.41 GB.
- The warning threshold in the email: 10 GB included free tier usage.
- Main source: `it-class-tcwu`, 15.12 GB.
- Other projects are small: the next largest is `2027-japan-family-ski`, 629.82 MB.
- Function Storage is 98.42 MB, so this is not primarily a Function storage issue.
- Traffic and request usage are low.

The latest `it-class-tcwu` deployment Resources page showed 574 static assets. It also showed development files such as `/.editorconfig`, `/AGENTS.md`, and `/CLAUDE.md` inside the deployment. This suggests the current Vercel project is serving the repository root and preserving too much project-local material in every deployment.

## Likely Causes

1. `it-class-tcwu` is deployed as a static root project without a narrow output directory.
2. There is no `.vercelignore`, so development files and reference material can enter deployments if tracked by Git.
3. The repository currently contains large tracked reference files, especially under `docs/references/108-curriculum/subjects/`.
4. Repeated production deployments preserve separate copies of the static output until deployment retention removes them.

Measured tracked repository payload:

- All tracked files: about 133,483,254 bytes.
- Tracked `docs/references/**`: about 81,655,943 bytes.
- Tracked PNG images under `grade3`, `grade6`, and `assets`: about 43,578,046 bytes.

## Goals

Reduce Vercel Deployment Storage without breaking the live classroom site.

Keep these production behaviors:

- Root HTML pages remain reachable.
- `grade3/`, `grade6/`, `shared/`, and `assets/` continue to load.
- Admin pages continue to load.
- Lesson images used by public pages remain available.
- No student progress, auth, visibility, or unlock behavior is changed.

## Proposed Repo Changes Codex May Apply After Claude Consensus

1. Add `.vercelignore` with a conservative blocklist.

   Exclude development, automation, source-reference, temporary, and local-only material:

   ```text
   .git/
   .github/
   .githooks/
   .claude/
   .chat-mode/
   .vercel/
   .vscode/
   .idea/
   AGENTS.md
   CLAUDE.md
   README.md
   docs/
   automation/
   skills/
   project-modules/
   templates/
   textbooks/
   tmp/
   output/
   wayground/
   tools/
   chat-mode-skill/
   1/
   *.ps1
   *.bak
   *.tmp
   *.log
   ```

   Rationale: none of these should be served as classroom website assets. Public pages should reference deployed website assets, not development docs or textbook/source material.

2. Add a small local verification script or documented command that checks public HTML references against the `.vercelignore` candidates.

   Minimum check:

   - Parse local `.html`, `.css`, and `.js` files that are intended for public deployment.
   - Look for references to excluded root folders such as `docs/`, `automation/`, `textbooks/`, `tmp/`, `tools/`, and `skills/`.
   - Fail if a production page depends on an excluded path.

3. Document the operational follow-up:

   - After deploying the `.vercelignore` change, check Vercel deployment Resources for the next production deployment.
   - Confirm that `AGENTS.md`, `CLAUDE.md`, and `docs/references/**` no longer appear.
   - Check Deployment Storage again after retention cleanup.

## Vercel Dashboard Actions Requiring User Decision

These are not repo changes and should not be done automatically:

1. Shorten Deployment Retention for `it-class-tcwu`.
2. Manually delete older deployments, if retention is not enough or the warning is urgent.
3. Upgrade to Pro, only if retention and output cleanup are insufficient.

## Open Questions for Claude Review

1. Is the proposed `.vercelignore` blocklist safe for this repository's current static deployment style?
2. Should `README.md`, `tools/`, or `wayground/` be retained for any public route?
3. Is excluding all `docs/` safe, or are there public pages that link to docs assets?
4. Would a narrower Vercel project output strategy be safer than `.vercelignore` for this repo?
5. What should be implemented now versus left for the user to decide?

## Current Recommendation Before Claude Review

The likely first repo change is `.vercelignore` plus a dependency check. The likely Vercel-side decision is to shorten retention or manually delete older deployments after the next clean deployment proves the output is small.

## Claude Review Result

Chat-mode review session:

- Session: `20260907T225033Z-vercel-storage-review`
- Transport: Claude CLI supervisor, review mode, read-only
- Claude version: 2.1.233
- Response artifact: `.chat-mode/sessions/20260907T225033Z-vercel-storage-review/turn-0001.response.md`
- Result: completed, no Git mutation detected by the supervisor

Consensus:

1. Add `.vercelignore` as the first repo change.
2. Use a blocklist strategy, not an allowlist, because this static course site serves multiple root folders and future public routes may be added.
3. Add `.tmp/` to the original ignore proposal.
4. Add a local reference scanner before relying on the ignore list.
5. Leave Vercel dashboard actions to the user: shortening retention, manually deleting deployments, and upgrading to Pro.

Implemented from the consensus:

- Added `.vercelignore`.
- Added `automation/check-vercelignore-references.js`.
- Verified `node automation/check-vercelignore-references.js`.
- Verified `git ls-files 'tmp/**' '.tmp/**'` returns no tracked files.
- Verified `git diff --check -- .vercelignore automation/check-vercelignore-references.js docs/development/sessions/2026-09-08-vercel-deployment-storage-plan.md`.
- After deploying commit `51b805b`, Vercel Resources for the new production deployment showed Static Assets reduced from 574 to 182. `AGENTS.md`, `CLAUDE.md`, and `docs/references/**` were no longer visible in the first Resources listing. `/.editorconfig` was still visible, so `.editorconfig` and `.gitignore` were added to `.vercelignore` for the follow-up deployment.
- After deploying commit `54fcf07`, Vercel Resources for the production deployment showed Static Assets reduced to 181. The first Resources listing no longer showed `/.editorconfig`, `AGENTS.md`, `CLAUDE.md`, or `docs/references/**`.

Deferred decisions:

- Whether to shorten Deployment Retention in Vercel.
- Whether to manually delete old deployments.
- Whether to upgrade to Pro.
- Whether to rewrite Git history to remove already committed large blobs. This is not recommended as a first response and would require explicit approval.
