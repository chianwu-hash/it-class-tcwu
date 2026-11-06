-- New opt-in pre-team stage. Ordinary rooms, answers, reviews and awards are not rewritten.
begin;
set local lock_timeout='3s';set local statement_timeout='90s';
do $guard$begin
 if to_regprocedure('public.quiz_session_class_allowed(uuid,text)') is null
 or md5(pg_get_functiondef('public.quiz_partner_pilot_action(jsonb)'::regprocedure))<>'154f9f65eaff002236cb0dab15001b16' then raise exception 'MATCHMAKING_BASE_CHANGED';end if;
end $guard$;
create table partner_pilot.match_settings(
 grade int primary key check(grade in(3,4,6,9)),enabled boolean not null default false,
 batch_seconds int not null default 30 check(batch_seconds=30),lease_seconds int not null default 120 check(lease_seconds between 60 and 900),
 warning_seconds int not null default 60 check(warning_seconds>=30),
 handoff_seconds int check(handoff_seconds>=90),close_seconds int check(close_seconds>=180),
 check(handoff_seconds is null or handoff_seconds>warning_seconds),check(close_seconds is null or handoff_seconds is null or close_seconds>handoff_seconds));
insert into partner_pilot.match_settings(grade) values(3),(4),(6),(9);
create table partner_pilot.match_batches(
 id uuid primary key default gen_random_uuid(),grade int not null references partner_pilot.match_settings(grade),
 deadline timestamptz,closed boolean not null default false,created_at timestamptz not null default clock_timestamp(),unique(id,grade));
create unique index match_one_open_batch on partner_pilot.match_batches(grade) where not closed;
create table partner_pilot.match_teams(
 id uuid primary key default gen_random_uuid(),grade int not null references partner_pilot.match_settings(grade),
 host uuid not null references auth.users(id),participants uuid[] not null,
 selected_paper text,revision int not null default 1,phase text not null default 'selecting' check(phase in('selecting','started','closed')),
 room_id uuid references partner_pilot.rooms(id),reason text,
 created_at timestamptz not null default clock_timestamp(),activity_at timestamptz not null default clock_timestamp(),captain_at timestamptz not null default clock_timestamp(),unique(id,grade));
create table partner_pilot.match_presence(
 user_id uuid primary key references auth.users(id),ticket uuid not null default gen_random_uuid(),grade int not null,
 batch_id uuid,team_id uuid,seen_at timestamptz not null default clock_timestamp(),
 check((batch_id is null)<>(team_id is null)),
 foreign key(batch_id,grade) references partner_pilot.match_batches(id,grade),foreign key(team_id,grade) references partner_pilot.match_teams(id,grade));
create index match_presence_batch on partner_pilot.match_presence(batch_id);
create index match_presence_team on partner_pilot.match_presence(team_id);
create index match_selecting_teams on partner_pilot.match_teams(grade) where phase='selecting';
create table partner_pilot.match_requests(user_id uuid not null references auth.users(id),request_id text not null,body jsonb not null,result jsonb not null,created_at timestamptz not null default clock_timestamp(),primary key(user_id,request_id));
alter table partner_pilot.match_settings enable row level security;alter table partner_pilot.match_batches enable row level security;
alter table partner_pilot.match_teams enable row level security;alter table partner_pilot.match_presence enable row level security;alter table partner_pilot.match_requests enable row level security;
revoke all on partner_pilot.match_settings,partner_pilot.match_batches,partner_pilot.match_teams,partner_pilot.match_presence,partner_pilot.match_requests from public,anon,authenticated,service_role;

create function partner_pilot.match_partition(n int) returns int[] language plpgsql immutable set search_path='' as $function$
declare groups int;sizes int[]:='{}';i int;
begin
 if n<2 then return sizes;end if;if n>2000 then raise exception 'MATCH_POOL_FULL';end if;
 groups:=ceil(n/4.0)::int;for i in 1..groups loop sizes:=array_append(sizes,n/groups+case when i<=n%groups then 1 else 0 end);end loop;return sizes;
end $function$;

create function partner_pilot.match_paper_ok(pid text,roster uuid[],captain uuid) returns boolean
language plpgsql stable security definer set search_path='' as $function$
declare p partner_pilot.papers;cnt int:=cardinality(roster);g int;doc jsonb;units int;sid uuid;
begin
 if cnt not between 2 and 4 then return false;end if;
 select min(left(e.class_code,1)::int) into g from auth.users u join public.student_enrollments e on e.email=lower(u.email) and e.school_year=115
 where u.id=any(roster) and u.email_confirmed_at is not null and u.raw_app_meta_data->'providers' ? 'google' and e.class_code~'^[3469][0-9]{2}$';
 if g is null or (select count(*) from auth.users u join public.student_enrollments e on e.email=lower(u.email) and e.school_year=115 where u.id=any(roster) and u.email_confirmed_at is not null and u.raw_app_meta_data->'providers' ? 'google' and e.class_code~'^[3469][0-9]{2}$' and left(e.class_code,1)::int=g)<>cnt then return false;end if;
 if left(coalesce(pid,''),5)='self:' then
  if substring(pid from 6)!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' or not(captain=any(roster)) then return false;end if;
  sid:=substring(pid from 6)::uuid;
  select v.document into doc from public.quiz_generated_papers x join public.quiz_sessions s on s.id=x.session_id join public.quiz_versions v on v.id=s.version_id
  join auth.users u on u.id=captain join public.student_enrollments e on e.email=lower(u.email) and e.school_year=115
  where s.id=sid and x.user_id=captain and s.owner_id=captain and x.deleted_at is null and x.config->>'kind'='self' and x.config->>'count' in('10','20')
   and s.access_mode='self' and s.status='open' and s.school_year=115 and s.class_codes ? e.class_code and left(e.class_code,1)::int=g;
  if doc is null or not partner_pilot.self_document_ok(doc) then return false;end if;
  select count(*) into units from jsonb_array_elements(doc->'blocks') b cross join lateral jsonb_array_elements(b->'questions') q;
  return units=20 or units=10 and cnt=2;
 end if;
 select * into p from partner_pilot.papers where id=pid and enabled and is_real and origin is null and grade=g;
 if p.id is null then return false;end if;
 if p.past_meta is not null then
  if not exists(select 1 from public.quiz_past_papers s where s.id=p.past_meta->>'sourcePaper' and s.enabled and s.grade=g and s.active_version=p.source_version) then return false;end if;
  begin select count(distinct unit_id) into units from partner_pilot.allocation_items(pid);exception when raise_exception then return false;end;
  return units>=cnt;
 end if;
 return (p.total=20 or p.total=10 and cnt=2) and not exists(
  select 1 from auth.users u join public.student_enrollments e on e.email=lower(u.email) and e.school_year=115 where u.id=any(roster) and not exists(
   select 1 from partner_pilot.paper_sources ps join public.quiz_sessions s on s.id=ps.session_id where ps.paper_id=pid and s.status='open' and s.library_visible and s.access_mode='practice' and s.school_year=115 and s.version_id=p.source_version and public.quiz_session_class_allowed(s.id,e.class_code)
   and not exists(select 1 from public.quiz_generated_papers x where x.session_id=s.id) and not exists(select 1 from public.quiz_learning_sessions x where x.session_id=s.id)));
end $function$;

create function partner_pilot.match_available(g int) returns boolean language plpgsql stable security definer set search_path='' as $function$
declare p record;units int;
begin
 for p in select * from partner_pilot.papers where grade=g and enabled and is_real and origin is null order by (kind='leaf' and total=20) desc,id loop
  if p.past_meta is null then
   if p.total=20 and exists(select 1 from partner_pilot.paper_sources ps join public.quiz_sessions s on s.id=ps.session_id join public.quiz_version_meta m on m.version_id=s.version_id
    where ps.paper_id=p.id and s.status='open' and s.library_visible and s.access_mode='practice' and s.school_year=115 and s.version_id=p.source_version and left(m.catalog->>'volume',1)=g::text
    and not exists(select 1 from public.quiz_generated_papers x where x.session_id=s.id) and not exists(select 1 from public.quiz_learning_sessions x where x.session_id=s.id)) then return true;end if;
  elsif exists(select 1 from public.quiz_past_papers s where s.id=p.past_meta->>'sourcePaper' and s.enabled and s.grade=g and s.active_version=p.source_version) then
   begin select count(distinct unit_id) into units from partner_pilot.allocation_items(p.id);exception when raise_exception then units:=0;end;
   if units>=4 then return true;end if;
  end if;
 end loop;return false;
end $function$;

-- Caller owns the grade advisory lock. No worker/cron and no browser decides a cohort boundary.
create function partner_pilot.match_sweep(g int) returns void language plpgsql security definer set search_path='' as $function$
declare policy partner_pilot.match_settings;b partner_pilot.match_batches;t partner_pilot.match_teams;
 roster uuid[];group_roster uuid[];sizes int[];size int;offset_n int:=1;captain uuid;tid uuid;
begin
 select * into policy from partner_pilot.match_settings where grade=g;
 delete from partner_pilot.match_presence a where grade=g and batch_id is not null and (seen_at<clock_timestamp()-make_interval(secs=>policy.lease_seconds)
 or not exists(select 1 from auth.users u join public.student_enrollments e on e.email=lower(u.email) and e.school_year=115 where u.id=a.user_id and u.email_confirmed_at is not null and u.raw_app_meta_data->'providers' ? 'google' and e.class_code~'^[3469][0-9]{2}$' and left(e.class_code,1)::int=g));
 for t in select * from partner_pilot.match_teams where grade=g and phase='selecting' for update loop
  if policy.close_seconds is not null and t.activity_at<clock_timestamp()-make_interval(secs=>policy.close_seconds) then
   update partner_pilot.match_teams set phase='closed',reason='idle',revision=revision+1 where id=t.id;delete from partner_pilot.match_presence where team_id=t.id;
  elsif policy.handoff_seconds is not null and t.captain_at<clock_timestamp()-make_interval(secs=>policy.handoff_seconds) then
   select user_id into captain from partner_pilot.match_presence where team_id=t.id and user_id<>t.host and seen_at>clock_timestamp()-make_interval(secs=>policy.lease_seconds) order by random() limit 1;
   if captain is not null then update partner_pilot.match_teams set host=captain,captain_at=clock_timestamp(),selected_paper=case when left(selected_paper,5)='self:' then null else selected_paper end,revision=revision+1 where id=t.id;end if;
  end if;
 end loop;
 select * into b from partner_pilot.match_batches where grade=g and not closed for update;
 if b.id is null or b.deadline is null or b.deadline>clock_timestamp() then return;end if;
 select array_agg(user_id order by random()) into roster from partner_pilot.match_presence where batch_id=b.id;
 if coalesce(cardinality(roster),0)<2 then update partner_pilot.match_batches set deadline=null where id=b.id;return;end if;
 sizes:=partner_pilot.match_partition(cardinality(roster));
 foreach size in array sizes loop
  group_roster:=roster[offset_n:offset_n+size-1];captain:=group_roster[1+floor(random()*size)::int];
  insert into partner_pilot.match_teams(grade,host,participants) values(g,captain,group_roster) returning id into tid;
  update partner_pilot.match_presence set team_id=tid,batch_id=null where user_id=any(group_roster);offset_n:=offset_n+size;
 end loop;
 update partner_pilot.match_batches set closed=true where id=b.id;
end $function$;

create function partner_pilot.match_self_key(doc jsonb,g int) returns text language plpgsql immutable set search_path='' as $function$
declare canonical jsonb:=doc;url text;hash text;key text;
begin
 for url in select distinct value#>>'{}' from jsonb_path_query(doc,'$.blocks[*].**.media[*].url') a(value) loop
  hash:=substring(url from '([a-f0-9]{64})$');if hash is null then return null;end if;
  canonical:=replace(canonical::text,to_jsonb(url)::text,to_jsonb('asset:'||hash)::text)::jsonb;
 end loop;
 select 'self:v1:'||encode(sha256(convert_to(jsonb_build_object('grade',g::text,'year',115,'semester',1,
 'questions',jsonb_agg(jsonb_build_object('material',b->'material','question',q-'id') order by jsonb_build_object('material',b->'material','question',q-'id')::text))::text,'UTF8')),'hex') into key
 from jsonb_array_elements(canonical->'blocks') b cross join lateral jsonb_array_elements(b->'questions') q;
 return key;
end $function$;

create function partner_pilot.match_snapshot(team_hint uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $function$
declare a partner_pilot.match_presence;t partner_pilot.match_teams;policy partner_pilot.match_settings;g int;selected jsonb;ready boolean;result jsonb;selected_key text;
begin
 select left(e.class_code,1)::int into strict g from auth.users u join public.student_enrollments e on e.email=lower(u.email) and e.school_year=115 where u.id=auth.uid();
 select * into policy from partner_pilot.match_settings where grade=g;
 select * into a from partner_pilot.match_presence where user_id=auth.uid();
 result:=jsonb_build_object('now',clock_timestamp(),'enabled',coalesce(policy.enabled,false),'available',coalesce(policy.enabled,false) and (a.user_id is not null or partner_pilot.match_available(g)),'grade',g);
 if a.user_id is null then
  if team_hint is not null then select * into t from partner_pilot.match_teams where id=team_hint and auth.uid()=any(participants);end if;
  if t.phase='started' and exists(select 1 from partner_pilot.members where room_id=t.room_id and user_id=auth.uid()) then return result||jsonb_build_object('phase','active','roomId',t.room_id);end if;
  if team_hint is null then select * into t from partner_pilot.match_teams where phase='closed' and auth.uid()=any(participants) and created_at>clock_timestamp()-interval '5 minutes' order by created_at desc limit 1;end if;
  return result||jsonb_build_object('phase','idle','reason',t.reason);
 end if;
 if a.grade<>g then return result||jsonb_build_object('phase','identity_changed','ticket',a.ticket);end if;
 if a.batch_id is not null then return result||jsonb_build_object('phase','waiting','ticket',a.ticket,'deadline',(select deadline from partner_pilot.match_batches where id=a.batch_id));end if;
 select * into t from partner_pilot.match_teams where id=a.team_id;
 ready:=t.selected_paper is not null and partner_pilot.match_paper_ok(t.selected_paper,t.participants,t.host);
 if ready then
  if left(t.selected_paper,5)='self:' then select jsonb_build_object('id',t.selected_paper,'title',coalesce(x.display_name,v.document->>'title'),'total',(select count(*) from jsonb_array_elements(v.document->'blocks') b cross join lateral jsonb_array_elements(b->'questions') q),'kind','leaf'),partner_pilot.match_self_key(v.document,g) into selected,selected_key from public.quiz_generated_papers x join public.quiz_sessions s on s.id=x.session_id join public.quiz_versions v on v.id=s.version_id where s.id=substring(t.selected_paper from 6)::uuid;
  else select jsonb_build_object('id',id,'title',title,'total',total,'kind',kind),content_key into selected,selected_key from partner_pilot.papers where id=t.selected_paper;end if;
 end if;
 return result||jsonb_build_object('phase','selecting','ticket',a.ticket,'team',jsonb_build_object('id',t.id,'revision',t.revision,'host',t.host,'members',(select jsonb_agg(jsonb_build_object('id',u.user_id,'name',u.display_name) order by u.user_id) from partner_pilot.allowed_users u where u.user_id=any(t.participants)),
  'selected',selected,'selectionUnavailable',t.selected_paper is not null and not ready,
  'idleWarning',t.captain_at<clock_timestamp()-make_interval(secs=>policy.warning_seconds),
  'handoffAt',case when policy.handoff_seconds is not null then t.captain_at+make_interval(secs=>policy.handoff_seconds) end,
  'closeAt',case when policy.close_seconds is not null then t.activity_at+make_interval(secs=>policy.close_seconds) end,
  'alreadyAwarded',ready and exists(select 1 from partner_pilot.awards where content_key=selected_key and member_key=(select string_agg(u::text,',' order by u) from unnest(t.participants) u))));
end $function$;

create function public.quiz_partner_match_action(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $function$
declare act text:=p->>'action';req text:=p->>'requestId';g int;policy partner_pilot.match_settings;
 a partner_pilot.match_presence;t partner_pilot.match_teams;b partner_pilot.match_batches;prior partner_pilot.match_requests;
 result jsonb;paper text;pid text;room jsonb;member uuid;hint uuid;old_host uuid;
begin
 if not partner_pilot.can_access() then raise exception 'ACCESS_DENIED';end if;
 if jsonb_typeof(p) is distinct from 'object' or act is null or act not in('status','join','cancel','leave','catalog','select','ping','start') then raise exception 'INVALID_ACTION';end if;
 select left(e.class_code,1)::int into strict g from auth.users u join public.student_enrollments e on e.email=lower(u.email) and e.school_year=115 where u.id=auth.uid();
 select * into a from partner_pilot.match_presence where user_id=auth.uid();
 perform pg_advisory_xact_lock(hashtextextended('partner-match-grade:'||coalesce(a.grade,g),0));
 perform partner_pilot.register_self();select * into policy from partner_pilot.match_settings where grade=g;
 if act in('join','cancel','leave','select','ping','start') then
  if req is null or length(req) not between 8 and 80 then raise exception 'REQUEST_ID_REQUIRED';end if;
  select * into prior from partner_pilot.match_requests where user_id=auth.uid() and request_id=req;
  if found then if prior.body<>p then raise exception 'REQUEST_REUSED';end if;return prior.result;end if;
  if(select count(*) from partner_pilot.match_requests where user_id=auth.uid() and created_at>clock_timestamp()-interval '1 minute')>=20 then raise exception 'MATCH_RATE_LIMIT';end if;
 end if;
 if p ? 'teamId' then hint:=(p->>'teamId')::uuid;end if;
 perform partner_pilot.match_sweep(coalesce(a.grade,g));select * into a from partner_pilot.match_presence where user_id=auth.uid();
 if act='status' then
  if a.user_id is not null and a.grade=g and a.seen_at<clock_timestamp()-interval '15 seconds' then update partner_pilot.match_presence set seen_at=clock_timestamp() where user_id=auth.uid();end if;
  return partner_pilot.match_snapshot(hint);
 end if;
 if a.user_id is not null and a.grade<>g and act not in('cancel','leave') then raise exception 'MATCH_IDENTITY_CHANGED';end if;
 if act='join' then
  if not coalesce(policy.enabled,false) then raise exception 'MATCH_DISABLED';end if;
  if not partner_pilot.match_available(g) then raise exception 'MATCH_NO_PAPER';end if;
  if a.user_id is null then
   select * into b from partner_pilot.match_batches where grade=g and not closed;
   if b.id is null then insert into partner_pilot.match_batches(grade,deadline) values(g,clock_timestamp()+make_interval(secs=>policy.batch_seconds)) returning * into b;end if;
   if(select count(*) from partner_pilot.match_presence where batch_id=b.id)>=2000 then raise exception 'MATCH_POOL_FULL';end if;
   insert into partner_pilot.match_presence(user_id,grade,batch_id) values(auth.uid(),g,b.id);
   if b.deadline is null then update partner_pilot.match_batches set deadline=clock_timestamp()+make_interval(secs=>policy.batch_seconds) where id=b.id;end if;
  end if;
 elsif act in('cancel','leave') then
  if a.user_id is not null then
   if a.ticket::text is distinct from p->>'ticket' or (hint is not null and hint is distinct from a.team_id) then raise exception 'MATCH_CHANGED';end if;
   if a.team_id is not null then
    select * into t from partner_pilot.match_teams where id=a.team_id for update;
    if t.phase<>'selecting' then raise exception 'ALREADY_STARTED';end if;
    t.participants:=array_remove(t.participants,auth.uid());
    if cardinality(t.participants)<2 then update partner_pilot.match_teams set phase='closed',participants=t.participants,reason='alone',revision=revision+1 where id=t.id;delete from partner_pilot.match_presence where team_id=t.id;
    else
     old_host:=t.host;if t.host=auth.uid() then select u into t.host from unnest(t.participants) u order by random() limit 1;end if;
     update partner_pilot.match_teams set participants=t.participants,host=t.host,selected_paper=case when old_host<>t.host and left(selected_paper,5)='self:' then null else selected_paper end,captain_at=case when old_host<>t.host then clock_timestamp() else captain_at end,revision=revision+1 where id=t.id;
    end if;
   end if;
   delete from partner_pilot.match_presence where user_id=auth.uid();
  end if;
 else
  if a.team_id is null or a.ticket::text is distinct from p->>'ticket' or hint is distinct from a.team_id then raise exception 'MATCH_CHANGED';end if;
  select * into t from partner_pilot.match_teams where id=a.team_id for update;
  if t.phase<>'selecting' then raise exception 'ALREADY_STARTED';end if;
  if act='catalog' then
   if t.host<>auth.uid() then raise exception 'HOST_ONLY';end if;
   return jsonb_build_object('teamId',t.id,'revision',t.revision,'papers',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'grade',grade,'subject',subject,'kind',kind,'total',total,'past',past_meta is not null) order by subject,title) from partner_pilot.papers where origin is null and grade=t.grade and enabled and is_real and (kind='flower' or total=20 or total=10 and cardinality(t.participants)=2) and partner_pilot.match_paper_ok(id,t.participants,t.host)),'[]')||coalesce((select jsonb_agg(x) from jsonb_array_elements(partner_pilot.self_catalog()) x where partner_pilot.match_paper_ok(x->>'id',t.participants,t.host)),'[]'));
  elsif act='ping' then
   update partner_pilot.match_teams set activity_at=clock_timestamp(),captain_at=case when host=auth.uid() then clock_timestamp() else captain_at end where id=t.id;
  else
   if t.host<>auth.uid() then raise exception 'HOST_ONLY';end if;
   if t.revision is distinct from (p->>'revision')::int then raise exception 'STALE_REVISION';end if;
   if act='select' then
    if not partner_pilot.match_paper_ok(p->>'paper',t.participants,t.host) then raise exception 'MATCH_PAPER_UNAVAILABLE';end if;
    update partner_pilot.match_teams set selected_paper=p->>'paper',activity_at=clock_timestamp(),captain_at=clock_timestamp(),revision=revision+1 where id=t.id;
   elsif act='start' then
    paper:=t.selected_paper;
    if not partner_pilot.match_paper_ok(paper,t.participants,t.host) then raise exception 'MATCH_PAPER_UNAVAILABLE';end if;
    perform 1 from auth.users u join public.student_enrollments e on e.email=lower(u.email) and e.school_year=115 where u.id=any(t.participants) for share of u,e;
    if left(paper,5)='self:' then pid:='custom:'||encode(sha256(convert_to(auth.uid()::text||':match:'||req,'UTF8')),'hex');perform partner_pilot.copy_self(substring(paper from 6)::uuid,pid);
    else
     pid:=paper;
     perform 1 from public.quiz_sessions s join partner_pilot.paper_sources ps on ps.session_id=s.id where ps.paper_id=pid for share of s;
     perform 1 from public.quiz_past_papers s join partner_pilot.papers pp on pp.past_meta->>'sourcePaper'=s.id where pp.id=pid for share of s;
    end if;
    if not partner_pilot.match_paper_ok(paper,t.participants,t.host) then raise exception 'MATCH_PAPER_UNAVAILABLE';end if;
    room:=partner_pilot.lobby_action(jsonb_build_object('action','create','paper',pid,'capacity',cardinality(t.participants),'theme','forest','team','一起練功隊','requestId',req||':create'));
    foreach member in array t.participants loop insert into partner_pilot.members(room_id,user_id,ready) values((room->>'id')::uuid,member,true) on conflict(room_id,user_id) do update set ready=true;end loop;
    room:=partner_pilot.lobby_action(jsonb_build_object('action','start','roomId',room->>'id','revision',room->'revision','requestId',req||':start'));
    update partner_pilot.match_teams set phase='started',room_id=(room->>'id')::uuid,revision=revision+1 where id=t.id;
    delete from partner_pilot.match_presence where team_id=t.id;
    result:=jsonb_build_object('phase','active','roomId',room->>'id','now',clock_timestamp());
   end if;
  end if;
 end if;
 result:=coalesce(result,partner_pilot.match_snapshot(hint));
 insert into partner_pilot.match_requests(user_id,request_id,body,result) values(auth.uid(),req,p,result);
 return result;
end $function$;

-- Existing invite creates/joins cannot race the same user's active opt-in queue/pre-team.
do $wrapper$declare d text;needle text:='perform partner_pilot.register_self();';begin
 select pg_get_functiondef('public.quiz_partner_pilot_action(jsonb)'::regprocedure) into d;
 if position(needle in d)=0 then raise exception 'MATCHMAKING_ENTRY_CHANGED';end if;
 execute replace(d,needle,'if act in (''create'',''join'') then perform pg_advisory_xact_lock(hashtextextended(''partner-match-grade:''||(select left(e.class_code,1) from auth.users u join public.student_enrollments e on e.email=lower(u.email) and e.school_year=115 where u.id=auth.uid()),0));if exists(select 1 from partner_pilot.match_presence where user_id=auth.uid()) then raise exception ''MATCH_ACTIVE'';end if;end if;'||E'\n '||needle);
end $wrapper$;
revoke all on function partner_pilot.match_partition(int),partner_pilot.match_paper_ok(text,uuid[],uuid),partner_pilot.match_available(int),partner_pilot.match_sweep(int),partner_pilot.match_snapshot(uuid),partner_pilot.match_self_key(jsonb,int) from public,anon,authenticated,service_role;
grant execute on function partner_pilot.match_partition(int),partner_pilot.match_paper_ok(text,uuid[],uuid),partner_pilot.match_available(int),partner_pilot.match_sweep(int),partner_pilot.match_snapshot(uuid),partner_pilot.match_self_key(jsonb,int) to postgres;
revoke all on function public.quiz_partner_match_action(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.quiz_partner_match_action(jsonb) to postgres,authenticated;
notify pgrst,'reload schema';
commit;
