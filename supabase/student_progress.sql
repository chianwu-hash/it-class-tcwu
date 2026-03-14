create table if not exists public.student_progress (
    user_id uuid not null references auth.users(id) on delete cascade,
    week_code text not null,
    activity_key text not null,
    current_level integer not null default 1 check (current_level between 1 and 5),
    completed boolean not null default false,
    updated_at timestamptz not null default now(),
    primary key (user_id, week_code, activity_key)
);

alter table public.student_progress enable row level security;

create policy "students_can_read_own_progress"
on public.student_progress
for select
to authenticated
using (auth.uid() = user_id);

create policy "students_can_insert_own_progress"
on public.student_progress
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "students_can_update_own_progress"
on public.student_progress
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "students_can_delete_own_progress"
on public.student_progress
for delete
to authenticated
using (auth.uid() = user_id);
