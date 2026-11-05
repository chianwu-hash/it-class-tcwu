-- Internal projection: caller must first bind the attempt to the selected roster user.
create or replace function public.admin_learning_past_detail(aid uuid,lim integer,offst integer,flt text)
returns jsonb language sql stable set search_path='' as $$
 with source as (
  select a.*,v.document,v.created_at as version_created from public.quiz_past_attempts a
  join public.quiz_past_versions v on v.id=a.version_id and v.paper_id=a.paper_id where a.id=aid
 ), fields as (
  select g,f,go,fo,row_number() over(order by go,fo) as number,s.document,s.version_id,s.paper_id
  from source s cross join lateral jsonb_array_elements(s.document->'groups') with ordinality groups(g,go)
  cross join lateral jsonb_array_elements(g->'fields') with ordinality fields(f,fo)
 ), rows as (
  select f.*,r.status as receipt_status,r.attempt_id is not null as answered,
   a.response,a.correct,saved.value as raw_response,coalesce(official.value,f.f->'answer',f.f->'reference') as official,
   f.g->>'kind' in ('manual','annotation') or r.status='self_checked' as manual,
   r.attempt_id is not null as receipt_saved
  from fields f left join public.quiz_past_receipts r on r.attempt_id=aid and r.group_id=f.g->>'id'
  left join public.quiz_past_answers a on a.attempt_id=aid and a.group_id=f.g->>'id' and a.question_id=f.f->>'id'
  left join lateral(select x->'value' as value from jsonb_array_elements(coalesce(r.responses,'[]')) x where x->>'questionId'=f.f->>'id') saved on true
  left join lateral(select x->'official' as value from jsonb_array_elements(coalesce(r.results,'[]')) x where x->>'questionId'=f.f->>'id') official on true
 ), filtered as(select * from rows where flt='all' or (answered and correct=false)),
 page as(select * from filtered order by number limit lim offset offst)
 select jsonb_build_object('activity_type','past_exam','title',(select document->>'title' from source),
  'version_id',(select version_id from source),
  'revision',(select count(*) from public.quiz_past_versions v,source s where v.paper_id=s.paper_id and (v.created_at,v.id)<=(s.version_created,s.version_id)),
  'session_id',aid,'started',true,'total',(select count(*) from rows),'filtered_total',(select count(*) from filtered),
  'answered',(select count(*) from rows where answered),'correct',(select count(*) from rows where correct=true),
  'manual',(select count(*) from rows where manual),'completed_at',(select completed_at from source),'hidden',false,
  'items',coalesce((select jsonb_agg(jsonb_build_object('number',p.number,'group',p.g,'field',p.f,
   'question',jsonb_build_object('id',p.f->>'id'),'group_id',p.g->>'id',
   'response',coalesce(p.raw_response,p.response),'official',p.official,'correct',p.correct,
   'answered',p.answered,'manual',p.manual,'receipt_status',p.receipt_status) order by p.number) from page p),'[]'::jsonb))
$$;
revoke all on function public.admin_learning_past_detail(uuid,integer,integer,text) from public,anon,authenticated,service_role;
