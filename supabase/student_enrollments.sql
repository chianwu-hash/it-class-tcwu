begin;

-- Annual rosters are independent of login accounts and historical progress.
create table if not exists public.student_enrollments (
    school_year smallint not null check (school_year between 100 and 999),
    email text not null check (email = lower(trim(email)) and position('@' in email) > 1),
    class_code text not null check (class_code ~ '^[1-6][0-9]{2}$'),
    seat_no smallint not null check (seat_no between 1 and 99),
    display_name text not null,
    primary key (school_year, email),
    unique (school_year, class_code, seat_no)
);

alter table public.student_enrollments enable row level security;
revoke all on public.student_enrollments from anon, authenticated;

-- Preserve the legacy roster; future imports never overwrite student_profiles.
insert into public.student_enrollments (school_year, email, class_code, seat_no, display_name)
select 114, lower(trim(coalesce(p.email, u.email))), p.class_code, p.seat_no,
       coalesce(p.display_name, '')
from public.student_profiles p
join auth.users u on u.id = p.user_id
where p.role = 'student' and p.class_code is not null and p.seat_no is not null
on conflict (school_year, email) do nothing;

create or replace function public.admin_list_student_enrollments(p_school_year smallint)
returns table (
    school_year smallint,
    user_id uuid,
    email text,
    class_code text,
    seat_no smallint,
    display_name text,
    student_code text,
    role text
)
language sql
security definer
set search_path = public, auth
as $$
    select e.school_year, u.id, e.email, e.class_code, e.seat_no, e.display_name,
           e.class_code || lpad(e.seat_no::text, 2, '0'), 'student'::text
    from public.student_enrollments e
    left join auth.users u on lower(u.email) = e.email
    where public.is_teacher() and e.school_year = p_school_year
    order by e.class_code, e.seat_no, e.email;
$$;

revoke all on function public.admin_list_student_enrollments(smallint) from public, anon;
grant execute on function public.admin_list_student_enrollments(smallint) to authenticated;

commit;
