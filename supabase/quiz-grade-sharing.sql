-- Grade-shared teacher practice only. Private self/classroom sessions keep their original class checks.
begin;
set local lock_timeout='3s';
set local statement_timeout='90s';
do $guard$declare r record;begin
 for r in select * from (values ('public.quiz_action_before_learning(text,jsonb)','bc629bb9102ea79fed963dde580bba4a'),
('public.quiz_entry_context_before_learning(jsonb)','4fed50cd9e8edffe9b96a3570f808147'),
('public.quiz_leaf_result_before_learning(uuid,boolean)','c3f57d4cf6534196f2880d28513f67ba'),
('public.quiz_library_sessions(jsonb)','1a092fa6bba0923cf3abce4f286ad50c'),
('public.quiz_media_visible(text,uuid)','c15ca3a0003a0c99a36dbe4308ffeb7e'),
('public.quiz_question_report(jsonb)','1edbd5dd51b6fa7311806403cdde3457'),
('public.quiz_wrong_refs(integer,text,text)','8a9e9d04b91087e026650b1521b70b46'),
('partner_pilot.source_allowed(text,boolean)','116cbac1374d17a4e51086844ecff7c5'),
('public.admin_learning_action(text,text,jsonb)','e1e56f0d8f9246ad373f4fe7b9f7d9f7'),
('public.admin_learning_paper_rows(uuid,integer,text)','4f1875b65bc0567b4dc4cf31b69f819a'),
('public.admin_learning_rewards(text,text,jsonb)','01e3ec4eaedfde3a8efeccb144a7c420')) x(signature,hash) loop
  if md5(pg_get_functiondef(r.signature::regprocedure))<>r.hash then raise exception 'GRADE_SHARING_BASE_CHANGED: %',r.signature;end if;
 end loop;
end $guard$;
create function public.quiz_session_class_allowed(p_session uuid,p_class text) returns boolean
language sql stable security definer set search_path='' as $function$
 select coalesce((select case
  when s.access_mode='practice' and m.catalog->>'volume' ~ '^[3469]年級'
   and not exists(select 1 from public.quiz_generated_papers g where g.session_id=s.id)
   and not exists(select 1 from public.quiz_learning_sessions l where l.session_id=s.id)
  then (p_class ~ '^[3469][0-9]{2}$' and left(p_class,1)=left(m.catalog->>'volume',1)
   and (s.library_visible or exists(select 1 from public.quiz_attempts a where a.session_id=s.id and a.user_id=auth.uid())))
   or (not s.library_visible and s.class_codes ? p_class)
  else s.class_codes ? p_class end
 from public.quiz_sessions s left join public.quiz_version_meta m on m.version_id=s.version_id where s.id=p_session),false)
$function$;
revoke all on function public.quiz_session_class_allowed(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.quiz_session_class_allowed(uuid,text) to postgres;
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
    correct:=exists(select 1 from jsonb_array_elements_text(q->'answer'->'accepted') a where trim(a)=trim(response#>>'{}'));
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
end $function$;
CREATE OR REPLACE FUNCTION public.quiz_entry_context_before_learning(p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare identity jsonb; sess public.quiz_sessions; subject text; vid uuid;
begin
 identity:=public.quiz_student_identity();
 select * into sess from public.quiz_sessions where id=(p_data->>'session_id')::uuid;
 if sess.id is not null and sess.access_mode<>'personal'
 and (sess.access_mode<>'self' or exists(select 1 from public.quiz_generated_papers where session_id=sess.id and user_id=auth.uid()))
 and exists(select 1 from public.student_enrollments e join auth.users u on lower(u.email)=e.email
  where u.id=auth.uid() and u.email_confirmed_at is not null and e.school_year=sess.school_year and public.quiz_session_class_allowed(sess.id,e.class_code)) then
  -- Small per-version summary instead of detoasting the whole document; same subject.
  select coalesce(m.catalog->>'subject',v.document->'catalog'->>'subject'),v.id into subject,vid
  from public.quiz_versions v left join public.quiz_version_meta m on m.version_id=v.id where v.id=sess.version_id;
 end if;
 return jsonb_build_object('role',identity->>'role','grade',identity->'grade','subject',subject,'version_id',vid,'identity',public.quiz_nav_identity(identity->>'email'));
end $function$;
CREATE OR REPLACE FUNCTION public.quiz_leaf_result_before_learning(aid uuid, new_answer boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.quiz_attempts;s public.quiz_sessions;v public.quiz_versions;settings public.quiz_integrity_settings;
 n integer;c integer;timed integer;fp text;award_id uuid;existing public.quiz_leaf_awards;g integer;
begin
 select * into a from public.quiz_attempts where id=aid and user_id=auth.uid();if a.id is null then raise exception 'attempt_unavailable';end if;
 select * into s from public.quiz_sessions where id=a.session_id;
 select * into v from public.quiz_versions where id=s.version_id;
 select * into settings from public.quiz_integrity_settings where id;
 n:=jsonb_array_length(a.question_order);
 select count(*) filter(where correct) into c from public.quiz_answers where attempt_id=aid;
 select * into existing from public.quiz_leaf_awards where attempt_id=aid;
 if existing.id is not null then return jsonb_build_object('earned',true,'earned_now',false,'id',existing.id);end if;
 if n<10 then return jsonb_build_object('earned',false,'reason','short_paper');end if;
 if not settings.enabled or coalesce(public.is_teacher(),false) or s.access_mode not in ('practice','self') then return jsonb_build_object('earned',false,'reason','not_eligible');end if;
 if (select count(*) from public.quiz_answers where attempt_id=aid)<>n then return jsonb_build_object('earned',false,'reason','incomplete');end if;
 if c*100<n*60 then return jsonb_build_object('earned',false,'reason','accuracy');end if;
 select count(*) into timed from public.quiz_question_timing t where t.attempt_id=aid and t.accepted_seconds>=settings.min_seconds;
 if timed<>n then return jsonb_build_object('earned',false,'reason','timing_unverified');end if;
 select md5(string_agg(x.fingerprint,'' order by x.fingerprint)) into fp from (
  select md5((q->'prompt')::text||coalesce((select string_agg((o->'content')::text,'' order by (o->'content')::text) from jsonb_array_elements(q->'options') o),'')) fingerprint
  from jsonb_array_elements(v.document->'blocks') b,lateral jsonb_array_elements(b->'questions') q) x;
 g:=substring(v.document->'catalog'->>'volume' from '^([3469])')::integer;
 if g is null or not exists(select 1 from public.student_enrollments e join auth.users u on lower(u.email)=e.email where u.id=auth.uid() and u.email_confirmed_at is not null and e.school_year=s.school_year and public.quiz_session_class_allowed(s.id,e.class_code) and left(e.class_code,1)::integer=g) then return jsonb_build_object('earned',false,'reason','not_eligible');end if;
 if new_answer then
  insert into public.quiz_leaf_awards(user_id,attempt_id,fingerprint,grade,total,correct) values(a.user_id,aid,fp,g,n,c) on conflict do nothing returning id into award_id;
 end if;
 return jsonb_build_object('earned',award_id is not null,'earned_now',award_id is not null,'id',award_id,'reason',case when award_id is null then 'same_content_already_earned' else 'earned' end);
end $function$;
CREATE OR REPLACE FUNCTION public.quiz_library_sessions(p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare identity jsonb; papers jsonb;
begin
 identity:=public.quiz_student_identity();
 with visible as materialized (
  select s.id,s.version_id,s.status,s.access_mode,g.display_name,g.created_at saved_at,g.config,g.actual_distribution
  from public.quiz_sessions s left join public.quiz_generated_papers g on g.session_id=s.id and g.user_id=auth.uid()
  where (s.access_mode<>'practice' or s.library_visible) and s.access_mode in ('practice','self') and (s.access_mode<>'self' or (g.session_id is not null and g.deleted_at is null))
  and exists(select 1 from public.student_enrollments e where e.email=identity->>'email' and e.school_year=s.school_year and public.quiz_session_class_allowed(s.id,e.class_code))
 ), progress as (
  select a.session_id,count(x.question_id) answered,count(*) filter(where x.correct) correct
  from visible s join public.quiz_attempts a on a.session_id=s.id and a.user_id=auth.uid()
  left join public.quiz_answers x on x.attempt_id=a.id group by a.session_id
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'version_id',s.version_id,'title',v.title,'catalog',v.catalog,'status',s.status,
 'generated',s.access_mode='self','display_name',s.display_name,'saved_at',s.saved_at,'generated_kind',s.config->>'kind',
 'unit_ids',s.config->'units','distribution',s.actual_distribution,
 'learning_point',case when s.config->>'kind'='extension' then regexp_replace(v.catalog->>'unit','^同重點再練習[：:]\s*','') else null end,
 'total',v.total,'answered',coalesce(p.answered,0),'correct',coalesce(p.correct,0))
 order by v.catalog->>'volume',v.catalog->>'subject',v.catalog->>'unit'),'[]') into papers
 from visible s join public.quiz_version_meta v on v.version_id=s.version_id left join progress p on p.session_id=s.id;
 return jsonb_build_object('sessions',papers,'role',identity->>'role','grade',identity->'grade','identity',public.quiz_nav_identity(identity->>'email'));
end $function$;
CREATE OR REPLACE FUNCTION public.quiz_media_visible(p_url text, p_attempt uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid:=auth.uid(); teacher boolean:=coalesce(public.is_teacher(),false); att public.quiz_attempts; sess public.quiz_sessions;
 d jsonb; b jsonb; q jsonb; done boolean; groupdone boolean; v_email text;
begin
 select * into att from public.quiz_attempts where id=p_attempt and user_id=uid;
 if att.id is null then raise exception 'media_unavailable';end if;
 select * into sess from public.quiz_sessions where id=att.session_id;
 if sess.id is null then raise exception 'session_unavailable';end if;
 if sess.access_mode='self' and not exists(select 1 from public.quiz_generated_papers where session_id=sess.id and user_id=uid) then raise exception 'session_unavailable';end if;
 -- quiz_action rejects teacher resume, including personal sessions.
 if teacher then raise exception 'student_required';end if;
 if sess.access_mode='personal' then raise exception 'session_unavailable';end if;
 select lower(u.email) into v_email from auth.users u where u.id=uid and u.email_confirmed_at is not null;
 if not exists(select 1 from public.student_enrollments e where e.email=v_email and e.school_year=sess.school_year and public.quiz_session_class_allowed(sess.id,e.class_code)) then raise exception 'roster_required';end if;
 select document into d from public.quiz_versions where id=sess.version_id;
 -- Match the immutable attempt's question and option orders, including material.
 if exists(select 1 from jsonb_array_elements(d->'blocks') bx cross join lateral jsonb_array_elements(bx->'questions') qx
  where att.question_order ? (qx->>'id') and (
   exists(select 1 from jsonb_path_query(jsonb_build_array(bx->'material',qx->'prompt'),'$.**.media[*].url') u where u#>>'{}'=p_url)
   or exists(select 1 from jsonb_array_elements(coalesce(qx->'options','[]')) o
    where coalesce(att.option_orders->(qx->>'id'),'[]') ? (o->>'id')
    and exists(select 1 from jsonb_path_query(o->'content','$.**.media[*].url') u where u#>>'{}'=p_url)))) then return true;end if;
 select count(*)=jsonb_array_length(att.question_order) into done from public.quiz_answers where attempt_id=att.id;
 for b in select value from jsonb_array_elements(d->'blocks') loop
  select not exists(select 1 from jsonb_array_elements(b->'questions') x where not exists(select 1 from public.quiz_answers a where a.attempt_id=att.id and a.question_id=x->>'id')) into groupdone;
  if (sess.reveal='complete' and done) or (sess.reveal='immediate' and groupdone) then
   if exists(select 1 from jsonb_array_elements(b->'questions') x cross join lateral jsonb_path_query(x->'explanation','$.**.media[*].url') u where u#>>'{}'=p_url) then return true;end if;
  end if;
 end loop;
 return false;
end $function$;
CREATE OR REPLACE FUNCTION public.quiz_question_report(p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 uid uuid:=auth.uid();act text:=coalesce(p_data->>'action','submit');r public.quiz_question_reports;
 a public.quiz_attempts;s public.quiz_sessions;pa public.quiz_past_attempts;pp public.quiz_past_papers;
 identity jsonb;d jsonb;q jsonb;b jsonb;projected jsonb;snap jsonb;vid uuid;aid uuid;rid uuid;
 src text:=coalesce(p_data->>'source','quiz');qid text:=p_data->>'question_id';
 cat text:=p_data->>'category';opt text:=coalesce(p_data->>'option_id','');descr text:=trim(p_data->>'description');
 page integer;filter text:=coalesce(p_data->>'status','');
begin
 if uid is null then raise exception 'login_required';end if;
 if jsonb_typeof(p_data)<>'object' then raise exception 'invalid_request';end if;
 if act='submit' then
  identity:=public.quiz_student_identity();
  if identity->>'role' is distinct from 'student' then raise exception 'student_required';end if;
  if src not in('quiz','past') or cat is null or cat not in('question','options','answer','explanation','media','other')
   or descr is null or length(descr) not between 1 and 1000 or qid is null or length(qid) not between 1 and 200 or length(opt)>200
   or coalesce(p_data->>'attempt_id','') !~ '^[0-9a-fA-F-]{36}$' or coalesce(p_data->>'request_id','') !~ '^[0-9a-fA-F-]{36}$'
   then raise exception 'invalid_request';end if;
  aid:=(p_data->>'attempt_id')::uuid;rid:=(p_data->>'request_id')::uuid;
  perform pg_advisory_xact_lock(hashtextextended('quiz_report:'||uid::text,0));
  select * into r from public.quiz_question_reports where user_id=uid and request_id=rid;
  if r.id is not null then
   if (r.source,r.attempt_id,r.question_id,r.category,r.option_id,r.description) is distinct from (src,aid,qid,cat,opt,descr) then raise exception 'report_conflict';end if;
   return jsonb_build_object('id',r.id,'status',r.status,'reused',true);
  end if;
  if (select count(*) from public.quiz_question_reports where user_id=uid and created_at>clock_timestamp()-interval '1 hour')>=20 then raise exception 'report_rate_limit';end if;
  if src='quiz' then
   select * into a from public.quiz_attempts where id=aid and user_id=uid;
   select * into s from public.quiz_sessions where id=a.session_id;
   if a.id is null or s.access_mode='personal' or not (public.quiz_session_class_allowed(s.id,identity->>'class_code')) or not(a.question_order ? qid) then raise exception 'report_unavailable';end if;
   vid:=s.version_id;select document into d from public.quiz_versions where id=vid;
   select block,question into b,q from jsonb_array_elements(d->'blocks') block,lateral jsonb_array_elements(block->'questions') question where question->>'id'=qid;
   if q is null then raise exception 'report_unavailable';end if;
   projected:=public.quiz_student_document(d,a.question_order,a.option_orders);
   select value into projected from jsonb_array_elements(projected->'questions') where value->>'id'=qid;
   if opt<>'' and not exists(select 1 from jsonb_array_elements(projected->'options') o where o->>'id'=opt) then raise exception 'invalid_request';end if;
   snap:=jsonb_build_object('title',d->>'title','catalog',d->'catalog','session_id',s.id,
    'number',(select ord from jsonb_array_elements_text(a.question_order) with ordinality x(id,ord) where x.id=qid),
    'question',projected||jsonb_build_object('answer',q->'answer','explanation',q->'explanation'));
  else
   select * into pa from public.quiz_past_attempts where id=aid and user_id=uid;
   select * into pp from public.quiz_past_papers where id=pa.paper_id;
   if pa.id is null or pp.grade<>(identity->>'grade')::integer then raise exception 'report_unavailable';end if;
   vid:=pa.version_id;select document into d from public.quiz_past_versions where id=vid;
   select value into q from jsonb_array_elements(d->'groups') where value->>'id'=qid;
   if q is null then raise exception 'report_unavailable';end if;
   if opt<>'' and not exists(select 1 from jsonb_array_elements(q->'choices') o where o->>'id'=opt) then raise exception 'invalid_request';end if;
   snap:=jsonb_build_object('title',pp.title,'paper_id',pp.id,'number',q->>'sourceLabel','group',q);
  end if;
  identity:=identity||coalesce(public.quiz_nav_identity(identity->>'email'),'{}');
  insert into public.quiz_question_reports(user_id,request_id,source,attempt_id,version_id,question_id,category,option_id,description,identity,snapshot)
   values(uid,rid,src,aid,vid,qid,cat,opt,descr,identity,snap) returning * into r;
  return jsonb_build_object('id',r.id,'status',r.status,'reused',false);
 end if;
 if not coalesce(public.is_teacher(),false) then raise exception 'teacher_required';end if;
 if act='list' then
  if coalesce(p_data->>'page','0') !~ '^[0-9]{1,5}$' or filter not in('','pending','processing','resolved','dismissed') then raise exception 'invalid_request';end if;
  page:=coalesce((p_data->>'page')::integer,0);
  return jsonb_build_object('total',(select count(*) from public.quiz_question_reports where filter='' or status=filter),
   'items',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]') from
    (select t.id,t.source,t.category,t.option_id,t.description,t.identity,t.status,t.note,t.created_at,t.updated_at,t.snapshot->>'title' title,t.snapshot->>'number' number
     from public.quiz_question_reports t where filter='' or t.status=filter order by t.created_at desc,t.id desc limit 20 offset page*20) x));
 end if;
 if act not in('detail','update') then raise exception 'invalid_request';end if;
 select * into r from public.quiz_question_reports where id=(p_data->>'id')::uuid for update;
 if r.id is null then raise exception 'report_unavailable';end if;
 if act='update' then
  if coalesce(p_data->>'status','') not in('pending','processing','resolved','dismissed') or length(coalesce(p_data->>'note',''))>1000 then raise exception 'invalid_request';end if;
  if r.updated_at is distinct from (p_data->>'updated_at')::timestamptz then raise exception 'report_changed';end if;
  update public.quiz_question_reports set status=p_data->>'status',note=coalesce(p_data->>'note',''),handled_by=uid,updated_at=clock_timestamp() where id=r.id returning * into r;
 end if;
 return to_jsonb(r)-'request_id'-'user_id';
end$function$;
CREATE OR REPLACE FUNCTION public.quiz_wrong_refs(p_grade integer, p_attempt text DEFAULT NULL::text, p_question text DEFAULT NULL::text)
 RETURNS TABLE(attempt_id uuid, session_id uuid, version_id uuid, question_id text, answered_at timestamp with time zone, title text, catalog jsonb, ordered_ids text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 with owned as materialized (
  select a.id,a.session_id,s.version_id,s.reveal,v.title,v.catalog,v.question_index,v.block_questions,
   array(select jsonb_array_elements_text(a.question_order)) ordered_ids
  from public.quiz_attempts a join public.quiz_sessions s on s.id=a.session_id
  join public.quiz_version_meta v on v.version_id=s.version_id
  where a.user_id=auth.uid() and (p_attempt is null or a.id=case when p_attempt ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p_attempt::uuid end) and s.access_mode<>'personal'
  and coalesce(nullif(left(v.catalog->>'volume',1),''),p_grade::text)=p_grade::text
  and exists(select 1 from public.student_enrollments e join auth.users u on lower(u.email)=e.email
   where u.id=auth.uid() and u.email_confirmed_at is not null and e.school_year=s.school_year and public.quiz_session_class_allowed(s.id,e.class_code))
 ), progress as materialized (
  select x.attempt_id,jsonb_object_agg(x.question_id,true) answered from public.quiz_answers x join owned a on a.id=x.attempt_id group by x.attempt_id
 )
 select a.id,a.session_id,a.version_id,x.question_id,x.created_at,a.title,a.catalog,a.ordered_ids
 from owned a join progress p on p.attempt_id=a.id join public.quiz_answers x on x.attempt_id=a.id and not x.correct
 where (p_question is null or x.question_id=p_question)
 and a.question_index ? x.question_id
 and ((a.reveal='complete' and p.answered ?& a.ordered_ids)
  or (a.reveal='immediate' and p.answered @> (a.block_questions->(a.question_index->x.question_id->>'block_id'))))
$function$;
CREATE OR REPLACE FUNCTION partner_pilot.source_allowed(pid text, continuing boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from partner_pilot.papers p join auth.users u on u.id=auth.uid() join public.student_enrollments e on e.email=lower(u.email) and e.school_year=115 where p.id=pid and p.enabled and p.is_real and left(e.class_code,1)=p.grade::text and case when p.origin='self' then p.total in (10,20) and exists(select 1 from partner_pilot.rooms r join partner_pilot.members m on m.room_id=r.id where r.paper=p.id and m.user_id=auth.uid()) when p.past_meta is not null then exists(select 1 from public.quiz_past_papers s where s.id=p.past_meta->>'sourcePaper' and s.enabled and s.grade=p.grade and (continuing or exists(select 1 from partner_pilot.allocation_specs a where a.version=p.source_version)) and (continuing or s.active_version=p.source_version)) else p.total in (10,20) and exists(select 1 from partner_pilot.paper_sources ps join public.quiz_sessions s on s.id=ps.session_id where ps.paper_id=p.id and s.status='open' and s.library_visible and s.access_mode='practice' and s.school_year=115 and public.quiz_session_class_allowed(s.id,e.class_code) and (continuing or s.version_id=p.source_version)) end)
$function$;
CREATE OR REPLACE FUNCTION public.admin_learning_action(p_action text, p_course_id text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 yr integer; grade text; cls text; seat integer; uid uuid; mappings integer; label text;
 lim integer:=20; offst integer:=0; search text; result jsonb; identity jsonb;
 selected_subject text; selected_state text; selected_activity text;
 prog public.typing_foundation_progress%rowtype; sess public.quiz_sessions%rowtype;
 att public.quiz_attempts%rowtype; doc jsonb; version_no integer; paper_count integer;
begin
 if auth.uid() is null or not coalesce(public.is_teacher(),false) then raise exception 'teacher_required';end if;
 -- v1 contract intentionally limited to the two audited course identities.
 if p_course_id is null or p_course_id not in ('grade3-115-1','grade4-115-1','grade6-115-1','grade9-115-1') then raise exception 'invalid_course';end if;
 yr:=115;grade:=substring(p_course_id from 6 for 1);
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'invalid_request';end if;
 if exists(select 1 from jsonb_object_keys(p_payload) k where k not in
  ('class_code','seat_no','search','limit','offset','progress_id','session_id','revision','filter','subject','state','activity_type')) then raise exception 'invalid_request';end if;
 if coalesce(p_payload->>'filter','all') not in ('all','wrong') then raise exception 'invalid_request';end if;
 selected_activity:=coalesce(p_payload->>'activity_type','all');
 if selected_activity not in ('all','classroom','practice','self','past_exam','extension') then raise exception 'invalid_request';end if;
 selected_subject:=coalesce(p_payload->>'subject','');selected_state:=coalesce(p_payload->>'state','all');
 if length(selected_subject)>80 or selected_state not in ('all','unstarted','in_progress','completed','hidden') then raise exception 'invalid_request';end if;
 if coalesce(p_payload->>'limit','20') !~ '^[0-9]{1,2}$' or coalesce(p_payload->>'offset','0') !~ '^[0-9]{1,6}$' then raise exception 'invalid_page';end if;
 lim:=(coalesce(p_payload->>'limit','20'))::integer;offst:=(coalesce(p_payload->>'offset','0'))::integer;
 if lim not between 1 and 50 or offst>100000 then raise exception 'invalid_page';end if;
 cls:=nullif(p_payload->>'class_code','');search:=coalesce(p_payload->>'search','');
 if length(search)>80 or (cls is not null and (cls !~ '^[3469][0-9]{2}$' or left(cls,1)<>grade)) then raise exception 'invalid_class';end if;

 if p_action='roster' then
  with rows as (
   select e.class_code,e.seat_no,e.display_name,e.class_code||lpad(e.seat_no::text,2,'0') as student_code,
    (select count(*) from auth.users u where lower(u.email)=e.email and u.email_confirmed_at is not null) as mappings
   from public.student_enrollments e where e.school_year=yr and left(e.class_code,1)=grade
    and (cls is null or e.class_code=cls)
    and (search='' or strpos(e.display_name,search)>0 or strpos(e.class_code||lpad(e.seat_no::text,2,'0'),search)>0)
  ), page as (select * from rows order by class_code,seat_no,student_code limit lim offset offst)
  select jsonb_build_object('total',(select count(*) from rows),'offset',offst,'limit',lim,
   'items',coalesce((select jsonb_agg(to_jsonb(p) order by class_code,seat_no,student_code) from page p),'[]'::jsonb),
   'classes',(select coalesce(jsonb_agg(c.class_code order by c.class_code),'[]'::jsonb) from
    (select distinct e.class_code from public.student_enrollments e where e.school_year=yr and left(e.class_code,1)=grade)c),
   'as_of',statement_timestamp()) into result;
  return result;
 end if;
 if p_action is null or p_action not in ('profile','weekly','typing','typing_events','papers','paper') then raise exception 'invalid_action';end if;
 if cls is null or coalesce(p_payload->>'seat_no','') !~ '^[0-9]{1,2}$' then raise exception 'student_required';end if;
 seat:=(p_payload->>'seat_no')::integer;
 select e.display_name into label from public.student_enrollments e where e.school_year=yr and e.class_code=cls and e.seat_no=seat;
 if not found then raise exception 'student_unavailable';end if;
 select count(*),min(u.id::text)::uuid into mappings,uid from auth.users u
 join public.student_enrollments e on lower(u.email)=e.email
 where e.school_year=yr and e.class_code=cls and e.seat_no=seat and u.email_confirmed_at is not null;
 identity:=jsonb_build_object('school_year',yr,'class_code',cls,'seat_no',seat,'display_name',label,
  'mapping',case when mappings=1 then 'linked' when mappings=0 then 'unlinked' else 'conflict' end);
 if mappings<>1 then return jsonb_build_object('identity',identity,'items','[]'::jsonb,'total',0,'as_of',statement_timestamp());end if;

 if p_action='profile' then
  return jsonb_build_object('identity',identity,'as_of',statement_timestamp(),
   'weekly',(select jsonb_build_object('recorded',count(*),'completed',count(*) filter(where s.completed),'last_at',max(s.updated_at))
    from public.student_progress s where s.user_id=uid and s.course_id=p_course_id),
   'typing',(select jsonb_build_object('recorded',count(*),'english',count(*) filter(where l.track='english' and p.completed),
    'zhuyin',count(*) filter(where l.track='zhuyin' and p.completed),'last_at',max(p.updated_at))
    from public.typing_foundation_progress p join public.typing_foundation_lessons l using(lesson_key)
    where p.course_id=p_course_id and p.learner_key='google:'||uid::text),
   'papers',(select jsonb_build_object('created',count(*),'started',count(attempt_id),
    'completed',count(*) filter(where answered=total and total>0),'last_at',max(last_answer_at))
    from public.admin_learning_paper_rows(uid,yr,cls)));
 end if;
 if p_action='weekly' then
  with rows as (select s.week_code,s.activity_key,s.current_level,s.score,s.completed,s.updated_at
   from public.student_progress s where s.user_id=uid and s.course_id=p_course_id),
  page as(select * from rows order by week_code,activity_key limit lim offset offst)
  select jsonb_build_object('total',(select count(*) from rows),'items',coalesce((select jsonb_agg(to_jsonb(p) order by week_code,activity_key) from page p),'[]'::jsonb)) into result;
 elsif p_action='typing' then
  with rows as (
   select l.lesson_key,l.ordinal,l.track,l.rate_unit,l.speed,l.starter_speed,
    p.id as progress_id,coalesce(p.checkpoint,0) as checkpoint,coalesce(p.completed,false) as completed,
    p.completed_at,p.updated_at,p.revision,coalesce(p.starter,false) as starter,
    x.best_rate,x.events,x.last_at,
    exists(select 1 from public.typing_foundation_lessons prev where prev.track=l.track and prev.ordinal<l.ordinal
     and not exists(select 1 from public.typing_foundation_progress pp where pp.course_id=p_course_id
      and pp.learner_key='google:'||uid::text and pp.lesson_key=prev.lesson_key and pp.completed)) as blocked,
    (select count(*) from public.typing_foundation_resets r where r.progress_id=p.id) as resets
   from public.typing_foundation_lessons l left join public.typing_foundation_progress p
    on p.lesson_key=l.lesson_key and p.course_id=p_course_id and p.learner_key='google:'||uid::text
   cross join lateral (select count(*) as events,max(e.created_at) as last_at,
    max(coalesce(e.cpm,e.wpm)) filter(where e.revision=p.revision and e.stage=6 and e.passed) as best_rate
    from public.typing_foundation_events e where e.progress_id=p.id) x
  ),page as(select * from rows order by ordinal,lesson_key limit lim offset offst)
  select jsonb_build_object('total',(select count(*) from rows),'items',coalesce((select jsonb_agg(to_jsonb(p) order by ordinal,lesson_key) from page p),'[]'::jsonb)) into result;
 elsif p_action='typing_events' then
  select * into prog from public.typing_foundation_progress p where p.id=(p_payload->>'progress_id')::uuid
   and p.course_id=p_course_id and p.learner_key='google:'||uid::text;
  if not found then raise exception 'progress_unavailable';end if;
  if p_payload ? 'revision' and coalesce(p_payload->>'revision','') !~ '^[0-9]{1,6}$' then raise exception 'invalid_revision';end if;
  with rows as (select e.id,e.revision,e.stage,e.correct,e.errors,e.elapsed_ms,e.interrupted,e.accuracy,
   coalesce(e.cpm,e.wpm) as rate,e.rate_unit,e.passed,e.created_at from public.typing_foundation_events e
   where e.progress_id=prog.id and (not(p_payload ? 'revision') or e.revision=(p_payload->>'revision')::integer)),
  page as(select * from rows order by created_at desc,id limit lim offset offst)
  select jsonb_build_object('revision',prog.revision,'total',(select count(*) from rows),
   'items',coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc,id) from page p),'[]'::jsonb),
   'reset_total',(select count(*) from public.typing_foundation_resets r where r.progress_id=prog.id),
   'resets',coalesce((select jsonb_agg(to_jsonb(r) order by reset_at desc,id) from
    (select id,previous_revision,previous_checkpoint,previous_completed,reset_at from public.typing_foundation_resets
     where progress_id=prog.id order by reset_at desc,id limit 20)r),'[]'::jsonb)) into result;
 elsif p_action='papers' then
  with rows as materialized(select * from public.admin_learning_paper_rows(uid,yr,cls)),
  filtered as (select * from rows r where (selected_subject='' or r.subject=selected_subject) and (selected_activity='all' or r.access_mode=selected_activity)
   and (selected_state='all' or (selected_state='unstarted' and r.attempt_id is null)
    or (selected_state='in_progress' and r.attempt_id is not null and (r.answered<r.total or r.total=0))
    or (selected_state='completed' and r.answered=r.total and r.total>0)
    or (selected_state='hidden' and r.hidden))),
  page as(select * from filtered order by created_at desc,session_id limit lim offset offst)
  select jsonb_build_object('total',(select count(*) from filtered),'all_total',(select count(*) from rows),
   'subjects',(select coalesce(jsonb_agg(subject order by subject),'[]'::jsonb) from (select distinct subject from rows where subject<>'')s),
   'items',coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc,session_id) from page p),'[]'::jsonb)) into result;
 elsif p_action='paper' then
  if exists(select 1 from public.admin_learning_paper_rows(uid,yr,cls) r where r.session_id=(p_payload->>'session_id')::uuid and r.access_mode='past_exam') then
   result:=public.admin_learning_past_detail((p_payload->>'session_id')::uuid,lim,offst,coalesce(p_payload->>'filter','all'));
   return result||jsonb_build_object('identity',identity,'offset',offst,'limit',lim,'as_of',statement_timestamp());
  end if;
  select * into sess from public.quiz_sessions s where s.id=(p_payload->>'session_id')::uuid and s.school_year=yr
   and (public.quiz_session_class_allowed(s.id,cls) or (s.access_mode='practice' and exists(select 1 from public.quiz_attempts old_attempt where old_attempt.session_id=s.id and old_attempt.user_id=uid))) and s.access_mode in ('classroom','practice','self')
   and (exists(select 1 from public.quiz_attempts a where a.session_id=s.id and a.user_id=uid)
    or exists(select 1 from public.quiz_generated_papers g where g.session_id=s.id and g.user_id=uid));
  if not found then raise exception 'paper_unavailable';end if;
  select * into att from public.quiz_attempts a where a.session_id=sess.id and a.user_id=uid;
  select v.document,v.revision into doc,version_no from public.quiz_versions v where v.id=sess.version_id;
  if coalesce((doc->>'schema')::integer,0)<>1 then raise exception 'unsupported_document';end if;
  with definitions as (
   select q as question,b->'material' as material,b->>'id' as block_id,
    row_number() over(order by bo,qo) as original_no
   from jsonb_array_elements(doc->'blocks') with ordinality blocks(b,bo),
    lateral jsonb_array_elements(b->'questions') with ordinality questions(q,qo)
  ), rows as (
   select d.question,d.material,d.block_id,coalesce(o.no,d.original_no) as number,
    x.response,x.correct,x.created_at as answered_at,x.attempt_id is not null as answered,
    att.option_orders->(d.question->>'id') as option_order
   from definitions d left join lateral
    (select no from jsonb_array_elements_text(coalesce(att.question_order,'[]'::jsonb)) with ordinality r(id,no) where r.id=d.question->>'id')o on true
   left join public.quiz_answers x on x.attempt_id=att.id and x.question_id=d.question->>'id'
   where att.id is null or o.no is not null
  ), filtered as(select * from rows where coalesce(p_payload->>'filter','all')='all' or (answered and not correct)),
  page as(select * from filtered order by number limit lim offset offst)
  select jsonb_build_object('title',coalesce((select g.display_name from public.quiz_generated_papers g where g.session_id=sess.id),doc->>'title'),
   'revision',version_no,'session_id',sess.id,'started',att.id is not null,'total',(select count(*) from rows),'filtered_total',(select count(*) from filtered),
   'answered',(select count(*) from rows where answered),'correct',(select count(*) from rows where correct),
   'hidden',exists(select 1 from public.quiz_generated_papers g where g.session_id=sess.id and g.user_id=uid and g.deleted_at is not null),
   'items',coalesce((select jsonb_agg(to_jsonb(p) order by number) from page p),'[]'::jsonb)) into result;
 end if;
 return result||jsonb_build_object('identity',identity,'offset',offst,'limit',lim,'as_of',statement_timestamp());
end $function$;
CREATE OR REPLACE FUNCTION public.admin_learning_paper_rows(p_user uuid, p_year integer, p_class text)
 RETURNS TABLE(session_id uuid, attempt_id uuid, title text, subject text, unit text, access_mode text, revision integer, created_at timestamp with time zone, started_at timestamp with time zone, last_answer_at timestamp with time zone, answered bigint, correct bigint, total integer, hidden boolean, source_attempt_id text, source_question_id text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 with own as (
  select a.session_id from public.quiz_attempts a where a.user_id=p_user
  union select g.session_id from public.quiz_generated_papers g where g.user_id=p_user
 )
 select s.id,a.id,coalesce(g.display_name,v.document->>'title','未命名試卷'),
  coalesce(v.document->'catalog'->>'subject',''),coalesce(v.document->'catalog'->>'unit',''),
  case when ls.session_id is not null then 'extension' else s.access_mode end,v.revision,s.created_at,a.created_at,x.last_at,x.answered,x.correct,
  case when a.id is not null then jsonb_array_length(a.question_order)
   else (select coalesce(sum(jsonb_array_length(b->'questions')),0)::integer from jsonb_array_elements(v.document->'blocks') b) end,
  g.deleted_at is not null,coalesce(ls.source_attempt::text,g.config->>'attempt_id'),coalesce(ls.question_id,g.config->>'question_id')
 from own o join public.quiz_sessions s on s.id=o.session_id
 left join public.quiz_learning_sessions ls on ls.session_id=s.id and ls.user_id=p_user
 join public.quiz_versions v on v.id=s.version_id
 left join public.quiz_attempts a on a.session_id=s.id and a.user_id=p_user
 left join public.quiz_generated_papers g on g.session_id=s.id and g.user_id=p_user
 cross join lateral (select count(*) as answered,count(*) filter(where z.correct) as correct,max(z.created_at) as last_at
  from public.quiz_answers z where z.attempt_id=a.id) x
 where s.school_year=p_year and (public.quiz_session_class_allowed(s.id,p_class) or (s.access_mode='practice' and a.id is not null)) and s.access_mode in ('classroom','practice','self')
 union all
 select a.id,a.id,v.document->>'title',coalesce(v.document->'catalog'->>'subject',''),v.document->>'title','past_exam',
  (select count(*)::integer from public.quiz_past_versions prior where prior.paper_id=a.paper_id and (prior.created_at,prior.id)<=(v.created_at,v.id)),
  a.created_at,a.created_at,x.last_at,x.answered,x.correct,
  (select count(*)::integer from jsonb_array_elements(v.document->'groups') g cross join lateral jsonb_array_elements(g->'fields') f),
  false,null::text,null::text
 from public.quiz_past_attempts a join public.quiz_past_versions v on v.id=a.version_id and v.paper_id=a.paper_id
 join public.quiz_past_papers p on p.id=a.paper_id
 cross join lateral(select count(*) filter(where r.attempt_id is not null) as answered,count(*) filter(where z.correct) as correct,null::timestamptz as last_at
  from jsonb_array_elements(v.document->'groups') fg cross join lateral jsonb_array_elements(fg->'fields') ff
  left join public.quiz_past_receipts r on r.attempt_id=a.id and r.group_id=fg->>'id'
  left join public.quiz_past_answers z on z.attempt_id=a.id and z.group_id=fg->>'id' and z.question_id=ff->>'id') x
 where a.user_id=p_user and a.school_year=p_year and a.semester=1 and p.grade=left(p_class,1)::integer;
$function$;
CREATE OR REPLACE FUNCTION public.admin_learning_rewards(p_action text, p_course_id text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare cls text;seat integer;result jsonb;
begin
 if auth.uid() is null or not coalesce(public.is_teacher(),false) then raise exception 'teacher_required';end if;
 if p_course_id is null or p_course_id not in ('grade3-115-1','grade4-115-1','grade6-115-1','grade9-115-1') then raise exception 'invalid_course';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('class_code','seat_no')) then raise exception 'invalid_request';end if;
 cls:=p_payload->>'class_code';
 if cls is null or cls !~ '^[3469][0-9]{2}$' or left(cls,1)<>substring(p_course_id from 6 for 1) then raise exception 'invalid_class';end if;
 if p_action='class_rewards' then
  if p_payload ? 'seat_no' then raise exception 'invalid_request';end if;
 else
  if coalesce(p_payload->>'seat_no','') !~ '^[0-9]{1,2}$' then raise exception 'student_required';end if;
  seat:=(p_payload->>'seat_no')::integer;if seat not between 1 and 99 then raise exception 'student_required';end if;
 end if;
 case p_action
 when 'rewards' then execute 'with input as (select $1::text as course,$2::text as class_code,$3::integer as seat_no,$4::jsonb as payload),
      binding as (select e.class_code,e.seat_no,e.display_name,count(u.id)::integer as mappings,min(u.id::text)::uuid as uid
       from public.student_enrollments e left join auth.users u on lower(u.email)=e.email and u.email_confirmed_at is not null
       where e.school_year=115 and e.class_code=$2 and e.seat_no=$3 group by e.class_code,e.seat_no,e.display_name),
      learner as (select uid,jsonb_build_object(''school_year'',115,''class_code'',class_code,''seat_no'',seat_no,''display_name'',display_name,
       ''mapping'',case when mappings=1 then ''linked'' when mappings=0 then ''unlinked'' else ''conflict'' end) as identity from binding),
      paper_rows(session_id,attempt_id,title,subject,unit,access_mode,revision,created_at,started_at,last_answer_at,answered,correct,total,hidden,source_attempt_id,source_question_id) as materialized (with own as (
  select a.session_id from public.quiz_attempts a where a.user_id=(select uid from learner)
  union select g.session_id from public.quiz_generated_papers g where g.user_id=(select uid from learner)
 )
 select s.id,a.id,coalesce(g.display_name,v.document->>''title'',''未命名試卷''),
  coalesce(v.document->''catalog''->>''subject'',''''),coalesce(v.document->''catalog''->>''unit'',''''),
  s.access_mode,v.revision,s.created_at,a.created_at,x.last_at,x.answered,x.correct,
  case when a.id is not null then jsonb_array_length(a.question_order)
   else (select coalesce(sum(jsonb_array_length(b->''questions'')),0)::integer from jsonb_array_elements(v.document->''blocks'') b) end,
  g.deleted_at is not null,g.config->>''attempt_id'',g.config->>''question_id''
 from own o join public.quiz_sessions s on s.id=o.session_id
 join public.quiz_versions v on v.id=s.version_id
 left join public.quiz_attempts a on a.session_id=s.id and a.user_id=(select uid from learner)
 left join public.quiz_generated_papers g on g.session_id=s.id and g.user_id=(select uid from learner)
 cross join lateral (select count(*) as answered,count(*) filter(where z.correct) as correct,max(z.created_at) as last_at
  from public.quiz_answers z where z.attempt_id=a.id) x
 where s.school_year=115 and (public.quiz_session_class_allowed(s.id,(select class_code from input)) or (s.access_mode=''practice'' and a.id is not null)) and s.access_mode in (''classroom'',''practice'',''self'') and not exists(select 1 from public.quiz_learning_sessions learning_private where learning_private.session_id=s.id)),
      selected_progress as (select p.* from public.typing_foundation_progress p where p.course_id=$1
       and p.learner_key=''google:''||(select uid::text from learner) and p.id=nullif($4::jsonb->>''progress_id'','''')::uuid),
      selected_session as (select s.* from public.quiz_sessions s join paper_rows r on r.session_id=s.id where s.id=nullif($4::jsonb->>''session_id'','''')::uuid),
      selected_attempt as (select a.* from public.quiz_attempts a where a.session_id=(select id from selected_session) and a.user_id=(select uid from learner)),
      selected_version as (select v.document,v.revision from public.quiz_versions v where v.id=(select version_id from selected_session)) select (case
      when not exists(select 1 from learner) then jsonb_build_object(''__error'',''student_unavailable'')
      when (select identity->>''mapping'' from learner)<>''linked'' then jsonb_build_object(''identity'',(select identity from learner),''items'',''[]''::jsonb,''total'',0)


      else (select result from (select jsonb_build_object(
    ''weekly_rows'',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select s.course_id,s.week_code,s.activity_key,s.current_level,s.completed,s.score,s.updated_at
       from public.student_progress s where s.user_id=(select uid from learner) and s.course_id=(select course from input)) r),''[]''::jsonb),
    ''foundation'',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select p.lesson_key,p.completed,p.checkpoint,p.completed_at,p.updated_at
       from public.typing_foundation_progress p where p.course_id=(select course from input) and p.learner_key=''google:''||(select uid from learner)::text) r),''[]''::jsonb),
    ''awards'',coalesce((select jsonb_agg(to_jsonb(r) order by r.awarded_at,r.id) from
      (select w.id,a.session_id,coalesce(g.display_name,v.document->>''title'') as title,w."grade",w.total,w.correct,
       coalesce((to_jsonb(w)->>''half_units'')::integer,2) as half_units,w.awarded_at
       from public.quiz_leaf_awards w join public.quiz_attempts a on a.id=w.attempt_id
       join public.quiz_sessions s on s.id=a.session_id join public.quiz_versions v on v.id=s.version_id
       left join public.quiz_generated_papers g on g.session_id=s.id
       where w.user_id=(select uid from learner) and w."grade"=substring((select course from input) from 6 for 1)::integer and s.school_year=115) r),''[]''::jsonb),
    ''past_flowers'',coalesce((select jsonb_agg(to_jsonb(r) order by r.awarded_at,r.id) from
      (select ''past:''||l.id::text as id,p.title,l.awarded_at
       from public.quiz_past_leaves l join public.quiz_past_attempts a on a.id=l.attempt_id
       join public.quiz_past_papers p on p.id=l.paper_id
       where l.user_id=(select uid from learner) and l.school_year=115 and l.semester=1
       and p."grade"=substring((select course from input) from 6 for 1)::integer) r),''[]''::jsonb),
    ''assignments'',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select a.id,a.course_id,a.week_code,a.title,
        (select jsonb_build_object(''status'',s.status,''submitted_at'',s.submitted_at,''reviewed_at'',s.reviewed_at)
         from public.homework_submissions s join public.homework_uploads u on u.id=s.upload_id
         where s.assignment_id=a.id and s.user_id=(select uid from learner)) as submission
       from public.homework_assignments a where (select course from input)=''grade6-115-1'' and a.course_id=(select course from input)
       and a.state<>''draft'' and a.class_code in (''*'',(select class_code from input))) r),''[]''::jsonb),
    ''periods'',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select p.id,p.course_id,p.week_code,
        (select jsonb_build_object(''status'',v.status,''submitted_at'',v.submitted_at,''reviewed_at'',v.reviewed_at)
         from public.reading_submissions s join public.reading_versions v on v.id=s.version_id
         where s.period_id=p.id and s.user_id=(select uid from learner)) as submission
       from public.reading_periods p where (select course from input)=''grade6-115-1'' and p.course_id=(select course from input)
       and p.starts_on<=(statement_timestamp() at time zone ''Asia/Taipei'')::date
       and (p.enabled or exists(select 1 from public.reading_submissions s where s.period_id=p.id and s.user_id=(select uid from learner)))) r),''[]''::jsonb),
    ''rehearsal'',coalesce((select jsonb_build_object(''leaves'',t.leaves,''flowers'',t.flowers,''setup_id'',to_jsonb(t)->>''setup_id'')
      from public.garden_test_setup t join auth.users u on u.id=t.user_id
      where t.user_id=(select uid from learner) and t.course_id=(select course from input) and (select course from input)=''grade3-115-1''
      and lower(u.email)=''chianwu@apps.ntpc.edu.tw'' and u.email_confirmed_at is not null),''null''::jsonb))) selected_result(result)) end)||jsonb_build_object(''as_of'',statement_timestamp(),''read_source'',''production-rpc'',''offset'',coalesce(($4::jsonb->>''offset'')::integer,0),''limit'',coalesce(($4::jsonb->>''limit'')::integer,20),''identity'',(select identity from learner)) as result' into result using p_course_id,cls,seat,p_payload;
when 'garden_status' then execute 'with reward_snapshot as (with input as (select $1::text as course,$2::text as class_code,$3::integer as seat_no,$4::jsonb as payload),
      binding as (select e.class_code,e.seat_no,e.display_name,count(u.id)::integer as mappings,min(u.id::text)::uuid as uid
       from public.student_enrollments e left join auth.users u on lower(u.email)=e.email and u.email_confirmed_at is not null
       where e.school_year=115 and e.class_code=$2 and e.seat_no=$3 group by e.class_code,e.seat_no,e.display_name),
      learner as (select uid,jsonb_build_object(''school_year'',115,''class_code'',class_code,''seat_no'',seat_no,''display_name'',display_name,
       ''mapping'',case when mappings=1 then ''linked'' when mappings=0 then ''unlinked'' else ''conflict'' end) as identity from binding),
      paper_rows(session_id,attempt_id,title,subject,unit,access_mode,revision,created_at,started_at,last_answer_at,answered,correct,total,hidden,source_attempt_id,source_question_id) as materialized (with own as (
  select a.session_id from public.quiz_attempts a where a.user_id=(select uid from learner)
  union select g.session_id from public.quiz_generated_papers g where g.user_id=(select uid from learner)
 )
 select s.id,a.id,coalesce(g.display_name,v.document->>''title'',''未命名試卷''),
  coalesce(v.document->''catalog''->>''subject'',''''),coalesce(v.document->''catalog''->>''unit'',''''),
  s.access_mode,v.revision,s.created_at,a.created_at,x.last_at,x.answered,x.correct,
  case when a.id is not null then jsonb_array_length(a.question_order)
   else (select coalesce(sum(jsonb_array_length(b->''questions'')),0)::integer from jsonb_array_elements(v.document->''blocks'') b) end,
  g.deleted_at is not null,g.config->>''attempt_id'',g.config->>''question_id''
 from own o join public.quiz_sessions s on s.id=o.session_id
 join public.quiz_versions v on v.id=s.version_id
 left join public.quiz_attempts a on a.session_id=s.id and a.user_id=(select uid from learner)
 left join public.quiz_generated_papers g on g.session_id=s.id and g.user_id=(select uid from learner)
 cross join lateral (select count(*) as answered,count(*) filter(where z.correct) as correct,max(z.created_at) as last_at
  from public.quiz_answers z where z.attempt_id=a.id) x
 where s.school_year=115 and (public.quiz_session_class_allowed(s.id,(select class_code from input)) or (s.access_mode=''practice'' and a.id is not null)) and s.access_mode in (''classroom'',''practice'',''self'') and not exists(select 1 from public.quiz_learning_sessions learning_private where learning_private.session_id=s.id)),
      selected_progress as (select p.* from public.typing_foundation_progress p where p.course_id=$1
       and p.learner_key=''google:''||(select uid::text from learner) and p.id=nullif($4::jsonb->>''progress_id'','''')::uuid),
      selected_session as (select s.* from public.quiz_sessions s join paper_rows r on r.session_id=s.id where s.id=nullif($4::jsonb->>''session_id'','''')::uuid),
      selected_attempt as (select a.* from public.quiz_attempts a where a.session_id=(select id from selected_session) and a.user_id=(select uid from learner)),
      selected_version as (select v.document,v.revision from public.quiz_versions v where v.id=(select version_id from selected_session)) select (case
      when not exists(select 1 from learner) then jsonb_build_object(''__error'',''student_unavailable'')
      when (select identity->>''mapping'' from learner)<>''linked'' then jsonb_build_object(''identity'',(select identity from learner),''items'',''[]''::jsonb,''total'',0)


      else (select result from (select jsonb_build_object(
    ''weekly_rows'',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select s.course_id,s.week_code,s.activity_key,s.current_level,s.completed,s.score,s.updated_at
       from public.student_progress s where s.user_id=(select uid from learner) and s.course_id=(select course from input)) r),''[]''::jsonb),
    ''foundation'',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select p.lesson_key,p.completed,p.checkpoint,p.completed_at,p.updated_at
       from public.typing_foundation_progress p where p.course_id=(select course from input) and p.learner_key=''google:''||(select uid from learner)::text) r),''[]''::jsonb),
    ''awards'',coalesce((select jsonb_agg(to_jsonb(r) order by r.awarded_at,r.id) from
      (select w.id,a.session_id,coalesce(g.display_name,v.document->>''title'') as title,w."grade",w.total,w.correct,
       coalesce((to_jsonb(w)->>''half_units'')::integer,2) as half_units,w.awarded_at
       from public.quiz_leaf_awards w join public.quiz_attempts a on a.id=w.attempt_id
       join public.quiz_sessions s on s.id=a.session_id join public.quiz_versions v on v.id=s.version_id
       left join public.quiz_generated_papers g on g.session_id=s.id
       where w.user_id=(select uid from learner) and w."grade"=substring((select course from input) from 6 for 1)::integer and s.school_year=115) r),''[]''::jsonb),
    ''past_flowers'',coalesce((select jsonb_agg(to_jsonb(r) order by r.awarded_at,r.id) from
      (select ''past:''||l.id::text as id,p.title,l.awarded_at
       from public.quiz_past_leaves l join public.quiz_past_attempts a on a.id=l.attempt_id
       join public.quiz_past_papers p on p.id=l.paper_id
       where l.user_id=(select uid from learner) and l.school_year=115 and l.semester=1
       and p."grade"=substring((select course from input) from 6 for 1)::integer) r),''[]''::jsonb),
    ''assignments'',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select a.id,a.course_id,a.week_code,a.title,
        (select jsonb_build_object(''status'',s.status,''submitted_at'',s.submitted_at,''reviewed_at'',s.reviewed_at)
         from public.homework_submissions s join public.homework_uploads u on u.id=s.upload_id
         where s.assignment_id=a.id and s.user_id=(select uid from learner)) as submission
       from public.homework_assignments a where (select course from input)=''grade6-115-1'' and a.course_id=(select course from input)
       and a.state<>''draft'' and a.class_code in (''*'',(select class_code from input))) r),''[]''::jsonb),
    ''periods'',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select p.id,p.course_id,p.week_code,
        (select jsonb_build_object(''status'',v.status,''submitted_at'',v.submitted_at,''reviewed_at'',v.reviewed_at)
         from public.reading_submissions s join public.reading_versions v on v.id=s.version_id
         where s.period_id=p.id and s.user_id=(select uid from learner)) as submission
       from public.reading_periods p where (select course from input)=''grade6-115-1'' and p.course_id=(select course from input)
       and p.starts_on<=(statement_timestamp() at time zone ''Asia/Taipei'')::date
       and (p.enabled or exists(select 1 from public.reading_submissions s where s.period_id=p.id and s.user_id=(select uid from learner)))) r),''[]''::jsonb),
    ''rehearsal'',coalesce((select jsonb_build_object(''leaves'',t.leaves,''flowers'',t.flowers,''setup_id'',to_jsonb(t)->>''setup_id'')
      from public.garden_test_setup t join auth.users u on u.id=t.user_id
      where t.user_id=(select uid from learner) and t.course_id=(select course from input) and (select course from input)=''grade3-115-1''
      and lower(u.email)=''chianwu@apps.ntpc.edu.tw'' and u.email_confirmed_at is not null),''null''::jsonb))) selected_result(result)) end)||jsonb_build_object(''as_of'',statement_timestamp(),''read_source'',''production-rpc'',''offset'',coalesce(($4::jsonb->>''offset'')::integer,0),''limit'',coalesce(($4::jsonb->>''limit'')::integer,20),''identity'',(select identity from learner)) as result), garden_catalog(item_key,label,pet,home,leaves,flowers,portrait) as (select * from public.garden_item_catalog()), principal as (
        select min(u.id::text)::uuid as uid from public.student_enrollments e join auth.users u
          on lower(u.email)=e.email and u.email_confirmed_at is not null
        where e.school_year=115 and e.class_code=$2 and e.seat_no=$3 having count(*)=1
      ) select result||case when result->''identity''->>''mapping''=''linked'' then jsonb_build_object(''garden'',jsonb_build_object(
        ''growth'',(select jsonb_build_object(''grown_at'',g.grown_at,''seen_at'',g.seen_at,''baseline'',g.baseline,
          ''reward_version'',coalesce((to_jsonb(g)->>''reward_version'')::integer,1),
          ''leaf_floor'',coalesce((to_jsonb(g)->>''leaf_floor'')::integer,44),
          ''flower_floor'',coalesce((to_jsonb(g)->>''flower_floor'')::integer,10))
          from public.garden_growth g where g.user_id=(select uid from principal) and g.course_id=$1),
        ''has_growth'',exists(select 1 from public.garden_growth g where g.user_id=(select uid from principal)),
        ''legacy_pet'',exists(select 1 from public.garden_growth g where g.user_id=(select uid from principal) and g.pet_unlocked_at is not null),
        ''catalog'',coalesce((select jsonb_agg(jsonb_build_object(''key'',c.item_key,''label'',c.label,''pet'',c.pet,''home'',c.home,
          ''leaves'',c.leaves,''flowers'',c.flowers) order by c.leaves,c.item_key) from garden_catalog c),''[]''::jsonb),
        ''unlocks'',coalesce((select jsonb_agg(jsonb_build_object(''key'',u.item_key,''course_id'',u.course_id,''unlocked_at'',u.unlocked_at))
          from public.garden_item_unlocks u where u.user_id=(select uid from principal)),''[]''::jsonb)))
        else ''{}''::jsonb end as result from reward_snapshot' into result using p_course_id,cls,seat,p_payload;
when 'class_rewards' then execute 'with roster_students as (
        select e.class_code,e.seat_no,e.display_name,e.class_code||lpad(e.seat_no::text,2,''0'') as student_code,
          (select count(*) from auth.users u where lower(u.email)=e.email and u.email_confirmed_at is not null) as mappings
        from public.student_enrollments e where e.school_year=115 and e.class_code=$2::text
          and left(e.class_code,1)=substring($1::text from 6 for 1) and $3::integer is null
      ) select jsonb_build_object(''class_code'',$2::text,''total'',count(*),''as_of'',statement_timestamp(),
        ''read_source'',''production-rpc'',''items'',coalesce(jsonb_agg(jsonb_build_object(
          ''class_code'',roster_students.class_code,''seat_no'',roster_students.seat_no,
          ''display_name'',roster_students.display_name,''student_code'',roster_students.student_code,
          ''mappings'',roster_students.mappings,''rewards'',reward_data.result) order by roster_students.seat_no),''[]''::jsonb)) as result
        from roster_students cross join lateral (with reward_snapshot as (with input as (select $1::text as course,$2::text as class_code,roster_students.seat_no::integer as seat_no,$4::jsonb as payload),
      binding as (select e.class_code,e.seat_no,e.display_name,count(u.id)::integer as mappings,min(u.id::text)::uuid as uid
       from public.student_enrollments e left join auth.users u on lower(u.email)=e.email and u.email_confirmed_at is not null
       where e.school_year=115 and e.class_code=$2 and e.seat_no=roster_students.seat_no group by e.class_code,e.seat_no,e.display_name),
      learner as (select uid,jsonb_build_object(''school_year'',115,''class_code'',class_code,''seat_no'',seat_no,''display_name'',display_name,
       ''mapping'',case when mappings=1 then ''linked'' when mappings=0 then ''unlinked'' else ''conflict'' end) as identity from binding),
      paper_rows(session_id,attempt_id,title,subject,unit,access_mode,revision,created_at,started_at,last_answer_at,answered,correct,total,hidden,source_attempt_id,source_question_id) as materialized (with own as (
  select a.session_id from public.quiz_attempts a where a.user_id=(select uid from learner)
  union select g.session_id from public.quiz_generated_papers g where g.user_id=(select uid from learner)
 )
 select s.id,a.id,coalesce(g.display_name,v.document->>''title'',''未命名試卷''),
  coalesce(v.document->''catalog''->>''subject'',''''),coalesce(v.document->''catalog''->>''unit'',''''),
  s.access_mode,v.revision,s.created_at,a.created_at,x.last_at,x.answered,x.correct,
  case when a.id is not null then jsonb_array_length(a.question_order)
   else (select coalesce(sum(jsonb_array_length(b->''questions'')),0)::integer from jsonb_array_elements(v.document->''blocks'') b) end,
  g.deleted_at is not null,g.config->>''attempt_id'',g.config->>''question_id''
 from own o join public.quiz_sessions s on s.id=o.session_id
 join public.quiz_versions v on v.id=s.version_id
 left join public.quiz_attempts a on a.session_id=s.id and a.user_id=(select uid from learner)
 left join public.quiz_generated_papers g on g.session_id=s.id and g.user_id=(select uid from learner)
 cross join lateral (select count(*) as answered,count(*) filter(where z.correct) as correct,max(z.created_at) as last_at
  from public.quiz_answers z where z.attempt_id=a.id) x
 where s.school_year=115 and (public.quiz_session_class_allowed(s.id,(select class_code from input)) or (s.access_mode=''practice'' and a.id is not null)) and s.access_mode in (''classroom'',''practice'',''self'') and not exists(select 1 from public.quiz_learning_sessions learning_private where learning_private.session_id=s.id)),
      selected_progress as (select p.* from public.typing_foundation_progress p where p.course_id=$1
       and p.learner_key=''google:''||(select uid::text from learner) and p.id=nullif($4::jsonb->>''progress_id'','''')::uuid),
      selected_session as (select s.* from public.quiz_sessions s join paper_rows r on r.session_id=s.id where s.id=nullif($4::jsonb->>''session_id'','''')::uuid),
      selected_attempt as (select a.* from public.quiz_attempts a where a.session_id=(select id from selected_session) and a.user_id=(select uid from learner)),
      selected_version as (select v.document,v.revision from public.quiz_versions v where v.id=(select version_id from selected_session)) select (case
      when not exists(select 1 from learner) then jsonb_build_object(''__error'',''student_unavailable'')
      when (select identity->>''mapping'' from learner)<>''linked'' then jsonb_build_object(''identity'',(select identity from learner),''items'',''[]''::jsonb,''total'',0)


      else (select result from (select jsonb_build_object(
    ''weekly_rows'',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select s.course_id,s.week_code,s.activity_key,s.current_level,s.completed,s.score,s.updated_at
       from public.student_progress s where s.user_id=(select uid from learner) and s.course_id=(select course from input)) r),''[]''::jsonb),
    ''foundation'',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select p.lesson_key,p.completed,p.checkpoint,p.completed_at,p.updated_at
       from public.typing_foundation_progress p where p.course_id=(select course from input) and p.learner_key=''google:''||(select uid from learner)::text) r),''[]''::jsonb),
    ''awards'',coalesce((select jsonb_agg(to_jsonb(r) order by r.awarded_at,r.id) from
      (select w.id,a.session_id,coalesce(g.display_name,v.document->>''title'') as title,w."grade",w.total,w.correct,
       coalesce((to_jsonb(w)->>''half_units'')::integer,2) as half_units,w.awarded_at
       from public.quiz_leaf_awards w join public.quiz_attempts a on a.id=w.attempt_id
       join public.quiz_sessions s on s.id=a.session_id join public.quiz_versions v on v.id=s.version_id
       left join public.quiz_generated_papers g on g.session_id=s.id
       where w.user_id=(select uid from learner) and w."grade"=substring((select course from input) from 6 for 1)::integer and s.school_year=115) r),''[]''::jsonb),
    ''past_flowers'',coalesce((select jsonb_agg(to_jsonb(r) order by r.awarded_at,r.id) from
      (select ''past:''||l.id::text as id,p.title,l.awarded_at
       from public.quiz_past_leaves l join public.quiz_past_attempts a on a.id=l.attempt_id
       join public.quiz_past_papers p on p.id=l.paper_id
       where l.user_id=(select uid from learner) and l.school_year=115 and l.semester=1
       and p."grade"=substring((select course from input) from 6 for 1)::integer) r),''[]''::jsonb),
    ''assignments'',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select a.id,a.course_id,a.week_code,a.title,
        (select jsonb_build_object(''status'',s.status,''submitted_at'',s.submitted_at,''reviewed_at'',s.reviewed_at)
         from public.homework_submissions s join public.homework_uploads u on u.id=s.upload_id
         where s.assignment_id=a.id and s.user_id=(select uid from learner)) as submission
       from public.homework_assignments a where (select course from input)=''grade6-115-1'' and a.course_id=(select course from input)
       and a.state<>''draft'' and a.class_code in (''*'',(select class_code from input))) r),''[]''::jsonb),
    ''periods'',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select p.id,p.course_id,p.week_code,
        (select jsonb_build_object(''status'',v.status,''submitted_at'',v.submitted_at,''reviewed_at'',v.reviewed_at)
         from public.reading_submissions s join public.reading_versions v on v.id=s.version_id
         where s.period_id=p.id and s.user_id=(select uid from learner)) as submission
       from public.reading_periods p where (select course from input)=''grade6-115-1'' and p.course_id=(select course from input)
       and p.starts_on<=(statement_timestamp() at time zone ''Asia/Taipei'')::date
       and (p.enabled or exists(select 1 from public.reading_submissions s where s.period_id=p.id and s.user_id=(select uid from learner)))) r),''[]''::jsonb),
    ''rehearsal'',coalesce((select jsonb_build_object(''leaves'',t.leaves,''flowers'',t.flowers,''setup_id'',to_jsonb(t)->>''setup_id'')
      from public.garden_test_setup t join auth.users u on u.id=t.user_id
      where t.user_id=(select uid from learner) and t.course_id=(select course from input) and (select course from input)=''grade3-115-1''
      and lower(u.email)=''chianwu@apps.ntpc.edu.tw'' and u.email_confirmed_at is not null),''null''::jsonb))) selected_result(result)) end)||jsonb_build_object(''as_of'',statement_timestamp(),''read_source'',''production-rpc'',''offset'',coalesce(($4::jsonb->>''offset'')::integer,0),''limit'',coalesce(($4::jsonb->>''limit'')::integer,20),''identity'',(select identity from learner)) as result), garden_catalog(item_key,label,pet,home,leaves,flowers,portrait) as (select * from public.garden_item_catalog()), principal as (
        select min(u.id::text)::uuid as uid from public.student_enrollments e join auth.users u
          on lower(u.email)=e.email and u.email_confirmed_at is not null
        where e.school_year=115 and e.class_code=$2 and e.seat_no=roster_students.seat_no having count(*)=1
      ) select result||case when result->''identity''->>''mapping''=''linked'' then jsonb_build_object(''garden'',jsonb_build_object(
        ''growth'',(select jsonb_build_object(''grown_at'',g.grown_at,''seen_at'',g.seen_at,''baseline'',g.baseline,
          ''reward_version'',coalesce((to_jsonb(g)->>''reward_version'')::integer,1),
          ''leaf_floor'',coalesce((to_jsonb(g)->>''leaf_floor'')::integer,44),
          ''flower_floor'',coalesce((to_jsonb(g)->>''flower_floor'')::integer,10))
          from public.garden_growth g where g.user_id=(select uid from principal) and g.course_id=$1),
        ''has_growth'',exists(select 1 from public.garden_growth g where g.user_id=(select uid from principal)),
        ''legacy_pet'',exists(select 1 from public.garden_growth g where g.user_id=(select uid from principal) and g.pet_unlocked_at is not null),
        ''catalog'',coalesce((select jsonb_agg(jsonb_build_object(''key'',c.item_key,''label'',c.label,''pet'',c.pet,''home'',c.home,
          ''leaves'',c.leaves,''flowers'',c.flowers) order by c.leaves,c.item_key) from garden_catalog c),''[]''::jsonb),
        ''unlocks'',coalesce((select jsonb_agg(jsonb_build_object(''key'',u.item_key,''course_id'',u.course_id,''unlocked_at'',u.unlocked_at))
          from public.garden_item_unlocks u where u.user_id=(select uid from principal)),''[]''::jsonb)))
        else ''{}''::jsonb end as result from reward_snapshot) reward_data' into result using p_course_id,cls,seat,p_payload;
 else raise exception 'invalid_action';end case;
 if result ? '__error' then raise exception '%',result->>'__error';end if;
 return result;
end $function$;
notify pgrst,'reload schema';
commit;
