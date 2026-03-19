create table if not exists public.student_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    email text,
    class_code text,
    seat_no smallint check (seat_no is null or seat_no between 1 and 99),
    display_name text,
    student_code text,
    role text not null default 'student' check (role in ('student', 'teacher')),
    updated_at timestamptz not null default now()
);

create index if not exists student_profiles_class_code_idx
on public.student_profiles (class_code);

create index if not exists student_profiles_student_code_idx
on public.student_profiles (student_code);

create index if not exists student_profiles_email_idx
on public.student_profiles (email);

alter table public.student_profiles enable row level security;

drop policy if exists "students_can_read_own_profile" on public.student_profiles;
create policy "students_can_read_own_profile"
on public.student_profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "students_can_insert_own_profile" on public.student_profiles;
create policy "students_can_insert_own_profile"
on public.student_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "students_can_update_own_profile" on public.student_profiles;
create policy "students_can_update_own_profile"
on public.student_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.refresh_student_code(
    p_class_code text,
    p_seat_no smallint
)
returns text
language sql
immutable
as $$
    select
        case
            when p_class_code is null or p_seat_no is null then null
            else p_class_code || lpad(p_seat_no::text, 2, '0')
        end;
$$;

create or replace function public.student_profiles_set_defaults()
returns trigger
language plpgsql
as $$
begin
    if new.email is null then
        select au.email::text
        into new.email
        from auth.users au
        where au.id = new.user_id;
    end if;

    new.student_code := public.refresh_student_code(new.class_code, new.seat_no);
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_student_profiles_set_defaults on public.student_profiles;
create trigger trg_student_profiles_set_defaults
before insert or update on public.student_profiles
for each row
execute function public.student_profiles_set_defaults();

create or replace function public.admin_list_student_profiles(
    p_class_code text default null,
    p_search text default null
)
returns table (
    user_id uuid,
    email text,
    class_code text,
    seat_no smallint,
    display_name text,
    student_code text,
    role text,
    updated_at timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
    select
        prof.user_id,
        coalesce(prof.email, au.email::text) as email,
        prof.class_code,
        prof.seat_no,
        prof.display_name,
        prof.student_code,
        prof.role,
        prof.updated_at
    from public.student_profiles prof
    left join auth.users au on au.id = prof.user_id
    where public.is_teacher()
      and (p_class_code is null or prof.class_code = p_class_code)
      and (
            p_search is null
            or coalesce(prof.email, au.email::text) ilike '%' || p_search || '%'
            or coalesce(prof.display_name, '') ilike '%' || p_search || '%'
            or coalesce(prof.student_code, '') ilike '%' || p_search || '%'
          )
    order by prof.class_code asc nulls last, prof.seat_no asc nulls last, prof.display_name asc nulls last;
$$;

grant execute on function public.admin_list_student_profiles(text, text) to authenticated;

create or replace function public.admin_upsert_student_profile(
    p_user_id uuid,
    p_class_code text default null,
    p_seat_no smallint default null,
    p_display_name text default null,
    p_role text default 'student'
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_email text;
begin
    if not public.is_teacher() then
        raise exception 'not authorized';
    end if;

    if p_role not in ('student', 'teacher') then
        raise exception 'invalid role';
    end if;

    select au.email::text
    into v_email
    from auth.users au
    where au.id = p_user_id;

    if v_email is null then
        raise exception 'user not found';
    end if;

    insert into public.student_profiles (
        user_id,
        email,
        class_code,
        seat_no,
        display_name,
        role,
        updated_at
    )
    values (
        p_user_id,
        v_email,
        p_class_code,
        p_seat_no,
        p_display_name,
        p_role,
        now()
    )
    on conflict (user_id)
    do update set
        email = excluded.email,
        class_code = excluded.class_code,
        seat_no = excluded.seat_no,
        display_name = excluded.display_name,
        role = excluded.role,
        updated_at = now();
end;
$$;

grant execute on function public.admin_upsert_student_profile(uuid, text, smallint, text, text) to authenticated;
