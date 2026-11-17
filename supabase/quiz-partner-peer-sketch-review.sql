-- Candidate: explicit user approval required before production application.
begin;
set local lock_timeout='3s';
do $guard$begin
 if md5(pg_get_functiondef('partner_pilot.learning_snapshot_pre_message_media(uuid)'::regprocedure))<>'c3a88880e9ea4fad0cdc59d185cea86f' then raise exception 'peer_sketch_review_baseline_changed';end if;
 if to_regprocedure('public.quiz_open_response(jsonb,text)')is null then raise exception 'peer_sketch_prerequisite_missing';end if;
end $guard$;
CREATE OR REPLACE FUNCTION partner_pilot.learning_snapshot_pre_message_media(rid uuid)
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
  item:=jsonb_build_object('id',q.id,'number',q.number,'title',q.title,'text',q.prompt,'options',q.options,'past',q.past_meta,'normal',q.normal_question-'answer'-'explanation','rich',q.rich-'explanation','owner',owner,'ownerName',(select display_name from partner_pilot.allowed_users where user_id=owner));
  if owner=auth.uid() then
   item:=item||jsonb_build_object('attempts',coalesce((select jsonb_agg(jsonb_build_object('choice',a.choice,'value',a.response,'correct',a.correct,'at',a.created_at) order by a.attempt) from partner_pilot.answers a where a.room_id=rid and a.qid=q.id),'[]'::jsonb));
  end if;
  if submitted=total or exists(select 1 from partner_pilot.answers where room_id=rid and qid=q.id and user_id=auth.uid()) then item:=item||jsonb_build_object('normalReference',q.normal_question->'answer','correct',q.correct,'explanation',q.explanation,'rich',q.rich); end if;
  if owner=auth.uid() then mine:=mine||jsonb_build_array(item); end if;
  if submitted=total or exists(select 1 from partner_pilot.notes where room_id=rid and qid=q.id and kind in ('ask','mark')) then shared:=shared||jsonb_build_array((item-'attempts')||case
   when submitted=total and q.normal_question->>'type'='open'
    and exists(select 1 from jsonb_array_elements(q.normal_question->'fields') f where f->>'input'='sketch')
   then jsonb_build_object('attempts',coalesce((
    select jsonb_build_array(jsonb_build_object('choice',a.choice,'value',a.response,'correct',a.correct,'at',a.created_at))
    from partner_pilot.answers a where a.room_id=rid and a.qid=q.id and a.user_id=owner
    order by a.attempt desc limit 1),'[]'::jsonb)) else '{}'::jsonb end); end if;
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
 return base||jsonb_build_object('exercise',jsonb_build_object('total',total,'submitted',submitted,'correct',correct_count,'initialCorrect',first_correct,'gradedTotal',(select count(*) from partner_pilot.paper_items pi join partner_pilot.question_bank qb on qb.id=pi.qid where pi.paper_id=r.paper and coalesce(qb.past_meta->>'selfCheck','false')<>'true' and coalesce(qb.normal_question->>'type','')<>'open'),'reviewOpen',submitted=total,'finished',r.finished,'mine',mine,'shared',shared,'notes',notes,'reviewers',reviewers,'stories',stories,'award',award,'privateDraft',coalesce((select jsonb_build_object('state',d.state,'revision',d.revision,'at',d.saved_at) from partner_pilot.drafts d where d.room_id=rid and d.user_id=auth.uid()),jsonb_build_object('state',null,'revision',0))));
end $function$;
commit;
