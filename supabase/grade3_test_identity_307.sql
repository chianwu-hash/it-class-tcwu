-- Teacher test identity for grade3-115-1: class 307, seat 30.
-- The teacher's only school Google account is enrolled as 609-30 for Grade 6.
-- student_enrollments allows one class per school year and account, so the same
-- account is switched between 609 and 307 with test_identity_to_grade3.sql and
-- test_identity_to_grade6.sql. This file never changes the enrollment itself.
--
-- Function-only upgrade: the two trusted Grade 3 functions gain class 307 in
-- their roster list and nothing else. Real classes 301-306 keep every check.
-- Idempotent; safe to run again.
begin;
do $$
declare
 old_list constant text := $q$('301','302','303','304','305','306')$q$;
 new_list constant text := $q$('301','302','303','304','305','306','307')$q$;
 f record; d text; n integer;
begin
 if not exists(select 1 from pg_proc p join pg_namespace s on s.oid=p.pronamespace
   where s.nspname='public' and p.proname='reconnect_grade3_progress') then
   raise exception 'reconnect_grade3_progress is missing; deploy grade3_google_transition.sql first';
 end if;
 for f in select p.oid,p.proname from pg_proc p join pg_namespace s on s.oid=p.pronamespace
   where s.nspname='public' and p.proname in ('reconnect_grade3_progress','typing_foundation_action') loop
   d:=pg_get_functiondef(f.oid);
   if position(new_list in d)>0 then continue; end if;
   n:=(length(d)-length(replace(d,old_list,'')))/length(old_list);
   if n<>1 then raise exception '% has % roster lists, expected exactly 1; review before upgrading',f.proname,n; end if;
   execute replace(d,old_list,new_list);
 end loop;
 if exists(select 1 from pg_proc p join pg_namespace s on s.oid=p.pronamespace
   where s.nspname='public' and p.proname in ('reconnect_grade3_progress','typing_foundation_action')
     and position(new_list in pg_get_functiondef(p.oid))=0) then
   raise exception 'roster list upgrade incomplete';
 end if;
end $$;

-- Identity rows. The existing 307-30 class card keeps its name; the approval
-- copies it. test_identity_to_grade3.sql gives the enrollment the same name, so
-- enrollment, class card and approval agree whenever the account is in 307.
do $$
declare mail constant text := 'chianwu@apps.ntpc.edu.tw'; nm text; n integer;
begin
 if not exists(select 1 from public.student_enrollments e where e.school_year=115 and e.email=mail) then
   raise exception 'test account has no 115 enrollment';
 end if;
 if exists(select 1 from public.guest_progress g where g.course_id='grade3-115-1' and g.student_code='30730') then
   raise exception '30730 has historical guest progress; review before approving';
 end if;
 update public.class_card_students c set practice_account='chianwu',active=true
   where c.course_id='grade3-115-1' and c.class_code='307' and c.seat_no=30
   returning trim(c.display_name) into nm;
 get diagnostics n=row_count;
 if n<>1 or nm is null or nm='' then raise exception 'expected exactly one named 307-30 class card, found %',n; end if;
 insert into public.grade3_google_approvals(email,student_code,display_name,history_student_code,history_display_name)
   values(mail,'30730',nm,'30730',nm)
   on conflict(email) do update set display_name=excluded.display_name,history_display_name=excluded.history_display_name
   where public.grade3_google_approvals.student_code='30730' and public.grade3_google_approvals.history_student_code='30730';
 if not exists(select 1 from public.grade3_google_approvals a where a.email=mail and a.student_code='30730'
   and a.history_student_code='30730' and trim(a.display_name)=nm) then
   raise exception 'approval for the test account conflicts with an existing row';
 end if;
end $$;
commit;
