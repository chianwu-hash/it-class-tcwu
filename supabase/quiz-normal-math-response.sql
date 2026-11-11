-- Only new, explicitly opted-in normal short answers use math-v1.
-- No historical answers, versions, rewards or grading rules are rewritten.
begin;
set local lock_timeout='5s';
lock table public.quiz_versions,public.quiz_banks,public.quiz_question_pool in share row exclusive mode;
do $normal_math_guard$
declare validator_hash text;action_hash text;normalizer_hash text;
begin
 select md5(pg_get_functiondef('public.quiz_validate(jsonb)'::regprocedure)) into validator_hash;
 select md5(pg_get_functiondef('public.quiz_action_before_learning(text,jsonb)'::regprocedure)) into action_hash;
 if to_regprocedure('public.quiz_math_answer_normalize(text)') is null then raise exception 'normal_math_normalizer_missing';end if;
 select md5(pg_get_functiondef('public.quiz_math_answer_normalize(text)'::regprocedure)) into normalizer_hash;
 if normalizer_hash<>'367a749f8772bd7415111f4abe85586f' then raise exception 'normal_math_normalizer_changed';end if;
 if validator_hash='5aaee6af34ac1368995faff284919b31' and action_hash='ec8c39c6328b35b605521e4388d3cb0d' then return;end if;
 if validator_hash<>'64c1481d0c70f11162d71b1df5975783' or action_hash<>'97e2df6be9620bd3b0e24ccd4ee1e81d' then raise exception 'normal_math_baseline_changed';end if;
 -- The marker used to be an ignored extra answer key. Refuse to change the
 -- behaviour of any historical document or pool row that already contains it.
 if exists(select 1 from (
  select document d from public.quiz_versions union all select draft from public.quiz_banks
 ) source, lateral jsonb_array_elements(case when jsonb_typeof(d->'blocks')='array' then d->'blocks' else '[]'::jsonb end) b,
 lateral jsonb_array_elements(case when jsonb_typeof(b->'questions')='array' then b->'questions' else '[]'::jsonb end) q
 where q->'answer' ? 'normalizer')
 or exists(select 1 from public.quiz_question_pool where question->'answer' ? 'normalizer') then raise exception 'normal_math_historical_marker_present';end if;
 execute $normal_math_validator$CREATE OR REPLACE FUNCTION public.quiz_validate(d jsonb)
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
   else raise exception 'invalid_question_type'; end if;
   -- 白名單投影仍是學生回傳的唯一來源，不信任教師輸入的額外欄位。
   for k in select jsonb_object_keys(q) loop
    if k not in ('id','type','prompt','explanation','options','answer') then raise exception 'invalid_question_field'; end if;
   end loop;
  end loop;
 end loop;
 if n>200 or octet_length(d::text)>1000000 then raise exception 'document_too_large'; end if;
end $function$
$normal_math_validator$;
 execute $normal_math_action$CREATE OR REPLACE FUNCTION public.quiz_action_before_learning(p_action text, p_data jsonb DEFAULT '{}'::jsonb)
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
 new_answer boolean:=false; leaf jsonb:='{}'; identity jsonb; correct_map jsonb; prior_lock_timeout text; compact boolean:=p_action='submit' and coalesce(p_data->'compact'='true'::jsonb,false);
begin
 if uid is null then raise exception 'login_required'; end if;
 -- Practice pages and answer APIs are student-only; teacher authoring/monitoring remains separate.
 if teacher and p_action in ('library_sessions','join','resume','submit','view_question') then raise exception 'student_required';end if;
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
    from public.quiz_attempts a left join public.quiz_answers x on x.attempt_id=a.id where a.user_id=uid group by a.session_id) progress on progress.session_id=s.id
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
  select coalesce(jsonb_agg(jsonb_build_object('user_id',a.user_id,'answered',(select count(*) from public.quiz_answers x where x.attempt_id=a.id),
   'total',jsonb_array_length(a.question_order),'class_code',e.class_code,'seat_no',e.seat_no,'display_name',e.display_name,
   'last_submitted_at',(select max(x.created_at) from public.quiz_answers x where x.attempt_id=a.id)) order by a.created_at),'[]') into result
   from public.quiz_attempts a join auth.users u on u.id=a.user_id
    left join public.student_enrollments e on e.email=lower(u.email) and e.school_year=sess.school_year
   where a.session_id=sess.id;
  return jsonb_build_object('status',sess.status,'students',result);
 end if;
 if p_action not in ('join','resume','submit','view_question') then raise exception 'invalid_action'; end if;
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
 elsif p_action in ('join','submit') then
  perform pg_advisory_xact_lock_shared(1364542026,hashtext(sess.id::text));
 end if;
 if p_action in ('join','submit') then select * into sess from public.quiz_sessions where id=sess.id;end if;
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
  select value#>>'{}' into cls from jsonb_array_elements(att.question_order) with ordinality x(value,ord) where not exists(select 1 from public.quiz_answers a where a.attempt_id=att.id and a.question_id=x.value#>>'{}') order by ord limit 1;
  if cls is distinct from qid then raise exception 'question_order';end if;
  if to_regprocedure('public.quiz_answer_guard(uuid,text,boolean)') is not null then perform public.quiz_answer_guard(att.id,qid,false);end if;
  return jsonb_build_object('viewed',true);
 end if;
 if ver.id is null then select * into ver from public.quiz_versions where id=sess.version_id;d:=ver.document;end if;
 if p_action='submit' then
  qid:=p_data->>'question_id';response:=p_data->'response';
  select bx,qx into b,q from jsonb_array_elements(d->'blocks') bx,lateral jsonb_array_elements(bx->'questions') qx where qx->>'id'=qid;
  if q is null then raise exception 'question_unavailable'; end if;
  select * into ans from public.quiz_answers where attempt_id=att.id and (question_id=qid or request_id=(p_data->>'request_id')::uuid) limit 1;
  if ans.attempt_id is not null then
   if ans.question_id<>qid or ans.request_id is distinct from (p_data->>'request_id')::uuid or ans.response is distinct from response then raise exception 'submission_conflict'; end if;
  else
   if sess.status<>'open' then raise exception 'session_closed'; end if;
   select value#>>'{}' into cls from jsonb_array_elements(att.question_order) with ordinality x(value,ord) where not exists(select 1 from public.quiz_answers a where a.attempt_id=att.id and a.question_id=x.value#>>'{}') order by ord limit 1;
   if cls is distinct from qid then raise exception 'question_order'; end if;
   if to_regprocedure('public.quiz_answer_guard(uuid,text,boolean)') is not null then
    result:=public.quiz_answer_guard(att.id,qid,true);if result ? 'warning' then return result;end if;
   end if;
   if jsonb_typeof(response) is distinct from 'string' or length(response#>>'{}') not between 1 and 2000 or (p_data->>'request_id')::uuid is null then raise exception 'invalid_response'; end if;
   if q->>'type'='single' then
    if not exists(select 1 from jsonb_array_elements(q->'options') opt where opt->>'id'=response#>>'{}') then raise exception 'invalid_response'; end if;
    correct:=(response#>>'{}')=q->'answer'->>'option_id';
   else
    -- 暫定僅去頭尾空白，比對教師列出的可接受答案，保留原始 response。
    -- Opt-in normal math answers v1
    if q->'answer'->>'normalizer'='math-v1' and (response#>>'{}')~'[0-9０-９][[:space:]　]+[0-9０-９]' then raise exception 'invalid_response';end if;
    correct:=case when q->'answer'->>'normalizer'='math-v1' then
     exists(select 1 from jsonb_array_elements_text(q->'answer'->'accepted') a
      where public.quiz_math_answer_normalize(a)=public.quiz_math_answer_normalize(response#>>'{}'))
     else exists(select 1 from jsonb_array_elements_text(q->'answer'->'accepted') a where trim(a)=trim(response#>>'{}')) end;
   end if;
   insert into public.quiz_answers(attempt_id,question_id,request_id,response,correct) values(att.id,qid,(p_data->>'request_id')::uuid,response,correct);
   new_answer:=true;
  end if;
 end if;
 select count(*)=jsonb_array_length(att.question_order),coalesce(jsonb_object_agg(a.question_id,a.response),'{}'),coalesce(jsonb_object_agg(a.question_id,a.correct),'{}') into done,responses,correct_map from public.quiz_answers a where a.attempt_id=att.id;
 for b in select value from jsonb_array_elements(d->'blocks') loop
  select not exists(select 1 from jsonb_array_elements(b->'questions') x where not(responses ? (x->>'id'))) into groupdone;
  if (sess.reveal='complete' and done) or (sess.reveal='immediate' and groupdone) then
   for q in select value from jsonb_array_elements(b->'questions') loop
    reviews:=reviews||jsonb_build_array(jsonb_build_object('question_id',q->>'id','answer',q->'answer','explanation',q->'explanation','correct',correct_map->(q->>'id')));
   end loop;
  end if;
 end loop;
 if sess.access_mode='self' then
  select display_name into cls from public.quiz_generated_papers where session_id=sess.id and user_id=uid;
  if cls is not null then d:=jsonb_set(d,'{title}',to_jsonb(cls));end if;
 end if;
 if to_regprocedure('public.quiz_leaf_result(uuid,boolean)') is not null then leaf:=public.quiz_leaf_result(att.id,new_answer);end if;
 result:=jsonb_build_object('attempt_id',att.id,'session_id',sess.id,'version_id',sess.version_id,'status',sess.status,'complete',done,'leaf',leaf,'responses',responses,'reviews',reviews);
 if compact then return result||jsonb_build_object('compact',true);end if;
 return result||jsonb_build_object('document',public.quiz_student_document(d,att.question_order,att.option_orders));
end $function$
$normal_math_action$;
end $normal_math_guard$;
notify pgrst,'reload schema';
commit;
