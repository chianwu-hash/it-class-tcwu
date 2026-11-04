import fs from 'node:fs/promises';import path from 'node:path';import {fingerprint,courses} from './review.mjs';
import {fileURLToPath} from 'node:url';
const lit=s=>"'"+String(s).replaceAll("'","''")+"'";
export function migration(snapshot,review,{commit=false}={}){
 if(review.schema!==1||review.assignments.length!==930||snapshot.pool.length!==930)throw Error('review_scope_mismatch');
 if(review.assignments.filter(a=>a.knowledge_reliable===true).length!==928||review.assignments.filter(a=>a.knowledge_reliable===false).length!==2)throw Error('review_reliability_scope_mismatch');
 const index=new Map(snapshot.pool.map(p=>[p.question_id,p]));if(index.size!==930)throw Error('duplicate_pool_id');
 const ids=new Set(),rows=[];
 for(const a of review.assignments){
  const p=index.get(a.question_id);if(!p||ids.has(a.question_id)||!courses.includes(a.course_id)||p.course_id!==a.course_id||a.source_version!==p.source_version||a.source_item_id!==p.source_item_id||fingerprint(p.question)!==a.question_sha256||!/^[a-f0-9]{32}$/.test(p.row_db_md5||''))throw Error('source_changed '+a.question_id);
  if(!a.knowledge_code||!a.knowledge_name||typeof a.knowledge_reliable!=='boolean'||!a.knowledge_reliable&&!a.hold_reason)throw Error('review_incomplete '+a.question_id);
  ids.add(a.question_id);rows.push([a.question_id,p.row_db_md5,a.course_id,a.knowledge_code,a.knowledge_name,a.knowledge_reliable]);
 }
 const reviewSha=fingerprint(review),audit={revision:'g6-knowledge-20261030-v1',review_sha256:reviewSha,reviewed_at:review.reviewed_at,method:review.review_method,source_metadata_sha256:review.source_metadata_sha256};
 const sql=`begin isolation level repeatable read;
set local lock_timeout='5s';set local statement_timeout='60s';
select pg_advisory_xact_lock(hashtextextended('quiz_catalog_cache',0));
create temp table knowledge_patch(id text primary key,expected_md5 text,course_id text,code text,name text,reliable boolean) on commit drop;
insert into knowledge_patch select value->>0,value->>1,value->>2,value->>3,value->>4,(value->>5)::boolean from jsonb_array_elements(${lit(JSON.stringify(rows))}::jsonb);
create or replace function pg_temp.knowledge_guard() returns jsonb language plpgsql as $guard$
declare t text; h text; result jsonb:='{}';begin
 for t in select tablename from pg_tables where schemaname='public' and tablename like 'quiz\\_%' escape '\\' and tablename not in ('quiz_question_pool','quiz_pool_membership','quiz_catalog_cache') order by tablename loop
  execute format('select md5(coalesce(string_agg(md5(to_jsonb(r)::text),'''' order by md5(to_jsonb(r)::text)),'''')) from public.%I r',t) into h;
  result:=result||jsonb_build_object(t,h);
 end loop;
 select md5(coalesce(string_agg((to_jsonb(p)-array['knowledge_code','knowledge_name','checks'])::text||(p.checks-array['knowledge_reliable','knowledge_review'])::text,'' order by p.question_id),'')) into h from public.quiz_question_pool p;
 result:=result||jsonb_build_object('pool_content',h);
 select md5(coalesce(string_agg(to_jsonb(p)::text,'' order by p.question_id),'')) into h from public.quiz_question_pool p where not exists(select 1 from knowledge_patch k where k.id=p.question_id);
 result:=result||jsonb_build_object('other_pool',h);
 select md5(coalesce(string_agg(to_jsonb(m)::text,'' order by m.question_id),'')) into h from public.quiz_pool_membership m where not exists(select 1 from knowledge_patch k where k.id=m.question_id);
 return result||jsonb_build_object('other_membership',h);
end $guard$;
create temp table knowledge_before on commit drop as select pg_temp.knowledge_guard() state;
do $verify$begin
 if (select count(*) from knowledge_patch)<>930 or exists(select 1 from knowledge_patch k left join public.quiz_question_pool p on p.question_id=k.id left join public.quiz_pool_membership m on m.question_id=k.id where p.question_id is null or md5(to_jsonb(p)::text)<>k.expected_md5 or m.course_id is distinct from k.course_id or m.knowledge_reliable is distinct from false) then raise exception 'knowledge_source_changed_or_already_applied';end if;
end $verify$;
update public.quiz_question_pool p set knowledge_code=k.code,knowledge_name=k.name,
 checks=p.checks||jsonb_build_object('knowledge_reliable',k.reliable,'knowledge_review',${lit(JSON.stringify(audit))}::jsonb)
from knowledge_patch k where p.question_id=k.id;
update public.quiz_pool_membership m set knowledge_reliable=k.reliable from knowledge_patch k where m.question_id=k.id;
do $verify$begin
 if pg_temp.knowledge_guard() is distinct from (select state from knowledge_before) then raise exception 'protected_data_changed';end if;
 if exists(select 1 from knowledge_patch k join public.quiz_question_pool p on p.question_id=k.id join public.quiz_pool_membership m on m.question_id=k.id where p.knowledge_code<>k.code or p.knowledge_name<>k.name or m.knowledge_reliable<>k.reliable) then raise exception 'knowledge_patch_incomplete';end if;
end $verify$;
insert into public.quiz_catalog_cache(grade,payload) select g,public.quiz_catalog_build(g) from unnest(array[3,6]) g on conflict(grade) do update set payload=excluded.payload,built_at=now();
select jsonb_build_object('review_sha256',${lit(reviewSha)},'updated',930,'reliable',928,'held',2,'protected_data_unchanged',true,'committed',${commit}) result;
${commit?'commit':'rollback'};
`;
 if(Buffer.byteLength(sql)>450000)throw Error('migration_request_too_large');
 return sql;
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url))){
 const [source,reviewFile,out,mode]=process.argv.slice(2),snapshot=JSON.parse(await fs.readFile(source,'utf8')),review=JSON.parse(await fs.readFile(reviewFile,'utf8'));
 const sql=migration(snapshot,review,{commit:mode==='apply'});await fs.writeFile(out,sql);console.log(JSON.stringify({bytes:Buffer.byteLength(sql),commit:mode==='apply'}));
}
