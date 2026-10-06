-- Grade 3 115-1 only. Apply after student_enrollments / class_card_guest_progress /
-- grade3_account_practice / student_progress. Review and backup before production.
begin;

create table if not exists public.grade3_google_activities (
 week_code text not null, activity_key text not null, total smallint not null check(total between 1 and 20),
 primary key(week_code,activity_key)
);
insert into public.grade3_google_activities values
 ('02','quiz_posture_5',5),('02','window_practice_5',5),('02','typing_task_4',4),('02','typing_task_5',5),
 ('03','quiz_device_safety_5',5),('03','typing_task_6',6),('04','typing_task_6',6),
 ('05','typing_task_5',6),('06','typing_task_5',5)
on conflict do nothing;

create table if not exists public.grade3_google_bindings (
 student_code text primary key, history_student_code text not null unique, user_id uuid not null unique, email text not null unique,
 migrated_at timestamptz not null default now()
);
-- Teacher-reviewed historical identity, never automatically populated from the
-- current seat list. Empty means fail closed until the historical roster is checked.
create table if not exists public.grade3_google_approvals (
 email text primary key, student_code text not null unique, display_name text not null,
 history_student_code text not null unique check(history_student_code ~ '^[0-9]{5}$'), history_display_name text not null,
 reviewed_existing_progress jsonb not null default '[]'::jsonb check(jsonb_typeof(reviewed_existing_progress)='array'),
 approved_at timestamptz not null default now()
);
create table if not exists public.grade3_google_imports (
 student_code text not null, week_code text not null, activity_key text not null,
 user_id uuid not null, source_snapshot jsonb not null, imported_at timestamptz not null default now(),
 primary key(student_code,week_code,activity_key)
);
alter table public.grade3_google_activities enable row level security;
alter table public.grade3_google_approvals enable row level security;
alter table public.grade3_google_bindings enable row level security;
alter table public.grade3_google_imports enable row level security;
drop policy if exists grade3_teacher_import_audit on public.grade3_google_imports;
create policy grade3_teacher_import_audit on public.grade3_google_imports for select to authenticated using(public.is_teacher());
drop policy if exists grade3_teacher_bindings on public.grade3_google_bindings;
create policy grade3_teacher_bindings on public.grade3_google_bindings for select to authenticated using(public.is_teacher());
grant select on public.grade3_google_imports,public.grade3_google_bindings to authenticated;

-- The base schema originally allowed five levels; current Grade 3 has six.
alter table public.student_progress drop constraint if exists student_progress_current_level_check;
alter table public.student_progress add constraint student_progress_current_level_check check(current_level between 1 and 20);

create or replace function public.freeze_grade3_guest_progress() returns trigger
language plpgsql set search_path='' as $$
begin
 if (tg_op<>'DELETE' and new.course_id='grade3-115-1') or (tg_op<>'INSERT' and old.course_id='grade3-115-1') then
   raise exception '本課程已切換 Google 登入，歷史成果已凍結，請重新整理並登入。';
 end if;
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
drop trigger if exists grade3_guest_frozen on public.guest_progress;
create trigger grade3_guest_frozen before insert or update or delete on public.guest_progress
for each row execute function public.freeze_grade3_guest_progress();

-- Close the old birthday-based read/identity channel for this course while
-- preserving pre-Google courses. No current page uses the practice-account RPC.
create or replace function public.verify_class_card_identity(p_course_id text,p_class_code text,p_seat_no smallint,p_birthday_code text)
returns table(course_id text,class_code text,seat_no smallint,student_code text,display_name text,profile_id text)
language sql security definer set search_path='' as $$
 select s.course_id,s.class_code,s.seat_no,s.student_code,s.display_name,
 s.course_id || ':' || s.class_code || ':' || lpad(s.seat_no::text,2,'0')
 from public.class_card_students s where s.course_id=p_course_id and s.course_id<>'grade3-115-1'
 and s.class_code=p_class_code and s.seat_no=p_seat_no and s.birthday_code=p_birthday_code and s.active limit 1;
$$;
create or replace function public.get_guest_progress(p_course_id text,p_week_code text,p_activity_key text,p_class_code text,p_seat_no smallint,p_birthday_code text)
returns table(course_id text,week_code text,activity_key text,student_code text,class_code text,seat_no smallint,display_name text,current_level integer,score smallint,completed boolean,updated_at timestamptz)
language sql security definer set search_path='' as $$
 select gp.course_id,gp.week_code,gp.activity_key,gp.student_code,gp.class_code,gp.seat_no,gp.display_name,gp.current_level,gp.score,gp.completed,gp.updated_at
 from public.class_card_students s join public.guest_progress gp on gp.course_id=s.course_id and gp.student_code=s.student_code
 where s.course_id=p_course_id and s.course_id<>'grade3-115-1' and s.class_code=p_class_code and s.seat_no=p_seat_no
 and s.birthday_code=p_birthday_code and s.active and gp.week_code=p_week_code and gp.activity_key=p_activity_key limit 1;
$$;
revoke all on function public.verify_class_card_identity(text,text,smallint,text),public.get_guest_progress(text,text,text,text,smallint,text) from public,anon,authenticated;
grant execute on function public.verify_class_card_identity(text,text,smallint,text),public.get_guest_progress(text,text,text,text,smallint,text) to anon,authenticated;
revoke all on function public.get_class_card_practice_account(text,text,smallint,text) from public,anon,authenticated;

create or replace function public.reconnect_grade3_progress()
returns table(class_code text,seat_no smallint,display_name text,student_code text,practice_account text)
language plpgsql security definer set search_path='' as $$
declare e record; g record; a record; old_binding record; approval record; s integer; t integer; c text;
begin
 if auth.uid() is null then raise exception '請先登入 Google。'; end if;
 select en.*, cs.practice_account into e
 from public.student_enrollments en join auth.users u on u.id=auth.uid()
   and u.email_confirmed_at is not null and lower(u.email)=en.email
 join public.class_card_students cs on cs.course_id='grade3-115-1'
   and cs.class_code=en.class_code and cs.seat_no=en.seat_no and cs.active
   and trim(cs.display_name)=trim(en.display_name)
   and lower(cs.practice_account || '@apps.ntpc.edu.tw')=en.email
 where en.school_year=115 and en.class_code in ('301','302','303','304','305','306');
 if not found then raise exception '學校帳號與三年級名冊不一致，請找老師。'; end if;
 c:=e.class_code || lpad(e.seat_no::text,2,'0');
 perform pg_advisory_xact_lock(hashtextextended('grade3-google:' || c,0));
 if exists(select 1 from public.grade3_google_bindings b where b.user_id=auth.uid() and b.student_code<>c) then
   raise exception '班級座號已異動，請老師查核原綁定，不能重新認領。';
 end if;
 select * into approval from public.grade3_google_approvals ga where ga.email=e.email and ga.student_code=c and trim(ga.display_name)=trim(e.display_name);
 if not found then raise exception '老師尚未核對你的歷史名冊，舊成果尚未接回，請找老師。'; end if;
 perform pg_advisory_xact_lock(hashtextextended('grade3-history:' || approval.history_student_code,0));
 if exists(select 1 from public.grade3_google_bindings b where b.history_student_code=approval.history_student_code and b.user_id<>auth.uid()) then
   raise exception '歷史成果已有其他帳號綁定，請找老師查核。';
 end if;
 select * into old_binding from public.grade3_google_bindings b where b.student_code=c;
 if found then
   if old_binding.user_id<>auth.uid() or old_binding.email<>e.email or old_binding.history_student_code<>approval.history_student_code then raise exception '帳號綁定衝突，請找老師。'; end if;
 else
   for g in select * from public.student_progress p where p.course_id='grade3-115-1' and p.user_id=auth.uid() loop
     select * into a from public.grade3_google_activities ga where ga.week_code=g.week_code and ga.activity_key=g.activity_key;
     -- Legacy Google typing wrote completed/current_level without a score.
     -- Accept that shape only when the teacher approved the exact original row.
     s:=case when g.activity_key like 'typing_%' and g.score is null and g.completed and g.current_level=a.total then a.total else coalesce(g.score,g.current_level-1) end;
     if not found or g.current_level is null or g.completed is null
        or g.current_level not between 1 and a.total or g.score not between 0 and a.total
        or g.completed is distinct from (s=a.total)
        or g.current_level<>least(s+1,a.total)
        or not (approval.reviewed_existing_progress @> jsonb_build_array(to_jsonb(g))) then
       raise exception '先前正式成果尚未經老師核對，請找老師。';
     end if;
   end loop;
   -- Validate the complete source snapshot before any import, including unknown activities.
   for g in select * from public.guest_progress gp where gp.course_id='grade3-115-1' and gp.student_code=approval.history_student_code loop
     select * into a from public.grade3_google_activities ga where ga.week_code=g.week_code and ga.activity_key=g.activity_key;
     if not found or g.week_code='06' or g.current_level is null or g.completed is null
       or g.current_level<1 or g.current_level>a.total
       or (g.score is not null and (g.score<0 or g.score>a.total))
       or g.completed is distinct from (coalesce(g.score,g.current_level-1)=a.total)
       or g.current_level<>least(coalesce(g.score,g.current_level-1)+1,a.total)
       or (g.class_code || lpad(g.seat_no::text,2,'0')) is distinct from approval.history_student_code or trim(g.display_name) is distinct from trim(approval.history_display_name) then
       raise exception '舊成果資料需老師查核，尚未接回。';
     end if;
   end loop;
   update public.student_progress p set score=case when p.completed then ga.total else p.current_level-1 end
     from public.grade3_google_activities ga where p.user_id=auth.uid() and p.course_id='grade3-115-1'
       and p.week_code=ga.week_code and p.activity_key=ga.activity_key and p.score is null;
   insert into public.grade3_google_bindings(student_code,history_student_code,user_id,email) values(c,approval.history_student_code,auth.uid(),e.email);
   for g in select * from public.guest_progress gp where gp.course_id='grade3-115-1' and gp.student_code=approval.history_student_code loop
     select ga.total into t from public.grade3_google_activities ga where ga.week_code=g.week_code and ga.activity_key=g.activity_key;
     s:=case when g.completed then t else coalesce(g.score,g.current_level-1) end;
     insert into public.grade3_google_imports(student_code,week_code,activity_key,user_id,source_snapshot)
       values(approval.history_student_code,g.week_code,g.activity_key,auth.uid(),to_jsonb(g));
     insert into public.student_progress as p(user_id,course_id,week_code,activity_key,current_level,score,completed,updated_at)
       values(auth.uid(),'grade3-115-1',g.week_code,g.activity_key,least(s+1,t),s,s=t,g.updated_at)
       on conflict(user_id,course_id,week_code,activity_key) do update set
         completed=p.completed or excluded.completed,
         score=case when p.completed or excluded.completed then t else greatest(coalesce(p.score,p.current_level-1),excluded.score) end,
         current_level=case when p.completed or excluded.completed then t else least(greatest(p.current_level,excluded.current_level),t) end,
         updated_at=greatest(p.updated_at,excluded.updated_at);
   end loop;
 end if;
 return query select e.class_code::text,e.seat_no::smallint,e.display_name::text,c,e.practice_account::text;
exception when unique_violation then
 raise exception '資料綁定或匯入紀錄衝突，請找老師查核。';
end $$;

create or replace function public.grade3_google_ready() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.grade3_google_bindings b join auth.users u on u.id=b.user_id
   join public.student_enrollments e on e.school_year=115 and e.email=b.email
   join public.grade3_google_approvals a on a.email=b.email and a.student_code=b.student_code and a.history_student_code=b.history_student_code and trim(a.display_name)=trim(e.display_name)
   join public.class_card_students c on c.course_id='grade3-115-1' and c.student_code=b.student_code
     and c.class_code=e.class_code and c.seat_no=e.seat_no and c.active
     and trim(c.display_name)=trim(e.display_name) and lower(c.practice_account || '@apps.ntpc.edu.tw')=b.email
   where b.user_id=auth.uid() and u.email_confirmed_at is not null and lower(u.email)=b.email);
$$;

-- Restrictive policies leave other semesters/grades untouched, even if additional
-- permissive policies exist. Grade 3 writes go exclusively through the trusted RPC.
drop policy if exists grade3_google_read_gate on public.student_progress;
drop policy if exists grade3_google_insert_gate on public.student_progress;
drop policy if exists grade3_google_update_gate on public.student_progress;
drop policy if exists grade3_google_delete_gate on public.student_progress;
create policy grade3_google_read_gate on public.student_progress as restrictive for select to authenticated
using(course_id<>'grade3-115-1' or public.grade3_google_ready() or public.is_teacher());
create policy grade3_google_insert_gate on public.student_progress as restrictive for insert to authenticated
with check(course_id<>'grade3-115-1');
create policy grade3_google_update_gate on public.student_progress as restrictive for update to authenticated
using(course_id<>'grade3-115-1') with check(course_id<>'grade3-115-1');
create policy grade3_google_delete_gate on public.student_progress as restrictive for delete to authenticated
using(course_id<>'grade3-115-1' or public.is_teacher());

create or replace function public.get_grade3_progress(p_week_code text,p_activity_key text)
returns setof public.student_progress language plpgsql security definer set search_path='' as $$
begin
 if not public.grade3_google_ready() then raise exception '請先接回本人舊成果。'; end if;
 return query select p.* from public.student_progress p where p.user_id=auth.uid() and p.course_id='grade3-115-1'
   and p.week_code=p_week_code and p.activity_key=p_activity_key;
end $$;
create or replace function public.save_grade3_progress(p_week_code text,p_activity_key text,p_score integer)
returns void language plpgsql security definer set search_path='' as $$
declare t integer;
begin
 if not public.grade3_google_ready() then raise exception '請先接回本人舊成果。'; end if;
 select total into t from public.grade3_google_activities where week_code=p_week_code and activity_key=p_activity_key;
 if t is null or p_score is null or p_score<0 or p_score>t then raise exception '無效的活動進度。'; end if;
 insert into public.student_progress as p(user_id,course_id,week_code,activity_key,current_level,score,completed)
 values(auth.uid(),'grade3-115-1',p_week_code,p_activity_key,least(p_score+1,t),p_score,p_score=t)
 on conflict(user_id,course_id,week_code,activity_key) do update set
   score=case when p.completed or excluded.completed then t else greatest(coalesce(p.score,p.current_level-1),excluded.score) end,
   completed=p.completed or excluded.completed,current_level=greatest(p.current_level,excluded.current_level),updated_at=now();
end $$;
revoke all on function public.reconnect_grade3_progress(),public.grade3_google_ready(),public.get_grade3_progress(text,text),public.save_grade3_progress(text,text,integer) from public,anon;
grant execute on function public.reconnect_grade3_progress(),public.grade3_google_ready(),public.get_grade3_progress(text,text),public.save_grade3_progress(text,text,integer) to authenticated;
commit;
