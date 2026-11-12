import {createHash} from 'node:crypto';
const md5=s=>createHash('md5').update(s).digest('hex');
const signatures={quiz_validate:'jsonb',quiz_student_document:'jsonb,jsonb,jsonb',quiz_action_before_learning:'text,jsonb',quiz_wrong_questions_before_learning:'jsonb'};
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('fields_source_changed');return s.replace(a,()=>b)};
// Project each nested field explicitly; an unknown source property never reaches students.
const projection=`(select coalesce(jsonb_agg(jsonb_build_object('id',f->>'id','label',f->>'label','input',f->>'input')
 ||case when f ? 'options' then jsonb_build_object('options',(select jsonb_agg(jsonb_build_object('id',o->>'id','content',o->'content')order by ord)from jsonb_array_elements(f->'options')with ordinality opts(o,ord)))else '{}'::jsonb end order by n),'[]'::jsonb)
 from jsonb_array_elements(q->'fields')with ordinality fields(f,n))`;
export function normalFieldsChanges(definitions){
 return Object.keys(signatures).map(name=>{
  const found=definitions.filter(r=>r.proname===name);if(found.length!==1)throw Error('fields_definition_missing');
  const before=found[0].definition;let after=before;
  if(name==='quiz_validate'){
   after=once(after,"else raise exception 'invalid_question_type'; end if;","elsif q->>'type'='fields' then perform public.quiz_fields_validate(q);\n   else raise exception 'invalid_question_type'; end if;");
   after=once(after,"if k not in ('id','type','prompt','explanation','options','answer') then", "if k not in ('id','type','prompt','explanation','options','answer') and not(k='fields' and q->>'type'='fields') then");
  }else if(name==='quiz_student_document'){
   const end="on o->>'id'=opt.id)) item";
   after=once(after,end,`on o->>'id'=opt.id))||case when q->>'type'='fields' then jsonb_build_object('fields',${projection})else '{}'::jsonb end item`);
  }else if(name==='quiz_action_before_learning'){
   const anchor="correct:=(response#>>'{}')=q->'answer'->>'option_id';\r\n   else";
   after=once(after,anchor,"correct:=(response#>>'{}')=q->'answer'->>'option_id';\r\n   elsif q->>'type'='fields' then\n    correct:=public.quiz_fields_grade(q,response#>>'{}');\n   elsif q->>'type'='short' then");
   const end="end;\r\n   end if;\r\n   insert into public.quiz_answers";
   after=once(after,end,"end;\r\n   else raise exception 'invalid_question_type';end if;\r\n   insert into public.quiz_answers");
  }else{
   const end="'material',b->'material','options',options),";
   after=once(after,end,`'material',b->'material','options',options)||case when q->>'type'='fields' then jsonb_build_object('fields',${projection})else '{}'::jsonb end,`);
  }
  return {name,before,after,beforeHash:md5(before),afterHash:md5(after)};
 });
}
export function buildNormalFieldsMigration(definitions,helpers){
 const changes=normalFieldsChanges(definitions),normalizer=definitions.find(r=>r.proname==='quiz_math_answer_normalize');if(!normalizer)throw Error('fields_dependency_missing');
 const helperGuards=[...helpers.matchAll(/create or replace function public\.(quiz_fields_\w+)\(([^)]*)\)[\s\S]*?as \$(fields_\w+)\$([\s\S]*?)\$\3\$;/g)].map(m=>{
  const args=m[2].split(',').map(x=>x.trim().split(/\s+/).at(-1)).join(',');return {signature:m[1]+'('+args+')',hash:md5(m[4])};
 });
 if(helperGuards.length!==4)throw Error('fields_helpers_incomplete');
 const same=changes.map(r=>`md5(pg_get_functiondef('public.${r.name}(${signatures[r.name]})'::regprocedure))='${r.afterHash}'`).join(' and ');
 const old=changes.map(r=>`md5(pg_get_functiondef('public.${r.name}(${signatures[r.name]})'::regprocedure))='${r.beforeHash}'`).join(' and ');
 return `-- Complete parent questions remain atomic; historical grading is unchanged.
begin;
set local lock_timeout='5s';
lock table public.quiz_versions,public.quiz_banks,public.quiz_question_pool in share row exclusive mode;
do $fields_guard$
declare installed boolean;
begin
 if md5(pg_get_functiondef('public.quiz_math_answer_normalize(text)'::regprocedure))<>'${md5(normalizer.definition)}' then raise exception 'fields_dependency_changed';end if;
 installed:=(${same});
 if not installed and not(${old})then raise exception 'fields_baseline_changed';end if;
 ${helperGuards.map(h=>`if to_regprocedure('public.${h.signature}') is not null then
  if(select md5(prosrc)from pg_proc where oid='public.${h.signature}'::regprocedure)<>'${h.hash}'then raise exception 'fields_helper_changed';end if;
 elsif installed then raise exception 'fields_helper_missing';end if;`).join('\n ')}
 if not installed and (exists(select 1 from(
  select document d from public.quiz_versions union all select draft from public.quiz_banks
 )src,lateral jsonb_array_elements(case when jsonb_typeof(d->'blocks')='array'then d->'blocks'else '[]'::jsonb end)b,
 lateral jsonb_array_elements(case when jsonb_typeof(b->'questions')='array'then b->'questions'else '[]'::jsonb end)q where q->>'type'='fields')
 or exists(select 1 from public.quiz_question_pool where question->>'type'='fields'))then raise exception 'fields_historical_type_present';end if;
end $fields_guard$;
${helpers}
${changes.map(r=>r.after+';').join('\n')}
notify pgrst,'reload schema';
commit;
`;
}
