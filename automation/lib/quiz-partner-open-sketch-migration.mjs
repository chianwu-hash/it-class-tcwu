import {createHash} from 'node:crypto';
const change=(s,a,b)=>{if(s.split(a).length!==2)throw Error('partner_sketch_baseline_changed');return s.replace(a,b);};
export function buildPartnerOpenSketchMigration(before){
 before=before.replaceAll('\r\n','\n');
 let after=change(before,"or length(p->>'response') not between 1 and 2000 then raise exception 'invalid_response';end if;","or (case when qb.normal_question->>'type'='open' and exists(select 1 from jsonb_array_elements(qb.normal_question->'fields') fs where fs->>'input'='sketch') then octet_length(p->>'response') not between 1 and 300000 else length(p->>'response') not between 1 and 2000 end) then raise exception 'invalid_response';end if;");
 after=change(after,"perform public.quiz_fields_response(qb.normal_question,p->>'response');","perform case when qb.normal_question->>'type'='open' then public.quiz_open_response(qb.normal_question,p->>'response') else public.quiz_fields_response(qb.normal_question,p->>'response') end;");
 const hash=createHash('md5').update(before).digest('hex');
 return `-- Candidate only. Apply after approved quiz-open-sketch.sql; requires separate explicit approval.\nbegin;\nset local lock_timeout='3s';\ndo $guard$ begin\n if md5(pg_get_functiondef('partner_pilot.action_core(jsonb)'::regprocedure))<>'${hash}' or to_regprocedure('public.quiz_open_response(jsonb,text)') is null then raise exception 'partner_sketch_baseline_changed';end if;\nend $guard$;\n${after.trimEnd()};\ncommit;\n`;
}
