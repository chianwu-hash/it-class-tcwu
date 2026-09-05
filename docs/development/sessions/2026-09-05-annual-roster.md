# Annual Roster Preparation

## Confirmed Scope

- Default year: 115.
- Teaching classes: 301-306, 603, 604.
- Local candidate roster: 176 students (21, 21, 23, 22, 20, 22, 25, 22 respectively).
- Existing live profiles: 150, all in legacy classes 301-306. No email overlap with the candidate teaching roster.
- Retain login accounts, progress, drafts, and legacy profiles.

## Prepared Changes

- `supabase/student_enrollments.sql`: annual roster table with RLS, legacy 114 snapshot, teacher-only reader RPC. Email matches existing Auth users at read time; unregistered students remain pending. Does not create Auth users or overwrite legacy profiles.
- `automation/prepare-annual-roster.cjs`: generates the reviewed 115 roster import, with duplicate email and seat checks. Copies only name, email, class, seat, year. Generated personal data stays in ignored `automation/output/annual-roster-115/`.
- `admin-progress.html`: year selection, year-specific identities/classes, registered/pending counts, paged progress queries. Unclassified progress remains accessible through the class filter. Default view shows roster students when the annual roster is available.
- `automation/verify-annual-roster.cjs`: isolated browser fixture with synthetic students; verifies pending students, 1001-row pagination, 114/115 switching, and mobile width. Does not read or modify live progress.

## Deployment Status

User explicitly approved the live migration and 176-student import. Both SQL files were executed successfully in project `upxgyusodibaqcrocdzj` using the verified `chianwu-hash` dashboard account.

1. Year 114 retains 150 roster rows; legacy profiles still contain 150 rows.
2. Year 115 contains 176 rows in exactly the eight confirmed classes, with 23 matched Auth users and 153 pending.
3. RLS is enabled; anonymous and authenticated roles lack direct table SELECT privileges.
4. Supabase default privileges initially granted anon RPC execution independently of PUBLIC. Explicitly revoked anon execution in the live database and migration source; verified `anon_rpc_access = false`.
5. Under authenticated role with synthetic non-teacher JWT claims, the RPC returns zero rows. Test used a transaction ending in ROLLBACK.
6. Live local backend: year 115 displays 19 progress records; year 114 displays 1817. Both show correct year-specific class options without notices. Backend left on year 115.

Do not interpret pending accounts as absent progress without checking Auth matching. Do not delete old accounts: existing foreign keys cascade into progress and drafts. Frontend code is local only; website publishing is separate.

## Validation

- Import generation: 176 rows, unique emails and annual class/seat combinations.
- Browser fixture: passed year defaults, pending roster classes, >1000 progress rows, historical identity, mobile no overflow.
- Browser fixture uses synthetic auth; the week visibility warning in its screenshot is expected because no live token is supplied.
- SQL execution, live counts, permission checks, and year switching passed. Public frontend deployment has not been performed.
