-- Source fragment for quiz-partner-production.sql. Apply the combined migration only.
create table partner_pilot.paper_sources(paper_id text references partner_pilot.papers(id),session_id uuid references public.quiz_sessions(id),primary key(paper_id,session_id));
alter table partner_pilot.paper_sources enable row level security;
insert into partner_pilot.paper_sources select p.id,s.id from partner_pilot.papers p join public.quiz_sessions s on s.version_id=p.source_version where p.past_meta is null and s.access_mode='practice' and not exists(select 1 from public.quiz_generated_papers g where g.session_id=s.id) on conflict do nothing;
-- A source already advanced before this upgrade can still be identified when its original ID is a practice session.
insert into partner_pilot.paper_sources select p.id,s.id from partner_pilot.papers p join public.quiz_sessions s on s.id=p.source_session where p.past_meta is null and s.access_mode='practice' and not exists(select 1 from public.quiz_generated_papers g where g.session_id=s.id) on conflict do nothing;
create function partner_pilot.sync_source_links() returns void language sql security definer set search_path='' as $$
 insert into partner_pilot.paper_sources select p.id,s.id from partner_pilot.papers p join public.quiz_sessions s on s.version_id=p.source_version where p.past_meta is null and s.access_mode='practice' and s.status='open' and s.library_visible and s.school_year=115 and not exists(select 1 from public.quiz_generated_papers g where g.session_id=s.id) on conflict do nothing
$$;
alter table partner_pilot.awards add column course_id text,add column school_year int,add column semester int;
-- No fabricated individual attempts. Existing pilot awards, if any, remain auditable in their source course.
update partner_pilot.awards a set course_id='grade'||p.grade||'-115-1',school_year=115,semester=1 from partner_pilot.rooms r join partner_pilot.papers p on p.id=r.paper where r.id=a.room_id;
alter table partner_pilot.awards alter column course_id set not null,alter column school_year set not null,alter column semester set not null;
create index partner_awards_members on partner_pilot.awards using gin(members);

create or replace function partner_pilot.can_access() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select enabled from partner_pilot.settings where id),false) and not coalesce(public.is_teacher(),false) and exists(select 1 from auth.users u join public.student_enrollments e on e.email=lower(u.email) and e.school_year=115 where u.id=auth.uid() and u.email_confirmed_at is not null and u.raw_app_meta_data->'providers' ? 'google' and e.class_code~'^[3469][0-9]{2}$')
$$;
create or replace function partner_pilot.register_self() returns void language plpgsql security definer set search_path='' as $$
declare label text;
begin
 if not partner_pilot.can_access() then raise exception 'ACCESS_DENIED';end if;
 select e.class_code||'班'||e.seat_no||'號 '||e.display_name into strict label from auth.users u join public.student_enrollments e on e.email=lower(u.email) and e.school_year=115 where u.id=auth.uid();
 insert into partner_pilot.allowed_users(user_id,display_name) values(auth.uid(),label) on conflict(user_id) do update set display_name=excluded.display_name,active=true where partner_pilot.allowed_users.display_name is distinct from excluded.display_name or not partner_pilot.allowed_users.active;
end $$;
create function partner_pilot.source_allowed(pid text,continuing boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from partner_pilot.papers p join auth.users u on u.id=auth.uid() join public.student_enrollments e on e.email=lower(u.email) and e.school_year=115 where p.id=pid and p.enabled and p.is_real and left(e.class_code,1)=p.grade::text and case when p.past_meta is not null then exists(select 1 from public.quiz_past_papers s where s.id=p.past_meta->>'sourcePaper' and s.enabled and s.grade=p.grade and (continuing or s.active_version=p.source_version)) else p.total in (10,20) and exists(select 1 from partner_pilot.paper_sources ps join public.quiz_sessions s on s.id=ps.session_id where ps.paper_id=p.id and s.status='open' and s.library_visible and s.access_mode='practice' and s.school_year=115 and s.class_codes ? e.class_code and (continuing or s.version_id=p.source_version)) end)
$$;
create or replace function partner_pilot.source_available(pid text) returns boolean language sql stable security definer set search_path='' as $$ select partner_pilot.source_allowed(pid,true) $$;
create function partner_pilot.claim_award(rid uuid) returns void language plpgsql security definer set search_path='' as $$
declare r partner_pilot.rooms;snap jsonb;p partner_pilot.papers;roster uuid[];key text;
begin
 select * into strict r from partner_pilot.rooms where id=rid for update;
 if not exists(select 1 from partner_pilot.members where room_id=rid and user_id=auth.uid()) then raise exception 'NOT_MEMBER';end if;
 if not r.finished or not partner_pilot.source_allowed(r.paper,true) then return;end if;
 snap:=partner_pilot.learning_snapshot(rid);
 if coalesce((snap#>>'{exercise,gradedTotal}')::int,0)=0 or (snap#>>'{exercise,correct}')::int*100<(snap#>>'{exercise,gradedTotal}')::int*60 then return;end if;
 select * into strict p from partner_pilot.papers where id=r.paper;
 select array_agg(user_id order by user_id),string_agg(user_id::text,',' order by user_id) into roster,key from partner_pilot.members where room_id=rid;
 insert into partner_pilot.awards(content_key,member_key,members,room_id,leaves,flowers,record,course_id,school_year,semester) values(p.content_key,key,roster,rid,case when p.kind='leaf' then p.total/10 else 0 end,case when p.kind='flower' then 1 else 0 end,jsonb_build_object('team',r.team,'paper',r.paper,'title',p.title,'stories',snap#>'{exercise,stories}','sharedTitles',(select coalesce(jsonb_agg(distinct q.title),'[]') from partner_pilot.notes n join partner_pilot.question_bank q on q.id=n.qid where n.room_id=rid and n.kind='mark')),'grade'||p.grade||'-115-1',115,1) on conflict(content_key,member_key) do nothing;
end $$;
create function partner_pilot.paused_snapshot(rid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r partner_pilot.rooms;a jsonb;
begin
 if not exists(select 1 from partner_pilot.members where room_id=rid and user_id=auth.uid()) then raise exception 'NOT_MEMBER';end if;
 select * into strict r from partner_pilot.rooms where id=rid;
 select jsonb_build_object('id',w.id,'record',w.record,'leaves',w.leaves,'flowers',w.flowers,'course',w.course_id) into a from partner_pilot.awards w where w.room_id=rid and auth.uid()=any(w.members);
 return jsonb_build_object('id',rid,'revision',r.revision,'team',r.team,'started',r.started,'paused',true,'award',a);
end $$;
create function public.quiz_partner_rewards(p_course text) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'authentication_required';end if;
 if p_course!~'^grade[3469]-[0-9]{3}-[12]$' then raise exception 'invalid_course';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'room',room_id,'course',course_id,'leaves',leaves,'flowers',flowers,'record',record,'at',created_at) order by created_at,id) from partner_pilot.awards where auth.uid()=any(members) and course_id=p_course),'[]');
end $$;
create function public.quiz_partner_reward_ids(p_course text) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',p_course||':00:partner_'||(a->>'id')||'_'||n||':'||case when n<=(a->>'leaves')::int then 'quiz-leaf' else 'flower' end||':1','kind',case when n<=(a->>'leaves')::int then 'quiz-leaf' else 'flower' end,'sourceType','partner')),'[]') from jsonb_array_elements(public.quiz_partner_rewards(p_course)) a cross join lateral generate_series(1,(a->>'leaves')::int+(a->>'flowers')::int) n
$$;
create or replace function public.quiz_partner_pilot_access() returns jsonb language plpgsql security definer set search_path='' as $$
begin if not partner_pilot.can_access() then return jsonb_build_object('allowed',false);end if;perform partner_pilot.register_self();return jsonb_build_object('allowed',true,'testRewards',false);end $$;
create or replace function public.quiz_partner_pilot_action(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare act text:=p->>'action';rid uuid;r partner_pilot.rooms;result jsonb;pid text;aid uuid;
begin
 perform partner_pilot.register_self();
 -- Remember newly published class sessions before a room starts; their normal version updates do not orphan it.
 if act in ('catalog','create','join','lookup') then perform partner_pilot.sync_source_links();end if;
 if act='me' then return jsonb_build_object('id',auth.uid(),'name',(select display_name from partner_pilot.allowed_users where user_id=auth.uid()),'rooms',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'team',t.team,'started',t.started,'paused',not partner_pilot.source_allowed(t.paper,t.started)) order by t.created_at desc) from partner_pilot.rooms t join partner_pilot.members m on m.room_id=t.id where m.user_id=auth.uid()),'[]'));end if;
 if act='record' then
  aid:=(p->>'awardId')::uuid;select room_id into rid from partner_pilot.awards where id=aid and auth.uid()=any(members);if rid is null then raise exception 'NOT_MEMBER';end if;
  select * into r from partner_pilot.rooms where id=rid;
  if partner_pilot.source_allowed(r.paper,true) then return partner_pilot.learning_snapshot(rid);end if;
  return partner_pilot.paused_snapshot(rid)||jsonb_build_object('recordOnly',true);
 end if;
 if act='create' and not partner_pilot.source_allowed(p->>'paper',false) then raise exception 'SOURCE_CHANGED';end if;
 if act='lookup' then select paper into pid from partner_pilot.rooms where code=p->>'code';if not partner_pilot.source_allowed(pid,false) then raise exception 'ROOM_NOT_FOUND';end if;end if;
 if p ? 'roomId' then
  rid:=(p->>'roomId')::uuid;
  if act='start' then select * into r from partner_pilot.rooms where id=rid for update;else select * into r from partner_pilot.rooms where id=rid;end if;
  if act='join' then if not partner_pilot.source_allowed(r.paper,false) then raise exception 'SOURCE_CHANGED';end if;
  else
   if not exists(select 1 from partner_pilot.members where room_id=rid and user_id=auth.uid()) then raise exception 'NOT_MEMBER';end if;
   if not partner_pilot.source_allowed(r.paper,r.started) then
    if act='snapshot' then return partner_pilot.paused_snapshot(rid);end if;
    if act<>'save_draft' and not(act='leave' and not r.started) then raise exception 'SOURCE_CHANGED';end if;
   end if;
  end if;
 end if;
 if act='start' and r.started then return partner_pilot.learning_snapshot(rid);end if;
 if act='settle' then perform partner_pilot.claim_award(rid);return partner_pilot.learning_snapshot(rid);end if;
 result:=partner_pilot.action_core(p);
 if rid is not null and not partner_pilot.source_allowed(r.paper,r.started) and act='save_draft' then return partner_pilot.paused_snapshot(rid);end if;
 if act in ('finish','answer') then perform partner_pilot.claim_award(rid);result:=partner_pilot.learning_snapshot(rid);end if;
 return result;
end $$;
create or replace function public.quiz_partner_pilot_can_subscribe(topic text) returns boolean language sql stable security definer set search_path='' as $$
 select partner_pilot.can_access() and exists(select 1 from partner_pilot.rooms r join partner_pilot.members m on m.room_id=r.id where m.user_id=auth.uid() and topic='partner-pilot:'||r.id||':'||r.epoch and partner_pilot.source_allowed(r.paper,r.started))
$$;
revoke all on all tables in schema partner_pilot from public,anon,authenticated;
revoke all on all sequences in schema partner_pilot from public,anon,authenticated;
revoke all on all functions in schema partner_pilot from public,anon,authenticated;
revoke all on function public.quiz_partner_rewards(text),public.quiz_partner_reward_ids(text) from public,anon,authenticated;
grant execute on function public.quiz_partner_rewards(text) to authenticated;
grant execute on function public.quiz_partner_reward_ids(text) to service_role;
revoke all on function public.quiz_partner_pilot_action(jsonb),public.quiz_partner_pilot_access(),public.quiz_partner_pilot_can_subscribe(text) from public,anon;
grant execute on function public.quiz_partner_pilot_action(jsonb),public.quiz_partner_pilot_access(),public.quiz_partner_pilot_can_subscribe(text) to authenticated;
