-- Additive adapter: preserve the installed scoring/media/learning functions.
begin;
create table public.quiz_past_drafts(
 attempt_id uuid primary key references public.quiz_past_attempts(id) on delete cascade,
 revision integer not null default 0, groups jsonb not null default '{}',
 current_group text, request_id uuid, request_body jsonb, updated_at timestamptz not null default now()
);
alter table public.quiz_past_drafts enable row level security;
revoke all on public.quiz_past_drafts from public,anon,authenticated;

create function public.quiz_past_draft_value(g jsonb,v jsonb) returns void
language plpgsql set search_path='' as $$
declare x jsonb;codes jsonb;n integer;checked jsonb;
begin
 if v is null or octet_length(v::text)>600000 then raise exception 'invalid_draft';end if;
 if g->>'kind'='manual' then
  if jsonb_typeof(v) is distinct from 'object' or jsonb_typeof(v->'text') is distinct from 'string' or jsonb_typeof(v->'confirmed') is distinct from 'boolean' then raise exception 'invalid_draft';end if;
  perform public.quiz_past_canonical(g,v||jsonb_build_object('confirmed',true,'text',case when length(trim(v->>'text'))=0 then 'draft' else v->>'text' end));return;
 end if;
 if g->>'kind'='annotation' then
  if jsonb_typeof(v) is distinct from 'object' or v->>'mediaSha256' is distinct from g->'assets'->0->>'sha256' then raise exception 'invalid_draft';end if;
  checked:=v;
  if v->'point'='null'::jsonb then checked:=checked||'{"point":{"x":0.5,"y":0.5}}';end if;
  if v->'arrow'<>'null'::jsonb then
   if jsonb_typeof(v->'arrow') is distinct from 'object' or (select array_agg(k order by k) from jsonb_object_keys(v->'arrow') k) is distinct from array['from','to'] then raise exception 'invalid_draft';end if;
   perform public.quiz_past_canonical(g,jsonb_build_object('mediaSha256',v->'mediaSha256','point',v->'arrow'->'from','arrow','{"from":{"x":0.5,"y":0.5},"to":{"x":0.5,"y":0.8}}'::jsonb));
   perform public.quiz_past_canonical(g,jsonb_build_object('mediaSha256',v->'mediaSha256','point',v->'arrow'->'to','arrow','{"from":{"x":0.5,"y":0.5},"to":{"x":0.5,"y":0.8}}'::jsonb));
  end if;
  checked:=checked||'{"arrow":{"from":{"x":0.5,"y":0.5},"to":{"x":0.5,"y":0.8}}}';
  perform public.quiz_past_canonical(g,checked);return;
 end if;
 if jsonb_typeof(v) is distinct from 'array' then raise exception 'invalid_draft';end if;
 n:=case when g->>'kind'='sequence' then jsonb_array_length(g->'choices') else jsonb_array_length(g->'fields') end;
 if jsonb_array_length(v)<>n then raise exception 'invalid_draft';end if;
 for x in select value from jsonb_array_elements(v) loop
  if g->>'kind'='short' and g->>'answerFormat'='math-v1' then
   if jsonb_typeof(x)='string' and x='""'::jsonb then continue;end if;
   if jsonb_typeof(x) is distinct from 'object' or jsonb_typeof(x->'answer') is distinct from 'string' or jsonb_typeof(x->'working') is distinct from 'string' or length(x->>'answer')>250 or length(x->>'working')>5000 or (select array_agg(k order by k) from jsonb_object_keys(x) k) is distinct from array['answer','working'] then raise exception 'invalid_draft';end if;
  elsif g->>'kind' in('single','code','short','sequence') and x='""'::jsonb then continue;
  elsif g->>'kind'='set' and x='[]'::jsonb then continue;
  elsif g->>'kind'='sequence' then
   if jsonb_typeof(x) is distinct from 'string' or not exists(select 1 from jsonb_array_elements(g->'choices') c where c->'id'=x) then raise exception 'invalid_draft';end if;
  else perform public.quiz_past_canonical(g,x);
  end if;
 end loop;
end $$;

alter function public.quiz_past_snapshot(uuid) rename to quiz_past_snapshot_before_drafts;
create function public.quiz_past_snapshot(p_attempt uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare data jsonb;draft public.quiz_past_drafts;begin
 data:=public.quiz_past_snapshot_before_drafts(p_attempt);
 select * into draft from public.quiz_past_drafts where attempt_id=p_attempt;
 return data||jsonb_build_object('draft',jsonb_build_object('revision',coalesce(draft.revision,0),'groups',coalesce(draft.groups,'{}'),'currentGroup',draft.current_group,'updatedAt',draft.updated_at));
end $$;

alter function public.quiz_past_action(text,jsonb) rename to quiz_past_action_before_drafts;
create function public.quiz_past_action(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare att public.quiz_past_attempts;old public.quiz_past_drafts;doc jsonb;g jsonb;k text;v jsonb;result jsonb;kept jsonb;rid uuid;expected integer;aid uuid;
begin
 if p_action<>'save_draft' then
  result:=public.quiz_past_action_before_drafts(p_action,p_data);
  if p_action='submit' then
   update public.quiz_past_drafts set groups=groups-(p_data->>'group_id'),revision=revision+1,request_id=null,request_body=null where attempt_id=(p_data->>'attempt_id')::uuid and groups ? (p_data->>'group_id');
  end if;
  if p_action in('start','restart','resume','submit') then
   aid:=(result->>'attemptId')::uuid;
   result:=result||jsonb_build_object('draft',public.quiz_past_snapshot(aid)->'draft');
  end if;
  return result;
 end if;
 -- Run the installed authorization contract rather than copying its current rules.
 perform public.quiz_past_action_before_drafts('resume',jsonb_build_object('paper_id',p_data->'paper_id','attempt_id',p_data->'attempt_id'));
 select * into att from public.quiz_past_attempts where id=(p_data->>'attempt_id')::uuid and user_id=auth.uid() and paper_id=p_data->>'paper_id' for update;
 if att.id is null then raise exception 'attempt_unavailable';end if;
 if p_data->>'version' is distinct from att.version_id::text then raise exception 'version_changed';end if;
 rid:=(p_data->>'request_id')::uuid;expected:=(p_data->>'revision')::integer;
 if rid is null or expected is null or expected<0 or jsonb_typeof(p_data->'groups') is distinct from 'object' or octet_length(p_data::text)>2000000 then raise exception 'invalid_draft';end if;
 select * into old from public.quiz_past_drafts where attempt_id=att.id;
 if old.request_id=rid and old.request_body=p_data then result:=public.quiz_past_snapshot(att.id);return (result->'draft')||jsonb_build_object('snapshot',result);end if;
 if coalesce(old.revision,0)<>expected or old.request_id=rid then raise exception 'draft_conflict';end if;
 select document into doc from public.quiz_past_versions where id=att.version_id;
 if not exists(select 1 from jsonb_array_elements(doc->'groups') x where x->>'id'=p_data->>'current_group') then raise exception 'invalid_draft';end if;
 kept:=(p_data->'groups') - array(select group_id from public.quiz_past_receipts where attempt_id=att.id);
 for k,v in select key,value from jsonb_each(kept) loop
  select value into g from jsonb_array_elements(doc->'groups') x where x->>'id'=k;
  if g is null then raise exception 'invalid_draft';end if;
  perform public.quiz_past_draft_value(g,v);
 end loop;
 insert into public.quiz_past_drafts(attempt_id,revision,groups,current_group,request_id,request_body,updated_at)
 values(att.id,expected+1,kept,p_data->>'current_group',rid,p_data,clock_timestamp())
 on conflict(attempt_id) do update set revision=excluded.revision,groups=excluded.groups,current_group=excluded.current_group,request_id=excluded.request_id,request_body=excluded.request_body,updated_at=excluded.updated_at;
 result:=public.quiz_past_snapshot(att.id);return (result->'draft')||jsonb_build_object('snapshot',result);
end $$;
revoke all on function public.quiz_past_draft_value(jsonb,jsonb),public.quiz_past_snapshot_before_drafts(uuid),public.quiz_past_snapshot(uuid),public.quiz_past_action_before_drafts(text,jsonb) from public,anon,authenticated;
revoke all on function public.quiz_past_action(text,jsonb) from public,anon;
grant execute on function public.quiz_past_action(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
