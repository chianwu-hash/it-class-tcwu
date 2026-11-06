-- Index currently published grade-wide teacher papers, including sources added after the pilot import.
-- Existing paper keys, immutable versions, rooms, answers and awards are retained.
begin;
set local lock_timeout='3s';set local statement_timeout='120s';
do $sync$
declare sid uuid;
begin
 for sid in select s.id from public.quiz_sessions s join public.quiz_versions v on v.id=s.version_id
 where s.access_mode='practice' and s.status='open' and s.library_visible and s.school_year=115
 and v.document#>>'{catalog,volume}' ~ '^[3469]年級'
 and not exists(select 1 from public.quiz_generated_papers g where g.session_id=s.id)
 and not exists(select 1 from public.quiz_learning_sessions l where l.session_id=s.id)
 and partner_pilot.self_document_ok(v.document)
 order by s.id for share of s
 loop perform partner_pilot.import_teacher_library_session(sid);end loop;
end $sync$;
commit;
