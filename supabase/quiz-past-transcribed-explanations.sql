-- Reveal fixed, reviewed transcriptions' supplemental explanations only after submission.
-- Existing learning maps and all old attempts retain their established path.
begin;
do $guard$ declare h text;begin
 select md5(pg_get_functiondef('public.quiz_past_snapshot(uuid)'::regprocedure)) into h;
 if h='375ef4f743a8fdf2dcaf6f5edd82f3a0' then return;end if;if h<>'0926c9ef644994308fd110cd81fa2110' then raise exception 'past_snapshot_source_changed';end if;
 execute $definition$CREATE OR REPLACE FUNCTION public.quiz_past_snapshot(p_attempt uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare data jsonb;m public.quiz_learning_maps;e jsonb;r jsonb;g jsonb;items jsonb;href text;doc jsonb;f jsonb;begin
 data:=public.quiz_past_snapshot_before_learning(p_attempt);
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
    href:='/grade3/115-1/quiz-library.html?wrong_source=past_exam&wrong_attempt='||p_attempt||'&wrong_paper='||m.paper_id||'&wrong_version='||m.source_version||'&wrong_group='||(e->>'groupId')||'&wrong_question='||(e->>'questionId')||'#wrong';
   end if;
   items:=items||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('questionId',e->>'questionId','text',e->>'explanation','selfCheck',coalesce((e->>'selfCheck')::boolean,false),'wrongReviewHref',href)));
  end loop;
  if jsonb_array_length(items)>0 then data:=jsonb_set(data,array['records',g->>'id','learningExplanations'],items);end if;
 end loop;
 return data;
end$function$
$definition$;end $guard$;
notify pgrst,'reload schema';commit;
