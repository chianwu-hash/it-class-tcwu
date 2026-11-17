import {createHash} from 'node:crypto';
export const workSignatures=['public.quiz_fields_validate(jsonb)','public.quiz_fields_response(jsonb,text)','public.quiz_validate(jsonb)','public.quiz_student_document(jsonb,jsonb,jsonb)','public.quiz_action_before_learning(text,jsonb)','partner_pilot.action_core(jsonb)','partner_pilot.learning_snapshot_pre_message_media(uuid)'];
const replace=(s,a,b)=>{if(s.split(a).length!==2)throw Error('saved_work_baseline_changed:'+a.slice(0,65));return s.replace(a,b);};
export function buildSavedWorkMigration(definitions){
 const changes=workSignatures.map(signature=>{
  const entry=definitions.find(d=>d.signature===signature);if(!entry)throw Error('missing_definition:'+signature);
  const before=entry.definition.replaceAll('\r\n','\n');let after=before;
  if(signature.startsWith('public.quiz_fields_validate'))after=replace(after,"begin\n if q ? 'options'",`begin
 if q ? 'work' then
  if q->>'type' is distinct from 'fields' or jsonb_typeof(q->'work') is distinct from 'object' then raise exception 'invalid_question';end if;
  if (select count(*) from jsonb_object_keys(q->'work'))<>2
   or exists(select 1 from jsonb_object_keys(q->'work') k where k not in('input','label'))
   or coalesce(q#>>'{work,input}','') not in('expression','sketch')
   or jsonb_typeof(q#>'{work,label}') is distinct from 'string' or length(trim(q#>>'{work,label}')) not between 1 and 120 then raise exception 'invalid_question';end if;
 end if;
 if q ? 'options'`);
  else if(signature.startsWith('public.quiz_fields_response')){
   after=replace(after,'if length(raw) not between 1 and 2000 then',"if raw is null or(case when q->>'type'='fields' and q#>>'{work,input}'='sketch' then octet_length(raw) not between 1 and 300000 else length(raw) not between 1 and 2000 end)then");
   after=replace(after,"(select count(*) from json_object_keys(original))<>2","(select count(*) from json_object_keys(original))<>(case when q ? 'work' then 3 else 2 end)");
   after=replace(after,"where k not in('v','f')","where k not in('v','f') and not(k='w' and q ? 'work')");
   after=replace(after," for f in select * from jsonb_array_elements(q->'fields') loop",` if q ? 'work' then
  if q->>'type' is distinct from 'fields' or not(v ? 'w') then raise exception 'invalid_response';end if;
  if q#>>'{work,input}'='expression' then
   if jsonb_typeof(v->'w') is distinct from 'string' or length(trim(v->>'w')) not between 1 and 250 then raise exception 'invalid_response';end if;
  elsif q#>>'{work,input}'='sketch' then
   if not public.quiz_sketch_valid(v->'w') then raise exception 'invalid_response';end if;
   if (select count(*) from json_object_keys(original->'w'))<>(select count(distinct k) from json_object_keys(original->'w') k) then raise exception 'invalid_response';end if;
  else raise exception 'invalid_response';end if;
 end if;
 for f in select * from jsonb_array_elements(q->'fields') loop`);
  }else if(signature.startsWith('public.quiz_validate'))after=replace(after,"and not(k='fields' and q->>'type' in('fields','open'))","and not(k='fields' and q->>'type' in('fields','open')) and not(k='work' and q->>'type'='fields')");
  else if(signature.startsWith('public.quiz_student_document'))after=replace(after,"else '{}'::jsonb end item","else '{}'::jsonb end||case when q->>'type'='fields' and q ? 'work' then jsonb_build_object('work',jsonb_build_object('input',q#>'{work,input}','label',q#>'{work,label}'))else '{}'::jsonb end item");
  else if(signature.startsWith('public.quiz_action_before_learning'))after=replace(after,"length(response#>>'{}') not between 1 and 2000","(case when q->>'type'='fields' and q#>>'{work,input}'='sketch' then octet_length(response#>>'{}') not between 1 and 300000 else length(response#>>'{}') not between 1 and 2000 end)");
  else if(signature==='partner_pilot.action_core(jsonb)')after=replace(after,"when qb.normal_question->>'type'='open' and exists(select 1 from jsonb_array_elements(qb.normal_question->'fields') fs where fs->>'input'='sketch') then","when(qb.normal_question->>'type'='open' and exists(select 1 from jsonb_array_elements(qb.normal_question->'fields') fs where fs->>'input'='sketch'))or(qb.normal_question->>'type'='fields' and qb.normal_question#>>'{work,input}'='sketch')then");
  else after=replace(after,"when submitted=total and q.normal_question->>'type'='open'\n    and exists(select 1 from jsonb_array_elements(q.normal_question->'fields') f where f->>'input'='sketch')","when submitted=total and((q.normal_question->>'type'='open'\n    and exists(select 1 from jsonb_array_elements(q.normal_question->'fields') f where f->>'input'='sketch'))or(q.normal_question->>'type'='fields' and q.normal_question ? 'work'))");
  return {signature,before,after:after.trimEnd().replace(/;?$/,';')};
 });
 const guards=changes.map(c=>`md5(pg_get_functiondef('${c.signature}'::regprocedure))='${createHash('md5').update(c.before).digest('hex')}'`).join(' and\n ');
 return `-- Saved calculation process, opt-in only. USER APPROVAL REQUIRED before production.\n-- No existing questions, attempts, permissions, or tables are modified.\nbegin;\nset local lock_timeout='3s';\ndo $guard$ begin\n if not(${guards})then raise exception 'saved_work_baseline_changed';end if;\nend $guard$;\n${changes.map(c=>c.after).join('\n')}\ncommit;\n`;
}
