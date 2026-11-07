-- Read-only inventory. No attempts, answers, identities or private media URLs are selected.
with documents as (
 select 'past_version'::text source,v.id::text doc_id,v.document,p.enabled,(v.id=p.active_version) current_version
 from public.quiz_past_versions v join public.quiz_past_papers p on p.id=v.paper_id
 union all select 'bank_version',v.id::text,v.document,null,null from public.quiz_versions v
 union all select 'bank_draft',b.id::text,b.draft,null,null from public.quiz_banks b
), questions as (
 select d.source,d.doc_id,d.enabled,d.current_version,g->>'id' qid,g->>'kind' kind,g->>'title' title,coalesce(g->'choices','[]') choices
 from documents d cross join lateral jsonb_array_elements(coalesce(d.document->'groups','[]')) g
 union all
 select d.source,d.doc_id,d.enabled,d.current_version,q->>'id',q->>'type','',coalesce(q->'options','[]')
 from documents d cross join lateral jsonb_array_elements(coalesce(d.document->'blocks','[]')) b
 cross join lateral jsonb_array_elements(coalesce(b->'questions','[]')) q
 union all
 select 'partner_copy',null,null,null,q.id::text,coalesce(q.past_meta->>'kind','single'),'',
 coalesce((select jsonb_agg(jsonb_build_object('id',coalesce(q.past_meta->'choices'->(i-1)::int->>'id',(i-1)::text),
 'content',coalesce(q.rich->'options'->(i-1)::int,jsonb_build_object('text',o#>>'{}','media','[]'::jsonb))))
 from jsonb_array_elements(q.options) with ordinality a(o,i)),'[]'::jsonb)
 from partner_pilot.question_bank q
), candidates as (
 select * from questions where jsonb_array_length(choices)=2 or kind in ('mark','boolean','true_false','truefalse') or title like '%是非%'
), safe_choices as (
 select c.source,c.doc_id,c.enabled,c.current_version,c.qid,c.kind,c.title,
 coalesce((select jsonb_agg(jsonb_build_object('id',o->>'id','text',coalesce(o#>>'{content,text}',o->>'text',''),
 'mediaCount',jsonb_array_length(coalesce(o#>'{content,media}','[]')),'hasLayout',coalesce(jsonb_array_length(o#>'{content,layout}')>0,false)) order by i)
 from jsonb_array_elements(c.choices) with ordinality a(o,i)),'[]') choices
 from candidates c
)
select jsonb_build_object(
 'documents',(select jsonb_object_agg(source,n) from(select source,count(*) n from documents group by source)x),
 'pastPapers',(select count(*) from public.quiz_past_papers),
 'pastEnabledPapers',(select count(*) from public.quiz_past_papers where enabled),
 'pastBlockedEntries',(select sum(jsonb_array_length(coalesce(document->'blocked','[]'))) from documents where source='past_version'),
 'questionTotals',(select jsonb_object_agg(source,n) from(select source,count(*) n from questions group by source)x),
 'kindTotals',(select jsonb_agg(x) from(select source,kind,count(*) n from questions group by source,kind order by source,kind)x),
 'candidates',(select coalesce(jsonb_agg(to_jsonb(safe_choices)),'[]') from safe_choices)
) inventory;
