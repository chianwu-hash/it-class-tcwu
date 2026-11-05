-- Team onboarding only; existing rooms, allocations, answers, drafts and awards are not rewritten.
begin;
create or replace function partner_pilot.team_rooms() returns jsonb language sql stable security definer set search_path='' as $rooms$
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',r.id,'team',r.team,'started',r.started,'finished',r.finished,'capacity',r.capacity,'host',r.host,
  'title',p.title,'subject',p.subject,'total',p.total,'kind',p.kind,
  'paused',not partner_pilot.source_allowed(r.paper,r.started),
  'inviteExpired',not r.started and r.expires_at<=now(),
  'count',(select count(*) from partner_pilot.members m where m.room_id=r.id),
  'members',(select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',u.display_name) order by m.joined_at,m.user_id),'[]') from partner_pilot.members m join partner_pilot.allowed_users u on u.user_id=m.user_id where m.room_id=r.id),
  'phase',case when r.finished then 'completed' when not r.started then 'waiting'
   when not exists(select 1 from partner_pilot.paper_items pi where pi.paper_id=r.paper and not exists(select 1 from partner_pilot.answers a where a.room_id=r.id and a.qid=pi.qid)) then 'review' else 'practice' end
 ) order by r.created_at desc,r.id),'[]'::jsonb)
 from partner_pilot.rooms r join partner_pilot.members mine on mine.room_id=r.id and mine.user_id=auth.uid() join partner_pilot.papers p on p.id=r.paper
$rooms$;
revoke all on function partner_pilot.team_rooms() from public,anon,authenticated,service_role;

-- Replace definitions in place, preserving OIDs, ACLs and caller dependencies.
do $migration$
declare definition text;old_me text;replacement text;
begin
 select pg_get_functiondef('partner_pilot.lobby_action(jsonb)'::regprocedure) into definition;
 if md5(definition)<>'81ccdaf585addd657cd582c8b03575cd' then raise exception 'TEAM_FLOW_BASE_CHANGED: partner_pilot.lobby_action(jsonb)';end if;
 select line into old_me from regexp_split_to_table(definition,E'\n') line where trim(line) like 'if act=''me'' then return %';
 if old_me is null then raise exception 'TEAM_FLOW_ME_MISSING';end if;
 replacement:=' if act=''me'' then return jsonb_build_object(''id'',auth.uid(),''name'',(select display_name from partner_pilot.allowed_users where user_id=auth.uid()),''rooms'',partner_pilot.team_rooms());end if;';
 definition:=replace(definition,old_me,replacement);
 if position('if cnt<>r.capacity or exists(select 1 from partner_pilot.members where room_id=rid and not ready)' in definition)=0 then raise exception 'TEAM_FLOW_START_MISSING';end if;
 definition:=replace(definition,'if cnt<>r.capacity or exists(select 1 from partner_pilot.members where room_id=rid and not ready)','if cnt<>r.capacity');
 definition:=replace(definition,'elsif act=''start'' then','elsif act=''start'' then'||E'\n    if r.host<>uid then raise exception ''HOST_ONLY'';end if;');
 definition:=replace(definition,'update partner_pilot.members set ready=false where room_id=rid;','-- Membership changes do not reset a preparation gate.');
 execute definition;
 select pg_get_functiondef('public.quiz_partner_pilot_action(jsonb)'::regprocedure) into definition;
 if md5(definition)<>'b9bd449a3b6833f0fe085cbe5e0a7fac' then raise exception 'TEAM_FLOW_BASE_CHANGED: public.quiz_partner_pilot_action(jsonb)';end if;
 select line into old_me from regexp_split_to_table(definition,E'\n') line where trim(line) like 'if act=''me'' then return %';
 if old_me is null then raise exception 'TEAM_FLOW_ME_MISSING';end if;
 replacement:=' if act=''me'' then return jsonb_build_object(''id'',auth.uid(),''name'',(select display_name from partner_pilot.allowed_users where user_id=auth.uid()),''rooms'',partner_pilot.team_rooms());end if;';
 definition:=replace(definition,old_me,replacement);
 execute definition;
 select pg_get_functiondef('partner_pilot.freeze_allocation()'::regprocedure) into definition;
 if md5(definition)<>'f56e173b7a87239885735f92ca6e8cff' then raise exception 'TEAM_FLOW_BASE_CHANGED: partner_pilot.freeze_allocation()';end if;
 if position(' or exists(select 1 from partner_pilot.members where room_id=new.id and not ready)' in definition)=0 then raise exception 'TEAM_FLOW_FREEZE_GATE_MISSING';end if;
 definition:=replace(definition,' or exists(select 1 from partner_pilot.members where room_id=new.id and not ready)','');
 execute definition;
end $migration$;
notify pgrst,'reload schema';
commit;
