-- Classroom identity card MVP for lower-grade lessons before Google login.
-- Apply after supabase/student_progress.sql because this file uses public.is_teacher().

create table if not exists public.class_card_students (
    course_id text not null,
    class_code text not null check (class_code ~ '^\d{3}$'),
    seat_no smallint not null check (seat_no between 1 and 99),
    student_code text generated always as (class_code || lpad(seat_no::text, 2, '0')) stored,
    display_name text not null,
    birthday_code text not null check (birthday_code ~ '^\d{4}$'),
    active boolean not null default true,
    updated_at timestamptz not null default now(),
    primary key (course_id, class_code, seat_no)
);

create index if not exists class_card_students_course_student_code_idx
on public.class_card_students (course_id, student_code);

alter table public.class_card_students enable row level security;

drop policy if exists "teachers_can_read_class_card_students" on public.class_card_students;
create policy "teachers_can_read_class_card_students"
on public.class_card_students
for select
to authenticated
using (public.is_teacher());

create table if not exists public.guest_progress (
    course_id text not null,
    week_code text not null,
    activity_key text not null,
    student_code text not null,
    class_code text not null,
    seat_no smallint not null check (seat_no between 1 and 99),
    display_name text,
    current_level integer not null default 1 check (current_level between 1 and 20),
    score smallint,
    completed boolean not null default false,
    updated_at timestamptz not null default now(),
    primary key (course_id, week_code, activity_key, student_code)
);

create index if not exists guest_progress_course_week_idx
on public.guest_progress (course_id, week_code, activity_key);

create index if not exists guest_progress_updated_at_idx
on public.guest_progress (updated_at desc);

alter table public.guest_progress enable row level security;

drop policy if exists "teachers_can_read_guest_progress" on public.guest_progress;
create policy "teachers_can_read_guest_progress"
on public.guest_progress
for select
to authenticated
using (public.is_teacher());

create or replace function public.verify_class_card_identity(
    p_course_id text,
    p_class_code text,
    p_seat_no smallint,
    p_birthday_code text
)
returns table (
    course_id text,
    class_code text,
    seat_no smallint,
    student_code text,
    display_name text,
    profile_id text
)
language sql
security definer
set search_path = public
as $$
    select
        s.course_id,
        s.class_code,
        s.seat_no,
        s.student_code,
        s.display_name,
        s.course_id || ':' || s.class_code || ':' || lpad(s.seat_no::text, 2, '0') as profile_id
    from public.class_card_students s
    where s.course_id = p_course_id
      and s.class_code = p_class_code
      and s.seat_no = p_seat_no
      and s.birthday_code = p_birthday_code
      and s.active = true
    limit 1;
$$;

grant execute on function public.verify_class_card_identity(text, text, smallint, text) to anon, authenticated;

create or replace function public.get_guest_progress(
    p_course_id text,
    p_week_code text,
    p_activity_key text,
    p_class_code text,
    p_seat_no smallint,
    p_birthday_code text
)
returns table (
    course_id text,
    week_code text,
    activity_key text,
    student_code text,
    class_code text,
    seat_no smallint,
    display_name text,
    current_level integer,
    score smallint,
    completed boolean,
    updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
    select
        gp.course_id,
        gp.week_code,
        gp.activity_key,
        gp.student_code,
        gp.class_code,
        gp.seat_no,
        gp.display_name,
        gp.current_level,
        gp.score,
        gp.completed,
        gp.updated_at
    from public.class_card_students s
    join public.guest_progress gp
      on gp.course_id = s.course_id
     and gp.student_code = s.student_code
    where s.course_id = p_course_id
      and s.class_code = p_class_code
      and s.seat_no = p_seat_no
      and s.birthday_code = p_birthday_code
      and s.active = true
      and gp.week_code = p_week_code
      and gp.activity_key = p_activity_key
    limit 1;
$$;

grant execute on function public.get_guest_progress(text, text, text, text, smallint, text) to anon, authenticated;

create or replace function public.upsert_guest_progress(
    p_course_id text,
    p_week_code text,
    p_activity_key text,
    p_class_code text,
    p_seat_no smallint,
    p_birthday_code text,
    p_current_level integer,
    p_score smallint,
    p_completed boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_student record;
    v_score smallint;
    v_current_level integer;
begin
    if p_week_code !~ '^\d{2}$' then
        raise exception 'invalid week_code';
    end if;

    if p_activity_key !~ '^[a-z0-9_:-]{3,64}$' then
        raise exception 'invalid activity_key';
    end if;

    select * into v_student
    from public.class_card_students s
    where s.course_id = p_course_id
      and s.class_code = p_class_code
      and s.seat_no = p_seat_no
      and s.birthday_code = p_birthday_code
      and s.active = true
    limit 1;

    if v_student is null then
        raise exception 'class card not found';
    end if;

    v_score := greatest(0, least(coalesce(p_score, 0), 20));
    v_current_level := greatest(1, least(coalesce(p_current_level, 1), 20));

    insert into public.guest_progress (
        course_id,
        week_code,
        activity_key,
        student_code,
        class_code,
        seat_no,
        display_name,
        current_level,
        score,
        completed,
        updated_at
    ) values (
        v_student.course_id,
        p_week_code,
        p_activity_key,
        v_student.student_code,
        v_student.class_code,
        v_student.seat_no,
        v_student.display_name,
        v_current_level,
        v_score,
        coalesce(p_completed, false),
        now()
    )
    on conflict (course_id, week_code, activity_key, student_code)
    do update set
        class_code = excluded.class_code,
        seat_no = excluded.seat_no,
        display_name = excluded.display_name,
        current_level = excluded.current_level,
        score = excluded.score,
        completed = excluded.completed,
        updated_at = now();
end;
$$;

grant execute on function public.upsert_guest_progress(text, text, text, text, smallint, text, integer, smallint, boolean) to anon, authenticated;

create or replace function public.admin_list_guest_progress(
    p_course_id text default null,
    p_week_code text default null,
    p_activity_type text default null,
    p_search text default null,
    p_completed boolean default null
)
returns table (
    user_id uuid,
    email text,
    course_id text,
    week_code text,
    activity_key text,
    activity_type text,
    current_level integer,
    score smallint,
    completed boolean,
    updated_at timestamptz,
    student_code text,
    class_code text,
    seat_no smallint,
    display_name text,
    identity_source text
)
language sql
security definer
set search_path = public
as $$
    select
        null::uuid as user_id,
        null::text as email,
        gp.course_id,
        gp.week_code,
        gp.activity_key,
        case
            when gp.activity_key like 'typing%' then 'typing'
            when gp.activity_key like 'quiz%' or gp.activity_key like '%\_quiz\_%' escape '\' or gp.activity_key like '%\_quiz' escape '\' then 'quiz'
            when gp.activity_key like 'window%' or gp.activity_key like '%\_window\_%' escape '\' or gp.activity_key like 'window\_%' escape '\' then 'window'
            when gp.activity_key like 'project%' then 'project'
            else 'other'
        end as activity_type,
        gp.current_level,
        gp.score,
        gp.completed,
        gp.updated_at,
        gp.student_code,
        gp.class_code,
        gp.seat_no,
        gp.display_name,
        'class-card'::text as identity_source
    from public.guest_progress gp
    where public.is_teacher()
      and (p_course_id is null or gp.course_id = p_course_id)
      and (p_week_code is null or gp.week_code = p_week_code)
      and (
            p_activity_type is null
            or case
                when gp.activity_key like 'typing%' then 'typing'
                when gp.activity_key like 'quiz%' or gp.activity_key like '%\_quiz\_%' escape '\' or gp.activity_key like '%\_quiz' escape '\' then 'quiz'
                when gp.activity_key like 'window%' or gp.activity_key like '%\_window\_%' escape '\' or gp.activity_key like 'window\_%' escape '\' then 'window'
                when gp.activity_key like 'project%' then 'project'
                else 'other'
               end = p_activity_type
          )
      and (
            p_search is null
            or coalesce(gp.display_name, '') ilike '%' || p_search || '%'
            or coalesce(gp.student_code, '') ilike '%' || p_search || '%'
            or coalesce(gp.class_code, '') ilike '%' || p_search || '%'
            or gp.activity_key ilike '%' || p_search || '%'
          )
      and (p_completed is null or gp.completed = p_completed)
    order by gp.updated_at desc, gp.class_code asc, gp.seat_no asc, gp.activity_key asc;
$$;

grant execute on function public.admin_list_guest_progress(text, text, text, text, boolean) to authenticated;

create or replace function public.admin_reset_guest_progress(
    p_student_code text,
    p_course_id text,
    p_week_code text,
    p_activity_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_teacher() then
        raise exception 'not authorized';
    end if;

    delete from public.guest_progress
    where student_code = p_student_code
      and course_id = p_course_id
      and week_code = p_week_code
      and activity_key = p_activity_key;
end;
$$;

grant execute on function public.admin_reset_guest_progress(text, text, text, text) to authenticated;
