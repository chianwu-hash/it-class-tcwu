# Admin Student Profiles Integration Plan

## Round 1 - Codex

Goal: prepare a detailed, reversible implementation plan before changing the teacher admin student identity feature. The user explicitly asked us to discuss this with Claude CLI first, reach consensus, then report back before implementation.

Current state verified by Codex:

- `docs/admin-roadmap.md` says the teacher admin currently depends too much on email and should show class, seat number, student name, and optional email.
- `docs/student-profiles-spec.md` defines the `student_profiles` model, including `user_id`, `email`, `class_code`, `seat_no`, `display_name`, `student_code`, `role`, and `updated_at`.
- `supabase/student_profiles.sql` already exists. It creates `student_profiles`, indexes, RLS policies, `refresh_student_code`, `student_profiles_set_defaults`, `admin_list_student_profiles`, and `admin_upsert_student_profile`.
- `supabase/student_progress.sql` keeps `student_progress` as the canonical progress table and `admin_list_progress` as the existing admin progress RPC.
- `admin-progress.html` already contains some profile-aware UI logic:
  - `formatStudentIdentity(row)` uses `studentProfilesByUserId` and falls back to `row.email`.
  - `loadStudentProfiles()` calls `admin_list_student_profiles`.
  - `filterProgressRows()` searches profile fields and falls back to email/activity fields.
  - The class filter is populated from loaded profiles.
- `docs/HANDOFF.md` is stale: it says profile UI is not yet connected, but `admin-progress.html` appears to have at least partial profile display/search integration.

Files touched in this planning round:

- `docs/development/sessions/2026-05-15-admin-student-profiles-plan.md`
- `docs/development/agent-sync-state.json`

No code or SQL implementation files should be changed in this planning round.

## Proposed Implementation Plan

### Guiding safety principle

`student_progress` remains the only source of truth for progress. `student_profiles` is an additive display and lookup layer only. If any profile path fails, the admin page must continue to work with the old email-based display.

### Stage 0: Baseline and inventory

Before edits:

1. Create or confirm a dedicated branch.
2. Record `git status --short` because the worktree has many unrelated local changes.
3. Capture current backend contracts:
   - `admin_list_progress(text, text, text, boolean)`
   - `admin_reset_progress(uuid, text, text)`
   - `admin_list_student_profiles(text, text)`
   - `admin_upsert_student_profile(uuid, text, smallint, text, text)`
4. Record current `admin-progress.html` behavior:
   - teacher login gate
   - progress list load
   - email fallback display
   - reset-progress button still targets `row.user_id`, `row.week_code`, `row.activity_key`
   - week visibility controls still load

Exit criteria:

- We know exactly which files belong to this change.
- No unrelated dirty worktree files are staged or edited.
- Existing admin progress list behavior is understood before any new edit.

Rollback for Stage 0:

- No rollback needed; it is read-only inventory.

### Stage 1: Verify and harden SQL contract without changing progress queries

Tasks:

1. Review `supabase/student_profiles.sql` for idempotency and permissions.
2. Confirm `student_profiles` policies do not expose all students to students.
3. Confirm teacher reads/writes go through security definer RPCs.
4. Confirm `admin_list_progress` does not need to join `student_profiles` in the first implementation pass.
5. Add SQL comments or a separate migration note only if needed; do not modify `student_progress`.

Exit criteria:

- `student_profiles` can be created safely.
- Teacher can list profiles through RPC.
- Teacher can upsert profiles through RPC.
- Existing `admin_list_progress` contract remains unchanged.

Rollback for Stage 1:

- If SQL deployment fails before completion, stop and do not change frontend.
- If new profile RPCs fail but existing progress RPC still works, keep the admin on email fallback and fix the SQL in a separate small change.
- If profile policies or functions break existing admin behavior, revert only the profile SQL migration or redeploy the previous known-good SQL definitions for affected functions.
- Never drop or rewrite `student_progress` as part of rollback.

### Stage 2: Frontend integration as optional enhancement

Tasks:

1. Keep `admin_list_progress` as the data source for progress rows.
2. Load profiles separately with `admin_list_student_profiles`.
3. Treat profile loading failure as non-fatal:
   - log the failure
   - clear `studentProfilesByUserId`
   - render progress rows with email fallback
4. Ensure student cell display priority is:
   - `student_code display_name`
   - fallback `profile.email`
   - fallback `row.email`
   - final fallback label such as unnamed student
5. Keep email visible in the secondary line when available.
6. Keep reset button data attributes based on progress row identifiers, not profile identifiers.
7. Keep pagination and week visibility controls independent from profile loading.
8. Add a lightweight warning only if useful, but do not block the table when profiles fail.

Exit criteria:

- With profiles loaded, teacher sees class/seat/name information.
- With profiles missing, teacher still sees email and can use existing progress controls.
- With profile RPC failure, the progress table still loads.
- Reset progress still calls `admin_reset_progress` with the same identifiers as before.

Rollback for Stage 2:

- Primary rollback: revert the frontend commit that adds profile display/search logic.
- Secondary rollback: introduce a front-end feature flag such as `ENABLE_STUDENT_PROFILES = false` if we want a one-line emergency disable.
- Since `admin_list_progress` remains unchanged, rollback restores pure email display without touching data.

### Stage 3: Search and filter behavior

Tasks:

1. Keep server-side progress filtering limited to stable existing fields unless we intentionally update `admin_list_progress`.
2. For the first pass, apply profile search and class filtering client-side after loading all progress rows.
3. Define expected behavior when profile data is missing:
   - class filter will only show classes that exist in loaded profiles
   - email/activity search continues to work
   - rows without profiles are hidden by class filter because class is unknown
4. Consider server-side profile join only as a later optimization if data volume requires it.

Exit criteria:

- Search by student name, student code, class code, seat number, email, and activity key works.
- Rows without profiles are still findable by email/activity key.
- Class filter behavior is documented and not confused with missing progress.

Rollback for Stage 3:

- Disable profile-based search/filter and keep only existing server-side filters.
- Leave display fallback intact if it is stable.

### Stage 4: Profile data entry and import

Tasks:

1. Do not start with a full admin editing UI.
2. Seed or upsert a small controlled test set first.
3. Validate:
   - `student_code` auto-generates from `class_code + LPAD(seat_no, 2, '0')`
   - `user_id` matches the correct Auth user
   - email in profile matches or intentionally mirrors Auth email
4. Only after small-sample verification, plan CSV import or admin edit UI as a separate change.

Exit criteria:

- 1 to 3 test students display correctly in admin.
- Incorrect profile rows can be corrected without touching progress.

Rollback for Stage 4:

- Delete or update bad `student_profiles` rows only.
- Do not delete `auth.users`.
- Do not delete `student_progress`.
- If profile data quality is unreliable, clear the profile table and fall back to email display.

### Stage 5: Documentation and handoff cleanup

Tasks:

1. Update stale handoff/docs that currently say UI is not connected if implementation is verified.
2. Document profile fallback behavior.
3. Document that `student_progress` must not be rewritten or migrated for this feature.
4. Add a short verification checklist for future agents.

Exit criteria:

- A future agent can tell what is implemented, what is intentionally deferred, and how to roll back.

Rollback for Stage 5:

- Documentation changes can be reverted independently.

## Verification Plan

Static checks:

1. `rg -n "student_profiles|admin_list_student_profiles|student_code|display_name|class_code|seat_no" admin-progress.html supabase docs`
2. `rg -n "localStorage|student_progress|admin_list_progress|admin_reset_progress" admin-progress.html shared grade3 grade6 supabase`
3. Confirm no course page writes profile data.

Manual admin checks:

1. Teacher login works.
2. Non-teacher login is rejected from admin data.
3. Progress rows load when profiles exist.
4. Progress rows load when profiles are absent.
5. Progress rows load when `admin_list_student_profiles` fails.
6. Student display shows `student_code display_name` when available.
7. Secondary display includes class, padded seat number, and email when available.
8. Search works by name, student code, seat number, email, and activity key.
9. Class filter works for known profiles.
10. Reset progress still deletes only the selected progress row.
11. Week visibility controls still load and toggle.

Database checks:

1. A student can read only their own profile.
2. A student cannot list all profiles.
3. Teacher RPC can list profiles.
4. Teacher RPC can upsert profiles.
5. `student_progress` rows are unchanged by profile upserts.

## Deferred Items

- Full student profile edit UI.
- CSV import.
- Activity catalog integration.
- Score calculation.
- Rewriting `admin_list_progress` to join profile data server-side.
- Replacing teacher email allowlist with profile-based role management.

## Main Risks

1. `admin_list_student_profiles` failure blocks the whole admin table if not isolated.
2. Wrong `user_id` mapping displays one student's name on another student's progress.
3. Profile RLS accidentally lets students see all profile rows.
4. Search/filter changes hide rows unexpectedly.
5. Existing reset-progress controls accidentally switch from progress identifiers to profile identifiers.
6. Stale docs lead future agents to duplicate or reverse already implemented work.

## Questions for Claude CLI

Please review this plan before implementation.

1. Is the stage ordering safe enough for a live classroom admin page?
2. Should the first implementation keep `admin_list_progress` unchanged and load profiles separately, or should it move immediately to a server-side left join?
3. Is a frontend feature flag for profile display worth adding as an emergency rollback switch?
4. Are the current `student_profiles` RLS policies too permissive because students can insert/update their own profile, despite the spec saying the first version should be teacher-maintained?
5. What additional verification would you require before touching `admin-progress.html`?
6. Do you see any rollback gap that could still leave the teacher without a usable progress table?

## Round 2 - Claude CLI Review

Claude CLI agrees with the overall stage order: inventory, SQL hardening, optional frontend integration, search/filter behavior, controlled profile data entry, and documentation cleanup. It flagged four required amendments before implementation.

Required amendments:

1. Stage 1 must drop the student self-insert and self-update profile policies.
   - `students_can_insert_own_profile` and `students_can_update_own_profile` contradict the first-version teacher-maintained model.
   - They allow students to corrupt `class_code`, `seat_no`, and `display_name`.
   - The trigger currently reads `auth.users`; student self-insert/update is not a reliable supported path anyway.

2. Stage 1 rollback must name the exact emergency SQL objects to remove.

   ```sql
   drop table if exists public.student_profiles cascade;
   drop function if exists public.refresh_student_code(text, smallint);
   drop function if exists public.student_profiles_set_defaults();
   drop function if exists public.admin_list_student_profiles(text, text);
   drop function if exists public.admin_upsert_student_profile(uuid, text, smallint, text, text);
   ```

3. Stage 2 must include a mandatory frontend feature flag.

   ```js
   const PROFILES_ENABLED = true;
   ```

   The flag should make emergency disable fast without SQL changes or a full revert.

4. Stage 3 must not silently hide progress rows that lack a profile when the class filter is active.
   - Preferred behavior: include an explicit unclassified option for rows with no profile/class.
   - Acceptable alternative: disable class filtering when profiles fail to load and show a clear admin notice.

Claude CLI also agrees that the first pass should keep the current two-query approach:

- `admin_list_progress` remains unchanged.
- `admin_list_student_profiles` loads separately.
- The frontend merges profile data client-side and falls back to email if profile loading fails.

Claude CLI does not recommend moving to a server-side profile join in the first pass because that would change the progress RPC return contract and add SQL deployment risk.

## Round 3 - Codex Consensus

Codex agrees with Claude CLI's amendments. The implementation should not start until the plan below is treated as the final baseline.

### Final Agreed Plan

1. Keep `student_progress` and `admin_list_progress` as the canonical progress path.
2. Treat `student_profiles` as an optional display/search layer.
3. First harden SQL:
   - keep student read-own-profile if useful
   - remove student insert/update profile policies
   - keep teacher writes through `admin_upsert_student_profile`
   - keep teacher reads through `admin_list_student_profiles`
4. Add the exact SQL rollback script before deploying SQL.
5. Add a mandatory frontend `PROFILES_ENABLED` flag before relying on profile display.
6. Keep profile loading non-fatal:
   - failure clears the profile map
   - progress table still loads by email
   - reset-progress still uses `row.user_id`, `row.week_code`, and `row.activity_key`
7. Keep profile-aware search client-side in the first pass.
8. Do not let class filtering hide unknown-profile rows silently:
   - add an unclassified bucket/option, or
   - disable the class filter with a visible notice if profile data is unavailable
9. Seed only a few controlled profile rows before broader data entry.
10. Defer CSV import, full edit UI, activity catalog, scores, and server-side profile joins.

### Final Rollback Plan

Frontend rollback:

1. Emergency in-class disable: set `PROFILES_ENABLED = false`.
2. If needed, revert only the frontend commit that added profile display/search/filter behavior.
3. Expected result after rollback: admin progress table returns to email display because `admin_list_progress` is unchanged.

SQL rollback:

1. If profile SQL breaks profile-only behavior but not progress, leave the admin on email fallback and fix SQL separately.
2. If profile SQL creates a broader incident, run the exact rollback script:

   ```sql
   drop table if exists public.student_profiles cascade;
   drop function if exists public.refresh_student_code(text, smallint);
   drop function if exists public.student_profiles_set_defaults();
   drop function if exists public.admin_list_student_profiles(text, text);
   drop function if exists public.admin_upsert_student_profile(uuid, text, smallint, text, text);
   ```

3. Never drop or rewrite `student_progress`.
4. Never delete `auth.users`.
5. Bad or mismatched profile data should be fixed by updating/deleting `student_profiles` rows only.

### Implementation Gate

Before touching implementation files, verify:

1. The worktree status and intended file list are recorded.
2. Current `admin-progress.html` profile-related changes are understood because the working tree already has local modifications.
3. The SQL policy change is explicit: no student self-insert/self-update profile policies in the first version.
4. The frontend flag and unclassified class-filter behavior are included in the planned patch.
5. Tests/manual checks include profile success, profile absence, profile RPC failure, reset progress, and week visibility controls.
