-- Classroom one-off controls for live teaching pages.
-- Apply this after supabase/student_progress.sql because it depends on public.is_teacher().

create table if not exists public.classroom_controls (
    grade text not null check (grade in ('grade3', 'grade6')),
    week_code text not null,
    control_key text not null,
    is_enabled boolean not null default false,
    updated_by uuid references auth.users(id) on delete set null,
    updated_at timestamptz not null default now(),
    primary key (grade, week_code, control_key)
);

alter table public.classroom_controls enable row level security;

drop policy if exists "public_can_read_classroom_controls" on public.classroom_controls;
create policy "public_can_read_classroom_controls"
on public.classroom_controls
for select
to anon, authenticated
using (true);

drop policy if exists "teachers_manage_classroom_controls" on public.classroom_controls;
create policy "teachers_manage_classroom_controls"
on public.classroom_controls
for all
to authenticated
using (public.is_teacher())
with check (public.is_teacher());

create or replace function public.get_classroom_control(
    p_grade text,
    p_week_code text,
    p_control_key text
)
returns table (
    grade text,
    week_code text,
    control_key text,
    is_enabled boolean,
    updated_at timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
    select
        p_grade as grade,
        p_week_code as week_code,
        p_control_key as control_key,
        coalesce(cc.is_enabled, false) as is_enabled,
        cc.updated_at
    from (select 1) seed
    left join public.classroom_controls cc
        on cc.grade = p_grade
        and cc.week_code = p_week_code
        and cc.control_key = p_control_key;
$$;

grant execute on function public.get_classroom_control(text, text, text) to anon, authenticated;

create or replace function public.admin_set_classroom_control(
    p_grade text,
    p_week_code text,
    p_control_key text,
    p_is_enabled boolean
)
returns table (
    grade text,
    week_code text,
    control_key text,
    is_enabled boolean,
    updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if not public.is_teacher() then
        raise exception 'not authorized';
    end if;

    insert into public.classroom_controls (
        grade,
        week_code,
        control_key,
        is_enabled,
        updated_by,
        updated_at
    )
    values (
        p_grade,
        p_week_code,
        p_control_key,
        p_is_enabled,
        auth.uid(),
        now()
    )
    on conflict on constraint classroom_controls_pkey
    do update set
        is_enabled = excluded.is_enabled,
        updated_by = auth.uid(),
        updated_at = now();

    return query
    select
        cc.grade,
        cc.week_code,
        cc.control_key,
        cc.is_enabled,
        cc.updated_at
    from public.classroom_controls cc
    where cc.grade = p_grade
        and cc.week_code = p_week_code
        and cc.control_key = p_control_key;
end;
$$;

grant execute on function public.admin_set_classroom_control(text, text, text, boolean) to authenticated;
