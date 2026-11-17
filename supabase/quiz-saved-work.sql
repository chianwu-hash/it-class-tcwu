-- Saved calculation process, opt-in only. USER APPROVAL REQUIRED before production.
-- No existing questions, attempts, permissions, or tables are modified.
begin;
set local lock_timeout='3s';
do $guard$ begin
 if not(md5(pg_get_functiondef('public.quiz_fields_validate(jsonb)'::regprocedure))='44014c918c926e07b4fb3edc3bb545f7' and
 md5(pg_get_functiondef('public.quiz_fields_response(jsonb,text)'::regprocedure))='d05e9328e438b1a8daf5bc2c87023ae6' and
 md5(pg_get_functiondef('public.quiz_validate(jsonb)'::regprocedure))='944e211b9d4532043d40b17bf255db52' and
 md5(pg_get_functiondef('public.quiz_student_document(jsonb,jsonb,jsonb)'::regprocedure))='535c6fddb398bb38ea052dd81a3e0bb7' and
 md5(pg_get_functiondef('public.quiz_action_before_learning(text,jsonb)'::regprocedure))='fc7ef9980e3bdaa81b84ed7ee224e433' and
 md5(pg_get_functiondef('partner_pilot.action_core(jsonb)'::regprocedure))='9de0e11eb5add96127ca557bca21f0ad' and
 md5(pg_get_functiondef('partner_pilot.learning_snapshot_pre_message_media(uuid)'::regprocedure))='67df6624c1cc1d1ddabfba4950ea7a50')then raise exception 'saved_work_baseline_changed';end if;
end $guard$;
CREATE OR REPLACE FUNCTION public.quiz_fields_validate(q jsonb)
 RETURNS void
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare f jsonb;o jsonb;a jsonb;t jsonb;alt jsonb;key text;fid text;
 ids text[]:='{}';opts text[];coupled text[];n integer;
begin
 if q ? 'work' then
  if q->>'type' is distinct from 'fields' or jsonb_typeof(q->'work') is distinct from 'object' then raise exception 'invalid_question';end if;
  if (select count(*) from jsonb_object_keys(q->'work'))<>2
   or exists(select 1 from jsonb_object_keys(q->'work') k where k not in('input','label'))
   or coalesce(q#>>'{work,input}','') not in('expression','sketch')
   or jsonb_typeof(q#>'{work,label}') is distinct from 'string' or length(trim(q#>>'{work,label}')) not between 1 and 120 then raise exception 'invalid_question';end if;
 end if;
 if q ? 'options' or jsonb_typeof(q->'fields') is distinct from 'array' then raise exception 'invalid_question';end if;
 if jsonb_array_length(q->'fields') not between 1 and 20 then raise exception 'invalid_question';end if;
 for f in select * from jsonb_array_elements(q->'fields') loop
  if jsonb_typeof(f) is distinct from 'object' or coalesce(f->>'id','')!~'^[A-Za-z][A-Za-z0-9_-]{0,39}$'
   or f->>'id'=any(ids) or f->>'id' in('constructor','prototype','__proto__')
   or jsonb_typeof(f->'label') is distinct from 'string' or length(trim(f->>'label')) not between 1 and 120
   or coalesce(f->>'input','') not in('math','text','single','set','sequence')
   or exists(select 1 from jsonb_object_keys(f) k where k not in('id','label','input','options')) then raise exception 'invalid_question';end if;
  ids:=array_append(ids,f->>'id');
  if f->>'input' in('math','text') then
   if f ? 'options' then raise exception 'invalid_options';end if;
  else
   if jsonb_typeof(f->'options') is distinct from 'array' then raise exception 'invalid_options';end if;
   if jsonb_array_length(f->'options') not between 2 and 8 then raise exception 'invalid_options';end if;
   opts:='{}';
   for o in select * from jsonb_array_elements(f->'options') loop
    if jsonb_typeof(o) is distinct from 'object' or coalesce(o->>'id','')!~'^[A-Za-z0-9_-]{1,40}$'
     or o->>'id'=any(opts) or not public.quiz_valid_content(o->'content')
     or exists(select 1 from jsonb_object_keys(o) k where k not in('id','content')) then raise exception 'invalid_options';end if;
    opts:=array_append(opts,o->>'id');
   end loop;
  end if;
 end loop;
 if q->'answer'->>'format' is distinct from 'fields-v1' or jsonb_typeof(q->'answer'->'fields') is distinct from 'object'
  or exists(select 1 from jsonb_object_keys(q->'answer') k where k not in('format','fields','tuples'))
  or (select count(*) from jsonb_object_keys(q->'answer'->'fields'))<>cardinality(ids)
  or exists(select 1 from jsonb_object_keys(q->'answer'->'fields') k where not(k=any(ids))) then raise exception 'invalid_answer';end if;
 for f in select * from jsonb_array_elements(q->'fields') loop
  a:=q->'answer'->'fields'->(f->>'id');
  if jsonb_typeof(a) is distinct from 'array' then raise exception 'invalid_answer';end if;
  if jsonb_array_length(a) not between 1 and 20 then raise exception 'invalid_answer';end if;
  for alt in select * from jsonb_array_elements(a) loop
   begin perform public.quiz_fields_value(f,alt);exception when others then raise exception 'invalid_answer';end;
  end loop;
 end loop;
 if q->'answer' ? 'tuples' then
  if jsonb_typeof(q->'answer'->'tuples') is distinct from 'array' then raise exception 'invalid_answer';end if;
  if jsonb_array_length(q->'answer'->'tuples') not between 1 and 20 then raise exception 'invalid_answer';end if;
  for t in select * from jsonb_array_elements(q->'answer'->'tuples') loop
   if jsonb_typeof(t) is distinct from 'object' or exists(select 1 from jsonb_object_keys(t) k where k not in('fields','accepted'))
    or jsonb_typeof(t->'fields') is distinct from 'array' or jsonb_typeof(t->'accepted') is distinct from 'array' then raise exception 'invalid_answer';end if;
   if jsonb_array_length(t->'fields') not between 2 and 20 or jsonb_array_length(t->'accepted') not between 1 and 20 then raise exception 'invalid_answer';end if;
   coupled:='{}';
   for a in select * from jsonb_array_elements(t->'fields') loop
    fid:=a#>>'{}';
    if jsonb_typeof(a) is distinct from 'string' or not(fid=any(ids)) or fid=any(coupled) then raise exception 'invalid_answer';end if;
    coupled:=array_append(coupled,fid);
   end loop;
   for alt in select * from jsonb_array_elements(t->'accepted') loop
    if jsonb_typeof(alt) is distinct from 'object' then raise exception 'invalid_answer';end if;
    if (select count(*) from jsonb_object_keys(alt))<>cardinality(coupled)
     or exists(select 1 from jsonb_object_keys(alt) k where not(k=any(coupled))) then raise exception 'invalid_answer';end if;
    foreach fid in array coupled loop
     select x into f from jsonb_array_elements(q->'fields') x where x->>'id'=fid;
     begin
      if not exists(select 1 from jsonb_array_elements(q->'answer'->'fields'->fid) v where public.quiz_fields_value(f,v)=public.quiz_fields_value(f,alt->fid)) then raise exception 'invalid_answer';end if;
     exception when others then raise exception 'invalid_answer';end;
    end loop;
   end loop;
  end loop;
 end if;
end $function$;
CREATE OR REPLACE FUNCTION public.quiz_fields_response(q jsonb, raw text)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare original json;v jsonb;f jsonb;result jsonb:='{}';
begin
 if raw is null or(case when q->>'type'='fields' and q#>>'{work,input}'='sketch' then octet_length(raw) not between 1 and 300000 else length(raw) not between 1 and 2000 end)then raise exception 'invalid_response';end if;
 begin original:=raw::json;v:=original::jsonb;exception when others then raise exception 'invalid_response';end;
 if json_typeof(original) is distinct from 'object' then raise exception 'invalid_response';end if;
 -- Keep the original JSON for duplicate checks; jsonb discards duplicate keys.
 if (select count(*) from json_object_keys(original))<>(case when q ? 'work' then 3 else 2 end) or json_typeof(original->'f') is distinct from 'object' then raise exception 'invalid_response';end if;
 if (select count(*) from json_object_keys(original->'f'))<>(select count(distinct k) from json_object_keys(original->'f') k) then raise exception 'invalid_response';end if;
 if v->'v' is distinct from '1'::jsonb or not(v ? 'f') or exists(select 1 from jsonb_object_keys(v) k where k not in('v','f') and not(k='w' and q ? 'work'))
  or (select count(*) from jsonb_object_keys(v->'f'))<>jsonb_array_length(q->'fields')
  or exists(select 1 from jsonb_object_keys(v->'f') k where not exists(select 1 from jsonb_array_elements(q->'fields') x where x->>'id'=k)) then raise exception 'invalid_response';end if;
 if q ? 'work' then
  if q->>'type' is distinct from 'fields' or not(v ? 'w') then raise exception 'invalid_response';end if;
  if q#>>'{work,input}'='expression' then
   if jsonb_typeof(v->'w') is distinct from 'string' or length(trim(v->>'w')) not between 1 and 250 then raise exception 'invalid_response';end if;
  elsif q#>>'{work,input}'='sketch' then
   if not public.quiz_sketch_valid(v->'w') then raise exception 'invalid_response';end if;
   if (select count(*) from json_object_keys(original->'w'))<>(select count(distinct k) from json_object_keys(original->'w') k) then raise exception 'invalid_response';end if;
  else raise exception 'invalid_response';end if;
 end if;
 for f in select * from jsonb_array_elements(q->'fields') loop
  result:=result||jsonb_build_object(f->>'id',public.quiz_fields_value(f,v->'f'->(f->>'id')));
 end loop;
 return result;
end $function$;
CREATE OR REPLACE FUNCTION public.quiz_validate(d jsonb)
 RETURNS void
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare b jsonb; q jsonb; o jsonb; a jsonb; ids text[]:='{}'; bids text[]:='{}'; opts text[]; n integer:=0; k text;
begin
 if jsonb_typeof(d) is distinct from 'object' or d->>'schema' is distinct from '1'
  or jsonb_typeof(d->'title') is distinct from 'string' or length(trim(d->>'title')) not between 1 and 200
  or jsonb_typeof(d->'catalog') is distinct from 'object' or length((d->'catalog')::text)>4000
  or jsonb_typeof(d->'blocks') is distinct from 'array' then raise exception 'invalid_document'; end if;
 if jsonb_array_length(d->'blocks') not between 1 and 100 then raise exception 'invalid_document'; end if;
 for b in select value from jsonb_array_elements(d->'blocks') loop
  if coalesce(b->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$' or b->>'id'=any(bids)
   or not public.quiz_valid_content(b->'material') or jsonb_typeof(b->'questions') is distinct from 'array' then raise exception 'invalid_block'; end if;
  bids:=array_append(bids,b->>'id');
  if jsonb_array_length(b->'questions') not between 1 and 30 then raise exception 'invalid_block'; end if;
  for q in select value from jsonb_array_elements(b->'questions') loop
   n:=n+1;
   if coalesce(q->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$' or q->>'id'=any(ids)
    or not public.quiz_valid_content(q->'prompt') or not public.quiz_valid_content(q->'explanation')
    or length(trim(q->'prompt'->>'text'))=0 or jsonb_typeof(q->'answer') is distinct from 'object' then raise exception 'invalid_question'; end if;
   ids:=array_append(ids,q->>'id');
   -- Opt-in normal math answers v1
   if q->'answer' ? 'normalizer' then
    if q->>'type' is distinct from 'short' or jsonb_typeof(q->'answer'->'normalizer') is distinct from 'string'
     or q->'answer'->>'normalizer' is distinct from 'math-v1' then raise exception 'invalid_answer';end if;
   end if;
   if q->>'type'='single' then
    if jsonb_typeof(q->'options') is distinct from 'array' then raise exception 'invalid_options'; end if;
    if jsonb_array_length(q->'options') not between 2 and 8 then raise exception 'invalid_options'; end if;
    opts:='{}';
    for o in select value from jsonb_array_elements(q->'options') loop
     if coalesce(o->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$' or o->>'id'=any(opts)
      or not public.quiz_valid_content(o->'content') then raise exception 'invalid_options'; end if;
     opts:=array_append(opts,o->>'id');
    end loop;
    if not coalesce(q->'answer'->>'option_id'=any(opts),false) then raise exception 'invalid_answer'; end if;
   elsif q->>'type'='short' then
    if q ? 'options' then raise exception 'invalid_options'; end if;
    if jsonb_typeof(q->'answer'->'accepted') is distinct from 'array' then raise exception 'invalid_answer'; end if;
    if jsonb_array_length(q->'answer'->'accepted') not between 1 and 20 then raise exception 'invalid_answer'; end if;
    for a in select value from jsonb_array_elements(q->'answer'->'accepted') loop
     if jsonb_typeof(a) is distinct from 'string' or length(trim(a#>>'{}')) not between 1 and 2000 then raise exception 'invalid_answer'; end if;
     if q->'answer'->>'normalizer'='math-v1' then
      if (a#>>'{}')~'[0-9０-９][[:space:]　]+[0-9０-９]' then raise exception 'invalid_answer';end if;
      perform public.quiz_math_answer_normalize(a#>>'{}');
     end if;
    end loop;
   elsif q->>'type'='fields' then perform public.quiz_fields_validate(q);
   elsif q->>'type'='open' then perform public.quiz_open_validate(q);
   else raise exception 'invalid_question_type'; end if;
   -- 白名單投影仍是學生回傳的唯一來源，不信任教師輸入的額外欄位。
   for k in select jsonb_object_keys(q) loop
    if k not in ('id','type','prompt','explanation','options','answer') and not(k='fields' and q->>'type' in('fields','open')) and not(k='work' and q->>'type'='fields') then raise exception 'invalid_question_field'; end if;
   end loop;
  end loop;
 end loop;
 if n>200 or octet_length(d::text)>1000000 then raise exception 'document_too_large'; end if;
end $function$;
CREATE OR REPLACE FUNCTION public.quiz_student_document(d jsonb, qo jsonb, oo jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 with source as materialized (
  select distinct on(q->>'id') q->>'id' id,b,q
  from jsonb_array_elements(d->'blocks') with ordinality bx(b,bn),
   lateral jsonb_array_elements(b->'questions') with ordinality qx(q,qn)
  order by q->>'id',bn,qn
 ), items as (
  select r.n,jsonb_build_object('id',q->>'id','type',q->>'type','prompt',q->'prompt',
   'block_id',b->>'id','material',b->'material','options',
   (select coalesce(jsonb_agg(jsonb_build_object('id',o->>'id','content',o->'content') order by ord),'[]'::jsonb)
    from jsonb_array_elements(coalesce(q->'options','[]')) o
    join jsonb_array_elements_text(coalesce(oo->(q->>'id'),'[]')) with ordinality opt(id,ord) on o->>'id'=opt.id))||case when q->>'type' in('fields','open') then jsonb_build_object('fields',(select coalesce(jsonb_agg(jsonb_build_object('id',f->>'id','label',f->>'label','input',f->>'input')
 ||case when f ? 'options' then jsonb_build_object('options',(select jsonb_agg(jsonb_build_object('id',o->>'id','content',o->'content')order by ord)from jsonb_array_elements(f->'options')with ordinality opts(o,ord)))else '{}'::jsonb end order by n),'[]'::jsonb)
 from jsonb_array_elements(q->'fields')with ordinality fields(f,n)))else '{}'::jsonb end||case when q->>'type'='fields' and q ? 'work' then jsonb_build_object('work',jsonb_build_object('input',q#>'{work,input}','label',q#>'{work,label}'))else '{}'::jsonb end item
  from jsonb_array_elements(qo) with ordinality r(qid,n)
  left join source on source.id=r.qid#>>'{}'
 ) select jsonb_build_object('title',d->>'title','questions',coalesce(jsonb_agg(item order by n),'[]'::jsonb)) from items;
$function$;
CREATE OR REPLACE FUNCTION public.quiz_action_before_learning(p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
 uid uuid:=auth.uid(); teacher boolean:=coalesce(public.is_teacher(),false); v_email text;
 bank public.quiz_banks; ver public.quiz_versions; sess public.quiz_sessions; att public.quiz_attempts; ans public.quiz_answers;
 d jsonb; b jsonb; q jsonb; o jsonb; qo jsonb; oo jsonb:='{}'; result jsonb; reviews jsonb:='[]'; responses jsonb;
 target uuid; qid text; response jsonb; correct boolean; done boolean; groupdone boolean; n integer; cls text; mode text; student_grade integer;
 new_answer boolean:=false; leaf jsonb:='{}'; identity jsonb; correct_map jsonb; completed_map jsonb; open_state jsonb; open_row public.quiz_open_responses; prior_lock_timeout text; compact boolean:=p_action in('submit','self_check') and coalesce(p_data->'compact'='true'::jsonb,false);
begin
 if uid is null then raise exception 'login_required'; end if;
 -- Practice pages and answer APIs are student-only; teacher authoring/monitoring remains separate.
 if teacher and p_action in ('library_sessions','join','resume','submit','self_check','view_question') then raise exception 'student_required';end if;
 if p_action in ('list','get','save','publish','versions','open','monitor','close','sessions','personal_sessions') and not teacher then raise exception 'teacher_required'; end if;
 if p_action='library_sessions' then return public.quiz_library_sessions(p_data);end if;
 if p_action in ('personal_sessions','library_sessions') then
  if not teacher then
   identity:=public.quiz_student_identity();v_email:=identity->>'email';student_grade:=(identity->>'grade')::integer;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'version_id',s.version_id,'title',v.document->>'title',
   'catalog',v.document->'catalog','status',s.status,
   'generated',s.access_mode='self','display_name',g.display_name,'saved_at',g.created_at,
   'generated_kind',g.config->>'kind','unit_ids',g.config->'units','distribution',g.actual_distribution,
   'learning_point',case when g.config->>'kind'='extension' then regexp_replace(v.document->'catalog'->>'unit','^同重點再練習[：:]\s*','') else null end,
   'total',(select count(*) from jsonb_array_elements(v.document->'blocks') b,lateral jsonb_array_elements(b->'questions') q),
   'answered',coalesce(progress.answered,0),'correct',coalesce(progress.correct,0)
   ) order by v.document->'catalog'->>'volume',v.document->'catalog'->>'subject',v.document->'catalog'->>'unit'),'[]') into result
   from public.quiz_sessions s join public.quiz_versions v on v.id=s.version_id
   left join public.quiz_generated_papers g on g.session_id=s.id and g.user_id=uid
   left join (select a.session_id,count(x.question_id) answered,count(*) filter(where x.correct) correct
    from public.quiz_attempts a left join lateral public.quiz_response_rows(a.id) x on x.completed where a.user_id=uid group by a.session_id) progress on progress.session_id=s.id
   where (teacher and s.owner_id=uid and s.access_mode='personal')
    or (not teacher and s.access_mode in ('practice','self') and (s.access_mode<>'self' or exists(select 1 from public.quiz_generated_papers g where g.session_id=s.id and g.user_id=uid and g.deleted_at is null)) and exists(select 1 from public.student_enrollments e
     where e.email=v_email and e.school_year=s.school_year and public.quiz_session_class_allowed(s.id,e.class_code)));
  return jsonb_build_object('sessions',result,'role',case when teacher then 'teacher' else 'student' end,'grade',student_grade);
 end if;
 if p_action='sessions' then
  select coalesce(jsonb_agg(to_jsonb(s)||jsonb_build_object('title',v.document->>'title','revision',v.revision) order by s.created_at desc),'[]') into result
   from public.quiz_sessions s join public.quiz_versions v on v.id=s.version_id where s.owner_id=uid;
  return jsonb_build_object('sessions',result);
 end if;
 if p_action='list' then
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'revision',r.revision,'title',r.draft->>'title','catalog',r.draft->'catalog','updated_at',r.updated_at) order by r.updated_at desc),'[]') into result
   from public.quiz_banks r where r.owner_id=uid and (coalesce(p_data->>'search','')='' or strpos(lower(r.draft::text),lower(p_data->>'search'))>0);
  return jsonb_build_object('banks',result);
 end if;
 if p_action in ('get','save','publish','versions') then
  target:=(p_data->>'bank_id')::uuid;
  -- 同一份題庫的首次建立、修改與版本固定共用交易鎖。
  perform pg_advisory_xact_lock(hashtextextended(target::text,0));
  select * into bank from public.quiz_banks where id=target for update;
  if bank.id is not null and bank.owner_id<>uid then raise exception 'bank_unavailable'; end if;
  if p_action='save' then
   d:=p_data->'document';perform public.quiz_validate(d);
   if bank.id is null then
    if (p_data->>'expected_revision')::integer is distinct from 0 then raise exception 'revision_changed'; end if;
    insert into public.quiz_banks(id,owner_id,draft) values(target,uid,d) returning * into bank;
   elsif bank.draft=d then null; -- 遺失回應後重試，不重複增加 revision。
   else
    if bank.revision is distinct from (p_data->>'expected_revision')::integer then raise exception 'revision_changed'; end if;
    update public.quiz_banks set draft=d,revision=revision+1,updated_at=now() where id=target returning * into bank;
   end if;
  end if;
  if bank.id is null then raise exception 'bank_unavailable'; end if;
  if p_action='publish' then
   if bank.revision is distinct from (p_data->>'expected_revision')::integer then raise exception 'revision_changed'; end if;
   select * into ver from public.quiz_versions where bank_id=bank.id and revision=bank.revision;
   if ver.id is not null then return to_jsonb(ver); end if;
   if jsonb_path_exists(bank.draft,'$.blocks[*].**.media[*]') then raise exception 'media_freeze_required'; end if;
   perform public.quiz_validate(bank.draft);
   insert into public.quiz_versions(bank_id,revision,document) values(bank.id,bank.revision,bank.draft)
    on conflict(bank_id,revision) do nothing;
   select * into ver from public.quiz_versions where bank_id=bank.id and revision=bank.revision;
   return to_jsonb(ver);
  elsif p_action='versions' then
   select coalesce(jsonb_agg(to_jsonb(v) order by revision desc),'[]') into result from public.quiz_versions v where bank_id=bank.id;
   return jsonb_build_object('versions',result);
  end if;
  return to_jsonb(bank);
 end if;
 if p_action='open' then
  select v.* into ver from public.quiz_versions v join public.quiz_banks k on k.id=v.bank_id where v.id=(p_data->>'version_id')::uuid and k.owner_id=uid;
  if ver.id is null then raise exception 'version_unavailable'; end if;
  mode:=coalesce(p_data->>'access_mode','classroom');
  if mode not in ('classroom','personal','practice') or jsonb_typeof(p_data->'class_codes') is distinct from 'array' then raise exception 'invalid_session'; end if;
  if (mode in ('classroom','practice') and jsonb_array_length(p_data->'class_codes') not between 1 and 20)
   or (mode='personal' and jsonb_array_length(p_data->'class_codes')<>0) or (p_data->>'school_year')::integer not between 100 and 200
   or exists(select 1 from jsonb_array_elements_text(p_data->'class_codes') c where c !~ '^[3469][0-9]{2}$')
   or coalesce(p_data->>'reveal','') not in ('immediate','complete') then raise exception 'invalid_session'; end if;
  insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode)
   values((p_data->>'session_id')::uuid,uid,ver.id,(p_data->>'school_year')::integer,p_data->'class_codes',p_data->>'reveal',
    coalesce((p_data->>'shuffle_questions')::boolean,false),coalesce((p_data->>'shuffle_options')::boolean,false),mode) on conflict(id) do nothing;
  select * into sess from public.quiz_sessions where id=(p_data->>'session_id')::uuid;
  if sess.owner_id<>uid or sess.version_id<>ver.id or sess.class_codes<>p_data->'class_codes' or sess.school_year<>(p_data->>'school_year')::integer
   or sess.reveal<>p_data->>'reveal' or sess.shuffle_questions<>coalesce((p_data->>'shuffle_questions')::boolean,false)
   or sess.shuffle_options<>coalesce((p_data->>'shuffle_options')::boolean,false) or sess.access_mode<>mode then raise exception 'session_conflict'; end if;
  return to_jsonb(sess);
 end if;
 select * into sess from public.quiz_sessions where id=(p_data->>'session_id')::uuid;
 if sess.id is null then raise exception 'session_unavailable'; end if;
 if sess.access_mode='self' and not exists(select 1 from public.quiz_generated_papers g where g.session_id=sess.id and g.user_id=uid) then raise exception 'session_unavailable'; end if;
 if p_action in ('monitor','close') then
  if sess.owner_id<>uid then raise exception 'session_unavailable'; end if;
  if p_action='close' then
   begin
    prior_lock_timeout:=current_setting('lock_timeout');perform set_config('lock_timeout','1000ms',true);
    perform pg_advisory_xact_lock(1364542026,hashtext(sess.id::text));
    perform set_config('lock_timeout',prior_lock_timeout,true);
   exception when lock_not_available then raise exception 'session_busy';end;
   update public.quiz_sessions set status='closed' where id=sess.id;return jsonb_build_object('ok',true);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id',a.user_id,'answered',(select count(*) from public.quiz_response_rows(a.id) x where x.completed),
   'total',jsonb_array_length(a.question_order),'class_code',e.class_code,'seat_no',e.seat_no,'display_name',e.display_name,
   'last_submitted_at',(select max(x.created_at) from public.quiz_response_rows(a.id) x where x.completed)) order by a.created_at),'[]') into result
   from public.quiz_attempts a join auth.users u on u.id=a.user_id
    left join public.student_enrollments e on e.email=lower(u.email) and e.school_year=sess.school_year
   where a.session_id=sess.id;
  return jsonb_build_object('status',sess.status,'students',result);
 end if;
 if p_action not in ('join','resume','submit','self_check','view_question') then raise exception 'invalid_action'; end if;
 if sess.access_mode='personal' then
  if not teacher or sess.owner_id<>uid then raise exception 'session_unavailable'; end if;
 else
  if teacher then raise exception 'student_required'; end if;
  select lower(u.email) into v_email from auth.users u where u.id=uid and u.email_confirmed_at is not null;
  select e.class_code into cls from public.student_enrollments e where e.email=v_email and e.school_year=sess.school_year and public.quiz_session_class_allowed(sess.id,e.class_code);
  if cls is null then raise exception 'roster_required'; end if;
 end if;
 -- Shared admission protects close; per-attempt locks isolate different students.
 if p_action='join' and sess.access_mode='classroom' then
  perform pg_advisory_xact_lock(1364542026,hashtext(sess.id::text));
 elsif p_action in ('join','submit','self_check') then
  perform pg_advisory_xact_lock_shared(1364542026,hashtext(sess.id::text));
 end if;
 if p_action in ('join','submit','self_check') then select * into sess from public.quiz_sessions where id=sess.id;end if;
 if p_action='resume' then
  select * into att from public.quiz_attempts where session_id=sess.id and user_id=uid for share;
 else
  select * into att from public.quiz_attempts where session_id=sess.id and user_id=uid for update;
 end if;
 if att.id is null then
  if p_action<>'join' or sess.status<>'open' then raise exception 'attempt_unavailable'; end if;
  select * into ver from public.quiz_versions where id=sess.version_id;d:=ver.document;
  select count(*) into n from public.quiz_attempts where session_id=sess.id;
  if sess.access_mode='classroom' and n>=29 then raise exception 'session_full'; end if;
  -- 暫定：題組位置固定，只在單題區塊的既有位置間亂序。
  with blocks as (select value b, ordinality pos from jsonb_array_elements(d->'blocks') with ordinality),
   singles as (select b,row_number() over(order by case when sess.shuffle_questions then random() else pos::float end) rn from blocks where jsonb_array_length(b->'questions')=1),
   slots as (select pos,row_number() over(order by pos) rn from blocks where jsonb_array_length(b->'questions')=1),
   arranged as (select s.b,t.pos from singles s join slots t using(rn) union all select b,pos from blocks where jsonb_array_length(b->'questions')>1)
   select jsonb_agg(q->>'id' order by pos,ord) into qo from arranged,lateral jsonb_array_elements(b->'questions') with ordinality x(q,ord);
  for b in select value from jsonb_array_elements(d->'blocks') loop
   for q in select value from jsonb_array_elements(b->'questions') loop
    select coalesce(jsonb_agg(o->>'id' order by case when sess.shuffle_options then random() else ord::float end),'[]') into result
     from jsonb_array_elements(coalesce(q->'options','[]')) with ordinality x(o,ord);
    oo:=oo||jsonb_build_object(q->>'id',result);
   end loop;
  end loop;
  insert into public.quiz_attempts(session_id,user_id,question_order,option_orders) values(sess.id,uid,qo,oo) on conflict(session_id,user_id) do nothing;
  select * into att from public.quiz_attempts where session_id=sess.id and user_id=uid for update;
 end if;
 if p_action='view_question' then
  qid:=p_data->>'question_id';
  select value#>>'{}' into cls from jsonb_array_elements(att.question_order) with ordinality x(value,ord) where not exists(select 1 from public.quiz_response_rows(att.id) a where a.completed and a.question_id=x.value#>>'{}') order by ord limit 1;
  if cls is distinct from qid then raise exception 'question_order';end if;
  if to_regprocedure('public.quiz_answer_guard(uuid,text,boolean)') is not null then perform public.quiz_answer_guard(att.id,qid,false);end if;
  return jsonb_build_object('viewed',true);
 end if;
 if ver.id is null then select * into ver from public.quiz_versions where id=sess.version_id;d:=ver.document;end if;
 if p_action in('submit','self_check') then
  qid:=p_data->>'question_id';response:=p_data->'response';
  select bx,qx into b,q from jsonb_array_elements(d->'blocks') bx,lateral jsonb_array_elements(bx->'questions') qx where qx->>'id'=qid;
  if q is null then raise exception 'question_unavailable'; end if;
  if q->>'type'='open' then
   select * into open_row from public.quiz_open_responses where attempt_id=att.id and question_id=qid;
   if open_row.attempt_id is null or(p_action='self_check' and open_row.status<>'self_checked') then
    if sess.status<>'open' then raise exception 'session_closed';end if;
    select value#>>'{}' into cls from jsonb_array_elements(att.question_order) with ordinality x(value,ord) where not exists(select 1 from public.quiz_response_rows(att.id) a where a.completed and a.question_id=x.value#>>'{}') order by ord limit 1;
    if cls is distinct from qid then raise exception 'question_order';end if;
    if p_action='submit' and to_regprocedure('public.quiz_answer_guard(uuid,text,boolean)') is not null then
     result:=public.quiz_answer_guard(att.id,qid,true);if result ? 'warning' then return result;end if;
    end if;
   end if;
   new_answer:=public.quiz_open_submit(att.id,q,p_data,p_action='self_check');
  elsif p_action='self_check' then raise exception 'invalid_question_type';
  else
   if exists(select 1 from public.quiz_open_responses where attempt_id=att.id and(request_id=(p_data->>'request_id')::uuid or self_check_request_id=(p_data->>'request_id')::uuid)) then raise exception 'submission_conflict';end if;
  select * into ans from public.quiz_answers where attempt_id=att.id and (question_id=qid or request_id=(p_data->>'request_id')::uuid) limit 1;
  if ans.attempt_id is not null then
   if ans.question_id<>qid or ans.request_id is distinct from (p_data->>'request_id')::uuid or ans.response is distinct from response then raise exception 'submission_conflict'; end if;
  else
   if sess.status<>'open' then raise exception 'session_closed'; end if;
   select value#>>'{}' into cls from jsonb_array_elements(att.question_order) with ordinality x(value,ord) where not exists(select 1 from public.quiz_response_rows(att.id) a where a.completed and a.question_id=x.value#>>'{}') order by ord limit 1;
   if cls is distinct from qid then raise exception 'question_order'; end if;
   if to_regprocedure('public.quiz_answer_guard(uuid,text,boolean)') is not null then
    result:=public.quiz_answer_guard(att.id,qid,true);if result ? 'warning' then return result;end if;
   end if;
   if jsonb_typeof(response) is distinct from 'string' or (case when q->>'type'='fields' and q#>>'{work,input}'='sketch' then octet_length(response#>>'{}') not between 1 and 300000 else length(response#>>'{}') not between 1 and 2000 end) or (p_data->>'request_id')::uuid is null then raise exception 'invalid_response'; end if;
   if q->>'type'='single' then
    if not exists(select 1 from jsonb_array_elements(q->'options') opt where opt->>'id'=response#>>'{}') then raise exception 'invalid_response'; end if;
    correct:=(response#>>'{}')=q->'answer'->>'option_id';
   elsif q->>'type'='fields' then
    correct:=public.quiz_fields_grade(q,response#>>'{}');
   elsif q->>'type'='short' then
    -- 暫定僅去頭尾空白，比對教師列出的可接受答案，保留原始 response。
    -- Opt-in normal math answers v1
    if q->'answer'->>'normalizer'='math-v1' and (response#>>'{}')~'[0-9０-９][[:space:]　]+[0-9０-９]' then raise exception 'invalid_response';end if;
    correct:=case when q->'answer'->>'normalizer'='math-v1' then
     exists(select 1 from jsonb_array_elements_text(q->'answer'->'accepted') a
      where public.quiz_math_answer_normalize(a)=public.quiz_math_answer_normalize(response#>>'{}'))
     else exists(select 1 from jsonb_array_elements_text(q->'answer'->'accepted') a where trim(a)=trim(response#>>'{}')) end;
   else raise exception 'invalid_question_type';end if;
   insert into public.quiz_answers(attempt_id,question_id,request_id,response,correct) values(att.id,qid,(p_data->>'request_id')::uuid,response,correct);
   new_answer:=true;
  end if;
  end if;
 end if;
 select count(*)filter(where a.completed)=jsonb_array_length(att.question_order),coalesce(jsonb_object_agg(a.question_id,a.response),'{}'),coalesce(jsonb_object_agg(a.question_id,a.correct),'{}'),coalesce(jsonb_object_agg(a.question_id,a.completed),'{}') into done,responses,correct_map,completed_map from public.quiz_response_rows(att.id) a;
 select coalesce(jsonb_object_agg(question_id,jsonb_build_object('status',status,'rating',self_rating,'note',self_note)),'{}') into open_state from public.quiz_open_responses where attempt_id=att.id;
 for b in select value from jsonb_array_elements(d->'blocks') loop
  select not exists(select 1 from jsonb_array_elements(b->'questions') x where not coalesce((completed_map->>(x->>'id'))::boolean,false)) into groupdone;
  for q in select value from jsonb_array_elements(b->'questions') loop
   if q->>'type'='open' and responses ? (q->>'id') then
    reviews:=reviews||jsonb_build_array(jsonb_build_object('question_id',q->>'id','answer',q->'answer','explanation',q->'explanation','correct',null,'assessment',open_state->(q->>'id')));
   elsif q->>'type'<>'open' and((sess.reveal='complete' and done) or(sess.reveal='immediate' and groupdone)) then
    reviews:=reviews||jsonb_build_array(jsonb_build_object('question_id',q->>'id','answer',q->'answer','explanation',q->'explanation','correct',correct_map->(q->>'id')));
   end if;
  end loop;
 end loop;
 if sess.access_mode='self' then
  select display_name into cls from public.quiz_generated_papers where session_id=sess.id and user_id=uid;
  if cls is not null then d:=jsonb_set(d,'{title}',to_jsonb(cls));end if;
 end if;
 if to_regprocedure('public.quiz_leaf_result(uuid,boolean)') is not null then leaf:=public.quiz_leaf_result(att.id,new_answer);end if;
 result:=jsonb_build_object('attempt_id',att.id,'session_id',sess.id,'version_id',sess.version_id,'status',sess.status,'complete',done,'leaf',leaf,'responses',responses,'reviews',reviews);
 if exists(select 1 from jsonb_array_elements(d->'blocks') bx,lateral jsonb_array_elements(bx->'questions') qx where qx->>'type'='open') then result:=result||jsonb_build_object('open_responses',open_state);end if;
 if compact then return result||jsonb_build_object('compact',true);end if;
 return result||jsonb_build_object('document',public.quiz_student_document(d,att.question_order,att.option_orders));
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
  if qb.normal_question is not null then
   if jsonb_typeof(p->'response') is distinct from 'string' or (case when(qb.normal_question->>'type'='open' and exists(select 1 from jsonb_array_elements(qb.normal_question->'fields') fs where fs->>'input'='sketch'))or(qb.normal_question->>'type'='fields' and qb.normal_question#>>'{work,input}'='sketch')then octet_length(p->>'response') not between 1 and 300000 else length(p->>'response') not between 1 and 2000 end) then raise exception 'invalid_response';end if;
   response_value:=p->'response';
   if qb.normal_question->>'type' in ('fields','open') then
    perform case when qb.normal_question->>'type'='open' then public.quiz_open_response(qb.normal_question,p->>'response') else public.quiz_fields_response(qb.normal_question,p->>'response') end;
    is_correct:=case when qb.normal_question->>'type'='open' then null else public.quiz_fields_grade(qb.normal_question,p->>'response') end;
   elsif qb.normal_question->>'type'='short' then
    if qb.normal_question#>>'{answer,normalizer}'='math-v1' and (p->>'response')~'[0-9０-９][[:space:]　]+[0-9０-９]' then raise exception 'invalid_response';end if;
    is_correct:=case when qb.normal_question#>>'{answer,normalizer}'='math-v1' then exists(select 1 from jsonb_array_elements_text(qb.normal_question#>'{answer,accepted}') a where public.quiz_math_answer_normalize(a)=public.quiz_math_answer_normalize(p->>'response')) else exists(select 1 from jsonb_array_elements_text(qb.normal_question#>'{answer,accepted}') a where trim(a)=trim(p->>'response')) end;
   else raise exception 'invalid_question_type';end if;
   insert into partner_pilot.answers(room_id,user_id,qid,attempt,choice,correct,created_at,response) values(rid,uid,qid,count_attempt+1,-1,is_correct,clock_timestamp(),response_value);
  elsif qb.past_meta is not null then
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
  -- The room row is already locked: the last explicit review completes atomically.
  if (select count(*) from partner_pilot.review_seen where room_id=rid)=r.capacity then update partner_pilot.rooms set finished=true where id=rid;end if;
 elsif act='finish' then
  if (select count(distinct a.qid) from partner_pilot.answers a where a.room_id=rid)<>total or (select count(*) from partner_pilot.review_seen where room_id=rid)<>r.capacity then raise exception 'WAIT_FOR_REVIEW'; end if;
  update partner_pilot.rooms set finished=true where id=rid;
 elsif act='settle' then
  perform partner_pilot.claim_award(rid);
 end if;
 if act in ('answer','chat','ask','reply','mark','discuss','review') then
  k:=(case act when 'review' then 'reflection' else act end)||'-'||case when act='reply' then p->>'thread' when act in ('answer','ask','mark','discuss') then p->>'qid' else '' end;
  update partner_pilot.drafts d set state=d.state#-array['drafts',k],revision=d.revision+1,saved_at=clock_timestamp() where d.room_id=rid and d.user_id=uid and d.state#>>array['drafts',k]=case when act='answer' then coalesce(p->>'response',p->>'choice') else coalesce(p->>'text','') end;
 end if;
 update partner_pilot.rooms set revision=revision+1 where id=rid returning * into r;
 result:=partner_pilot.learning_snapshot(rid);
 insert into partner_pilot.requests values(uid,req,p,jsonb_build_object('room',rid,'revision',r.revision));
 perform realtime.send(jsonb_build_object('room_id',rid,'revision',r.revision),'revision','partner-pilot:'||rid||':'||r.epoch,true);
 return result;
end $function$;
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
   when submitted=total and((q.normal_question->>'type'='open'
    and exists(select 1 from jsonb_array_elements(q.normal_question->'fields') f where f->>'input'='sketch'))or(q.normal_question->>'type'='fields' and q.normal_question ? 'work'))
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
