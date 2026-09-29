-- Add only the school-generated account needed for Grade 3 typing practice.
-- Apply after class_card_guest_progress.sql. Student identity numbers and
-- passwords must never be imported into this column or this practice flow.

begin;

alter table public.class_card_students
    add column if not exists practice_account text;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.class_card_students'::regclass
          and conname = 'class_card_students_practice_account_format'
    ) then
        alter table public.class_card_students
            add constraint class_card_students_practice_account_format
            check (practice_account is null or practice_account ~ '^[a-z][a-z0-9]*$');
    end if;
end;
$$;

create unique index if not exists class_card_students_practice_account_unique
    on public.class_card_students (course_id, practice_account)
    where practice_account is not null;

create or replace function public.get_class_card_practice_account(
    p_course_id text,
    p_class_code text,
    p_seat_no smallint,
    p_birthday_code text
)
returns text
language sql
security definer
set search_path = public
as $$
    select s.practice_account
    from public.class_card_students s
    where s.course_id = 'grade3-115-1'
      and s.course_id = p_course_id
      and s.class_code = p_class_code
      and s.seat_no = p_seat_no
      and s.birthday_code = p_birthday_code
      and s.active = true
    limit 1;
$$;

revoke all on function public.get_class_card_practice_account(text, text, smallint, text)
    from public, anon, authenticated;
grant execute on function public.get_class_card_practice_account(text, text, smallint, text)
    to anon, authenticated;

comment on column public.class_card_students.practice_account is
    'School-generated account for personal typing practice; never a password.';

commit;
