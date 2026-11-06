-- Incremental only: no historical answers, reviews, rooms or awards are rewritten.
begin;
do $guard$
begin
 if md5(pg_get_functiondef('partner_pilot.team_rooms()'::regprocedure))<>'67de92209ccc003c55bfab4d68980f5c'
 or md5(pg_get_functiondef('partner_pilot.action_core(jsonb)'::regprocedure))<>'6fa6d2f4372e65f3453fe41d6c648bef'
 or md5(pg_get_functiondef('public.quiz_partner_pilot_action(jsonb)'::regprocedure))<>'8dcef95dd78cf59d57d088b44950ec46' then
  raise exception 'REVIEW_COMPLETION_BASE_CHANGED';
 end if;
end $guard$;

create or replace function partner_pilot.team_rooms() returns jsonb language sql stable security definer set search_path='' as $rooms$
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',r.id,'team',r.team,'started',r.started,'finished',r.finished,'capacity',r.capacity,'host',r.host,
  'title',p.title,'subject',p.subject,'total',p.total,'kind',p.kind,
  'paused',not partner_pilot.source_allowed(r.paper,r.started),
  'inviteExpired',not r.started and r.expires_at<=now(),
  'count',(select count(*) from partner_pilot.members m where m.room_id=r.id),
  'members',(select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',u.display_name,
   'assigned',case when r.started then (select count(*) from partner_pilot.paper_items i where i.paper_id=r.paper and partner_pilot.owner_of(r.id,i.qid)=m.user_id) else 0 end,
   'submitted',(select count(distinct a.qid) from partner_pilot.answers a where a.room_id=r.id and a.user_id=m.user_id),
   'reviewed',exists(select 1 from partner_pilot.review_seen v where v.room_id=r.id and v.user_id=m.user_id)) order by m.joined_at,m.user_id),'[]')
   from partner_pilot.members m join partner_pilot.allowed_users u on u.user_id=m.user_id where m.room_id=r.id),
  'phase',case when r.finished then 'completed' when not r.started then 'waiting'
   when s.submitted=s.total then 'review' else 'practice' end,
  'progress',jsonb_build_object('total',s.total,'submitted',s.submitted,'graded',s.graded,
   'correct',case when s.submitted=s.total and r.started then s.correct else null end,
   'reviewed',(select count(*) from partner_pilot.review_seen v where v.room_id=r.id),
   'meReviewed',exists(select 1 from partner_pilot.review_seen v where v.room_id=r.id and v.user_id=auth.uid()),
   'award',(select jsonb_build_object('leaves',a.leaves,'flowers',a.flowers,'earnedHere',a.room_id=r.id)
     from partner_pilot.awards a where a.content_key=p.content_key and a.member_key=(select string_agg(user_id::text,',' order by user_id) from partner_pilot.members where room_id=r.id)))
 ) order by r.created_at desc,r.id),'[]'::jsonb)
 from partner_pilot.rooms r join partner_pilot.members mine on mine.room_id=r.id and mine.user_id=auth.uid() join partner_pilot.papers p on p.id=r.paper
 cross join lateral (select partner_pilot.paper_total(r.paper) total,
  (select count(distinct a.qid) from partner_pilot.answers a where a.room_id=r.id) submitted,
  (select count(*) from partner_pilot.paper_items i join partner_pilot.question_bank q on q.id=i.qid where i.paper_id=r.paper and coalesce(q.past_meta->>'selfCheck','false')<>'true') graded,
  (select count(*) from (select distinct on(a.qid) a.correct from partner_pilot.answers a where a.room_id=r.id order by a.qid,a.attempt desc)x where correct) correct) s
$rooms$;

do $migration$
declare definition text;needle text;
begin
 select pg_get_functiondef('partner_pilot.action_core(jsonb)'::regprocedure) into definition;
 needle:='insert into partner_pilot.review_seen values(rid,uid,body,clock_timestamp()) on conflict(room_id,user_id) do update set reflection=excluded.reflection;';
 if position(needle in definition)=0 or position('where id=rid for update' in definition)=0 then raise exception 'REVIEW_COMPLETION_LOCK_OR_BRANCH_MISSING';end if;
 definition:=replace(definition,needle,needle||E'\n  -- The room row is already locked: the last explicit review completes atomically.\n  if (select count(*) from partner_pilot.review_seen where room_id=rid)=r.capacity then update partner_pilot.rooms set finished=true where id=rid;end if;');
 execute definition;
 select pg_get_functiondef('public.quiz_partner_pilot_action(jsonb)'::regprocedure) into definition;
 needle:='if act in (''finish'',''answer'') and exists';
 if position(needle in definition)=0 then raise exception 'REVIEW_COMPLETION_AWARD_BRANCH_MISSING';end if;
 execute replace(definition,needle,'if act in (''finish'',''answer'',''review'') and exists');
end $migration$;
commit;
