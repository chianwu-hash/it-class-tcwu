-- Use the source grade for past-exam wrong-review links.
-- Candidate only: production application requires this task's function-change approval.
-- Before: 588e36cb7015d20bb4a3797de71f916b; after: 074421da5937e369d97813f418900737.
begin;
do $guard$
declare actual text;
begin
 select md5(pg_get_functiondef('public.quiz_past_snapshot_before_drafts(uuid)'::regprocedure)) into actual;
 if actual not in ('588e36cb7015d20bb4a3797de71f916b','074421da5937e369d97813f418900737') then
  raise exception 'quiz_past_learning_route_function_changed' using errcode='55000';
 end if;
end
$guard$;
CREATE OR REPLACE FUNCTION public.quiz_past_snapshot_before_drafts(p_attempt uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare data jsonb;m public.quiz_learning_maps;e jsonb;r jsonb;g jsonb;items jsonb;href text;doc jsonb;f jsonb;begin
 data:=public.quiz_past_snapshot_before_learning(p_attempt);
 -- Old attempts remain readable, with a clear way to open the revised paper.
 if exists(select 1 from public.quiz_past_attempts a join public.quiz_past_papers p on p.id=a.paper_id where a.id=p_attempt and p.grade=9 and p.active_version::text is distinct from data->>'version') then
  data:=jsonb_set(data,'{groups}',(select jsonb_agg(jsonb_set(x,'{notice}',to_jsonb('這是更新前的舊版作答，原紀錄已保留。要練習新版，請展開「成績紀錄與重新作答」，按「另開一次作答」或「重新作答」。 '||coalesce(x->>'notice',''))) order by ord) from jsonb_array_elements(data->'groups') with ordinality q(x,ord)));
 end if;

 select * into m from public.quiz_learning_maps where source_version=(data->>'version')::uuid and enabled;
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
revoke all on function public.quiz_past_snapshot_before_drafts(uuid) from public, anon, authenticated, service_role;
grant execute on function public.quiz_past_snapshot_before_drafts(uuid) to postgres;
grant execute on function public.quiz_past_snapshot_before_drafts(uuid) to service_role;
do $verify$
begin
 if md5(pg_get_functiondef('public.quiz_past_snapshot_before_drafts(uuid)'::regprocedure)) <> '074421da5937e369d97813f418900737' then
  raise exception 'quiz_past_learning_route_verification_failed';
 end if;
end
$verify$;
commit;
