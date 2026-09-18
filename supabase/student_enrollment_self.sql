-- Student-safe annual roster lookup for the currently authenticated account.
-- Returns at most one row and never accepts another user's id or email.
begin;

create or replace function public.get_my_student_enrollment(p_school_year smallint)
returns table (
    school_year smallint,
    email text,
    class_code text,
    seat_no smallint,
    display_name text,
    student_code text
)
language sql
stable
security definer
set search_path = ''
as $$
    select e.school_year,
           e.email,
           e.class_code,
           e.seat_no,
           e.display_name,
           e.class_code || lpad(e.seat_no::text, 2, '0')
    from public.student_enrollments e
    join auth.users u
      on u.id = auth.uid()
     and u.email_confirmed_at is not null
     and lower(u.email) = e.email
    where auth.uid() is not null
      and e.school_year = p_school_year
    limit 1;
$$;

revoke all on function public.get_my_student_enrollment(smallint) from public, anon;
grant execute on function public.get_my_student_enrollment(smallint) to authenticated;

commit;
