drop function if exists public.admin_list_grade3_grading_data();

create or replace function public.admin_list_grade3_grading_data()
returns table (
    record_type text,
    user_id uuid,
    email text,
    class_code text,
    seat_no smallint,
    display_name text,
    student_code text,
    role text,
    course_id text,
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
    with grade3_profiles as (
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
          and prof.class_code in ('301', '302', '303', '304', '305', '306')
    ),
    counted_activities as (
        select * from (values
            ('06', 'safety_quiz_1', 'quiz'),
            ('07', 'privacy_quiz_1', 'quiz'),
            ('11', 'etiquette_quiz_1', 'quiz'),
            ('12', 'media_literacy_quiz_1', 'quiz'),
            ('13', 'internet_addiction_quiz_1', 'quiz'),
            ('14', 'phishing_safety_quiz_1', 'quiz'),
            ('15', 'screen_time_quiz_1', 'quiz'),
            ('16', 'copyright_cc_quiz_1', 'quiz'),
            ('04', 'typing_task_2', 'typing'),
            ('05', 'typing_task_3', 'typing'),
            ('06', 'typing_task_4', 'typing'),
            ('07', 'typing_task_5', 'typing'),
            ('10', 'typing_task_2', 'typing'),
            ('12', 'typing_task_5', 'typing'),
            ('13', 'typing_task_5', 'typing'),
            ('14', 'typing_task_5', 'typing'),
            ('15', 'typing_task_5', 'typing'),
            ('16', 'typing_task_5', 'typing')
        ) as activities(week_code, activity_key, activity_type)
    )
    select
        'profile'::text as record_type,
        gp.user_id,
        gp.email,
        gp.class_code,
        gp.seat_no,
        gp.display_name,
        gp.student_code,
        gp.role,
        null::text as course_id,
        null::text as week_code,
        null::text as activity_key,
        null::text as activity_type,
        null::integer as current_level,
        null::smallint as score,
        null::boolean as completed,
        gp.updated_at
    from grade3_profiles gp

    union all

    select
        'progress'::text as record_type,
        sp.user_id,
        gp.email,
        gp.class_code,
        gp.seat_no,
        gp.display_name,
        gp.student_code,
        gp.role,
        sp.course_id,
        sp.week_code,
        sp.activity_key,
        ca.activity_type,
        sp.current_level,
        sp.score,
        sp.completed,
        sp.updated_at
    from public.student_progress sp
    join grade3_profiles gp on gp.user_id = sp.user_id
    join counted_activities ca
      on ca.week_code = sp.week_code
     and ca.activity_key = sp.activity_key
    where sp.course_id = 'grade3-114-2'

    order by record_type asc, class_code asc nulls last, seat_no asc nulls last, course_id asc nulls last, week_code asc nulls last, activity_key asc nulls last;
$$;

grant execute on function public.admin_list_grade3_grading_data() to authenticated;
