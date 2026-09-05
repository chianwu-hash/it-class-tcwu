create table if not exists public.typing_drafts (
    user_id uuid not null references auth.users(id) on delete cascade,
    course_id text not null default 'grade3-114-2',
    week_code text not null,
    activity_key text not null,
    level_id integer not null check (level_id >= 1),
    draft_text text not null default '',
    saved_at timestamptz not null default now(),
    primary key (user_id, course_id, week_code, activity_key, level_id)
);

alter table public.typing_drafts
    add column if not exists course_id text not null default 'grade3-114-2';

update public.typing_drafts
set course_id = 'grade6-115-1'
where course_id = 'grade3-114-2'
  and week_code = '01'
  and activity_key = 'typing_task_5';

do $$
begin
    if exists (
        select 1
        from pg_constraint
        where conrelid = 'public.typing_drafts'::regclass
          and conname = 'typing_drafts_pkey'
          and pg_get_constraintdef(oid) = 'PRIMARY KEY (user_id, week_code, activity_key, level_id)'
    ) then
        alter table public.typing_drafts drop constraint typing_drafts_pkey;
        alter table public.typing_drafts
            add constraint typing_drafts_pkey primary key (user_id, course_id, week_code, activity_key, level_id);
    end if;
end $$;

create index if not exists typing_drafts_saved_at_idx
on public.typing_drafts (saved_at desc);

create index if not exists typing_drafts_course_activity_idx
on public.typing_drafts (course_id, week_code, activity_key);

alter table public.typing_drafts enable row level security;

drop policy if exists "students_can_read_own_typing_drafts" on public.typing_drafts;
create policy "students_can_read_own_typing_drafts"
on public.typing_drafts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "students_can_insert_own_typing_drafts" on public.typing_drafts;
create policy "students_can_insert_own_typing_drafts"
on public.typing_drafts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "students_can_update_own_typing_drafts" on public.typing_drafts;
create policy "students_can_update_own_typing_drafts"
on public.typing_drafts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "students_can_delete_own_typing_drafts" on public.typing_drafts;
create policy "students_can_delete_own_typing_drafts"
on public.typing_drafts
for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on public.typing_drafts to authenticated;
