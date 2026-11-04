-- Synthetic-test schema only. Definitions from the restricted pilot; contains no student rows or real questions.
create schema if not exists partner_pilot;
create table public.student_enrollments("school_year" smallint not null,"email" text not null,"class_code" text not null,"seat_no" smallint not null,"display_name" text not null);
alter table public.student_enrollments add CHECK ((class_code ~ '^[1-69][0-9]{2}$'::text));
alter table public.student_enrollments add CHECK (((email = lower(TRIM(BOTH FROM email))) AND (POSITION(('@'::text) IN (email)) > 1)));
alter table public.student_enrollments add PRIMARY KEY (school_year, email);
alter table public.student_enrollments add CHECK (((school_year >= 100) AND (school_year <= 999)));
alter table public.student_enrollments add UNIQUE (school_year, class_code, seat_no);
alter table public.student_enrollments add CHECK (((seat_no >= 1) AND (seat_no <= 99)));
create table public.quiz_sessions("id" uuid not null,"owner_id" uuid not null,"version_id" uuid not null,"school_year" integer not null,"class_codes" jsonb not null,"reveal" text not null,"shuffle_questions" boolean not null,"shuffle_options" boolean not null,"access_mode" text default 'classroom'::text not null,"status" text default 'open'::text not null,"created_at" timestamp with time zone default now() not null,"library_visible" boolean default true not null);
alter table public.quiz_sessions add CHECK ((access_mode = ANY (ARRAY['classroom'::text, 'personal'::text, 'practice'::text, 'self'::text])));
alter table public.quiz_sessions add PRIMARY KEY (id);
alter table public.quiz_sessions add CHECK ((reveal = ANY (ARRAY['immediate'::text, 'complete'::text])));
alter table public.quiz_sessions add CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text])));
create table public.quiz_past_papers("id" text not null,"owner_id" uuid not null,"grade" integer not null,"school_year" integer not null,"semester" integer not null,"title" text not null,"active_version" uuid,"enabled" boolean default false not null);
alter table public.quiz_past_papers add CHECK ((grade = ANY (ARRAY[3, 4, 6, 9])));
alter table public.quiz_past_papers add PRIMARY KEY (id);
alter table public.quiz_past_papers add CHECK ((semester = ANY (ARRAY[1, 2])));
create table public.quiz_learning_settings("id" boolean default true not null,"school_year" integer not null,"semester" integer not null,"enabled" boolean default false not null,"enabled_at" timestamp with time zone default clock_timestamp() not null);
alter table public.quiz_learning_settings add CHECK (id);
alter table public.quiz_learning_settings add PRIMARY KEY (id);
alter table public.quiz_learning_settings add CHECK ((semester = ANY (ARRAY[1, 2])));
create table public.quiz_learning_leaves("user_id" uuid not null,"school_year" integer not null,"semester" integer not null,"ordinal" integer not null,"created_at" timestamp with time zone default clock_timestamp() not null);
alter table public.quiz_learning_leaves add PRIMARY KEY (user_id, school_year, semester, ordinal);
create table public.garden_growth("user_id" uuid not null,"course_id" text not null,"grown_at" timestamp with time zone default now() not null,"baseline" jsonb not null,"reward_order" jsonb not null,"seen_at" timestamp with time zone,"pet_unlocked_at" timestamp with time zone,"reward_version" integer default 1 not null,"leaf_floor" integer default 44 not null,"flower_floor" integer default 10 not null,"foundation_reward_version" smallint default 1 not null);
alter table public.garden_growth add PRIMARY KEY (user_id, course_id);
create table public.garden_reward_catalog("course_id" text not null,"week_code" text not null,"activity_key" text not null,"kind" text not null,"total_levels" integer not null,"reward_mode" text);
alter table public.garden_reward_catalog add PRIMARY KEY (course_id, week_code, activity_key);
create table public.student_progress("user_id" uuid not null,"week_code" text not null,"activity_key" text not null,"current_level" integer default 1 not null,"completed" boolean default false not null,"updated_at" timestamp with time zone default now() not null,"score" smallint,"course_id" text default 'grade3-114-2'::text not null);
alter table public.student_progress add CHECK (((current_level >= 1) AND (current_level <= 20)));
alter table public.student_progress add PRIMARY KEY (user_id, course_id, week_code, activity_key);
create table public.quiz_generated_papers(session_id uuid primary key);
create table public.quiz_media_assets(url text primary key,object_path text,mime text,bytes bigint);
create table partner_pilot.allowed_users("user_id" uuid not null,"display_name" text not null,"active" boolean default true not null);
create table partner_pilot.rooms("id" uuid default gen_random_uuid() not null,"code" text not null,"team" text not null,"theme" text not null,"paper" text not null,"capacity" integer not null,"host" uuid not null,"revision" integer default 1 not null,"epoch" uuid default gen_random_uuid() not null,"started" boolean default false not null,"created_at" timestamp with time zone default now() not null,"expires_at" timestamp with time zone default (now() + '24:00:00'::interval) not null,"character_offset" integer default (floor((random() * (4)::double precision)))::integer not null,"finished" boolean default false not null);
create table partner_pilot.members("room_id" uuid not null,"user_id" uuid not null,"ready" boolean default false not null,"joined_at" timestamp with time zone default clock_timestamp() not null);
create table partner_pilot.requests("user_id" uuid not null,"request_id" text not null,"body" jsonb not null,"result" jsonb not null);
create table partner_pilot.question_bank("id" integer not null,"title" text not null,"prompt" text not null,"options" jsonb not null,"correct" integer not null,"explanation" text not null,"rich" jsonb default '{}'::jsonb not null,"past_meta" jsonb,"past_config" jsonb,"past_answer" jsonb);
create table partner_pilot.answers("room_id" uuid not null,"user_id" uuid not null,"qid" integer not null,"attempt" integer not null,"choice" integer not null,"correct" boolean,"created_at" timestamp with time zone default clock_timestamp() not null,"response" jsonb);
create table partner_pilot.notes("id" bigint generated always as identity not null,"room_id" uuid,"user_id" uuid not null,"kind" text not null,"qid" integer,"thread_id" bigint,"tag" text,"text" text not null,"created_at" timestamp with time zone default clock_timestamp() not null);
create table partner_pilot.review_seen("room_id" uuid not null,"user_id" uuid not null,"reflection" text not null,"created_at" timestamp with time zone default clock_timestamp() not null);
create table partner_pilot.awards("id" uuid default gen_random_uuid() not null,"content_key" text not null,"member_key" text not null,"members" uuid[] not null,"room_id" uuid not null,"leaves" integer not null,"flowers" integer not null,"record" jsonb not null,"created_at" timestamp with time zone default clock_timestamp() not null);
create table partner_pilot.drafts("room_id" uuid not null,"user_id" uuid not null,"state" jsonb not null,"revision" integer default 1 not null,"saved_at" timestamp with time zone default clock_timestamp() not null);
create table partner_pilot.papers("id" text not null,"title" text not null,"grade" integer,"subject" text not null,"kind" text not null,"total" integer not null,"content_key" text not null,"source_version" uuid,"source_sha" text,"is_real" boolean default false not null,"enabled" boolean default true not null,"past_meta" jsonb,"source_session" uuid);
create table partner_pilot.paper_items("paper_id" text not null,"number" integer not null,"qid" integer);
create table partner_pilot.assets("hash" text not null,"mime" text not null,"data" bytea not null);
create table partner_pilot.invitees("email" text not null,"display_name" text not null,"user_id" uuid,"active" boolean default true not null);
create table partner_pilot.settings("id" boolean default true not null,"enabled" boolean default false not null);
create table partner_pilot.media_map("paper_id" text not null,"hash" text not null,"source_url" text not null);
alter table partner_pilot.allowed_users add PRIMARY KEY (user_id);
alter table partner_pilot.rooms add CHECK (((capacity >= 2) AND (capacity <= 4)));
alter table partner_pilot.rooms add UNIQUE (code);
alter table partner_pilot.rooms add PRIMARY KEY (id);
alter table partner_pilot.members add PRIMARY KEY (room_id, user_id);
alter table partner_pilot.requests add PRIMARY KEY (user_id, request_id);
alter table partner_pilot.question_bank add PRIMARY KEY (id);
alter table partner_pilot.answers add PRIMARY KEY (room_id, qid, attempt);
alter table partner_pilot.notes add CHECK ((kind = ANY (ARRAY['chat'::text, 'ask'::text, 'reply'::text, 'mark'::text, 'discuss'::text])));
alter table partner_pilot.notes add PRIMARY KEY (id);
alter table partner_pilot.review_seen add PRIMARY KEY (room_id, user_id);
alter table partner_pilot.awards add UNIQUE (content_key, member_key);
alter table partner_pilot.awards add PRIMARY KEY (id);
alter table partner_pilot.drafts add PRIMARY KEY (room_id, user_id);
alter table partner_pilot.papers add CHECK ((kind = ANY (ARRAY['leaf'::text, 'flower'::text])));
alter table partner_pilot.papers add PRIMARY KEY (id);
alter table partner_pilot.paper_items add UNIQUE (paper_id, qid);
alter table partner_pilot.paper_items add PRIMARY KEY (paper_id, number);
alter table partner_pilot.assets add PRIMARY KEY (hash);
alter table partner_pilot.invitees add CHECK ((email = lower(email)));
alter table partner_pilot.invitees add PRIMARY KEY (email);
alter table partner_pilot.invitees add UNIQUE (user_id);
alter table partner_pilot.settings add CHECK (id);
alter table partner_pilot.settings add PRIMARY KEY (id);
alter table partner_pilot.media_map add CHECK ((hash ~ '^[0-9a-f]{64}$'::text));
alter table partner_pilot.media_map add PRIMARY KEY (paper_id, hash);
alter table partner_pilot.allowed_users add FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table partner_pilot.rooms add FOREIGN KEY (paper) REFERENCES partner_pilot.papers(id);
alter table partner_pilot.members add FOREIGN KEY (room_id) REFERENCES partner_pilot.rooms(id) ON DELETE CASCADE;
alter table partner_pilot.members add FOREIGN KEY (user_id) REFERENCES partner_pilot.allowed_users(user_id);
alter table partner_pilot.answers add FOREIGN KEY (qid) REFERENCES partner_pilot.question_bank(id);
alter table partner_pilot.answers add FOREIGN KEY (room_id) REFERENCES partner_pilot.rooms(id) ON DELETE CASCADE;
alter table partner_pilot.notes add FOREIGN KEY (qid) REFERENCES partner_pilot.question_bank(id);
alter table partner_pilot.notes add FOREIGN KEY (room_id) REFERENCES partner_pilot.rooms(id) ON DELETE CASCADE;
alter table partner_pilot.notes add FOREIGN KEY (thread_id) REFERENCES partner_pilot.notes(id) ON DELETE CASCADE;
alter table partner_pilot.review_seen add FOREIGN KEY (room_id) REFERENCES partner_pilot.rooms(id) ON DELETE CASCADE;
alter table partner_pilot.drafts add FOREIGN KEY (room_id) REFERENCES partner_pilot.rooms(id) ON DELETE CASCADE;
alter table partner_pilot.paper_items add FOREIGN KEY (paper_id) REFERENCES partner_pilot.papers(id);
alter table partner_pilot.paper_items add FOREIGN KEY (qid) REFERENCES partner_pilot.question_bank(id);
alter table partner_pilot.invitees add FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table partner_pilot.media_map add FOREIGN KEY (paper_id) REFERENCES partner_pilot.papers(id);
insert into partner_pilot.settings values(true,true);
insert into public.quiz_learning_settings(id,school_year,semester,enabled) values(true,115,1,false);
CREATE OR REPLACE FUNCTION partner_pilot.assert_source(pid text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin if not partner_pilot.source_available(pid) then raise exception 'SOURCE_CHANGED';end if;end $function$;
CREATE OR REPLACE FUNCTION partner_pilot.can_access()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from auth.users u join partner_pilot.invitees i on i.email=lower(u.email) cross join partner_pilot.settings s where u.id=auth.uid() and u.email_confirmed_at is not null and u.raw_app_meta_data->'providers' ? 'google' and i.active and (i.user_id is null or i.user_id=u.id) and s.enabled)
$function$;
CREATE OR REPLACE FUNCTION partner_pilot.learning_snapshot(rid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'partner_pilot'
AS $function$
declare base jsonb; r partner_pilot.rooms; total int; submitted int; correct_count int; first_correct int; q record; owner uuid; item jsonb; mine jsonb:='[]'; shared jsonb:='[]'; notes jsonb; reviewers jsonb; stories jsonb:='[]'; story text[]; m record; award jsonb; roster uuid[]; memberkey text;
begin
 base:=partner_pilot.snapshot(rid);
 select * into strict r from partner_pilot.rooms where id=rid;
 base:=base||jsonb_build_object('paperInfo',(select jsonb_build_object('title',title,'grade',grade,'subject',subject,'kind',kind,'total',pp.total,'real',is_real,'sourceVersion',source_version,'sourceSha',source_sha,'past',past_meta) from partner_pilot.papers pp where id=r.paper));
 if not r.started then return base; end if;
 total:=partner_pilot.paper_total(r.paper);
 select count(distinct qid) into submitted from partner_pilot.answers where room_id=rid;
 select count(*) into correct_count from (select distinct on(qid) correct from partner_pilot.answers where room_id=rid order by qid,attempt desc) a where correct;
 select count(*) into first_correct from partner_pilot.answers where room_id=rid and attempt=1 and correct;
 for q in select b.*,i.number from partner_pilot.question_bank b join partner_pilot.paper_items i on i.qid=b.id where i.paper_id=r.paper order by i.number loop
  owner:=partner_pilot.owner_of(rid,q.id);
  item:=jsonb_build_object('id',q.id,'number',q.number,'title',q.title,'text',q.prompt,'options',q.options,'past',q.past_meta,'rich',q.rich-'explanation','owner',owner,'ownerName',(select display_name from partner_pilot.allowed_users where user_id=owner));
  if owner=auth.uid() then
   item:=item||jsonb_build_object('attempts',coalesce((select jsonb_agg(jsonb_build_object('choice',a.choice,'value',a.response,'correct',a.correct,'at',a.created_at) order by a.attempt) from partner_pilot.answers a where a.room_id=rid and a.qid=q.id),'[]'::jsonb));
  end if;
  if submitted=total or exists(select 1 from partner_pilot.answers where room_id=rid and qid=q.id and user_id=auth.uid()) then item:=item||jsonb_build_object('correct',q.correct,'explanation',q.explanation,'rich',q.rich); end if;
  if owner=auth.uid() then mine:=mine||jsonb_build_array(item); end if;
  if submitted=total or exists(select 1 from partner_pilot.notes where room_id=rid and qid=q.id and kind in ('ask','mark')) then shared:=shared||jsonb_build_array(item-'attempts'); end if;
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'user',n.user_id,'name',u.display_name,'kind',n.kind,'qid',n.qid,'thread',n.thread_id,'tag',n.tag,'text',n.text,'at',n.created_at) order by n.id),'[]'::jsonb) into notes from partner_pilot.notes n join partner_pilot.allowed_users u on u.user_id=n.user_id where n.room_id=rid;
 select coalesce(jsonb_agg(jsonb_build_object('user',v.user_id,'name',u.display_name,'reflection',v.reflection) order by v.created_at),'[]'::jsonb) into reviewers from partner_pilot.review_seen v join partner_pilot.allowed_users u using(user_id) where v.room_id=rid;
 for m in select a.user_id,u.display_name from partner_pilot.members a join partner_pilot.allowed_users u using(user_id) where a.room_id=rid order by a.joined_at,a.user_id loop
  story:=array[]::text[];
  if exists(select 1 from partner_pilot.notes where room_id=rid and user_id=m.user_id and kind='mark') then story:=array_append(story,'把「'||(select b.title from partner_pilot.notes n join partner_pilot.question_bank b on b.id=n.qid where n.room_id=rid and n.user_id=m.user_id and n.kind='mark' order by n.id limit 1)||'」帶到大家面前。'); end if;
  if exists(select 1 from partner_pilot.notes n join partner_pilot.notes ask on ask.id=n.thread_id where n.room_id=rid and n.user_id=m.user_id and n.kind='reply' and ask.user_id<>m.user_id) then story:=array_append(story,'陪夥伴一起想「'||(select b.title from partner_pilot.notes n join partner_pilot.notes ask on ask.id=n.thread_id join partner_pilot.question_bank b on b.id=n.qid where n.room_id=rid and n.user_id=m.user_id and n.kind='reply' and ask.user_id<>m.user_id order by n.id limit 1)||'」，留下自己的提示。'); end if;
  if exists(select 1 from partner_pilot.notes where room_id=rid and user_id=m.user_id and kind='ask') then story:=array_append(story,'在「'||(select b.title from partner_pilot.notes n join partner_pilot.question_bank b on b.id=n.qid where n.room_id=rid and n.user_id=m.user_id and n.kind='ask' order by n.id limit 1)||'」卡住時，主動請夥伴一起想。'); end if;
  if exists(select 1 from partner_pilot.answers where room_id=rid and user_id=m.user_id and attempt>1) then story:=array_append(story,'回到「'||(select b.title from partner_pilot.answers a join partner_pilot.question_bank b on b.id=a.qid where a.room_id=rid and a.user_id=m.user_id and a.attempt>1 order by a.created_at limit 1)||'」，訂正後再試。'); end if;
  if exists(select 1 from partner_pilot.notes where room_id=rid and user_id=m.user_id and kind='discuss') then story:=array_append(story,'在「'||(select b.title from partner_pilot.notes n join partner_pilot.question_bank b on b.id=n.qid where n.room_id=rid and n.user_id=m.user_id and n.kind='discuss' order by n.id limit 1)||'」的共同回顧中留下新發現。'); end if;
  if cardinality(story)=0 then story:=array_append(story,case when exists(select 1 from partner_pilot.answers where room_id=rid and user_id=m.user_id) then '在「'||(select b.title from partner_pilot.answers a join partner_pilot.question_bank b on b.id=a.qid where a.room_id=rid and a.user_id=m.user_id order by a.created_at limit 1)||'」留下作答與思考的起點。' else '已和大家一起出發，正按自己的步調練習。' end); end if;
  stories:=stories||jsonb_build_array(jsonb_build_object('user',m.user_id,'name',m.display_name,'lines',to_jsonb(story),'reflection',coalesce((select reflection from partner_pilot.review_seen where room_id=rid and user_id=m.user_id),'')));
 end loop;
 select array_agg(user_id order by user_id),string_agg(user_id::text,',' order by user_id) into roster,memberkey from partner_pilot.members where room_id=rid;
 select jsonb_build_object('id',id,'room',room_id,'leaves',leaves,'flowers',flowers,'record',record,'at',created_at,'earnedHere',room_id=rid) into award from partner_pilot.awards where content_key=(select content_key from partner_pilot.papers where id=r.paper) and member_key=memberkey;
 return base||jsonb_build_object('exercise',jsonb_build_object('total',total,'submitted',submitted,'correct',correct_count,'initialCorrect',first_correct,'gradedTotal',(select count(*) from partner_pilot.paper_items pi join partner_pilot.question_bank qb on qb.id=pi.qid where pi.paper_id=r.paper and coalesce(qb.past_meta->>'selfCheck','false')<>'true'),'reviewOpen',submitted=total,'finished',r.finished,'mine',mine,'shared',shared,'notes',notes,'reviewers',reviewers,'stories',stories,'award',award,'privateDraft',coalesce((select jsonb_build_object('state',d.state,'revision',d.revision,'at',d.saved_at) from partner_pilot.drafts d where d.room_id=rid and d.user_id=auth.uid()),jsonb_build_object('state',null,'revision',0))));
end $function$;
CREATE OR REPLACE FUNCTION partner_pilot.lobby_action(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'partner_pilot'
AS $function$
declare uid uuid:=auth.uid(); act text:=p->>'action'; rid uuid; r partner_pilot.rooms; old_topic text; result jsonb; previous partner_pilot.requests; req text:=p->>'requestId'; cnt int; cap int; cname text; changed boolean:=true;
begin
 perform partner_pilot.register_self();
 if act='me' then return jsonb_build_object('id',uid,'name',(select display_name from partner_pilot.allowed_users where user_id=uid),'rooms',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'team',a.team,'started',a.started) order by a.created_at desc) from partner_pilot.rooms a join partner_pilot.members b on b.room_id=a.id where b.user_id=uid and partner_pilot.source_available(a.paper)),'[]'::jsonb)); end if;
 if act='lookup' then
  if coalesce(p->>'code','') !~ '^[0-9]{6}$' then raise exception 'INVALID_CODE'; end if;
  select * into r from partner_pilot.rooms where code=p->>'code' and expires_at>now() and partner_pilot.source_available(paper);
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  return jsonb_build_object('id',r.id,'team',r.team,'capacity',r.capacity,'paper',r.paper,'started',r.started,'count',(select count(*) from partner_pilot.members where room_id=r.id));
 end if;
 if act='snapshot' then return partner_pilot.snapshot((p->>'roomId')::uuid); end if;
 if act not in ('create','join','ready','start','resize','leave') then raise exception 'INVALID_ACTION'; end if;
 if req is null or length(req) not between 8 and 100 then raise exception 'REQUEST_ID_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||req,0));
 select * into previous from partner_pilot.requests where user_id=uid and request_id=req;
 if found then if previous.body<>p then raise exception 'REQUEST_REUSED'; end if; return previous.result; end if;
 if act='create' then
  cap:=(p->>'capacity')::int;
  if cap is null or cap not between 2 and 4 or length(trim(coalesce(p->>'team',''))) not between 1 and 24 or not exists(select 1 from partner_pilot.papers where id=p->>'paper' and enabled) or coalesce(p->>'theme','') not in ('forest','space','dora') then raise exception 'INVALID_ROOM'; end if;
  if (select count(*) from partner_pilot.rooms a join partner_pilot.members b on b.room_id=a.id where b.user_id=uid and not a.started)>9 then raise exception 'TOO_MANY_ROOMS'; end if;
  for i in 1..10 loop
   cname:=lpad((floor(random()*1000000)::int)::text,6,'0');
   begin
    insert into partner_pilot.rooms(code,team,theme,paper,capacity,host) values(cname,trim(p->>'team'),p->>'theme',p->>'paper',cap,uid) returning * into r;
    exit;
   exception when unique_violation then if i=10 then raise exception 'CODE_BUSY'; end if;
   end;
  end loop;
  insert into partner_pilot.members(room_id,user_id) values(r.id,uid);
 else
  rid:=(p->>'roomId')::uuid;
  select * into r from partner_pilot.rooms where id=rid for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  old_topic:='partner-pilot:'||r.id||':'||r.epoch;
  if act='join' then
   if exists(select 1 from partner_pilot.members where room_id=rid and user_id=uid) then changed:=false;
   else
    if r.started or r.expires_at<=now() or r.code<>coalesce(p->>'code','') then raise exception 'JOIN_CLOSED'; end if;
    if (select count(*) from partner_pilot.members where room_id=rid)>=r.capacity then raise exception 'ROOM_FULL'; end if;
    insert into partner_pilot.members(room_id,user_id) values(rid,uid);
    update partner_pilot.members set ready=false where room_id=rid;
    update partner_pilot.rooms set epoch=gen_random_uuid() where id=rid;
   end if;
  else
   if not exists(select 1 from partner_pilot.members where room_id=rid and user_id=uid) then raise exception 'NOT_MEMBER'; end if;
   if r.revision is distinct from (p->>'revision')::int then raise exception 'STALE_REVISION'; end if;
   if r.started then raise exception 'ALREADY_STARTED'; end if;
   if act='ready' then
    if jsonb_typeof(p->'ready')<>'boolean' or not(p ? 'ready') then raise exception 'INVALID_READY'; end if;
    update partner_pilot.members set ready=(p->>'ready')::boolean where room_id=rid and user_id=uid;
   elsif act='start' then
    if r.host<>uid then raise exception 'HOST_ONLY'; end if;
    select count(*) into cnt from partner_pilot.members where room_id=rid;
    if cnt<>r.capacity or exists(select 1 from partner_pilot.members where room_id=rid and not ready) then raise exception 'NOT_READY'; end if;
    update partner_pilot.rooms set started=true where id=rid;
   elsif act='resize' then
    cap:=(p->>'capacity')::int;
    if r.host<>uid then raise exception 'HOST_ONLY'; end if;
    if cap is null or cap not between 2 and 4 or cap<(select count(*) from partner_pilot.members where room_id=rid) then raise exception 'INVALID_CAPACITY'; end if;
    update partner_pilot.rooms set capacity=cap where id=rid;
    update partner_pilot.members set ready=false where room_id=rid;
   elsif act='leave' then
    delete from partner_pilot.members where room_id=rid and user_id=uid;
    update partner_pilot.members set ready=false where room_id=rid;
    update partner_pilot.rooms set epoch=gen_random_uuid(),host=coalesce((select user_id from partner_pilot.members where room_id=rid order by joined_at,user_id limit 1),uid),expires_at=case when not exists(select 1 from partner_pilot.members where room_id=rid) then now() else expires_at end where id=rid;
   end if;
  end if;
  if changed then update partner_pilot.rooms set revision=revision+1 where id=rid returning * into r; end if;
 end if;
 if act='leave' then result:=jsonb_build_object('left',true); else result:=partner_pilot.snapshot(r.id); end if;
 insert into partner_pilot.requests values(uid,req,p,result);
 if changed then
  if old_topic is not null and old_topic<>'partner-pilot:'||r.id||':'||r.epoch then perform realtime.send(jsonb_build_object('room_id',r.id,'revision',r.revision),'revision',old_topic,true); end if;
  perform realtime.send(jsonb_build_object('room_id',r.id,'revision',r.revision),'revision','partner-pilot:'||r.id||':'||r.epoch,true);
 end if;
 return result;
end $function$;
CREATE OR REPLACE FUNCTION partner_pilot.owner_of(rid uuid, n integer)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'partner_pilot'
AS $function$
select user_id from (select user_id,row_number() over(order by joined_at,user_id)-1 pos from partner_pilot.members where room_id=rid) m where pos=(select (i.number-1)%r.capacity from partner_pilot.rooms r join partner_pilot.paper_items i on i.paper_id=r.paper where r.id=rid and i.qid=n)
$function$;
CREATE OR REPLACE FUNCTION partner_pilot.paper_total(pid text)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'partner_pilot'
AS $function$ select total from partner_pilot.papers where id=pid $function$;
CREATE OR REPLACE FUNCTION partner_pilot.quiz_math_answer_normalize(input text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare s text;n bigint;d bigint;a bigint;b bigint;t bigint;parts text[];fraction text;
begin
 if input is null or length(input)>250 then raise exception 'invalid_response';end if;
 s:=lower(regexp_replace(translate(input,'０１２３４５６７８９（）＋－＊／，＜＞＝−–—×÷','0123456789()+-*/,<>=---*/'),'[[:space:]　]','','g'));
 s:=replace(replace(replace(replace(s,'π','pi'),'√','sqrt'),'·','*'),'⋅','*');
 s:=translate(s,'ｒＲｄＤｐＰｉＩ','rrddppii');
 s:=regexp_replace(s,'sqrt([0-9]+)','sqrt(\1)','g');
 s:=regexp_replace(s,'\((pi|sqrt\([0-9]+\)|[a-z])\)','\1','g');
 s:=regexp_replace(s,'^\(([+-]?[0-9]{1,9}/[0-9]{1,9})\)\*?(pi|sqrt\([0-9]+\))$','\1*\2');
 -- Keep division grouping explicit: 8/3*pi means (8/3)*pi, never 8/(3*pi).
 s:=regexp_replace(s,'^([+-]?[0-9]{1,9})/([0-9]{1,9})\*(pi|sqrt\([0-9]+\))$','\1\3/\2');
 s:=regexp_replace(s,'([0-9)])\*(pi|sqrt|\()','\1\2','g');
 if length(s)=0 or s!~'^[a-z0-9()+*/.,<>=-]+$' then raise exception 'invalid_response';end if;
 if s~'^\([^,]*,[^,]*\)$' then
  parts:=string_to_array(substr(s,2,length(s)-2),',');
  return '('||partner_pilot.quiz_math_answer_normalize(parts[1])||','||partner_pilot.quiz_math_answer_normalize(parts[2])||')';
 end if;
 while s~'^\([+0-9./-]+\)$' loop s:=substr(s,2,length(s)-2);end loop;
 if s~'^[+-]?[0-9]{1,12}$' then return (s::bigint)::text;end if;
 if s~'^[+-]?[0-9]{1,9}/[0-9]{1,9}$' then n:=split_part(s,'/',1)::bigint;d:=split_part(s,'/',2)::bigint;
 elsif s~'^[+-]?[0-9]{1,9}\.[0-9]{1,8}$' then
  fraction:=split_part(s,'.',2);d:=power(10::numeric,length(fraction))::bigint;n:=(s::numeric*d)::bigint;
 else return s;end if;
 if d=0 then raise exception 'invalid_response';end if;
 a:=abs(n);b:=d;while b<>0 loop t:=a%b;a:=b;b:=t;end loop;
 n:=n/a;d:=d/a;return case when d=1 then n::text else n::text||'/'||d::text end;
end $function$;
CREATE OR REPLACE FUNCTION partner_pilot.quiz_past_canonical(g jsonb, v jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$

declare codes jsonb;result jsonb;n integer;distinct_n integer;p jsonb;stroke jsonb;

begin

 if g->>'kind'='mark' then if jsonb_typeof(v) is distinct from 'boolean' then raise exception 'invalid_response';end if;return v;end if;

 if g->>'kind'='manual' then

  if jsonb_typeof(v) is distinct from 'object' or (select array_agg(k order by k) from jsonb_object_keys(v) k) is distinct from array['confirmed','strokes','text']

   or v->'confirmed' is distinct from 'true'::jsonb or jsonb_typeof(v->'text') is distinct from 'string' or length(v->>'text')>5000

   or jsonb_typeof(v->'strokes') is distinct from 'array' or jsonb_array_length(v->'strokes')>80 or octet_length(v::text)>500000 then raise exception 'invalid_response';end if;

  for stroke in select value from jsonb_array_elements(v->'strokes') loop

   if jsonb_typeof(stroke) is distinct from 'array' or jsonb_array_length(stroke) not between 2 and 256 then raise exception 'invalid_response';end if;

   for p in select value from jsonb_array_elements(stroke) loop

    if jsonb_typeof(p) is distinct from 'array' or jsonb_array_length(p)<>2 or jsonb_typeof(p->0) is distinct from 'number' or jsonb_typeof(p->1) is distinct from 'number' then raise exception 'invalid_response';end if;

    if (p->>0)::numeric not between 0 and 1 or (p->>1)::numeric not between 0 and 1 then raise exception 'invalid_response';end if;

   end loop;

  end loop;

  if length(trim(v->>'text'))=0 and jsonb_array_length(v->'strokes')=0 then raise exception 'invalid_response';end if;

  return v;

 end if;

 if g->>'kind'='annotation' then

  if jsonb_typeof(v) is distinct from 'object' or (select array_agg(k order by k) from jsonb_object_keys(v) k) is distinct from array['arrow','mediaSha256','point']

   or v->>'mediaSha256' is distinct from g->'assets'->0->>'sha256' or jsonb_typeof(v->'arrow') is distinct from 'object'

   or (select array_agg(k order by k) from jsonb_object_keys(v->'arrow') k) is distinct from array['from','to'] then raise exception 'invalid_response';end if;

  for p in select v->'point' union all select v->'arrow'->'from' union all select v->'arrow'->'to' loop

   if jsonb_typeof(p) is distinct from 'object' or (select array_agg(k order by k) from jsonb_object_keys(p) k) is distinct from array['x','y']

    or jsonb_typeof(p->'x') is distinct from 'number' or jsonb_typeof(p->'y') is distinct from 'number' then raise exception 'invalid_response';end if;

   if (p->>'x')::numeric not between 0 and 1 or (p->>'y')::numeric not between 0 and 1 then raise exception 'invalid_response';end if;

  end loop;

  if power((v#>>'{arrow,to,x}')::numeric-(v#>>'{arrow,from,x}')::numeric,2)+power((v#>>'{arrow,to,y}')::numeric-(v#>>'{arrow,from,y}')::numeric,2)<0.0009 then raise exception 'invalid_response';end if;

  return v;

 end if;

 if g->>'kind'='short' and g->>'answerFormat'='math-v1' then
  if jsonb_typeof(v) is distinct from 'object' or (select array_agg(k order by k) from jsonb_object_keys(v) k) is distinct from array['answer','working'] or jsonb_typeof(v->'answer') is distinct from 'string' or jsonb_typeof(v->'working') is distinct from 'string' or length(v->>'working')>5000 then raise exception 'invalid_response';end if;
  return jsonb_build_object('answer',partner_pilot.quiz_math_answer_normalize(v->>'answer'),'working',v->>'working');
 end if;
 if g->>'kind'='short' then if jsonb_typeof(v) is distinct from 'string' or length(v#>>'{}') not between 1 and 2000 then raise exception 'invalid_response';end if;return v;end if;

 codes:=case when g->>'kind'='set' then g->'codes' else (select jsonb_agg(c->'id' order by ord) from jsonb_array_elements(g->'choices') with ordinality x(c,ord)) end;

 if g->>'kind' in('single','code') then if jsonb_typeof(v) is distinct from 'string' or not(codes @> jsonb_build_array(v)) then raise exception 'invalid_response';end if;return v;end if;

 if g->>'kind' not in('sequence','set') or jsonb_typeof(v) is distinct from 'array' then raise exception 'invalid_response';end if;

 select count(*),count(distinct value) into n,distinct_n from jsonb_array_elements(v);

 if n=0 or n<>distinct_n or exists(select 1 from jsonb_array_elements(v) x where jsonb_typeof(x) is distinct from 'string' or not(codes @> jsonb_build_array(x))) then raise exception 'invalid_response';end if;

 if g->>'kind'='sequence' then if n<>jsonb_array_length(codes) then raise exception 'invalid_response';end if;return v;end if;

 select jsonb_agg(c order by ord) into result from jsonb_array_elements(codes) with ordinality x(c,ord) where v @> jsonb_build_array(c);return result;

end $function$;
CREATE OR REPLACE FUNCTION partner_pilot.register_self()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not partner_pilot.can_access() then raise exception 'ACCESS_DENIED';end if;
 update partner_pilot.invitees i set user_id=u.id from auth.users u where u.id=auth.uid() and i.email=lower(u.email) and i.active and i.user_id is null;
 insert into partner_pilot.allowed_users(user_id,display_name) select user_id,display_name from partner_pilot.invitees where user_id=auth.uid() on conflict(user_id) do update set display_name=excluded.display_name,active=true where partner_pilot.allowed_users.display_name is distinct from excluded.display_name or not partner_pilot.allowed_users.active;
end $function$;
CREATE OR REPLACE FUNCTION partner_pilot.snapshot(rid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'partner_pilot'
AS $function$
declare r partner_pilot.rooms; answer jsonb;
begin
 if not exists(select 1 from partner_pilot.members where room_id=rid and user_id=auth.uid()) then raise exception 'NOT_MEMBER'; end if;
 select * into strict r from partner_pilot.rooms where id=rid;
 select jsonb_build_object('id',r.id,'code',r.code,'team',r.team,'theme',r.theme,'paper',r.paper,'capacity',r.capacity,'host',r.host,'revision',r.revision,'started',r.started,'topic','partner-pilot:'||r.id||':'||r.epoch,'members',coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',u.display_name,'ready',m.ready,'character',(case r.theme when 'space' then array['星星','月亮','彗星','太陽'] when 'dora' then array['大雄','哆啦A夢','靜香','小夫'] else array['小鹿','松鼠','狐狸','貓頭鷹'] end)[((m.position::int+r.character_offset-1)%4)+1])),'[]'::jsonb),'questions',case when r.started then (select coalesce(jsonb_agg(n),'[]'::jsonb) from generate_series(1,partner_pilot.paper_total(r.paper)) n where (n-1)%r.capacity=(select count(*) from partner_pilot.members a where a.room_id=rid and (a.joined_at,a.user_id)<(select b.joined_at,b.user_id from partner_pilot.members b where b.room_id=rid and b.user_id=auth.uid()))) else '[]'::jsonb end) into answer
 from (select *,row_number() over(order by joined_at,user_id) position from partner_pilot.members where room_id=rid) m join partner_pilot.allowed_users u using(user_id);
 return answer;
end $function$;
CREATE OR REPLACE FUNCTION partner_pilot.source_available(pid text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from partner_pilot.papers p where p.id=pid and p.enabled and p.is_real and case when p.past_meta is not null then exists(select 1 from public.quiz_past_papers s where s.id=p.past_meta->>'sourcePaper' and s.enabled and s.active_version=p.source_version) else p.total in (10,20) and exists(select 1 from public.quiz_sessions s where s.id=p.source_session and s.version_id=p.source_version and s.status='open' and s.library_visible and s.access_mode='personal' and not exists(select 1 from public.quiz_generated_papers g where g.session_id=s.id)) and exists(select 1 from public.quiz_sessions s where s.version_id=p.source_version and s.status='open' and s.library_visible and s.access_mode='practice' and not exists(select 1 from public.quiz_generated_papers g where g.session_id=s.id)) end)
$function$;
CREATE OR REPLACE FUNCTION public.quiz_partner_pilot_media_descriptor(p_room uuid, p_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare snap jsonb;pid text;result jsonb;
begin
 perform partner_pilot.register_self();
 if p_hash is null or p_hash!~'^[0-9a-f]{64}$' then raise exception 'MEDIA_DENIED';end if;
 select paper into pid from partner_pilot.rooms where id=p_room;
 perform partner_pilot.assert_source(pid);snap:=partner_pilot.learning_snapshot(p_room);
 -- Inspect only source-owned rich media URLs. Answers, notes and drafts are never authorization input.
 if not exists(select 1 from jsonb_array_elements(coalesce(snap#>'{exercise,mine}','[]')||coalesce(snap#>'{exercise,shared}','[]')) q cross join lateral jsonb_path_query(q->'rich','$.**.url') media where media=to_jsonb('https://partner-media.invalid/'||p_hash)) then raise exception 'MEDIA_DENIED';end if;
 select jsonb_build_object('path',a.object_path,'mime',a.mime,'bytes',a.bytes) into result from partner_pilot.media_map m join public.quiz_media_assets a on a.url=m.source_url where m.paper_id=pid and m.hash=p_hash;
 if result is null then raise exception 'MEDIA_UNAVAILABLE';end if;return result;
end $function$;
CREATE OR REPLACE FUNCTION public.quiz_rewards(p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare data jsonb;cfg public.quiz_learning_settings;awards jsonb;identity jsonb;begin
 data:=public.quiz_rewards_before_learning(p_data);if coalesce(public.is_teacher(),false) then return data;end if;
 select * into cfg from public.quiz_learning_settings where id;if not cfg.enabled then return data;end if;
 begin identity:=public.quiz_student_identity();exception when raise_exception then if sqlerrm in ('roster_required','student_required') then return data;else raise;end if;end;
 if identity->>'role' is distinct from 'student' then return data;end if;
 if p_data ? 'course_id' and p_data->>'course_id'<>'grade'||(identity->>'grade')||'-'||cfg.school_year||'-'||cfg.semester then return data;end if;
 select coalesce(jsonb_agg(jsonb_build_object('id','learning:'||l.school_year||':'||l.semester||':'||l.ordinal,'source_type','learning','title','練習累積・第'||l.ordinal||'片延伸葉','grade',(identity->>'grade')::integer,'half_units',2,'total',10,'correct',null,'awarded_at',l.created_at,'ordinal',l.ordinal) order by l.ordinal),'[]') into awards from public.quiz_learning_leaves l where l.user_id=auth.uid() and l.school_year=cfg.school_year and l.semester=cfg.semester;
 -- Full two-unit learning awards go first: they cannot consume/relabel an older pending half.
 -- Existing garden_growth already reads awards and therefore receives the same stable IDs.
 return data||jsonb_build_object('awards',awards||coalesce(data->'awards','[]'),'learning',public.quiz_learning_summary(),'learningAwards',awards);
end$function$;
CREATE OR REPLACE FUNCTION public.quiz_student_identity()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid:=auth.uid();mail text;cls text;
begin
 if uid is null then raise exception 'login_required';end if;
 if coalesce(public.is_teacher(),false) then raise exception 'student_required';end if;
 select lower(u.email) into mail from auth.users u where u.id=uid and u.email_confirmed_at is not null;
 select e.class_code into cls from public.student_enrollments e where e.email=mail and e.school_year=115 and e.class_code ~ '^[3469][0-9]{2}$';
 if cls is null then raise exception 'roster_required';end if;
 return jsonb_build_object('role','student','grade',left(cls,1)::integer,'email',mail,'class_code',cls);
end $function$;
create function public.quiz_rewards_before_learning(p jsonb) returns jsonb language sql as $$ select jsonb_build_object('awards',(select jsonb_agg(jsonb_build_object('id','old-'||n,'half_units',2,'title','old leaf','grade',3,'total',10,'correct',9,'awarded_at','2026-10-01')) from generate_series(1,44)n)||jsonb_build_array(jsonb_build_object('id','old-half','half_units',1,'title','pending','grade',3)),'flowers',(select jsonb_agg(jsonb_build_object('id','old-flower-'||n)) from generate_series(1,10)n)) $$;
create function public.quiz_learning_summary() returns jsonb language sql as $$select '{}'::jsonb$$;
create function public.typing_foundation_action(text,text,jsonb) returns jsonb language sql as $$ select '[]'::jsonb $$;
create function public.foundation_milestone_rewards(text,jsonb) returns jsonb language sql as $$ select '[]'::jsonb $$;
create function public.garden_test_rewards(text) returns jsonb language sql as $$ select '[]'::jsonb $$;
create function public.garden_unlock_items(text,integer,integer) returns jsonb language sql as $$ select '[]'::jsonb $$;
CREATE OR REPLACE FUNCTION public.garden_growth(p_course_id text, p_action text DEFAULT 'get'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 uid uuid:=auth.uid(); r record; j jsonb; a jsonb; result jsonb:='[]';
 prefix text; reward_id text; k text; n integer; i integer; units integer;
 pending_id text; pending_i integer; awid text;
 leaves integer; flowers integer; new_leaves integer; new_flowers integer;
 g public.garden_growth; pet boolean:=false; ord jsonb; old_awards jsonb; converted_base jsonb; converted_order jsonb; item_keys jsonb;
begin
 if uid is null then raise exception 'authentication_required';end if;
 if p_course_id not in ('grade3-114-2','grade3-115-1','grade4-115-1','grade6-115-1','grade9-115-1') or p_action not in ('get','seen') then raise exception 'invalid_request';end if;
 if coalesce(public.is_teacher(),false) or not exists(
  select 1 from auth.users u join public.student_enrollments e on e.email=lower(u.email)
  where u.id=uid and u.email_confirmed_at is not null and e.school_year=115
  and left(e.class_code,1)=substring(p_course_id from 6 for 1)
 ) then raise exception 'student_required';end if;
 perform pg_advisory_xact_lock(hashtextextended('garden-growth:'||uid::text,0));
 for r in select c.*,s.completed,s.current_level from public.garden_reward_catalog c
  join public.student_progress s on s.user_id=uid and s.course_id=c.course_id
   and s.week_code=c.week_code and s.activity_key=c.activity_key
  where c.course_id=p_course_id order by c.week_code,c.activity_key
 loop
  prefix:=r.course_id||':'||r.week_code||':'||r.activity_key||':';
  if r.kind='typing' and not (coalesce(r.reward_mode,'')='boss' and r.total_levels=1) then
   n:=greatest(0,least(r.total_levels-1,case when r.completed then r.total_levels-1 else coalesce(r.current_level,0)-1 end));
   for i in 1..n loop result:=result||jsonb_build_array(jsonb_build_object('id',prefix||'typing-leaf:'||i,'kind','typing-leaf'));end loop;
   if r.completed then result:=result||jsonb_build_array(jsonb_build_object('id',prefix||'flower:'||r.total_levels,'kind','flower'));end if;
  elsif r.completed then
   k:=case r.kind when 'typing' then 'flower' when 'quiz' then 'quiz-leaf' when 'practical' then 'practical-leaf' end;
   if k is not null then result:=result||jsonb_build_array(jsonb_build_object('id',prefix||k||':1','kind',k));end if;
  end if;
 end loop;
 if p_course_id in ('grade3-115-1','grade4-115-1','grade6-115-1','grade9-115-1') then
  if p_course_id not in ('grade4-115-1','grade9-115-1') then
  j:=public.typing_foundation_action('list',p_course_id,'{"include_zhuyin":true}');
  for a in select value from jsonb_array_elements(j) loop
   if (a->>'completed')::boolean and exists(select 1 from public.garden_reward_catalog c where c.course_id=p_course_id and c.week_code='foundation' and c.activity_key=a->>'lesson_key' and c.kind='foundation') then result:=result||jsonb_build_array(jsonb_build_object('id',p_course_id||':foundation:'||(a->>'lesson_key')||':foundation-leaf:1','kind','foundation-leaf'));end if;
  end loop;
  result:=result||public.foundation_milestone_rewards(p_course_id,j);
  end if;
  j:=public.quiz_rewards(jsonb_build_object('course_id',p_course_id));
  for a in select value from jsonb_array_elements(coalesce(j->'flowers','[]')) loop
   result:=result||jsonb_build_array(jsonb_build_object('id',p_course_id||':00:practice_'||(a->>'id')||':flower:1','kind','flower','sourceType','past_exam'));
  end loop;
  for a in select value from jsonb_array_elements(j->'awards') loop
   awid:=a->>'id';units:=coalesce((a->>'half_units')::integer,2);
   if units not between 1 and 2000 then raise exception 'invalid_reward';end if;
   for i in 0..units-1 loop
    if pending_id is null then pending_id:=awid;pending_i:=i;
    else
     reward_id:=case when pending_id=awid and units=2 then awid else 'pair:'||pending_id||':'||pending_i||':'||awid||':'||i end;
     result:=result||jsonb_build_array(jsonb_build_object('id',p_course_id||':00:practice_'||reward_id||':quiz-leaf:1','kind','quiz-leaf'));
     pending_id:=null;
    end if;
   end loop;
  end loop;
 end if;
 if p_course_id='grade6-115-1' then
  j:=public.homework_action('list','{}');
  for a in select value from jsonb_array_elements(j->'assignments') loop
   if a->>'course_id'=p_course_id and jsonb_typeof(a->'submission')='object' then
    prefix:=p_course_id||':'||(a->>'week_code')||':homework_'||(a->>'id')||':homework-leaf:';
    result:=result||jsonb_build_array(jsonb_build_object('id',prefix||'1','kind','homework-leaf'));
    if a->'submission'->>'status'='passed' then result:=result||jsonb_build_array(jsonb_build_object('id',prefix||'2','kind','homework-leaf'));end if;
   end if;
  end loop;
  j:=public.reading_action('list','{}');
  for a in select value from jsonb_array_elements(j->'periods') loop
   if a->>'course_id'=p_course_id and jsonb_typeof(a->'submission')='object' then
    prefix:=p_course_id||':'||(a->>'week_code')||':reading_'||(a->>'id')||':homework-leaf:';
    result:=result||jsonb_build_array(jsonb_build_object('id',prefix||'1','kind','homework-leaf'));
    if a->'submission'->>'status'='passed' then result:=result||jsonb_build_array(jsonb_build_object('id',prefix||'2','kind','homework-leaf'));end if;
   end if;
  end loop;
 end if;
 if to_regprocedure('public.garden_test_rewards(text)') is not null then
  result := result || public.garden_test_rewards(p_course_id);
 end if;
 select count(*) filter(where value->>'kind'<>'flower'),count(*) filter(where value->>'kind'='flower') into leaves,flowers from jsonb_array_elements(result);
 select * into g from public.garden_growth where user_id=uid and course_id=p_course_id;
 if g.user_id is not null and g.reward_version<2 then
  if to_regprocedure('public.quiz_rewards_before_past_flowers(jsonb)') is not null then
   old_awards:=public.quiz_rewards_before_past_flowers(jsonb_build_object('course_id',p_course_id))->'awards';
   converted_base:=public.garden_convert_quiz_snapshot(g.baseline,old_awards,p_course_id);
   converted_order:=public.garden_convert_quiz_snapshot(g.reward_order,old_awards,p_course_id);
   update public.garden_growth set baseline=converted_base,reward_order=converted_order,reward_version=2,
    leaf_floor=least(44,(select count(*) from jsonb_array_elements(converted_base) b where b->>'kind'<>'flower')),
    -- A converted past-exam flower replaces an old leaf; it must not also
    -- substitute for a subsequently revoked, previously required boss flower.
    flower_floor=g.flower_floor+
      (select count(*) from jsonb_array_elements(converted_base) b where b->>'kind'='flower')-
      (select count(*) from jsonb_array_elements(g.baseline) b where b->>'kind'='flower')
    where user_id=uid and course_id=p_course_id returning * into g;
  else update public.garden_growth set reward_version=2 where user_id=uid and course_id=p_course_id returning * into g;
  end if;
 end if;
 -- Mark historical milestone flowers as part of an already-grown tree's baseline.
 -- This does not replay growth or change earned pet/unlock timestamps.
 if g.user_id is not null and g.foundation_reward_version<1 then
  select coalesce(jsonb_agg(v),'[]'::jsonb) into converted_base
  from jsonb_array_elements(result) v
  where v->>'sourceType'='foundation' and v->>'kind'='flower'
   and (v->>'earnedAt' is null or (v->>'earnedAt')::timestamptz <= (select activated_at from public.foundation_milestone_policy where id))
   and not exists(select 1 from jsonb_array_elements(g.baseline) b where b->>'id'=v->>'id');
  g.baseline:=g.baseline||converted_base;
  for a in select value from jsonb_array_elements(converted_base) loop
   if not exists(select 1 from jsonb_array_elements(g.reward_order) b where b->>'id'=a->>'id') then g.reward_order:=g.reward_order||jsonb_build_array(a);end if;
  end loop;
  update public.garden_growth set baseline=g.baseline,reward_order=g.reward_order,foundation_reward_version=1
   where user_id=uid and course_id=p_course_id returning * into g;
 end if;
 if (leaves>=44 and flowers>=10) or (g.user_id is not null and leaves>=g.leaf_floor and flowers>=g.flower_floor) then
  if g.user_id is null then
   insert into public.garden_growth(user_id,course_id,baseline,reward_order,reward_version) values(uid,p_course_id,result,result,2) returning * into g;
  end if;
  select count(*) filter(where v->>'kind'<>'flower'),count(*) filter(where v->>'kind'='flower') into new_leaves,new_flowers
   from jsonb_array_elements(result) v where not exists(select 1 from jsonb_array_elements(g.baseline) b where b->>'id'=v->>'id');
  ord:=g.reward_order;
  for a in select value from jsonb_array_elements(result) loop
   if not exists(select 1 from jsonb_array_elements(ord) b where b->>'id'=a->>'id') then ord:=ord||jsonb_build_array(a);end if;
  end loop;
  if (new_leaves>=12 or new_flowers>=3) and g.pet_unlocked_at is null then g.pet_unlocked_at:=now();end if;
  if p_action='seen' and g.seen_at is null then g.seen_at:=now();end if;
  update public.garden_growth set reward_order=ord,pet_unlocked_at=g.pet_unlocked_at,seen_at=g.seen_at
   where user_id=uid and course_id=p_course_id and (reward_order is distinct from ord or pet_unlocked_at is distinct from g.pet_unlocked_at or seen_at is distinct from g.seen_at);
  select exists(select 1 from public.garden_growth where user_id=uid and pet_unlocked_at is not null) into pet;
  item_keys:=public.garden_unlock_items(p_course_id,new_leaves,new_flowers);
  return jsonb_build_object('unlockedItems',item_keys,'level',2,'petUnlocked',pet,'seen',g.seen_at is not null,'baseline',g.baseline,'order',ord,'newLeaves',new_leaves,'newFlowers',new_flowers);
 end if;
 return jsonb_build_object('level',1);
end$function$;
-- Actual existing decoration unlock functions, with empty synthetic-only state tables.
create table public.garden_item_unlocks(user_id uuid not null,item_key text not null,course_id text not null,unlocked_at timestamp with time zone default now() not null);
alter table public.garden_item_unlocks add PRIMARY KEY (user_id, item_key);
create table public.garden_item_notices(user_id uuid not null,item_key text not null,course_id text not null,created_at timestamp with time zone default now() not null,seen_at timestamp with time zone,claim_id uuid,claim_until timestamp with time zone);
alter table public.garden_item_notices add PRIMARY KEY (user_id, item_key);
CREATE OR REPLACE FUNCTION public.garden_item_catalog()
 RETURNS TABLE(item_key text, label text, pet text, home text, leaves integer, flowers integer, portrait text)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$values
 ('pet:cat','橘寶與奶油貓耳陶屋','cat','b',12,3,'/garden/assets/processed/social-v10/sit-0.webp'),
 ('home:cat:a','原版綠頂木屋','cat','a',18,5,'/garden/assets/homes/cat-a-preview.webp'),
 ('home:cat:c','葉頂藤編窩','cat','c',24,6,'/garden/assets/homes/cat-c-preview.webp'),
 ('pet:dog','布丁與森林山牆木屋','dog','a',24,6,'/garden/assets/processed/pets-v3/dog/sit-1.webp'),
 ('home:dog:b','雲朵圓頂窩','dog','b',30,8,'/garden/assets/homes/dog-b-preview.webp'),
 ('home:dog:c','露營小帳篷','dog','c',36,9,'/garden/assets/homes/dog-c-preview.webp'),
 ('pet:rabbit','蹦蹦與桃色蘑菇屋','rabbit','b',36,9,'/garden/assets/processed/pets-v3/rabbit/sit-1.webp'),
 ('home:rabbit:a','樺木樹樁屋','rabbit','a',42,11,'/garden/assets/homes/rabbit-a-preview.webp'),
 ('home:rabbit:c','草丘小地窩','rabbit','c',48,12,'/garden/assets/homes/rabbit-c-preview.webp')$function$;
CREATE OR REPLACE FUNCTION public.garden_unlock_items(course text, new_leaves integer, new_flowers integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid:=auth.uid();c record;added text;owned jsonb;
begin
 for c in select * from public.garden_item_catalog() order by leaves,item_key loop
  if new_leaves>=c.leaves or new_flowers>=c.flowers then
   added:=null;
   insert into public.garden_item_unlocks(user_id,item_key,course_id) values(uid,c.item_key,course)
    on conflict do nothing returning item_key into added;
   if added is not null then insert into public.garden_item_notices(user_id,item_key,course_id) values(uid,added,course) on conflict do nothing;end if;
  end if;
 end loop;
 select coalesce(jsonb_agg(item_key order by item_key),'[]') into owned from public.garden_item_unlocks where user_id=uid;
 return owned;
end$function$;
