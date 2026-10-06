-- TEMPLATE ONLY: teacher/DB owner runs after comparing the original Week 02–05
-- roster to the 115 enrollment email, name and seat. Never infer identity from
-- current seat alone. This file does NOT approve any student by default.
-- Install grade3_google_transition.sql first to freeze old writes, then review.
-- If seats changed, names coincide or formal rows already exist, handle those
-- students individually. Never delete formal rows to make an import pass.
-- Maintenance contract (not executable repair instructions):
-- * Seat changes: independently verify the same email/user_id and historical
--   source. In one DB-owner transaction update current student_code/name in the
--   approval and current student_code in the binding, together with the official
--   roster. Preserve user_id, history_student_code, import ledger and progress.
--   Check unique ownership of both old/new seats. Never delete a binding merely
--   to repeat the import; a leftover ledger correctly blocks that operation.
-- * An accidentally deleted binding: restore the original reviewed binding from
--   its backup/audit for the SAME user/email/history. Do not delete the ledger.
--   An account/user_id replacement requires a separately reviewed migration of
--   binding and formal rows; it is not an ordinary student reconnect.
-- * Invalid frozen source: stop student activity and preserve restricted before/
--   after backups. A DB owner must prepare a separate, person-scoped maintenance
--   transaction with a table write lock; if source correction is justified,
--   temporarily disable ONLY grade3_guest_frozen, make reviewed changes, restore
--   it before committing and rerun preflight. Do not deploy this automatically.
--   Already-imported people need formal progress repair, not source reimport.
-- * An approved legacy typing row may have score NULL normalized during first
--   import. Keep the approved ORIGINAL snapshot as evidence; restoring the
--   original binding avoids comparing it again. Never clear audit for convenience.

-- For EACH verified historical identity, replace the fictional parameters and
-- uncomment only after teacher review. approved_at records the review timestamp.
-- insert into public.grade3_google_approvals(email,student_code,display_name,history_student_code,history_display_name)
-- values('verified-school-account@apps.ntpc.edu.tw','30102','現在姓名','30101','歷史姓名');

-- When genuine preexisting formal rows were independently reviewed, record the
-- exact approved JSON snapshot, limited to the identified authenticated user:
-- update public.grade3_google_approvals a
-- set reviewed_existing_progress = coalesce((
--   select jsonb_agg(to_jsonb(p)) from public.student_progress p
--   join auth.users u on u.id=p.user_id
--   where p.course_id='grade3-115-1' and lower(u.email)=a.email
-- ),'[]'::jsonb)
-- where a.email='verified-school-account@apps.ntpc.edu.tw';

-- Read-only deployment gate: expected 129 verified rows for the original six
-- classes, subject to the teacher's current official roster, not a hard-coded quota.
select count(*) as teacher_verified_identities from public.grade3_google_approvals;
select g.student_code as unreviewed_history_code,count(*) as source_records
from public.guest_progress g left join public.grade3_google_approvals a on a.history_student_code=g.student_code
where g.course_id='grade3-115-1' and a.email is null group by g.student_code order by g.student_code;
