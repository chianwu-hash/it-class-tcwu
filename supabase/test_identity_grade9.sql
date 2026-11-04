-- Extend the existing test-account-only switch to Grade 9 (922-30).
-- Preserve Grade 3/4/6, the current enrollment, progress, grants and auth checks.
begin;
do $guard$ declare h text;begin
 select md5(pg_get_functiondef('public.switch_test_identity(text)'::regprocedure)) into h;
 if h='ff4a40f65e7236d148a0d3ef28b348cf' then return;end if;
 if h<>'0843c8b40e1042515c2be56446bba07e' then raise exception 'test_identity_source_changed';end if;
 execute $definition$CREATE OR REPLACE FUNCTION public.switch_test_identity(p_grade text DEFAULT NULL::text)
 RETURNS TABLE(class_code text, seat_no smallint, display_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare mail constant text:='chianwu@apps.ntpc.edu.tw'; n integer; target_class text; target_name text;
begin
 if auth.uid() is null or not exists(select 1 from auth.users u
  where u.id=auth.uid() and u.email_confirmed_at is not null and lower(u.email)=mail) then
  raise exception 'not_test_account' using errcode='42501';
 end if;
 if p_grade is not null then
  if p_grade='grade3' then
   target_class:='307';
   select trim(c.display_name) into target_name from public.class_card_students c
    where c.course_id='grade3-115-1' and c.class_code='307' and c.seat_no=30 and c.active;
  elsif p_grade='grade4' then target_class:='407';target_name:=U&'\5433\5C0F\8B19';
  elsif p_grade='grade6' then target_class:='609';target_name:=U&'\5433\5C0F\8B19';
  elsif p_grade='grade9' then target_class:='922';target_name:=U&'\5433\5C0F\8B19';
  else raise exception 'invalid_grade';end if;
  if target_name is null then raise exception 'test_identity_not_ready';end if;
  update public.student_enrollments e set class_code=target_class,display_name=target_name
   where e.school_year=115 and e.email=mail and e.seat_no=30 and e.class_code in('307','407','609','922');
  get diagnostics n=row_count;
  if n<>1 then raise exception 'test_identity_not_ready';end if;
 end if;
 return query select e.class_code::text,e.seat_no::smallint,e.display_name::text
  from public.student_enrollments e where e.school_year=115 and e.email=mail;
end $function$
$definition$;
end $guard$;
notify pgrst,'reload schema';
commit;
