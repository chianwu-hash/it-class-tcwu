import {createHash} from 'node:crypto';

const md5=text=>createHash('md5').update(text).digest('hex');
const signatures={quiz_validate:'jsonb',quiz_action_before_learning:'text,jsonb'};
const marker='-- Opt-in normal math answers v1';
function once(source,from,to){
 if(source.split(from).length!==2)throw Error('normal_math_source_changed');
 return source.replace(from,to);
}

// Patch the actual installed definitions, preserving the surrounding auth,
// timing, ordering, idempotency, study and learning wrappers byte for byte.
export function normalMathChanges(definitions){
 return Object.keys(signatures).map(name=>{
  const matches=definitions.filter(row=>row.proname===name);
  if(matches.length!==1)throw Error('normal_math_definition_missing_or_overloaded');
  const before=matches[0].definition;
  let after=before;
  if(!before.includes(marker)){
   if(name==='quiz_validate'){
    const anchor="ids:=array_append(ids,q->>'id');";
    after=once(after,anchor,anchor+`
   ${marker}
   if q->'answer' ? 'normalizer' then
    if q->>'type' is distinct from 'short' or jsonb_typeof(q->'answer'->'normalizer') is distinct from 'string'
     or q->'answer'->>'normalizer' is distinct from 'math-v1' then raise exception 'invalid_answer';end if;
   end if;`);
    const accepted="if jsonb_typeof(a) is distinct from 'string' or length(trim(a#>>'{}')) not between 1 and 2000 then raise exception 'invalid_answer'; end if;";
    after=once(after,accepted,accepted+`
     if q->'answer'->>'normalizer'='math-v1' then
      if (a#>>'{}')~'[0-9０-９][[:space:]　]+[0-9０-９]' then raise exception 'invalid_answer';end if;
      perform public.quiz_math_answer_normalize(a#>>'{}');
     end if;`);
   }else{
    const literal="correct:=exists(select 1 from jsonb_array_elements_text(q->'answer'->'accepted') a where trim(a)=trim(response#>>'{}'));";
    after=once(after,literal,`${marker}
    if q->'answer'->>'normalizer'='math-v1' and (response#>>'{}')~'[0-9０-９][[:space:]　]+[0-9０-９]' then raise exception 'invalid_response';end if;
    correct:=case when q->'answer'->>'normalizer'='math-v1' then
     exists(select 1 from jsonb_array_elements_text(q->'answer'->'accepted') a
      where public.quiz_math_answer_normalize(a)=public.quiz_math_answer_normalize(response#>>'{}'))
     else exists(select 1 from jsonb_array_elements_text(q->'answer'->'accepted') a where trim(a)=trim(response#>>'{}')) end;`);
   }
  }
  return {name,before,after,beforeHash:md5(before),afterHash:md5(after)};
 });
}

export function buildNormalMathMigration(definitions){
 const changes=normalMathChanges(definitions);
 const normalizers=definitions.filter(row=>row.proname==='quiz_math_answer_normalize');
 if(normalizers.length!==1)throw Error('normal_math_dependency_missing_or_overloaded');
 const normalizerHash=md5(normalizers[0].definition);
 const checks=changes.map(row=>`select md5(pg_get_functiondef('public.${row.name}(${signatures[row.name]})'::regprocedure)) into ${row.name==='quiz_validate'?'validator_hash':'action_hash'};`).join('\n ');
 const validator=changes[0],action=changes[1];
 return `-- Only new, explicitly opted-in normal short answers use math-v1.
-- No historical answers, versions, rewards or grading rules are rewritten.
begin;
set local lock_timeout='5s';
lock table public.quiz_versions,public.quiz_banks,public.quiz_question_pool in share row exclusive mode;
do $normal_math_guard$
declare validator_hash text;action_hash text;normalizer_hash text;
begin
 ${checks}
 if to_regprocedure('public.quiz_math_answer_normalize(text)') is null then raise exception 'normal_math_normalizer_missing';end if;
 select md5(pg_get_functiondef('public.quiz_math_answer_normalize(text)'::regprocedure)) into normalizer_hash;
 if normalizer_hash<>'${normalizerHash}' then raise exception 'normal_math_normalizer_changed';end if;
 if validator_hash='${validator.afterHash}' and action_hash='${action.afterHash}' then return;end if;
 if validator_hash<>'${validator.beforeHash}' or action_hash<>'${action.beforeHash}' then raise exception 'normal_math_baseline_changed';end if;
 -- The marker used to be an ignored extra answer key. Refuse to change the
 -- behaviour of any historical document or pool row that already contains it.
 if exists(select 1 from (
  select document d from public.quiz_versions union all select draft from public.quiz_banks
 ) source, lateral jsonb_array_elements(case when jsonb_typeof(d->'blocks')='array' then d->'blocks' else '[]'::jsonb end) b,
 lateral jsonb_array_elements(case when jsonb_typeof(b->'questions')='array' then b->'questions' else '[]'::jsonb end) q
 where q->'answer' ? 'normalizer')
 or exists(select 1 from public.quiz_question_pool where question->'answer' ? 'normalizer') then raise exception 'normal_math_historical_marker_present';end if;
 execute $normal_math_validator$${validator.after}$normal_math_validator$;
 execute $normal_math_action$${action.after}$normal_math_action$;
end $normal_math_guard$;
notify pgrst,'reload schema';
commit;
`;
}
