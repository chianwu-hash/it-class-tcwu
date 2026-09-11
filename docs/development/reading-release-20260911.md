# Grade 6 homework portal and reading cards — 2026-09-11

## Functional contract

Production student entry is `grade6/115-1/homework.html`; teacher entry is `admin-homework.html`. Teacher-assigned file work comes first. The optional reading area uses the same violet/mint design, without missing-work counts or an embedded tree. The existing grade navbar remains the single tree entry.

`supabase/reading.sql` adds private reading tables and the authenticated `reading_action` RPC. Student access requires a confirmed Auth email matched to the 115 Grade 6 enrollment roster. Teachers must pass `is_teacher()` and own the selected period. Direct table access is revoked for browser roles; writes are transactional and use row locks. No service key or Drive file is used for reading text.

- Period uniqueness: course/semester + academic week. Each provided period has explicit dates; gaps remain gaps. Past provided periods stay editable unless the teacher pauses them.
- One current card per period/student, with immutable submitted payloads and a current-version pointer. Retrying the same submission UUID is idempotent; an obsolete retry cannot restore an old pointer.
- Reviews target the latest version and expected review sequence. Pass/retry/retract and text feedback cannot silently overwrite a newer version or review.
- File submissions and reading cards earn one submission leaf plus one current-pass leaf. Resubmission/retraction/retry removes the second leaf; passing restores it. No new flowers. Typing and flower-color rules are unchanged.
- Reading rewards are derived from current submissions, not event counts; unshared optional periods do not create tree activities.
- Account changes close dialogs, clear data, discard stale responses and reload after an outstanding request. Repeated same-user auth events do not force refresh.

## Course content

- Grade 6 Week 02 includes the school HyRead library and parent/student platform, textbook P22–28 steps, submission guidance and five language-text typing levels.
- Removed the duplicate submission button and the oral peer-sharing block. Reading cards carry the voluntary reading response.
- Homepage includes the new S092 online textbook link; Week 02 is registered in navigation, admin progress and reward-tree typing activities.
- Lesson and lesson-writing SOP retain the requirement to identify language-text sources.

## Deployment

- Applied `supabase/reading.sql` through the logged-in Supabase SQL editor for project `upxgyusodibaqcrocdzj`. Visible account verified as `chianwu-hash / chianwu@gmail.com`; SQL returned success.
- Teacher production interface successfully configured Week 02 for 2026-09-07 through 2026-09-13. No future/holiday periods were generated. Future week dates are configured by the teacher according to the academic calendar.
- Reading is separate from the existing Drive Edge function. This release also commits the previously verified homework review/thumbnail dependencies used by the production portal.
- The main-branch push publishes the frontend through the repository deployment connection. See Git history for the release commit.

## Verification

1. `node --test automation/tests/reading.test.mjs automation/tests/homework.test.mjs automation/tests/homework-sql.test.mjs automation/tests/homework-review.test.mjs`: 11 passing tests. Includes real PostgreSQL execution via PGlite, browser-role denial, roster isolation, overlapping periods, skipped weeks, backfill, retry conflicts, stale reviews, immutable history, retract/resubmit and two-leaf derivation; existing upload/auth/review tests pass.
2. `node automation/tests/reading-browser.cjs`: actual production HTML/modules against an isolated PGlite database, with fixture auth/API interception in a separate shared AI-browser tab. Tested sharing, old-week backfill, teacher pass, feedback, retract, resubmission, both versions/history, logout data removal, and 1440/1024/390-width layout. No real student records were written.
3. `node automation/tests/homework-browser.cjs`: anonymous/student restrictions, 9 MB video interrupted after 4 MB and resumed, reloaded submission status, teacher quick review, two-leaf calculation, unchanged typing rewards, no same-user refocus refresh, and mobile layout.
4. Module and inline JavaScript syntax checks; five `{id, ans}` entries; required course/week/activity identifiers; library link; removed duplicate/oral-share block; no page-level localStorage progress.
5. Live authenticated teacher page loaded both the existing Drive assignment and reading RPC. Read-only real-session smoke check; no real student submission or review was changed for testing.

Browser tests require the shared AI browser on port 9232, the existing local CDP runtime, and the project HTTP server on port 8126 for the reading test. PGlite follows the existing SQL-test dependency location under `%TEMP%/codex-drive-validation`. Screenshots are local verification artifacts under `tmp/`, not release assets. Tablet tests check responsive browser layout; physical iPad/stylus behavior was not retested in this reading change.

## Ownership / handoff

Codex is the only implementation writer for this release. Claude's earlier read-only design discussion is recorded separately. Unrelated working-tree assets and automation changes are deliberately excluded. Next routine action: teacher configures further academic-week reading periods as needed.

## Follow-up: file drop area

The student file selector now has a large, full-width 190px minimum drop area. A native file input preserves keyboard/touch/file-picker support. Dropping selects one file and displays its name/size; the student still presses the upload button. Multi-file, unsupported-format, empty and oversized files are rejected. Custom drops cannot replace files while an upload is busy. Existing resumable upload and server validation remain in use.

`automation/tests/homework-browser.cjs` passed file-picker change, drag highlight/drop, multi-file/format rejection, no auto-upload and busy selection lock, followed by the existing 9 MB interruption/resume and teacher review regression. Browser screenshot inspected; no live student records changed.
