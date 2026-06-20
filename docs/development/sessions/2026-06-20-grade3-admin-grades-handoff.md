# Grade 3 Admin Grades Handoff

Date: 2026-06-20

Current agent: Codex

## Goal

Continue the Grade 3 semester grade processing/admin export work.

The user needs `admin-grades.html` to calculate Grade 3 term grades from existing `student_progress`, preview/edit the results, and export a New Taipei school administration `.xlsx` import workbook.

## Current State

Implemented files:

- `admin-grades.html`
- `shared/grade3-grading-config.js`
- `shared/grade3-grading.js`
- `supabase/grade3_grading.sql`
- `docs/development/sessions/2026-06-08-grade3-admin-grades-design-review.md`

Existing page entry:

- `admin-progress.html` has a link to `admin-grades.html`.

Supabase:

- User ran `supabase/grade3_grading.sql` successfully in Supabase SQL Editor.
- Dedicated RPC is installed: `admin_list_grade3_grading_data()`.

Confirmed school-system import:

- Browser-generated `.xlsx` import works in the New Taipei school administration system.
- All six Grade 3 worksheets imported successfully.
- `學期總分` numeric `85` displays as `85.0`.
- `努力程度` code `1` displays as `表現良好`.
- `文字描述` accepts Chinese text and UI shows max 200 chars.
- Therefore v1 should export `.xlsx`; no `.xls` helper is needed.

## Grade Rules

Exempt students:

- `30127`
- `30227`
- `30414`

Exempt rows stay in the template but D/E/F remain blank and they are excluded from PR calculations.

Component raw scores:

- `quizRaw = quizCorrect / 40`
- `typingRaw = typingPoints / 138`

PR:

- Calculate PR within the same class only.
- Exclude exempt students.
- Non-exempt students with missing progress remain in the class comparison with raw `0`.
- Ties should receive the same PR. Current implementation uses average-rank percentile.

Final formula:

```text
quizScore = 80 + quizPR * 20 / 100
typingScore = 80 + typingPR * 20 / 100
termScore = round(quizScore * 0.4 + typingScore * 0.6)
```

## Recent Bug: 30321 And Later Missing Progress

User observed that rows after `30321` showed `0 / 40`, `0 / 138`, and warning `沒有任何計分進度`.

Likely cause:

- Supabase REST/RPC default returns at most 1000 rows per request.
- `admin_list_grade3_grading_data()` returns profile rows plus progress rows.
- Around `30320`, the response hit the 1000-row cap, so later progress rows were truncated.

Fix already applied to `admin-grades.html`:

- Added `loadAllRpcRows(functionName, payload = {})`.
- It calls `supabase.rpc(...).range(from, to)` in 1000-row pages until all rows are fetched.
- Dedicated RPC and fallback RPC paths now both use this paged loader.

Verification performed before crash:

- `apply_patch` succeeded.
- Node REPL confirmed:
  - `async function loadAllRpcRows` exists.
  - dedicated RPC path uses `loadAllRpcRows("admin_list_grade3_grading_data")`.
  - fallback uses `loadAllRpcRows("admin_list_student_profiles")` and `loadAllRpcRows("admin_list_progress")`.

Still needs user/browser verification:

1. Reload `http://127.0.0.1:4173/admin-grades.html`.
2. Upload the Grade 3 school-system template.
3. Click `讀取並計算`.
4. Check whether `30321` and later rows now show real quiz/typing progress instead of false zeroes.

## Codex Sandbox / Crash Context

The user updated Codex on 2026-06-20 and then sandboxed commands started failing.

Initial sandbox errors:

- `write ACE grant failed on D:\projects\it-class-tcwu: SetNamedSecurityInfoW failed: 5`
- `read ACL run had errors` for `C:\Users\user\Intel`

Diagnosis:

- Repo owner/ACL required elevated ACL repair.
- User repaired ACLs and restarted Codex.
- After repair, sandbox setup logs showed:
  - `setup refresh ... errors=[]`
  - `setup binary completed`
  - `read ACL run completed`

Residual issue seen in the old/current thread:

- General sandbox shell runner still returned `CreateProcessAsUserW failed: 1312`.
- `apply_patch` worked.
- Node REPL worked.
- Some approved-prefix shell commands worked.

Codex then crashed with:

```text
code=3221225477
state db discrepancy during read_repair_rollout_path: upsert_needed (fast path)
target: codex_rollout::state_db
```

Action for next thread:

- First test whether normal shell commands work after the new Codex session starts:
  - `rg -n "loadAllRpcRows" admin-grades.html`
  - `cmd /c ver`
- If shell runner still returns 1312, continue using `apply_patch` and Node REPL for local file work, and tell the user the sandbox runner is still not fully healthy.

## Local Server

A local static server had been started earlier at:

`http://127.0.0.1:4173/admin-grades.html`

It may or may not still be running after the Codex crash/restart. If needed, restart a static server from repo root.

## Next Actions

1. Verify sandbox health in the new thread.
2. Verify `admin-grades.html` still contains the paged RPC loader.
3. Ask the user to reload the page and test whether `30321` and later rows now show progress.
4. If rows still show false zeroes:
   - inspect actual RPC row count and progress rows for a sample student after `30321`;
   - check whether `student_profiles.user_id` matches `student_progress.user_id`;
   - check whether activity keys and week codes match the config.
5. Once verified, consider adding a small status indicator to the page showing:
   - profile rows loaded
   - progress rows loaded
   - RPC source
   - whether pagination was used

## Prompt For New Conversation

Use this prompt to resume:

```text
請接手三年級成績處理後台工作。請先讀：

1. docs/development/agent-sync-state.json
2. 該 JSON 內的 session_file
3. docs/development/sessions/2026-06-08-grade3-admin-grades-design-review.md

目前重點：
- admin-grades.html 已實作三年級成績處理與 .xlsx 匯出。
- Supabase 專用 RPC admin_list_grade3_grading_data() 已部署成功。
- 使用者發現 30321 之後進度都變成 0，研判是 Supabase RPC/REST 每次最多 1000 rows 截斷。
- 已在 admin-grades.html 加入 loadAllRpcRows()，用 .range(from, to) 分頁抓完 dedicated RPC 與 fallback RPC。
- 請先確認檔案內仍有這個修正，然後協助我重新測 admin-grades.html。
- 也請先測 sandbox 是否恢復：rg -n "loadAllRpcRows" admin-grades.html；如果仍有 CreateProcessAsUserW failed: 1312，就回報 sandbox runner 還沒完全恢復，但 apply_patch/Node REPL 可能可用。

請不要重做整個功能，先接續驗證 30321 之後資料是否恢復。
```
