-- Self-service switch for the teacher's own school test account between
-- Grade 6 (609-30) and Grade 3 (307-30). Used by the switch on the two semester
-- home pages (shared/test-identity-switch.js). Requires
-- grade3_test_identity_307.sql. Every other account is rejected, and the
-- function can only write the two fixed rosters below.
--   p_grade null     -> report the current roster
--   p_grade 'grade3' -> 307-30 under the name on the 307-30 class card
--   p_grade 'grade6' -> 609-30 under the Grade 6 roster name
begin;
create or replace function public.switch_test_identity(p_grade text default null)
returns table(class_code text,seat_no smallint,display_name text)
language plpgsql security definer set search_path='' as $$
declare mail constant text := 'chianwu@apps.ntpc.edu.tw'; n integer;
begin
 if auth.uid() is null or not exists(select 1 from auth.users u
   where u.id=auth.uid() and u.email_confirmed_at is not null and lower(u.email)=mail) then
   raise exception 'not_test_account' using errcode='42501';
 end if;
 if p_grade is not null then
   if p_grade='grade3' then
     update public.student_enrollments e set class_code='307',display_name=trim(c.display_name)
     from public.class_card_students c
     where c.course_id='grade3-115-1' and c.class_code='307' and c.seat_no=30 and c.active
       and e.school_year=115 and e.email=mail and e.seat_no=30 and e.class_code in ('609','307');
   elsif p_grade='grade6' then
     -- The escaped literal reads "test student" in Chinese.
     update public.student_enrollments e set class_code='609',display_name=U&'\6E2C\8A66\5B78\751F'
     where e.school_year=115 and e.email=mail and e.seat_no=30 and e.class_code in ('609','307');
   else
     raise exception 'invalid_grade';
   end if;
   get diagnostics n=row_count;
   if n<>1 then raise exception 'test_identity_not_ready'; end if;
 end if;
 return query select e.class_code::text,e.seat_no::smallint,e.display_name::text
   from public.student_enrollments e where e.school_year=115 and e.email=mail;
end $$;
revoke all on function public.switch_test_identity(text) from public,anon;
grant execute on function public.switch_test_identity(text) to authenticated;
commit;
