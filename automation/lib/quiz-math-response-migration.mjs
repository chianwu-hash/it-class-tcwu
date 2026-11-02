import {createHash} from 'node:crypto';
const md5=s=>createHash('md5').update(s).digest('hex');
const signatures={quiz_past_canonical:'jsonb,jsonb',quiz_past_action:'text,jsonb',quiz_past_snapshot_before_flowers:'uuid',quiz_learning_wrong_detail:'jsonb'};
function once(s,a,b){if(s.split(a).length!==2)throw Error('math_migration_source_changed: '+a);return s.replace(a,b)}
export function mathResponseChanges(defs){const byName=new Map(defs.map(r=>[r.proname,r])),changes=[];const edit=(name,fn)=>{const r=byName.get(name);if(!r)throw Error('missing '+name);const after=fn(r.definition);changes.push({name,args:r.args,before:r.definition,after,beforeHash:md5(r.definition),afterHash:md5(after)})};
 edit('quiz_past_canonical',s=>once(s,"if g->>'kind'='short' then",`if g->>'kind'='short' and g->>'answerFormat'='math-v1' then
  if jsonb_typeof(v) is distinct from 'object' or (select array_agg(k order by k) from jsonb_object_keys(v) k) is distinct from array['answer','working'] or jsonb_typeof(v->'answer') is distinct from 'string' or jsonb_typeof(v->'working') is distinct from 'string' or length(v->>'working')>5000 then raise exception 'invalid_response';end if;
  return jsonb_build_object('answer',public.quiz_math_answer_normalize(v->>'answer'),'working',v->>'working');
 end if;
 if g->>'kind'='short' then`));
 edit('quiz_past_action',s=>{
  s=once(s,"where trim(a)=trim(v#>>'{}')","where (case when g->>'answerFormat'='math-v1' then public.quiz_math_answer_normalize(a)=v->>'answer' else trim(a)=trim(v#>>'{}') end)");
  return once(s,"then null else f->'answer' end","then null when g->>'answerFormat'='math-v1' then f->'displayAnswer' else f->'answer' end");
 });
 edit('quiz_past_snapshot_before_flowers',s=>once(s,"'id',g->'id','kind',g->'kind'","'id',g->'id','kind',g->'kind','answerFormat',g->'answerFormat'"));
 edit('quiz_learning_wrong_detail',s=>{
  // This helper renders past-exam answers in the existing wrong-question view.
  return once(s,"response_text:=case when g->>'kind'='mark'", "response_text:=case when g->>'answerFormat'='math-v1' then (response->>'answer')||case when coalesce(response->>'working','')='' then '' else E'\\n計算過程（自我核對）：'||(response->>'working') end when g->>'kind'='mark'");
 });
 return changes.filter(r=>r.before!==r.after);
}
export function buildMathResponseMigration(defs,helper){return 'begin;\n'+helper+'\n'+mathResponseChanges(defs).map(r=>`do $guard$ declare h text;begin
 select md5(pg_get_functiondef('public.${r.name}(${signatures[r.name]})'::regprocedure)) into h;
 if h='${r.afterHash}' then return;end if;if h<>'${r.beforeHash}' then raise exception 'math_migration_changed: ${r.name}';end if;
 execute $def$${r.after}$def$;end $guard$;`).join('\n')+"\nnotify pgrst,'reload schema';commit;\n";}
