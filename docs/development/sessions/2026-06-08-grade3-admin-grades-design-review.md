# Grade 3 Admin Grades Export Design Review

## Goal

Design a Grade 3 "成績處理" admin workflow that converts existing course-site records into a New Taipei City school administration grade import workbook.

This is a design review only. Do not implement yet.

## User Need

The teacher needs to:

1. Use existing `student_progress` records as the source for Grade 3 information class grades.
2. Produce values for the New Taipei school administration score import module.
3. Fill these fields in the school-system template:
   - 學期成績
   - 努力程度
   - 文字描述
4. Leave roster-only / experimental-education students blank.

Known exempt student codes:

- `30127`
- `30227`
- `30414`

## Template Facts

The provided template is:

`D:/Downloads/成績管理匯出入檔_吳重謙_20260608.xls`

It is a real BIFF/OLE `.xls`, not an HTML disguised file.

It contains 6 worksheets:

1. `三年一班資訊教育(A08_13_00)`
2. `三年二班資訊教育(A08_13_00)`
3. `三年三班資訊教育(A08_13_00)`
4. `三年四班資訊教育(A08_13_00)`
5. `三年五班資訊教育(A08_13_00)`
6. `三年六班資訊教育(A08_13_00)`

Each worksheet has the same shape:

- Row 1:
  - A1: `114學年度第2學期`
  - D1: class/subject label, for example `三年一班資訊教育科`
  - F1: import identifier, for example `114_2_301_A08_13_00`
- Row 2:
  - A2:C2 merged-ish header: `基本資料`
  - D2: `學期成績`
  - E2: `努力程度`
  - F2: `文字描述`
- Row 3:
  - A3: `座號`
  - B3: `姓名`
  - C3: `性別`
- Student rows start at row 4.
- Student rows contain A/B/C and blank D/E/F.
- Final two rows are notes:
  - `努力程度選項為半形數字>> 1:表現良好 2:表現尚可 3:需再加油 。`
  - `能力指標選項為半形數字>> 1:已達到 2:普通程度 3:需再努力 。`

Student counts:

- 301: 26 students, row 4-29. `30127 黃詠欣` is row 29 and should be left blank.
- 302: 25 students, row 4-28.
- 303: 26 students, row 4-29.
- 304: 26 students, row 4-29.
- 305: 24 students, row 4-27.
- 306: 24 students, row 4-27.

Only columns D/E/F should be filled. Columns A/B/C and template metadata should be preserved.

## Existing Data Model

`student_profiles` exists in `supabase/student_profiles.sql` and includes:

- `user_id`
- `email`
- `class_code`
- `seat_no`
- `display_name`
- `student_code`
- `role`

`student_code` is generated as:

```text
class_code + LPAD(seat_no, 2)
```

Example:

```text
class_code = 301
seat_no = 27
student_code = 30127
```

`student_progress` exists in `supabase/student_progress.sql` and includes:

- `user_id`
- `week_code`
- `activity_key`
- `current_level`
- `completed`
- `score`
- `updated_at`

Current admin RPCs:

- `admin_list_student_profiles(p_class_code, p_search)`
- `admin_list_progress(p_week_code, p_activity_type, p_search, p_completed)`

The current admin progress RPC returns rows, not a joined full-grade dataset.

## Existing Grade Rules

Source: `docs/development/grade3-grading-rules.md`

The grade system has two independent component scores:

1. 資訊素養答題成績
2. 中英打闖關成績

Both scores use `student_progress` only. Do not use `localStorage` or visual page state.

The site should not write calculated grade results back to the database. It should preview and export.

### Quiz Score

Count included quiz activities from a grade config. For each included quiz:

```text
quiz component = total correct answers / total question count * 100
```

Missing or unfinished quiz after final settlement counts as 0 correct, while its question count remains in the denominator.

Do not hard-code total question count as 5 unless the grade config explicitly says so.

### Typing Score

Typing activities use triangular points:

```text
level 1 = 1 point
level 2 = 2 points
level 3 = 3 points
...
N levels max = N * (N + 1) / 2
```

Passed levels:

```text
completed = true  -> passed levels = totalLevels
completed = false -> passed levels = current_level - 1
missing row       -> passed levels = 0
```

Clamp passed levels to `[0, totalLevels]`.

Current Grade 3 typing config has 9 five-level activities and 1 two-level activity:

```text
9 * 15 + 3 = 138 points
```

The old sample text in `grade3-grading-rules.md` saying `108 點` is only a stale example; the current source-of-truth config is 138.

## Proposed Grade Config

Create a dedicated shared grade config, rather than relying directly on reward-tree display config:

`shared/grade3-grading-config.js`

Suggested fields:

```js
export const GRADE3_GRADING_CONFIG = {
  grade: "grade3",
  schoolYear: "114",
  semester: "2",
  subjectCode: "A08_13_00",
  quiz: [
    { weekCode: "06", activityKey: "safety_quiz_1", title: "...", totalQuestions: 5, counted: true },
    ...
  ],
  typing: [
    { weekCode: "04", activityKey: "typing_task_2", title: "...", totalLevels: 5, counted: true },
    ...
  ],
  defaultWeights: {
    quiz: 50,
    typing: 50
  },
  effortThresholds: [
    { minScore: 85, effort: "1" },
    { minScore: 70, effort: "2" },
    { minScore: 0, effort: "3" }
  ],
  exemptStudents: [
    { studentCode: "30127", name: "黃詠欣", reason: "實驗教育／掛名學生" }
  ]
};
```

For v1, prepopulate known exempt student codes and allow the teacher to edit the list before calculation/export. Exempt rows stay in the workbook roster, but D/E/F remain blank and the students are excluded from class PR calculations.

## Proposed Calculation Output Per Student

For every student in the template roster:

- `studentCode`
- `classCode`
- `seatNo`
- `nameFromTemplate`
- `nameFromProfile`
- `userId`
- `email`
- `profileMatchStatus`
- `isExempt`
- `quizCorrect`
- `quizTotal`
- `quizScore`
- `typingPoints`
- `typingTotal`
- `typingScore`
- `termScore`
- `effort`
- `description`
- `warnings`

Recommended term score:

```text
quizRaw = quiz correct answers / 40
typingRaw = typing points / 138

quizPR = quizRaw PR within the same class, excluding exempt students
typingPR = typingRaw PR within the same class, excluding exempt students

quizScore = 80 + quizPR * 20 / 100
typingScore = 80 + typingPR * 20 / 100

termScore = round(quizScore * 0.4 + typingScore * 0.6)
```

Default weights:

- quiz: 40%
- typing: 60%

PR should be calculated within each class, not across all Grade 3 students. Missing progress for a non-exempt student counts as raw `0` and participates in PR. Exempt students are removed from both PR numerator/ranking and denominator.

Tie handling should assign the same PR to students with the same raw value. Use an average-rank percentile or another explicitly documented tie-safe method; never let array order give same-score students different PR.

Important: earlier rules kept quiz and typing separate. Producing one `學期成績` is an export-layer decision. The v1 default is now explicitly quiz 40% and typing 60%.

## Proposed Effort and Description Rules

Effort uses the template's half-width numeric codes:

- `1`: 表現良好
- `2`: 表現尚可
- `3`: 需再加油

Default mapping:

- `termScore >= 85`: `1`
- `termScore >= 70`: `2`
- otherwise: `3`

This should be teacher-editable before export.

文字描述 should be generated from component signals, but teacher-editable. Suggested v1 templates:

- high: `能穩定完成資訊素養測驗與中英打闖關，學習態度良好。`
- mid: `能完成多數資訊課學習任務，若能持續補齊未完成活動會更完整。`
- low: `資訊課學習任務仍有未完成項目，建議持續練習並補齊進度。`
- exempt: blank

Open design question: whether descriptions should be generic and short to fit the import system, or whether the system accepts longer text. Need user/system confirmation before final wording.

## Proposed Admin Page

New page:

`admin-grades.html`

Chinese title:

`成績處理`

Keep separate from `admin-progress.html` because this workflow is roster/export oriented, not activity-row oriented.

### UI Sections

1. Template import / template status
   - For web-only implementation, browser cannot directly write local `.xls`; use file input and output a generated workbook/download.
   - Show detected worksheets/classes and row counts.

2. Grade settings
   - Quiz weight
   - Typing weight
   - Settlement mode:
     - preview mode: optionally compute with current completed items
     - final mode: missing included items count as 0 / current typing points
   - Effort thresholds

3. Exempt students
   - Default list includes `30127`, `30227`, and `30414`.
   - Allow teacher to add/remove by `student_code`.
   - Export leaves D/E/F blank for exempt rows.

4. Review table
   - One row per template student.
   - Show class/seat/name, profile match, quiz, typing, term score, effort, description.
   - D/E/F values editable before export.
   - Warnings column for missing profile, name mismatch, no progress, incomplete activities.

5. Export
   - Download completed import workbook.
   - Also download audit CSV/JSON if useful.

## Template Export Strategy

Critical implementation question: browser-side support for legacy `.xls`.

Options:

1. Client-side `.xlsx` output only
   - Easiest technically with modern libraries.
   - Risk: New Taipei import module may require `.xls` exactly.

2. Preserve `.xls` template using server/CLI/offline helper
   - Python `xlrd` can read `.xls`, but writing `.xls` while preserving formatting usually needs `xlwt`/`xlutils` or Excel COM/LibreOffice.
   - In browser, this is not straightforward.

3. Browser reads template and outputs tabular CSV per sheet
   - Risk: import system likely expects workbook shape, not CSV.

4. Admin page exports a JSON/CSV calculation file, and local Codex/CLI fills the `.xls`
   - Useful for now, but not fully self-service in the website.

Design recommendation for v1:

- Use admin page for calculation, review, and export-ready data.
- Generate an `.xlsx` workbook matching the template layout if the school system accepts `.xlsx`.
- If the school system requires `.xls`, add a teacher-only/local helper script that fills the original `.xls` template from exported JSON. Confirm with an actual test import before relying on `.xlsx`.

Open question for Claude: Is a static site able to preserve and output `.xls` safely without adding backend/build-time helper dependencies?

## Data Access Design

For the page, prefer a new teacher-only RPC to avoid many client-side calls:

`admin_list_grade3_grading_data()`

Potential return rows:

- all Grade 3 student profiles
- all included `student_progress` rows for included Grade 3 activities

Alternative: use current RPCs and aggregate in JS:

- call `admin_list_student_profiles(null, null)`
- call `admin_list_progress(null, null, null, null)`
- filter client-side to Grade 3 and included activity keys

For v1, current RPCs may be enough but could over-fetch and rely on string filtering. A dedicated RPC is cleaner and easier to audit.

Security:

- Must require `is_teacher()`.
- Must not expose all students to normal students.
- Must not write calculated grades to DB.

## Validation Rules

Before export, block or warn on:

- Template class sheet has no matching `class_code`.
- Student row cannot match `student_profiles.student_code`.
- Template name differs from profile name.
- Multiple profiles share same student code.
- Non-exempt student has no progress rows.
- Grade config total does not match expected quiz/typing totals.
- Typing total points should show `138` under current config.
- Effort is not `1`, `2`, or `3`.
- Term score is outside `0-100`.
- Exempt student has nonblank D/E/F.

## Known Risks / Questions For Claude

1. Should v1 implement `.xls` export in the browser, or should we design `.xlsx` first and require an import test?
2. Do we need a dedicated grading RPC immediately, or is current `admin_list_student_profiles` + `admin_list_progress` safe enough?
3. Should exempt students live in code config, in an editable local admin setting, or in the database?
4. Are `50/50` quiz/typing weights acceptable as a default design, given the existing rules only kept the two component scores separate?
5. Should the final `學期成績` be integer only, or preserve one decimal? The template cell is blank and likely expects a normal score.
6. Should `文字描述` be auto-generated, or default blank with suggestions only?
7. Are there risks from using template name matching when student names may contain variant characters?
8. What implementation pitfalls are likely around old `.xls` format, static hosting, Supabase RPC permissions, or browser file downloads?

## Claude CLI Review Summary

Claude CLI completed a design review on 2026-06-08.

Full local output:

`tmp/claude-grade3-admin-grades-review-20260608.txt`

Verdict:

```text
Conditional GO for v1.
```

Claude agreed the calculation model, data model, and admin-page structure are sound, but identified two blockers before implementation:

1. `.xls` / `.xlsx` import compatibility must be tested against the real New Taipei school administration system before choosing the export architecture.
2. The Grade 3 grading activity list and quiz question counts must be verified against the actual week pages before writing `shared/grade3-grading-config.js`.

Important recommended changes:

- Use a dedicated teacher-only RPC such as `admin_list_grade3_grading_data()` for production, not broad `admin_list_progress(null, null, null, null)` plus client filtering.
- Match template rows by `student_code` derived from worksheet class code + seat number, not row position or name.
- Use `student_code` as the primary match key; compare names only as an audit warning, with Unicode normalization.
- Store default weights as fractions or normalize percentages in formula; `50` must mean `50 / 100`.
- Show component scores to one decimal in the review UI, but default `學期成績` export to integer unless decimal import is tested.
- Use `sessionStorage` for the exempt-student list in v1; prepopulate known defaults but avoid exposing persistent exemption reasons in public source if possible.
- Read and preserve worksheet F1 import identifiers from the uploaded template; never regenerate them from code.
- Preserve footer note rows and row counts exactly in the exported workbook.
- Write `學期成績` as a numeric cell and `努力程度` as half-width `1`, `2`, or `3`.
- Confirm `文字描述` length limit through test import.

Claude's suggested pre-implementation checklist:

1. Test `.xlsx` import into the New Taipei school administration system with a sample file.
2. If `.xlsx` fails, test browser-generated `.xls`; if that fails, use a local helper path for filling the original `.xls`.
3. Verify the 8 quiz and 10 typing activities against actual deployed week pages.
4. Confirm all `totalQuestions` values from actual quiz definitions.
5. Confirm `文字描述` field character limit.
6. Confirm whether `學期成績` accepts integer only or decimal.
7. Specify and implement `admin_list_grade3_grading_data()` with `is_teacher()` enforcement.
8. Then implement in order: grade config, RPC, pure calculation engine, review table, export.

## 2026-06-08 Blocker Resolution Status

### Resolved: Grade 3 Activity List And Totals

Verified against actual source files, not only old docs:

Quiz activities:

| Week | Activity key | Source file | Questions |
| --- | --- | --- | ---: |
| 06 | `safety_quiz_1` | `grade3/week06.html` (`quizRawData`) | 5 |
| 07 | `privacy_quiz_1` | `grade3/week07.html` | 5 |
| 11 | `etiquette_quiz_1` | `grade3/week11.quiz-adapter.js` | 5 |
| 12 | `media_literacy_quiz_1` | `grade3/week12.html` | 5 |
| 13 | `internet_addiction_quiz_1` | `grade3/week13.html` | 5 |
| 14 | `phishing_safety_quiz_1` | `grade3/week14.html` | 5 |
| 15 | `screen_time_quiz_1` | `grade3/week15.html` | 5 |
| 16 | `copyright_cc_quiz_1` | `grade3/week16.html` | 5 |

Current quiz denominator: `40` questions.

Typing activities are verified from `shared/reward-tree-config.js`:

| Week | Activity key | Levels | Max points |
| --- | --- | ---: | ---: |
| 04 | `typing_task_2` | 5 | 15 |
| 05 | `typing_task_3` | 5 | 15 |
| 06 | `typing_task_4` | 5 | 15 |
| 07 | `typing_task_5` | 5 | 15 |
| 10 | `typing_task_2` | 2 | 3 |
| 12 | `typing_task_5` | 5 | 15 |
| 13 | `typing_task_5` | 5 | 15 |
| 14 | `typing_task_5` | 5 | 15 |
| 15 | `typing_task_5` | 5 | 15 |
| 16 | `typing_task_5` | 5 | 15 |

Current typing denominator: `138` points.

Implementation implication: `shared/grade3-grading-config.js` can safely use these values as the first checked source of truth, with a validation check that warns if future source files diverge.

### Resolved: Import File Compatibility

The New Taipei school administration import module was tested by the user on 2026-06-08:

- The generated `.xlsx` imported successfully.
- All six Grade 3 worksheets reported import success.
- Testing `.xls` is no longer required for v1.
- The school system displays imported `學期總分` as `85.0` from numeric `85`, so numeric score cells are accepted.
- The school system accepts `努力程度` code `1` and displays `表現良好`.
- The school system UI shows `文字描述` placeholders with `上限200字`, so v1 descriptions should stay within 200 characters.

Implementation implication: v1 can use a browser-generated `.xlsx` export matching the uploaded template shape. A legacy `.xls` local-helper path is unnecessary unless a future school-system change rejects `.xlsx`.

Local import-test artifacts created:

- `tmp/grade-import-tests/grade3-sample-filled.xlsx`
- `tmp/grade-import-tests/grade3-sample-filled.xls`

Both files were generated from a copy of the original template. Verification passed:

- 6 worksheets preserved.
- Per-sheet used row counts and F1 import identifiers match the source template.
- Row 4 on every worksheet contains test values in D/E/F: score `85`, effort `1`, and a nonblank Chinese description.
- First-sheet row 29, matching the known `30127` roster-only case, remains blank in D/E/F.

### Import Test Record

Test date: 2026-06-08

Tester: user, in the New Taipei school administration system grade import module.

Test file:

`tmp/grade-import-tests/grade3-sample-filled.xlsx`

Imported worksheets:

| Worksheet | Result shown by school system |
| --- | --- |
| 三年一班資訊教育科 | 匯入成功 |
| 三年二班資訊教育科 | 匯入成功 |
| 三年三班資訊教育科 | 匯入成功 |
| 三年四班資訊教育科 | 匯入成功 |
| 三年五班資訊教育科 | 匯入成功 |
| 三年六班資訊教育科 | 匯入成功 |

Observed imported values in the school system:

- `學期總分`: numeric `85` from the workbook is displayed as `85.0`.
- `努力程度`: code `1` is accepted and displayed as `表現良好`.
- `文字描述`: imported Chinese description is accepted.
- `文字描述` input placeholder shows `請輸入文字描述(上限200字)`.
- The worksheet-level import result view reports success for every Grade 3 class.

Decision from this test:

- Use `.xlsx` as the v1 export format.
- Do not build a legacy `.xls` export/helper path for v1.
- Export `學期成績` as numeric cells.
- Export `努力程度` as half-width numeric codes `1`, `2`, or `3`.
- Keep generated `文字描述` at or below 200 characters.

## 2026-06-08 V1 Implementation Notes

Initial v1 implementation files:

- `admin-grades.html`
- `shared/grade3-grading-config.js`
- `shared/grade3-grading.js`
- `supabase/grade3_grading.sql`

The existing `admin-progress.html` header now links to `admin-grades.html`.

Implemented behavior:

- Upload and parse the New Taipei grade import workbook.
- Match roster rows by `student_code`.
- Load Grade 3 profiles and counted progress rows.
- Prefer `admin_list_grade3_grading_data()` when installed.
- Fall back to `admin_list_student_profiles()` plus `admin_list_progress()` if the dedicated RPC has not been deployed yet.
- Calculate quiz and typing raw scores, class PR values, component scores, and final term score.
- Use quiz 40% and typing 60%.
- Prepopulate exempt students: `30127`, `30227`, `30414`.
- Exempt rows remain blank in D/E/F and are excluded from PR.
- Preview all roster rows with warnings for missing profiles, name mismatches, missing progress, or duplicate student codes.
- Allow teacher edits to `學期成績`, `努力程度`, and `文字描述` before export.
- Export `.xlsx` with only D/E/F filled; A/B/C, sheet names, F1 identifiers, and footer rows are preserved from the uploaded workbook.

Deployment note:

- Apply `supabase/grade3_grading.sql` to enable the dedicated teacher-only RPC.
- The page still works through fallback RPCs before that SQL is deployed, but the dedicated RPC is the preferred production path.
