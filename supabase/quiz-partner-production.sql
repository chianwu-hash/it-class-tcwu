-- Upgrade the existing restricted partner pilot. No individual answers or earned rewards are rewritten.
begin;
set local lock_timeout='3s';
set local statement_timeout='90s';

CREATE OR REPLACE FUNCTION partner_pilot.assert_source(pid text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin if not partner_pilot.source_available(pid) then raise exception 'SOURCE_CHANGED';end if;end $function$;

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

CREATE OR REPLACE FUNCTION partner_pilot.action_core(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'partner_pilot'
AS $function$
declare uid uuid:=auth.uid(); act text:=p->>'action'; rid uuid; r partner_pilot.rooms; req text:=p->>'requestId'; prior partner_pilot.requests; result jsonb; total int; qid int; choice int; count_attempt int; correct_choice int; option_count int; k text; body text; parent partner_pilot.notes; roster uuid[]; memberkey text; snap jsonb; qb partner_pilot.question_bank; response_value jsonb; is_correct boolean;
begin
 perform partner_pilot.register_self();
 if act='catalog' then return jsonb_build_object('papers',(select jsonb_agg(jsonb_build_object('id',id,'title',title,'grade',grade,'subject',subject,'kind',kind,'total',pp.total,'real',is_real,'past',past_meta is not null,'sourceSession',source_session,'sourceSessions',(select coalesce(jsonb_agg(s.id order by s.id),'[]') from public.quiz_sessions s where s.version_id=pp.source_version and (s.id=pp.source_session or s.access_mode='practice') and s.status='open' and s.library_visible and not exists(select 1 from public.quiz_generated_papers g where g.session_id=s.id)),'sourcePaper',past_meta->>'sourcePaper') order by is_real desc,grade,subject,title) from partner_pilot.papers pp where enabled and partner_pilot.source_allowed(pp.id,false))); end if;
 if act='snapshot' then return partner_pilot.learning_snapshot((p->>'roomId')::uuid); end if;
 if act not in ('answer','chat','ask','reply','mark','discuss','review','finish','settle','save_draft') then
  result:=partner_pilot.lobby_action(p);
  if result ? 'members' then return partner_pilot.learning_snapshot((result->>'id')::uuid); end if;
  return result;
 end if;
 if req is null or length(req) not between 8 and 100 then raise exception 'REQUEST_ID_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||req,0));
 select * into prior from partner_pilot.requests where user_id=uid and request_id=req;
 if found then if prior.body<>p then raise exception 'REQUEST_REUSED'; end if; return partner_pilot.learning_snapshot((p->>'roomId')::uuid); end if;
 rid:=(p->>'roomId')::uuid;
 select * into r from partner_pilot.rooms where id=rid for update;
 if not found or not exists(select 1 from partner_pilot.members where room_id=rid and user_id=uid) then raise exception 'NOT_MEMBER'; end if;
 if not r.started then raise exception 'NOT_STARTED'; end if;
 total:=partner_pilot.paper_total(r.paper);
 if act in ('answer','ask','mark','discuss') then
  qid:=(p->>'qid')::int;
  if qid is null or not exists(select 1 from partner_pilot.paper_items i where i.paper_id=r.paper and i.qid=(p->>'qid')::int) then raise exception 'INVALID_QUESTION'; end if;
 end if;
 if act='save_draft' then
  if jsonb_typeof(p->'state') is distinct from 'object' or octet_length((p->'state')::text)>1500000 or jsonb_typeof(p#>'{state,drafts}') is distinct from 'object' or jsonb_typeof(p#>'{state,attempts}') is distinct from 'object' or jsonb_typeof(p#>'{state,editing}') is distinct from 'array' or jsonb_typeof(p#>'{state,open}') is distinct from 'array' or coalesce(p#>>'{state,view}','') not in ('practice','review','book') then raise exception 'INVALID_DRAFT'; end if;
  if coalesce((select d.revision from partner_pilot.drafts d where d.room_id=rid and d.user_id=uid),0) is distinct from (p->>'draftRevision')::int then raise exception 'DRAFT_CHANGED'; end if;
  insert into partner_pilot.drafts(room_id,user_id,state) values(rid,uid,p->'state') on conflict(room_id,user_id) do update set state=excluded.state,revision=partner_pilot.drafts.revision+1,saved_at=clock_timestamp();
 elsif act='answer' then
  if partner_pilot.owner_of(rid,qid) is distinct from uid then raise exception 'OWN_QUESTION_ONLY'; end if;
  select count(*) into count_attempt from partner_pilot.answers a where a.room_id=rid and a.qid=(p->>'qid')::int;
  if count_attempt is distinct from (p->>'expectedAttempt')::int then raise exception 'ANSWER_CHANGED'; end if;
  select * into strict qb from partner_pilot.question_bank where id=qid;
  if qb.past_meta is not null then
   response_value:=partner_pilot.quiz_past_canonical(qb.past_config,p->'value');
   is_correct:=case when qb.past_meta->>'selfCheck'='true' then null when qb.past_meta->>'kind'='short' then exists(select 1 from jsonb_array_elements_text(qb.past_answer) a where case when qb.past_meta->>'answerFormat'='math-v1' then partner_pilot.quiz_math_answer_normalize(a)=response_value->>'answer' else trim(a)=trim(response_value#>>'{}') end) else response_value=qb.past_answer end;
   insert into partner_pilot.answers(room_id,user_id,qid,attempt,choice,correct,created_at,response) values(rid,uid,qid,count_attempt+1,-1,is_correct,clock_timestamp(),response_value);
  else
   choice:=(p->>'choice')::int;correct_choice:=qb.correct;option_count:=jsonb_array_length(qb.options);
   if choice is null or choice<0 or choice>=option_count then raise exception 'INVALID_CHOICE'; end if;
   insert into partner_pilot.answers(room_id,user_id,qid,attempt,choice,correct,created_at) values(rid,uid,qid,count_attempt+1,choice,choice=correct_choice,clock_timestamp());
  end if;
 elsif act in ('chat','ask','reply','mark','discuss') then
  body:=trim(coalesce(p->>'text',''));
  if length(body)>600 or (length(body)=0 and act<>'mark') then raise exception 'INVALID_TEXT'; end if;
  if act in ('ask','mark') and partner_pilot.owner_of(rid,qid) is distinct from uid then raise exception 'OWN_QUESTION_ONLY'; end if;
  if act='mark' and coalesce(p->>'tag','') not in ('hard','interesting','careful','method') then raise exception 'INVALID_TAG'; end if;
  if act='reply' then
   select * into parent from partner_pilot.notes where id=(p->>'thread')::bigint and room_id=rid and kind='ask';
   if not found then raise exception 'THREAD_NOT_FOUND'; end if;
   qid:=parent.qid;
  end if;
  if act='discuss' and (select count(distinct a.qid) from partner_pilot.answers a where a.room_id=rid)<>total then raise exception 'REVIEW_NOT_READY'; end if;
  insert into partner_pilot.notes(room_id,user_id,kind,qid,thread_id,tag,text) values(rid,uid,act,qid,case when act='reply' then parent.id else null end,case when act='mark' then p->>'tag' else null end,body);
 elsif act='review' then
  if (select count(distinct a.qid) from partner_pilot.answers a where a.room_id=rid)<>total then raise exception 'REVIEW_NOT_READY'; end if;
  body:=trim(coalesce(p->>'text',''));if length(body)>240 then raise exception 'INVALID_TEXT'; end if;
  insert into partner_pilot.review_seen values(rid,uid,body,clock_timestamp()) on conflict(room_id,user_id) do update set reflection=excluded.reflection;
 elsif act='finish' then
  if (select count(distinct a.qid) from partner_pilot.answers a where a.room_id=rid)<>total or (select count(*) from partner_pilot.review_seen where room_id=rid)<>r.capacity then raise exception 'WAIT_FOR_REVIEW'; end if;
  update partner_pilot.rooms set finished=true where id=rid;
 elsif act='settle' then
  perform partner_pilot.claim_award(rid);
 end if;
 if act in ('answer','chat','ask','reply','mark','discuss','review') then
  k:=(case act when 'review' then 'reflection' else act end)||'-'||case when act='reply' then p->>'thread' when act in ('answer','ask','mark','discuss') then p->>'qid' else '' end;
  update partner_pilot.drafts d set state=d.state#-array['drafts',k],revision=d.revision+1,saved_at=clock_timestamp() where d.room_id=rid and d.user_id=uid and d.state#>>array['drafts',k]=case when act='answer' then p->>'choice' else coalesce(p->>'text','') end;
 end if;
 update partner_pilot.rooms set revision=revision+1 where id=rid returning * into r;
 result:=partner_pilot.learning_snapshot(rid);
 insert into partner_pilot.requests values(uid,req,p,jsonb_build_object('room',rid,'revision',r.revision));
 perform realtime.send(jsonb_build_object('room_id',rid,'revision',r.revision),'revision','partner-pilot:'||rid||':'||r.epoch,true);
 return result;
end $function$;

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


CREATE OR REPLACE FUNCTION public.quiz_rewards_before_partner(p_data jsonb DEFAULT '{}'::jsonb)
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

create or replace function public.quiz_rewards(p_data jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare data jsonb;cid text:=p_data->>'course_id';identity jsonb;
begin
 data:=public.quiz_rewards_before_partner(p_data);
 if cid is null then
  begin identity:=public.quiz_student_identity();exception when raise_exception then if sqlerrm in ('student_required','roster_required','login_required') then return data;else raise;end if;end;
  cid:='grade'||(identity->>'grade')||'-115-1';
 end if;
 return data||jsonb_build_object('partner',public.quiz_partner_rewards(cid));
end $$;
revoke all on function public.quiz_rewards_before_partner(jsonb) from public,anon,authenticated;
revoke all on function public.quiz_rewards(jsonb) from public,anon;
grant execute on function public.quiz_rewards(jsonb) to authenticated,service_role;


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
 result:=result||public.quiz_partner_reward_ids(p_course_id);
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

revoke all on all functions in schema partner_pilot from public,anon,authenticated;
-- Keep the new feature closed until the matching main frontend is verified.
update partner_pilot.settings set enabled=false where id;
notify pgrst,'reload schema';
commit;
