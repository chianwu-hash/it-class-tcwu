import {fingerprint} from './review.mjs';import {courseIds,prepareExplanation} from './g4-complete-review.mjs';
const lit=s=>"'"+String(s).replaceAll("'","''")+"'";
export function migration(snapshot,review,{commit=false}={}){
 if(review.schema!==2||review.assignments.length!==1562||snapshot.pool.length!==1562)throw Error('review_scope_mismatch');
 const prior=new Map(snapshot.pool.map(p=>[p.question_id,p])),seen=new Set(),rows=[];
 for(const a of review.assignments){
  const p=prior.get(a.question_id);if(!p||seen.has(a.question_id)||!courseIds.includes(a.course_id)||p.course_id!==a.course_id||p.source_version!==a.source_version||p.source_item_id!==a.source_item_id||fingerprint(p.question)!==a.question_sha256||!/^[a-f0-9]{32}$/.test(p.row_db_md5))throw Error('source_changed');seen.add(a.question_id);
  const prepared=prepareExplanation(p.question,a.explanation_review.source_present),next=structuredClone(p.question);next.explanation=prepared.explanation;
  if(fingerprint(next)!==a.updated_question_sha256||prepared.publisher_explanation!==a.publisher_explanation||!a.knowledge_code||!a.knowledge_name||typeof a.knowledge_reliable!=='boolean'||!a.knowledge_reliable&&!a.hold_reason)throw Error('review_incomplete');
  const changed=fingerprint(p.question.explanation)!==fingerprint(next.explanation);
  rows.push([a.question_id,p.row_db_md5,a.course_id,p.knowledge_reliable,a.knowledge_code,a.knowledge_name,a.knowledge_reliable,a.publisher_explanation,changed?next.explanation:null,a.explanation_review]);
 }
 const reviewSha=fingerprint(review),audit={revision:'g4-complete-knowledge-20261101-v1',review_sha256:reviewSha,reviewed_at:review.reviewed_at,method:review.review_method,source_metadata_sha256:review.source_metadata_sha256};
 return `begin isolation level repeatable read;
set local lock_timeout='5s';set local statement_timeout='90s';
select pg_advisory_xact_lock(hashtextextended('quiz_catalog_cache',0));
lock table public.quiz_question_pool,public.quiz_pool_membership in share row exclusive mode;
create temp table knowledge_patch(id text primary key,expected_md5 text,course_id text,previous_reliable boolean,code text,name text,reliable boolean,publisher_explanation boolean,explanation jsonb,explanation_review jsonb) on commit drop;
insert into knowledge_patch select value->>0,value->>1,value->>2,(value->>3)::boolean,value->>4,value->>5,(value->>6)::boolean,(value->>7)::boolean,nullif(value->8,'null'::jsonb),value->9 from jsonb_array_elements(${lit(JSON.stringify(rows))}::jsonb);
create or replace function pg_temp.knowledge_guard() returns jsonb language plpgsql as $guard$
declare t text;h text;result jsonb:='{}';begin
 for t in select tablename from pg_tables where schemaname='public' and tablename like 'quiz\\_%' escape '\\' and tablename not in ('quiz_question_pool','quiz_pool_membership','quiz_catalog_cache') order by tablename loop
 execute format('select md5(coalesce(string_agg(md5(to_jsonb(r)::text),'''' order by md5(to_jsonb(r)::text)),'''')) from public.%I r',t) into h;result:=result||jsonb_build_object(t,h);end loop;
 select md5(coalesce(string_agg((to_jsonb(p)-array['knowledge_code','knowledge_name','checks','question','publisher_explanation'])::text||(p.checks-array['knowledge_reliable','knowledge_complete_review','extension_explanation_review'])::text||(case when exists(select 1 from knowledge_patch k where k.id=p.question_id and k.explanation is not null) then p.question-'explanation' else p.question end)::text,'' order by p.question_id),'')) into h from public.quiz_question_pool p;result:=result||jsonb_build_object('pool_protected_content',h);
 select md5(coalesce(string_agg(to_jsonb(p)::text,'' order by p.question_id),'')) into h from public.quiz_question_pool p where not exists(select 1 from knowledge_patch k where k.id=p.question_id);result:=result||jsonb_build_object('other_pool',h);
 select md5(coalesce(string_agg(to_jsonb(m)::text,'' order by m.question_id),'')) into h from public.quiz_pool_membership m where not exists(select 1 from knowledge_patch k where k.id=m.question_id);result:=result||jsonb_build_object('other_membership',h);
 select md5(coalesce(string_agg(p.oid::regprocedure::text||md5(pg_get_functiondef(p.oid)),'' order by p.oid::regprocedure::text),'')) into h from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'quiz_%';return result||jsonb_build_object('quiz_functions',h);end $guard$;
create temp table knowledge_before on commit drop as select pg_temp.knowledge_guard() state;
do $verify$begin if (select count(*) from knowledge_patch)<>1562 or exists(select 1 from knowledge_patch k left join public.quiz_question_pool p on p.question_id=k.id left join public.quiz_pool_membership m on m.question_id=k.id where p.question_id is null or md5(to_jsonb(p)::text)<>k.expected_md5 or m.course_id is distinct from k.course_id or m.knowledge_reliable is distinct from k.previous_reliable) then raise exception 'knowledge_source_changed_or_already_applied';end if;end $verify$;
update public.quiz_question_pool p set knowledge_code=k.code,knowledge_name=k.name,publisher_explanation=k.publisher_explanation,
 question=case when k.explanation is null then p.question else jsonb_set(p.question,'{explanation}',k.explanation) end,
 checks=p.checks||jsonb_build_object('knowledge_reliable',k.reliable,'knowledge_complete_review',${lit(JSON.stringify(audit))}::jsonb,'extension_explanation_review',k.explanation_review) from knowledge_patch k where p.question_id=k.id;
update public.quiz_pool_membership m set knowledge_reliable=k.reliable from knowledge_patch k where m.question_id=k.id;
do $verify$begin if pg_temp.knowledge_guard() is distinct from (select state from knowledge_before) then raise exception 'protected_data_changed';end if;
 if exists(select 1 from knowledge_patch k join public.quiz_question_pool p on p.question_id=k.id join public.quiz_pool_membership m on m.question_id=k.id where p.knowledge_code<>k.code or p.knowledge_name<>k.name or m.knowledge_reliable<>k.reliable or p.publisher_explanation<>k.publisher_explanation or k.explanation is not null and p.question->'explanation'<>k.explanation) then raise exception 'knowledge_patch_incomplete';end if;end $verify$;
insert into public.quiz_catalog_cache(grade,payload) select g,public.quiz_catalog_build(g) from unnest(array[3,4,6]) g on conflict(grade) do update set payload=excluded.payload,built_at=now();
select jsonb_build_object('passed',true,'review_sha256',${lit(reviewSha)},'updated',1562,'reliable',1561,'held',1,'protected_data_unchanged',true,'committed',${commit}) result;
${commit?'commit':'rollback'};
`;
}
