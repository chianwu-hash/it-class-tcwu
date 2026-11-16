// Offline only: immutable replacements and guarded SQL. Inputs/outputs stay private.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {canonicalizeQuestion} from '../shared/quiz-question-contract.mjs';
const args=process.argv.slice(2),arg=k=>args[args.indexOf(k)+1],input=arg('--input'),output=arg('--output');
if(!args.includes('--input')||!args.includes('--output')||![input,output].every(path.isAbsolute)||path.resolve(input)===path.resolve(output))throw Error('absolute_private_paths_required');
if([output+'.private.json',output+'-rollback.private.sql',output+'-commit.private.sql'].some(p=>path.resolve(p).toLowerCase()===path.resolve(input).toLowerCase()))throw Error('source_overwrite_forbidden');
const rows=JSON.parse(await fs.readFile(input,'utf8')),plan=[],seen=new Set(),retained=[];
const sha=s=>createHash('sha256').update(s).digest('hex'),lit=s=>"'"+s.replaceAll("'","''")+"'",j=v=>lit(JSON.stringify(v))+'::jsonb';
for(const row of rows){
 const r=canonicalizeQuestion(row.question);
 if(r.issues.length||r.retained_reason){retained.push({id:row.question_id,usable:row.usable,issues:r.issues,reason:r.retained_reason});continue;}
 if(!r.mapping||!row.usable)continue;
 if(!row.pool||!row.membership||!row.study?.enabled)throw Error('missing_enabled_source_metadata:'+row.question_id);
 const version=sha(JSON.stringify({contract:'canonical-single-v1',previous:row.pool.source_version,question:{...r.question,id:undefined}}));
 const id=row.question_id.replace(/_v[a-f0-9]{12}$/,'')+'_v'+version.slice(0,12),question={...r.question,id};
 const change={previous_question_id:row.question_id,field_id:r.mapping.field_id,option_ids:r.mapping.option_ids,option_map:r.mapping.option_map,method:'canonical-single-v1',model_calls:0};
 const pool={...row.pool,question_id:id,source_version:version,question,checks:{...row.pool.checks,canonical_type_repair:change}};
 const membership={...row.membership,question_id:id};
 const provenance={...row.study.provenance,canonical_type_repair:change,previous_version_provenance:row.study.provenance};
 delete provenance.accepted_record_sha256;delete provenance.accepted_candidate_sha256;
 const study={...row.study,question_id:id,question,provenance};
 const key=id+'|'+membership.course_id;if(seen.has(key))throw Error('duplicate_membership');seen.add(key);
 plan.push({old:row,pool,membership,study,mapping:r.mapping});
}
const protectedTables=['quiz_versions','quiz_banks','quiz_attempts','quiz_answers','quiz_open_responses','student_progress','quiz_learning_credits','quiz_learning_leaves','quiz_leaf_awards'];
const digest=protectedTables.map(t=>`select ${lit(t)} t,count(*) n,md5(coalesce(string_agg(to_jsonb(x)::text,'' order by to_jsonb(x)::text),'')) h from public.${t} x`).join(' union all ');
let sql=`begin;set transaction isolation level repeatable read;set local statement_timeout='180s';\ncreate temp table protected_before as ${digest};\ncreate temp table canonical_repair(data jsonb);\n`;
sql+=plan.map(p=>`insert into canonical_repair values(${j(p)});`).join('\n');
sql+=`
do $repair$ declare r jsonb;q jsonb;opt jsonb;old_raw text;doc jsonb;begin
 for r in select data from canonical_repair loop
  if not exists(select 1 from public.quiz_question_pool p where p.question_id=r#>>'{old,question_id}' and to_jsonb(p)=r#>'{old,pool}')
   or not exists(select 1 from public.quiz_pool_membership p where p.question_id=r#>>'{old,question_id}' and p.course_id=r#>>'{membership,course_id}' and to_jsonb(p)=r#>'{old,membership}')
   or not exists(select 1 from public.quiz_pool_study_sources p where p.question_id=r#>>'{old,question_id}' and p.course_id=r#>>'{study,course_id}' and to_jsonb(p)=r#>'{old,study}') then raise exception 'source_changed: %',r#>>'{old,question_id}';end if;
  q:=r#>'{pool,question}';
  doc:=jsonb_build_object('schema',1,'title','題型相容驗收','catalog',jsonb_build_object('school_year','115'),'blocks',jsonb_build_array(jsonb_build_object('id','b','material',jsonb_build_object('text','','media','[]'::jsonb),'questions',jsonb_build_array(q))));
  perform public.quiz_validate(doc);
  for opt in select value from jsonb_array_elements(q->'options') loop
   old_raw:=jsonb_build_object('v',1,'f',jsonb_build_object(r#>>'{mapping,field_id}',(select key from jsonb_each_text(r#>'{mapping,option_map}') where value=opt->>'id')))::text;
   if public.quiz_fields_grade(r#>'{old,question}',old_raw) is distinct from ((opt->>'id')=(q#>>'{answer,option_id}')) then raise exception 'grade_changed: %',q->>'id';end if;
  end loop;
  insert into public.quiz_question_pool select (jsonb_populate_record(null::public.quiz_question_pool,r->'pool')).*;
  insert into public.quiz_pool_membership select (jsonb_populate_record(null::public.quiz_pool_membership,r->'membership')).*;
  insert into public.quiz_pool_study_sources select (jsonb_populate_record(null::public.quiz_pool_study_sources,r->'study')).*;
 end loop;
 update public.quiz_question_pool p set usable=false from canonical_repair r where p.question_id=r.data#>>'{old,question_id}';
 update public.quiz_pool_study_sources p set enabled=false from canonical_repair r where p.question_id=r.data#>>'{old,question_id}' and p.course_id=r.data#>>'{study,course_id}';
end $repair$;
do $protected$ begin if exists(select * from protected_before except select * from (${digest}) x) then raise exception 'protected_changed';end if;end $protected$;
select count(*) replacements from canonical_repair;
`;
await fs.writeFile(output+'.private.json',JSON.stringify({plan,retained}));
await fs.writeFile(output+'-rollback.private.sql',sql+'rollback;\n');
await fs.writeFile(output+'-commit.private.sql',sql+'commit;\n');
console.log(JSON.stringify({replacements:plan.length,retained,model_calls:0,private_sql_sha256:sha(sql)}));
