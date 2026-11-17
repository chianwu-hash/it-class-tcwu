import {createHash} from 'node:crypto';
const md5=s=>createHash('md5').update(s).digest('hex');
const replace=(source,from,to)=>{if(source.split(from).length!==2)throw Error('sketch_baseline_changed:'+from.slice(0,50));return source.replace(from,to);};
export function buildOpenSketchMigration(definitions,helpers){
 helpers=helpers.replaceAll('\r\n','\n');
 const changes=['quiz_open_validate','quiz_open_submit'].map(name=>{
  const entry=definitions.filter(d=>d.proname===name);if(entry.length!==1)throw Error('sketch_definition_missing:'+name);
  const before=entry[0].definition.replaceAll('\r\n','\n');let after=before;
  if(name==='quiz_open_validate'){
   after=replace(after,"fake jsonb;","fake jsonb;projected jsonb;");
   after=replace(after," perform public.quiz_fields_validate(jsonb_set(q,'{answer}',jsonb_build_object('format','fields-v1','fields',fake)));"," select jsonb_agg(case when fs.item->>'input'='sketch' then jsonb_set(fs.item,'{input}','\"text\"') else fs.item end order by fs.n) into projected from jsonb_array_elements(q->'fields')with ordinality fs(item,n);\n perform public.quiz_fields_validate(jsonb_set(jsonb_set(q,'{fields}',projected),'{answer}',jsonb_build_object('format','fields-v1','fields',fake)));");
   after=replace(after,"if f->>'input' is distinct from 'text' then","if f->>'input' is null or f->>'input' not in('text','sketch') then");
  }else after=replace(after,'canonical:=public.quiz_fields_response(p_question,raw);','canonical:=public.quiz_open_response(p_question,raw);');
  return {before,after:after.trimEnd()+';',signature:name==='quiz_open_validate'?'quiz_open_validate(jsonb)':'quiz_open_submit(uuid,jsonb,jsonb,boolean)'};
 });
 const guards=changes.map(c=>`md5(pg_get_functiondef('public.${c.signature}'::regprocedure))='${md5(c.before)}'`).join(' and ');
 return `-- Local-tested candidate. USER APPROVAL REQUIRED before production application.\nbegin;\nset local lock_timeout='3s';\ndo $guard$ begin\n if not(${guards}) then raise exception 'sketch_baseline_changed';end if;\n if not exists(select 1 from pg_constraint where conrelid='public.quiz_open_responses'::regclass and conname='quiz_open_responses_response_check' and md5(pg_get_constraintdef(oid))='7d197a7fac6f6f16888881c6ec47e46e') then raise exception 'sketch_response_constraint_changed';end if;\n if to_regprocedure('public.quiz_open_response(jsonb,text)') is not null or to_regprocedure('public.quiz_sketch_valid(jsonb)') is not null then raise exception 'sketch_already_installed';end if;\nend $guard$;\n${helpers}\nalter table public.quiz_open_responses drop constraint quiz_open_responses_response_check;\nalter table public.quiz_open_responses add constraint quiz_open_responses_response_check check(jsonb_typeof(response)='string' and octet_length(response#>>'{}') between 1 and 300000);\n${changes.map(c=>c.after).join('\n')}\ncommit;\n`;
}
