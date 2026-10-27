import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const project='upxgyusodibaqcrocdzj',dir='automation/output/quiz/wrong-questions';
function cli(args){try{return execFileSync('pwsh',['-NoProfile','-Command','& supabase-personal '+args.map(a=>"'"+a.replaceAll("'","''")+"'").join(' ')],{encoding:'utf8',windowsHide:true,timeout:90000,maxBuffer:1000000,stdio:['ignore','pipe','pipe']});}catch{throw Error('quiz_wrong_deployment_failed');}}
const json=raw=>JSON.parse(raw.slice(Math.min(...[raw.indexOf('{'),raw.indexOf('[')].filter(x=>x>=0))));
if(!json(cli(['projects','list','--output','json'])).some(p=>p.id===project&&p.name==="chianwu-hash's Project"))throw Error('project_mismatch');
const query=sql=>json(cli(['db','query','--linked','--project-ref',project,sql,'--output','json'])).rows;
const summary=()=>query("select (select count(*) from public.quiz_answers)::int as answers,(select count(*) from public.quiz_attempts)::int as attempts,(select md5(coalesce(string_agg(row_to_json(a)::text,'' order by a.attempt_id,a.question_id),'')) from public.quiz_answers a) as answer_digest;")[0];
const before=summary();
cli(['db','query','--linked','--project-ref',project,'--file','supabase/quiz-wrong-questions.sql','--output','json']);
const after=summary();if(JSON.stringify(before)!==JSON.stringify(after))throw Error('concurrent_progress_change_requires_review');
const permissions=query("select p.prosecdef as secured,has_function_privilege('anon',p.oid,'execute') as anonymous,has_function_privilege('authenticated',p.oid,'execute') as authenticated from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='quiz_wrong_questions';");
if(permissions.length!==1||!permissions[0].secured||permissions[0].anonymous||!permissions[0].authenticated)throw Error('permission_mismatch');
const report={at:new Date().toISOString(),project,readOnlyProjection:true,before,after,permissions};await mkdir(dir,{recursive:true});await writeFile(dir+'/deployment.json',JSON.stringify(report,null,2),'utf8');console.log(JSON.stringify({installed:true,readOnlyProjection:true,answersUnchanged:true}));
