-- Expiring access to sealed individual past papers for dedicated Google test students.
BEGIN;
SET LOCAL lock_timeout = '4s';
DO $guard$
BEGIN
 IF md5(pg_get_functiondef('public.quiz_past_action_before_drafts(text,jsonb)'::regprocedure)) IS DISTINCT FROM '79ae9c807de6cd4084549a02b97bbfe3' THEN
  RAISE EXCEPTION 'Unexpected public.quiz_past_action_before_drafts(text,jsonb) version';
 END IF;
 IF md5(pg_get_functiondef('public.quiz_media_access_before_reports(text,uuid)'::regprocedure)) IS DISTINCT FROM '4f8ac6502ef5bc43ba7528ff5bbcbdcc' THEN
  RAISE EXCEPTION 'Unexpected public.quiz_media_access_before_reports(text,uuid) version';
 END IF;
 IF md5(pg_get_functiondef('public.quiz_study_payload(text,uuid,uuid,jsonb)'::regprocedure)) IS DISTINCT FROM '217af41e87b728299f490684e66860b0' THEN
  RAISE EXCEPTION 'Unexpected public.quiz_study_payload(text,uuid,uuid,jsonb) version';
 END IF;
 IF md5(pg_get_functiondef('public.quiz_past_snapshot_before_flowers(uuid)'::regprocedure)) IS DISTINCT FROM 'cfdca6b8722433bf295ca63e129a4ae7' THEN
  RAISE EXCEPTION 'Unexpected public.quiz_past_snapshot_before_flowers(uuid) version';
 END IF;
 IF md5(pg_get_functiondef('public.quiz_past_snapshot_before_drafts(uuid)'::regprocedure)) IS DISTINCT FROM '074421da5937e369d97813f418900737' THEN
  RAISE EXCEPTION 'Unexpected public.quiz_past_snapshot_before_drafts(uuid) version';
 END IF;
 IF md5(pg_get_functiondef('public.quiz_learning(jsonb)'::regprocedure)) IS DISTINCT FROM '7a64a004c959dcf5b6a6ae5b7cae7673' THEN
  RAISE EXCEPTION 'Unexpected public.quiz_learning(jsonb) version';
 END IF;
 IF md5(pg_get_functiondef('public.quiz_learning_wrong_items(integer)'::regprocedure)) IS DISTINCT FROM '4c23de22e897b10eccde977bf202d2a6' THEN
  RAISE EXCEPTION 'Unexpected public.quiz_learning_wrong_items(integer) version';
 END IF;
 IF md5(pg_get_functiondef('public.quiz_question_report(jsonb)'::regprocedure)) IS DISTINCT FROM '4cd12b935a83c67e45cdbb0b3596bd6d' THEN
  RAISE EXCEPTION 'Unexpected public.quiz_question_report(jsonb) version';
 END IF;
END $guard$;

CREATE TABLE public.quiz_past_acceptance_grants (
 paper_id text NOT NULL REFERENCES public.quiz_past_papers(id),
 version_id uuid NOT NULL REFERENCES public.quiz_past_versions(id),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 starts_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 PRIMARY KEY (paper_id,user_id),
 CHECK (expires_at>starts_at AND expires_at<=starts_at+interval '2 hours')
);
ALTER TABLE public.quiz_past_acceptance_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.quiz_past_acceptance_grants FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.quiz_past_attempts ADD COLUMN acceptance_only boolean NOT NULL DEFAULT false;

CREATE FUNCTION public.quiz_past_acceptance_version(pid text)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 SELECT g.version_id
 FROM public.quiz_past_acceptance_grants g
 JOIN public.quiz_past_papers p ON p.id=g.paper_id AND NOT p.enabled AND p.active_version IS NULL
 JOIN public.quiz_past_versions v ON v.id=g.version_id AND v.paper_id=p.id
 JOIN auth.users u ON u.id=g.user_id AND u.email_confirmed_at IS NOT NULL AND u.raw_app_meta_data->'providers' ? 'google'
 WHERE g.user_id=auth.uid() AND g.paper_id=pid
   AND g.starts_at<=statement_timestamp() AND g.expires_at>statement_timestamp()
   AND EXISTS (
     SELECT 1 FROM public.student_enrollments e WHERE e.email=lower(u.email)
       AND e.school_year=p.school_year AND left(e.class_code,1)=p.grade::text
   )
$function$;
REVOKE ALL ON FUNCTION public.quiz_past_acceptance_version(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.quiz_past_action_before_drafts(p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare identity jsonb; qa_version uuid; paper public.quiz_past_papers;att public.quiz_past_attempts;prior public.quiz_past_receipts;d jsonb;g jsonb;f jsonb;r jsonb;v jsonb;correct boolean;canonical jsonb:='[]';results jsonb:='[]';n integer:=0;score numeric:=0;mx numeric;aid uuid;rid uuid;viewed public.quiz_past_views;elapsed numeric;min_seconds numeric;gid text;
begin
 if auth.uid() is null then raise exception 'login_required';end if;
 if p_action in('preview','preview_list') then
  if not coalesce(public.is_teacher(),false) then raise exception 'teacher_required';end if;
  if p_action='preview_list' then return jsonb_build_object('papers',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'grade',p.grade,'enabled',p.enabled,'version',p.active_version) order by p.grade,p.id) from public.quiz_past_papers p where p.owner_id=auth.uid()),'[]'));end if;
  select * into paper from public.quiz_past_papers where id=p_data->>'paper_id' and owner_id=auth.uid();if paper.id is null then raise exception 'paper_unavailable';end if;
  return (select jsonb_build_object('paper',to_jsonb(paper),'document',document,'provenance',provenance) from public.quiz_past_versions where id=paper.active_version);
 end if;
 if coalesce(public.is_teacher(),false) then raise exception 'student_required';end if;
 identity:=public.quiz_student_identity();if identity->>'role' is distinct from 'student' then raise exception 'roster_required';end if;
 if p_action='list' then return jsonb_build_object('identity',identity,'papers',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'version',p.active_version,'grade',p.grade,'enabled',p.enabled,'catalog',v.document->'catalog') order by p.id) from public.quiz_past_papers p join public.quiz_past_versions v on v.id=p.active_version and v.paper_id=p.id where p.grade=(identity->>'grade')::integer and p.school_year=115 and p.semester=1),'[]'));end if;
 select * into paper from public.quiz_past_papers where id=p_data->>'paper_id' for share;
 if not paper.enabled then qa_version:=public.quiz_past_acceptance_version(paper.id);end if;
 if paper.id is null or (not paper.enabled and qa_version is null)
    or paper.grade<>(identity->>'grade')::integer or paper.school_year<>115 or paper.semester<>1
 then raise exception 'paper_unavailable';end if;
 if p_action in('start','restart') then
  rid:=(p_data->>'request_id')::uuid;if rid is null then raise exception 'invalid_request';end if;
  -- Retry of a lost start response returns the exact existing attempt, even after a later revision.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||paper.id,0));
  select * into att from public.quiz_past_attempts where user_id=auth.uid() and paper_id=paper.id and start_request=rid;
  if att.id is not null and (att.acceptance_only is distinct from (qa_version is not null)
    or (qa_version is not null and att.version_id is distinct from qa_version))
  then raise exception 'attempt_unavailable';end if;
  if att.id is null and p_action='start' then select * into att from public.quiz_past_attempts where user_id=auth.uid() and paper_id=paper.id and school_year=paper.school_year and semester=paper.semester and acceptance_only=(qa_version is not null)
   and (case when qa_version is not null then version_id=qa_version else paper.grade<>9 or version_id=paper.active_version end)
   and completed_at is null order by created_at desc limit 1;end if;
  if att.id is null then insert into public.quiz_past_attempts(paper_id,version_id,user_id,school_year,semester,start_request,acceptance_only) values(paper.id,coalesce(qa_version,paper.active_version),auth.uid(),paper.school_year,paper.semester,rid,qa_version is not null) returning * into att;end if;
  return public.quiz_past_snapshot(att.id)||jsonb_build_object('identity',identity);
 end if;
 aid:=(p_data->>'attempt_id')::uuid;
 select * into att from public.quiz_past_attempts where id=aid and user_id=auth.uid() and paper_id=paper.id for update;
 if att.id is null or att.acceptance_only is distinct from (qa_version is not null)
    or (qa_version is not null and att.version_id is distinct from qa_version)
 then raise exception 'attempt_unavailable';end if;
 select document into d from public.quiz_past_versions where id=att.version_id;
 if p_action='resume' then return public.quiz_past_snapshot(aid)||jsonb_build_object('identity',identity);end if;
 gid:=p_data->>'group_id';select x into g from jsonb_array_elements(d->'groups') x where x->>'id'=gid;if g is null then raise exception 'group_unavailable';end if;
 if p_action='view' then
  insert into public.quiz_past_views(attempt_id,group_id) values(aid,gid) on conflict do nothing;return jsonb_build_object('ready',true);
 end if;
 if p_action<>'submit' or p_data->>'version' is distinct from att.version_id::text then raise exception 'version_changed';end if;
 rid:=(p_data->>'request_id')::uuid;if rid is null then raise exception 'invalid_request';end if;
 if jsonb_typeof(p_data->'responses') is distinct from 'array' or jsonb_array_length(p_data->'responses')<>jsonb_array_length(g->'fields') then raise exception 'incomplete_group';end if;
 if g->>'kind'='mark' and p_data->'confirmed' is distinct from 'true'::jsonb then raise exception 'confirmation_required';end if;
 for f in select value from jsonb_array_elements(g->'fields') loop
  r:=p_data->'responses'->n;n:=n+1;
  if jsonb_typeof(r) is distinct from 'object' or (select array_agg(k order by k) from jsonb_object_keys(r) k) is distinct from array['questionId','value'] or r->>'questionId' is distinct from f->>'id' then raise exception 'invalid_group_fields';end if;
  v:=public.quiz_past_canonical(g,r->'value');canonical:=canonical||jsonb_build_array(jsonb_build_object('questionId',f->'id','value',v));
  correct:=case when g->>'kind' in('annotation','manual') then null when g->>'kind'='short' then exists(select 1 from jsonb_array_elements_text(f->'answer') a where (case when g->>'answerFormat'='math-v1' then public.quiz_math_answer_normalize(a)=v->>'answer' else trim(a)=trim(v#>>'{}') end)) else v=f->'answer' end;
  if correct then score:=score+(f->>'points')::numeric;end if;
  results:=results||jsonb_build_array(jsonb_build_object('questionId',f->'id','correct',correct,'points',case when g->>'kind' in('annotation','manual') then null else f->'points' end,'official',case when g->>'kind' in('annotation','manual') then null when g->>'answerFormat'='math-v1' then f->'displayAnswer' else f->'answer' end));
 end loop;
 select * into prior from public.quiz_past_receipts where attempt_id=aid and group_id=gid;
 if prior.attempt_id is not null then
  if prior.request_id<>rid or prior.responses is distinct from canonical then raise exception 'submission_conflict';end if;return public.quiz_past_snapshot(aid);
 end if;
 if exists(select 1 from public.quiz_past_receipts where attempt_id=aid and request_id=rid) then raise exception 'submission_conflict';end if;
 select * into viewed from public.quiz_past_views where attempt_id=aid and group_id=gid;
 min_seconds:=greatest(2,jsonb_array_length(g->'fields')*2);elapsed:=extract(epoch from clock_timestamp()-viewed.started_at);
 if viewed.attempt_id is null or elapsed<min_seconds then raise exception 'answer_too_fast';end if;
 insert into public.quiz_past_receipts values(aid,gid,rid,canonical,results,case when g->>'kind' in('annotation','manual') then null else score end,case when g->>'kind' in('annotation','manual') then 'self_checked' else 'graded' end);
 n:=0;for f in select value from jsonb_array_elements(g->'fields') loop
  insert into public.quiz_past_answers values(aid,gid,f->>'id',canonical->n->'value',(results->n->>'correct')::boolean,(f->>'points')::numeric);n:=n+1;
 end loop;
 update public.quiz_past_views set accepted_seconds=elapsed where attempt_id=aid and group_id=gid;
 select coalesce(sum(case when x.correct then x.points else 0 end),0) into score from public.quiz_past_answers x where attempt_id=aid;
 select coalesce(sum((df->>'points')::numeric),0) into mx from jsonb_array_elements(d->'groups') dg cross join lateral jsonb_array_elements(dg->'fields') df where dg->>'kind' not in('annotation','manual');
 update public.quiz_past_attempts set score=score,max_score=mx where id=aid;
 if not exists(select 1 from jsonb_array_elements(d->'groups') required where required->'optional' is distinct from 'true'::jsonb and not exists(select 1 from public.quiz_past_receipts r where r.attempt_id=aid and r.group_id=required->>'id')) then
  update public.quiz_past_attempts set completed_at=coalesce(completed_at,clock_timestamp()) where id=aid;
  if not att.acceptance_only and mx>0 and score*100>=mx*60 then
   insert into public.quiz_past_leaves(user_id,paper_id,school_year,semester,attempt_id) values(auth.uid(),paper.id,att.school_year,att.semester,aid) on conflict(user_id,paper_id,school_year,semester) do nothing;
  end if;
 end if;
 return public.quiz_past_snapshot(aid);
end $function$;

CREATE OR REPLACE FUNCTION public.quiz_media_access_before_reports(p_url text, p_attempt uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare att public.quiz_past_attempts;paper public.quiz_past_papers;d jsonb;asset public.quiz_media_assets;identity jsonb;
begin
 if auth.uid() is null then raise exception 'login_required';end if;
 if coalesce(public.is_teacher(),false) then
  select * into asset from public.quiz_media_assets where url=p_url and owner_id=auth.uid();
  if asset.url is not null and exists(select 1 from public.quiz_past_versions v join public.quiz_past_papers p on p.id=v.paper_id where p.owner_id=auth.uid() and (public.quiz_past_has_media(v.document,p_url) or exists(select 1 from jsonb_array_elements(v.document->'groups') g where g->>'referenceUrl'=p_url))) then return to_jsonb(asset)||jsonb_build_object('backend','supabase');end if;
 end if;
 select * into att from public.quiz_past_attempts where id=p_attempt;
 if att.id is null then return public.quiz_media_access_before_past(p_url,p_attempt);end if;
 identity:=public.quiz_student_identity();select * into paper from public.quiz_past_papers where id=att.paper_id;
 if att.user_id<>auth.uid() or identity->>'role' is distinct from 'student' or (case when att.acceptance_only then
  public.quiz_past_acceptance_version(paper.id) is distinct from att.version_id
  else not paper.enabled end) or paper.grade<>(identity->>'grade')::integer then raise exception 'media_unavailable';end if;
 select document into d from public.quiz_past_versions where id=att.version_id;
 if not public.quiz_past_has_media(d,p_url) and not exists(select 1 from jsonb_array_elements(d->'groups') g where g->>'referenceUrl'=p_url and exists(select 1 from public.quiz_past_receipts r where r.attempt_id=att.id and r.group_id=g->>'id' and r.status='self_checked')) then raise exception 'media_unavailable';end if;
 select * into asset from public.quiz_media_assets where url=p_url and owner_id=paper.owner_id;if asset.url is null then raise exception 'media_unavailable';end if;
 return to_jsonb(asset)||jsonb_build_object('backend','supabase');
end$function$;

CREATE OR REPLACE FUNCTION public.quiz_study_payload(p_kind text, p_attempt uuid, p_version uuid, p_disclosed jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare identity jsonb;d jsonb; qa_attempt boolean:=false; private_access boolean:=false;pkg public.quiz_study_packages;link public.quiz_study_items;
 refs jsonb:='{}';explanations jsonb:='{}';pages jsonb;ref jsonb;known boolean;book_ids uuid[]:='{}';key text;field jsonb;
begin
 if p_kind='past' then
  select a.acceptance_only,
   a.acceptance_only and public.quiz_past_acceptance_version(a.paper_id)=a.version_id
  into qa_attempt,private_access
  from public.quiz_past_attempts a where a.id=p_attempt and a.version_id=p_version and a.user_id=auth.uid();
  qa_attempt:=coalesce(qa_attempt,false); private_access:=coalesce(private_access,false);
  if qa_attempt and not private_access then raise exception 'attempt_unavailable'; end if;
 end if;
 if not exists(select 1 from public.quiz_study_attempts where kind=p_kind and attempt_id=p_attempt and version_id=p_version)
  and not exists(select 1 from public.quiz_study_packages where kind=p_kind and version_id=p_version and (enabled or private_access) and approved) then return '{}'::jsonb;end if;
 if p_kind='normal' and coalesce(public.is_teacher(),false) then
  -- The existing teacher trial joins only an owned session. Derive this book's
  -- grade from that fixed version, never from a browser-provided identity.
  select jsonb_build_object('grade',substring(v.document->'catalog'->>'volume' from '^([3469])')::integer) into identity
   from public.quiz_attempts a join public.quiz_sessions s on s.id=a.session_id join public.quiz_versions v on v.id=s.version_id
   where a.id=p_attempt and a.user_id=auth.uid() and s.owner_id=auth.uid() and v.id=p_version;
  if identity is null then raise exception 'attempt_unavailable';end if;
 else identity:=public.quiz_student_identity();end if;
 if p_kind='normal' then
  select v.document into d from public.quiz_attempts a join public.quiz_sessions s on s.id=a.session_id
   join public.quiz_versions v on v.id=s.version_id where a.id=p_attempt and a.user_id=auth.uid() and v.id=p_version;
 elsif p_kind='past' then
  select v.document into d from public.quiz_past_attempts a join public.quiz_past_versions v on v.id=a.version_id
   join public.quiz_past_papers p on p.id=a.paper_id where a.id=p_attempt and a.user_id=auth.uid() and v.id=p_version and p.grade=(identity->>'grade')::integer;
 else raise exception 'study_unavailable';end if;
 if d is null then raise exception 'attempt_unavailable';end if;
 select p.* into pkg from public.quiz_study_attempts a join public.quiz_study_packages p on p.id=a.package_id
  where a.kind=p_kind and a.attempt_id=p_attempt and a.version_id=p_version;
 if pkg.id is null then
  select * into pkg from public.quiz_study_packages p where p.kind=p_kind and p.version_id=p_version and (p.enabled or private_access) and p.approved order by p.created_at desc,p.id desc limit 1;
  if pkg.id is null then return '{}'::jsonb;end if;
  insert into public.quiz_study_attempts values(p_kind,p_attempt,p_version,pkg.id) on conflict do nothing;
  select p.* into pkg from public.quiz_study_attempts a join public.quiz_study_packages p on p.id=a.package_id where a.kind=p_kind and a.attempt_id=p_attempt and a.version_id=p_version;
 end if;
 if (not pkg.enabled and not private_access) or not pkg.approved then return '{}'::jsonb;end if;
 for link in select * from public.quiz_study_items where package_id=pkg.id order by group_id,question_id loop
  if p_kind='normal' then
   known:=link.group_id='' and exists(select 1 from jsonb_array_elements(d->'blocks') b,jsonb_array_elements(b->'questions') q where q->>'id'=link.question_id);
   key:=link.question_id;
  else
   known:=exists(select 1 from jsonb_array_elements(d->'groups') g,jsonb_array_elements(g->'fields') f where g->>'id'=link.group_id and f->>'id'=link.question_id);
   key:=link.group_id;
  end if;
  if not known then continue;end if;
  if link.book_id is not null and exists(select 1 from public.quiz_textbooks b where b.id=link.book_id and b.enabled and b.grade=(identity->>'grade')::integer)
   and not exists(select 1 from unnest(link.reference_pages) n where not exists(select 1 from public.quiz_textbook_pages p where p.book_id=link.book_id and n=any(p.printed_pages))) then
   if not link.book_id=any(book_ids) then book_ids:=array_append(book_ids,link.book_id);end if;
   ref:=refs->key;
   if ref is null then ref:=jsonb_build_object('bookId',link.book_id,'primary',link.primary_page,'references',to_jsonb(link.reference_pages),'fields','[]'::jsonb);
   elsif ref->>'bookId'=link.book_id::text then ref:=jsonb_set(ref,'{references}',(ref->'references')||to_jsonb(link.reference_pages));end if;
   if p_kind='past' and ref->>'bookId'=link.book_id::text then ref:=jsonb_set(ref,'{fields}',(ref->'fields')||jsonb_build_array(jsonb_build_object('questionId',link.question_id,'page',link.primary_page)));end if;
   refs:=jsonb_set(refs,array[key],ref);
  end if;
  if link.student_explanation is not null and p_disclosed ? link.question_id then
   explanations:=jsonb_set(explanations,array[link.question_id],jsonb_build_object('text',link.student_explanation,'origin',link.origin));
  end if;
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'bookId',p.book_id,'printedPages',p.printed_pages,
  'sequence',p.book_id::text||':'||p.sequence,'url','https://quiz-media.invalid/'||p.book_id::text||'/'||p.sha256) order by p.book_id,p.printed_pages[1]),'[]') into pages
  from public.quiz_textbook_pages p where p.book_id=any(book_ids);
 return jsonb_build_object('schema',1,'kind',p_kind,'attemptId',p_attempt,'versionId',p_version,'packageId',pkg.id,'pages',pages,'references',refs,'explanations',explanations);
end$function$;

CREATE OR REPLACE FUNCTION public.quiz_past_snapshot_before_flowers(aid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare att public.quiz_past_attempts;d jsonb;g jsonb;safe jsonb:='[]';fs jsonb;records jsonb;history jsonb;award uuid;score numeric;mx numeric;answered integer;total integer;drawing text:='not_submitted';
begin
 select * into att from public.quiz_past_attempts where id=aid and user_id=auth.uid();if att.id is null then raise exception 'attempt_unavailable';end if;
 select document into d from public.quiz_past_versions where id=att.version_id;
 for g in select value from jsonb_array_elements(d->'groups') loop
  select jsonb_agg(jsonb_build_object('id',f->'id','label',f->'label','text',f->'text','points',f->'points') order by ord) into fs from jsonb_array_elements(g->'fields') with ordinality x(f,ord);
  safe:=safe||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('id',g->'id','kind',g->'kind','answerFormat',g->'answerFormat','optional',g->'optional','title',g->'title','sourceLabel',g->'sourceLabel','material',g->'material','choices',g->'choices','assets',g->'assets','codes',g->'codes','fields',fs,'notice',g->'notice','promptContent',g->'promptContent','materialContent',g->'materialContent')));
 end loop;
 select coalesce(jsonb_object_agg(r.group_id,jsonb_build_object('requestId',r.request_id,'responses',r.responses,'results',r.results,'score',r.score,'status',r.status,
  'referenceStatus',case when r.status='self_checked' then coalesce((select x->'fields'->0->>'referenceStatus' from jsonb_array_elements(d->'groups') x where x->>'id'=r.group_id),'provided') else null end,
  'reference',case when r.status='self_checked' then (select x->'fields'->0->'reference' from jsonb_array_elements(d->'groups') x where x->>'id'=r.group_id) else null end,
  'referenceUrl',case when r.status='self_checked' then (select x->'referenceUrl' from jsonb_array_elements(d->'groups') x where x->>'id'=r.group_id) else null end)),'{}') into records from public.quiz_past_receipts r where r.attempt_id=aid;
 select coalesce(sum(case when x.correct then x.points else 0 end),0),count(*) filter(where x.correct is not null) into score,answered from public.quiz_past_answers x where attempt_id=aid;
 select coalesce(sum((df->>'points')::numeric),0),count(*) into mx,total from jsonb_array_elements(d->'groups') dg cross join lateral jsonb_array_elements(dg->'fields') df where dg->>'kind' not in('annotation','manual');
 if exists(select 1 from public.quiz_past_receipts where attempt_id=aid and status='self_checked') then drawing:='self_checked';end if;
 select attempt_id into award from public.quiz_past_leaves where user_id=auth.uid() and paper_id=att.paper_id and school_year=att.school_year and semester=att.semester;
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'version_id',a.version_id,'created_at',a.created_at,'completed_at',a.completed_at,'complete',a.completed_at is not null,'score',coalesce(a.score,0),'max_score',a.max_score,'passed',case when a.completed_at is null then null else a.max_score>0 and a.score*100>=a.max_score*60 end,'earned_leaf',a.id=award) order by a.created_at,a.id),'[]') into history from public.quiz_past_attempts a where a.user_id=auth.uid() and a.paper_id=att.paper_id and a.acceptance_only=att.acceptance_only and a.school_year=att.school_year and a.semester=att.semester;
 return jsonb_build_object('version',att.version_id,'title',d->'title','policy',jsonb_build_object('automaticPoints',mx,'manualPoints',(select coalesce(sum((pf->>'points')::numeric),0) from jsonb_array_elements(d->'groups') pg cross join lateral jsonb_array_elements(pg->'fields') pf where pg->>'kind' in('annotation','manual')),'blockedPoints',(select coalesce(sum((b->>'points')::numeric),0) from jsonb_array_elements(coalesce(d->'blocked','[]')) b),'blockedFields',jsonb_array_length(coalesce(d->'blocked','[]'))),'groups',safe,'records',records,'attemptId',aid,'summary',jsonb_build_object('score',score,'max',mx,'answered',answered,'total',total,'drawingStatus',drawing),
  'practice',jsonb_build_object('localOnly',false,'eligible',mx>0,'thresholdPercent',60,'complete',att.completed_at is not null,'leafCount',case when award is null then 0 else 1 end,'earnedByThisAttempt',award=aid,'history',history));
end $function$;

CREATE OR REPLACE FUNCTION public.quiz_past_snapshot_before_drafts(p_attempt uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare data jsonb;m public.quiz_learning_maps;e jsonb;r jsonb;g jsonb;items jsonb;href text;doc jsonb;f jsonb;begin
 data:=public.quiz_past_snapshot_before_learning(p_attempt);
 -- Old attempts remain readable, with a clear way to open the revised paper.
 if exists(select 1 from public.quiz_past_attempts a join public.quiz_past_papers p on p.id=a.paper_id where a.id=p_attempt and not a.acceptance_only and p.grade=9 and p.active_version::text is distinct from data->>'version') then
  data:=jsonb_set(data,'{groups}',(select jsonb_agg(jsonb_set(x,'{notice}',to_jsonb('這是更新前的舊版作答，原紀錄已保留。要練習新版，請展開「成績紀錄與重新作答」，按「另開一次作答」或「重新作答」。 '||coalesce(x->>'notice',''))) order by ord) from jsonb_array_elements(data->'groups') with ordinality q(x,ord)));
 end if;

 select * into m from public.quiz_learning_maps where source_version=(data->>'version')::uuid and (enabled or exists (
  select 1 from public.quiz_past_attempts a where a.id=p_attempt and a.user_id=auth.uid()
    and a.acceptance_only and public.quiz_past_acceptance_version(a.paper_id)=a.version_id));
 if m.source_version is null then
  if data->'records'='{}'::jsonb then return data;end if;
  select document into doc from public.quiz_past_versions where id=(data->>'version')::uuid;
  for g in select value from jsonb_array_elements(doc->'groups') loop
   r:=data->'records'->(g->>'id');if r is null then continue;end if;items:='[]';
   for f in select value from jsonb_array_elements(g->'fields') loop
    if jsonb_typeof(f->'explanation') is distinct from 'string' or length(f->>'explanation') not between 1 and 5000 then continue;end if;
    if not exists(select 1 from jsonb_array_elements(coalesce(r->'results','[]')) x where x->>'questionId'=f->>'id' and jsonb_typeof(x->'correct')='boolean') and not(g->>'kind'='manual' and r->>'status'='self_checked') then continue;end if;
    items:=items||jsonb_build_array(jsonb_build_object('questionId',f->>'id','text',f->>'explanation','selfCheck',g->>'kind'='manual'));
   end loop;
   if jsonb_array_length(items)>0 then data:=jsonb_set(data,array['records',g->>'id','learningExplanations'],items);end if;
  end loop;
  return data;
 end if;
 for g in select value from jsonb_array_elements(data->'groups') loop
  r:=data->'records'->(g->>'id');if r is null then continue;end if;items:='[]';
  for e in select value from jsonb_array_elements(m.content->'questions') where value->>'groupId'=g->>'id' loop
   if not exists(select 1 from jsonb_array_elements(coalesce(r->'results','[]')) x where x->>'questionId'=e->>'questionId' and jsonb_typeof(x->'correct')='boolean') and not(coalesce((e->>'selfCheck')::boolean,false) and r->>'status'='self_checked') then continue;end if;
   href:=null;
   if exists(select 1 from jsonb_array_elements(r->'results') x where x->>'questionId'=e->>'questionId' and x->>'correct'='false') then
    -- Derive the route from this owned attempt's immutable source, not a fixed grade.
    select '/grade'||p.grade::text||'/115-1/quiz-library.html?wrong_source=past_exam&wrong_attempt='||p_attempt||'&wrong_paper='||m.paper_id||'&wrong_version='||m.source_version||'&wrong_group='||(e->>'groupId')||'&wrong_question='||(e->>'questionId')||'#wrong' into href
    from public.quiz_past_attempts a join public.quiz_past_papers p on p.id=a.paper_id
    where a.id=p_attempt and a.user_id=auth.uid()
     and a.version_id=m.source_version and a.paper_id=m.paper_id;
   end if;
   items:=items||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('questionId',e->>'questionId','text',e->>'explanation','selfCheck',coalesce((e->>'selfCheck')::boolean,false),'wrongReviewHref',href)));
  end loop;
  if jsonb_array_length(items)>0 then data:=jsonb_set(data,array['records',g->>'id','learningExplanations'],items);end if;
 end loop;
 return data;
end$function$;

CREATE OR REPLACE FUNCTION public.quiz_learning(p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare identity jsonb;cfg public.quiz_learning_settings;action text:=coalesce(p_data->>'action','summary');a public.quiz_past_attempts;m public.quiz_learning_maps;snap jsonb;review jsonb;topic jsonb;e jsonb;t public.quiz_learning_topics;ls public.quiz_learning_sessions;sid uuid;rid uuid;result jsonb;existing public.quiz_learning_sessions;
begin
 identity:=public.quiz_student_identity();if identity->>'role' is distinct from 'student' then raise exception 'student_required';end if;
 select * into cfg from public.quiz_learning_settings where id;
 if action='summary' then return public.quiz_learning_summary();end if;
 if not cfg.enabled then raise exception 'learning_unavailable';end if;
 if action='context' then
  select * into ls from public.quiz_learning_sessions where session_id=(p_data->>'session_id')::uuid and user_id=auth.uid();
  if ls.session_id is null then return '{}'::jsonb;end if;
  return jsonb_build_object('mode',ls.mode,'attempt_id',ls.source_attempt,'paper_id',(select paper_id from public.quiz_past_attempts where id=ls.source_attempt),'version_id',ls.source_version,'group_id',ls.group_id,'question_id',ls.question_id,'concept_id',ls.concept_id);
 end if;
 if action='reviews' then
  select coalesce(jsonb_agg(jsonb_build_object('id',pa.id,'title',p.title,'score',pa.score,'max_score',pa.max_score,'paper_id',pa.paper_id,'created_at',pa.created_at) order by pa.created_at desc),'[]') into result
  from public.quiz_past_attempts pa join public.quiz_past_papers p on p.id=pa.paper_id join public.quiz_learning_maps lm on lm.source_version=pa.version_id and lm.enabled where pa.user_id=auth.uid() and not pa.acceptance_only and p.enabled and p.grade=(identity->>'grade')::integer and pa.completed_at is not null and pa.school_year=cfg.school_year and pa.semester=cfg.semester;
  return jsonb_build_object('attempts',result);
 end if;
 select * into a from public.quiz_past_attempts where id=(p_data->>'attempt_id')::uuid and user_id=auth.uid() and not acceptance_only;if a.id is null then raise exception 'attempt_unavailable';end if;
 if a.school_year is distinct from cfg.school_year or a.semester is distinct from cfg.semester or not exists(select 1 from public.quiz_past_papers p where p.id=a.paper_id and p.enabled and p.grade=(identity->>'grade')::integer) then raise exception 'course_unavailable';end if;
 select * into m from public.quiz_learning_maps where source_version=a.version_id and paper_id=a.paper_id and enabled;if m.source_version is null then raise exception 'learning_unavailable';end if;
 snap:=public.quiz_past_action('resume',jsonb_build_object('paper_id',a.paper_id,'attempt_id',a.id));
 if action='topics' then
  if a.completed_at is null then raise exception 'learning_incomplete';end if;
  select coalesce(jsonb_agg(c||jsonb_build_object('count',2)),'[]') into result from jsonb_array_elements(m.content->'concepts') c join public.quiz_learning_topics lt on lt.source_version=a.version_id and lt.concept_id=c->>'id';
  return jsonb_build_object('title',snap->>'title','attempt_id',a.id,'version',a.version_id,'concepts',result);
 end if;
 if action<>'start' then raise exception 'invalid_action';end if;
 if p_data->>'version' is distinct from a.version_id::text then raise exception 'version_unavailable';end if;
 if coalesce(p_data->>'mode','wrong') not in ('review','wrong') then raise exception 'invalid_request';end if;
 if p_data->>'mode'='review' then
  if a.completed_at is null then raise exception 'learning_incomplete';end if;
  -- A completed original permits proactive practice, including concepts occurring
  -- only on self-check fields. Self-check fields still never become wrong items.
  select value into e from jsonb_array_elements(m.content->'questions') where value->'conceptIds' ? (p_data->>'concept_id') order by coalesce((value->>'selfCheck')::boolean,false) limit 1;
 else select value into e from jsonb_array_elements(m.content->'questions') where value->>'questionId'=p_data->>'question_id' and value->>'groupId'=p_data->>'group_id' and value->'conceptIds' ? (p_data->>'concept_id') and not coalesce((value->>'selfCheck')::boolean,false);end if;
 if e is null then raise exception 'learning_unavailable';end if;
 if coalesce(p_data->>'mode','wrong')='wrong' then review:=public.quiz_learning_review(a.id,e->>'groupId',e->>'questionId');end if;
 if coalesce(p_data->>'mode','wrong')='wrong' and not exists(select 1 from jsonb_array_elements(snap->'records'->(e->>'groupId')->'results') x where x->>'questionId'=e->>'questionId' and x->>'correct'='false') then raise exception 'wrong_question_unavailable';end if;
 select * into t from public.quiz_learning_topics where source_version=a.version_id and concept_id=p_data->>'concept_id';if t.version_id is null then raise exception 'learning_unavailable';end if;
 rid:=(p_data->>'request_id')::uuid;if rid is null then raise exception 'invalid_request';end if;
 perform pg_advisory_xact_lock(1364542036,hashtext(auth.uid()::text||rid));
 select * into existing from public.quiz_learning_sessions where user_id=auth.uid() and request_id=rid;
 if existing.session_id is not null then
  if existing.source_attempt<>a.id or existing.source_version<>a.version_id or existing.concept_id<>t.concept_id or existing.mode<>coalesce(p_data->>'mode','wrong') or existing.group_id<>e->>'groupId' or existing.question_id<>e->>'questionId' then raise exception 'submission_conflict';end if;sid:=existing.session_id;
 else
  sid:=gen_random_uuid();
  insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode) values(sid,(select owner_id from public.quiz_past_papers where id=a.paper_id),t.version_id,cfg.school_year,jsonb_build_array(identity->>'class_code'),'immediate',false,false,'classroom');
  insert into public.quiz_learning_sessions values(sid,auth.uid(),a.id,a.version_id,e->>'groupId',e->>'questionId',t.concept_id,coalesce(p_data->>'mode','wrong'),rid,cfg.school_year,cfg.semester);
 end if;
 return jsonb_build_object('sessionId',sid,'url','/grade'||(identity->>'grade')||'/115-1/quiz.html?cloud=1&learning=1&session='||sid,'count',2,'extensionEligible',true);
end$function$;

CREATE OR REPLACE FUNCTION public.quiz_learning_wrong_items(p_grade integer)
 RETURNS SETOF jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('source_type','past_exam','attempt_id',a.id,'paper_id',a.paper_id,'version_id',a.version_id,'group_id',an.group_id,'question_id',an.question_id,'answered_at',a.created_at,'title',v.document->>'title','catalog',(v.document->'catalog')||jsonb_build_object('unit',v.document->>'title'),'number',ord,'source_label',g->>'sourceLabel','field_label',case when f->>'label' ~ '^\d{1,2}$' then f->>'label' else ford::text end,'preview',left(coalesce(g->'promptContent'->>'text',g->>'prompt','')||' '||coalesce(f->>'text',''),160))
 from public.quiz_past_attempts a join public.quiz_past_versions v on v.id=a.version_id join public.quiz_past_papers p on p.id=a.paper_id join public.quiz_learning_maps m on m.source_version=a.version_id and m.enabled
 join public.quiz_past_answers an on an.attempt_id=a.id and an.correct=false join public.quiz_past_receipts r on r.attempt_id=a.id and r.group_id=an.group_id
 cross join lateral jsonb_array_elements(v.document->'groups') with ordinality groups(g,ord) cross join lateral jsonb_array_elements(g->'fields') with ordinality fields(f,ford)
 where a.user_id=auth.uid() and not a.acceptance_only and p.enabled and p.grade=p_grade and a.school_year=(select school_year from public.quiz_learning_settings where id) and a.semester=(select semester from public.quiz_learning_settings where id)
 and g->>'id'=an.group_id and f->>'id'=an.question_id and g->>'kind' not in('annotation','manual')
 and exists(select 1 from jsonb_array_elements(m.content->'questions') e where e->>'groupId'=an.group_id and e->>'questionId'=an.question_id and not coalesce((e->>'selfCheck')::boolean,false))
 and exists(select 1 from jsonb_array_elements(r.results) x where x->>'questionId'=an.question_id and x->>'correct'='false')
$function$;

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
   select * into pa from public.quiz_past_attempts where id=aid and user_id=uid and not acceptance_only;
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

COMMIT;
