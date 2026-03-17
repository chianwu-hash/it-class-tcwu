create table if not exists public.student_progress (
    user_id uuid not null references auth.users(id) on delete cascade,
    week_code text not null,
    activity_key text not null,
    current_level integer not null default 1 check (current_level between 1 and 5),
    completed boolean not null default false,
    updated_at timestamptz not null default now(),
    score smallint,
    primary key (user_id, week_code, activity_key)
);

alter table public.student_progress
    add column if not exists score smallint;

create index if not exists student_progress_updated_at_idx
on public.student_progress (updated_at desc);

alter table public.student_progress enable row level security;

drop policy if exists "students_can_read_own_progress" on public.student_progress;
create policy "students_can_read_own_progress"
on public.student_progress
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "students_can_insert_own_progress" on public.student_progress;
create policy "students_can_insert_own_progress"
on public.student_progress
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "students_can_update_own_progress" on public.student_progress;
create policy "students_can_update_own_progress"
on public.student_progress
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "students_can_delete_own_progress" on public.student_progress;
create policy "students_can_delete_own_progress"
on public.student_progress
for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.is_teacher()
returns boolean
language sql
stable
as $$
    select lower(coalesce(auth.jwt() ->> 'email', '')) = any (
        array[
            'chianwu@gmail.com'
        ]
    );
$$;

create or replace function public.admin_list_progress(
    p_week_code text default null,
    p_activity_type text default null,
    p_search text default null,
    p_completed boolean default null
)
returns table (
    user_id uuid,
    email text,
    week_code text,
    activity_key text,
    activity_type text,
    current_level integer,
    score smallint,
    completed boolean,
    updated_at timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
    select
        sp.user_id,
        au.email::text,
        sp.week_code,
        sp.activity_key,
        case
            when sp.activity_key like 'typing%' then 'typing'
            when sp.activity_key like 'quiz%' then 'quiz'
            when sp.activity_key like 'project%' then 'project'
            else 'other'
        end as activity_type,
        sp.current_level,
        sp.score,
        sp.completed,
        sp.updated_at
    from public.student_progress sp
    join auth.users au on au.id = sp.user_id
    where public.is_teacher()
      and (p_week_code is null or sp.week_code = p_week_code)
      and (
            p_activity_type is null
            or case
                when sp.activity_key like 'typing%' then 'typing'
                when sp.activity_key like 'quiz%' then 'quiz'
                when sp.activity_key like 'project%' then 'project'
                else 'other'
               end = p_activity_type
          )
      and (
            p_search is null
            or au.email ilike '%' || p_search || '%'
            or sp.activity_key ilike '%' || p_search || '%'
          )
      and (p_completed is null or sp.completed = p_completed)
    order by sp.updated_at desc, au.email asc, sp.week_code asc, sp.activity_key asc;
$$;

grant execute on function public.admin_list_progress(text, text, text, boolean) to authenticated;

create or replace function public.admin_reset_progress(
    p_user_id uuid,
    p_week_code text,
    p_activity_key text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if not public.is_teacher() then
        raise exception 'not authorized';
    end if;

    delete from public.student_progress
    where user_id = p_user_id
      and week_code = p_week_code
      and activity_key = p_activity_key;
end;
$$;

grant execute on function public.admin_reset_progress(uuid, text, text) to authenticated;

create table if not exists public.week_visibility (
    grade text not null check (grade in ('grade3', 'grade6')),
    week_code text not null,
    is_visible boolean not null default true,
    updated_at timestamptz not null default now(),
    primary key (grade, week_code)
);

alter table public.week_visibility enable row level security;

drop policy if exists "public_can_read_week_visibility" on public.week_visibility;
create policy "public_can_read_week_visibility"
on public.week_visibility
for select
to anon, authenticated
using (true);

drop policy if exists "teachers_manage_week_visibility" on public.week_visibility;
create policy "teachers_manage_week_visibility"
on public.week_visibility
for all
to authenticated
using (public.is_teacher())
with check (public.is_teacher());

create or replace function public.admin_list_week_visibility()
returns table (
    grade text,
    week_code text,
    is_visible boolean,
    updated_at timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
    select
        wv.grade,
        wv.week_code,
        wv.is_visible,
        wv.updated_at
    from public.week_visibility wv
    where public.is_teacher()
    order by wv.grade asc, wv.week_code asc;
$$;

grant execute on function public.admin_list_week_visibility() to authenticated;

create or replace function public.admin_set_week_visibility(
    p_grade text,
    p_week_code text,
    p_is_visible boolean
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if not public.is_teacher() then
        raise exception 'not authorized';
    end if;

    insert into public.week_visibility (grade, week_code, is_visible, updated_at)
    values (p_grade, p_week_code, p_is_visible, now())
    on conflict (grade, week_code)
    do update set
        is_visible = excluded.is_visible,
        updated_at = now();
end;
$$;

grant execute on function public.admin_set_week_visibility(text, text, boolean) to authenticated;
