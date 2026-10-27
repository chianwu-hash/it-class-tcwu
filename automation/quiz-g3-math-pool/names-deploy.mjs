// Add metadata/RPC only; no pool re-import, no answer or version updates.
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const deleting=process.argv.includes('--delete'),project='upxgyusodibaqcrocdzj',dir='automation/output/quiz/hanlin-g3-math-pool/'+(deleting?'deletion':'names');await mkdir(dir,{recursive:true});
function cli(args){let raw;try{raw=execFileSync('pwsh',['-NoProfile','-NonInteractive','-Command','& supabase-personal '+args.map(a=>"'"+a.replaceAll("'","''")+"'").join(' ')],{encoding:'utf8',windowsHide:true,timeout:90000,stdio:['ignore','pipe','pipe']});}catch{throw Error('names_deploy_failed');}return JSON.parse(raw.slice(Math.min(...[raw.indexOf('{'),raw.indexOf('[')].filter(x=>x>=0))));}
if(!cli(['projects','list','--output','json']).some(p=>p.id===project&&p.name==="chianwu-hash's Project"))throw Error('project_mismatch');
const query=sql=>cli(['db','query','--linked','--project-ref',project,sql,'--output','json']).rows;
const snapshot=()=>query("select (select count(*) from public.quiz_answers)::int answers,(select count(*) from public.quiz_versions)::int versions,(select md5(coalesce(string_agg(row_to_json(a)::text,'' order by a.attempt_id,a.question_id),'')) from public.quiz_answers a) answer_digest,(select md5(coalesce(string_agg(row_to_json(v)::text,'' order by v.id),'')) from public.quiz_versions v) version_digest")[0];
const before=snapshot();await writeFile(dir+'/before.json',JSON.stringify(before,null,2),'utf8');
for(const f of ['supabase/quiz.sql','supabase/quiz-pool.sql'])cli(['db','query','--linked','--project-ref',project,'--file',resolve(f),'--output','json']);
const after=snapshot();if(JSON.stringify(before)!==JSON.stringify(after))throw Error('concurrent_data_change_review_required');
const rpc=deleting?'quiz_delete_paper':'quiz_rename_paper';
const permission=query(`select has_function_privilege('anon','public.${rpc}(jsonb)','EXECUTE') anonymous,has_function_privilege('authenticated','public.${rpc}(jsonb)','EXECUTE') student`)[0];if(permission.anonymous||!permission.student)throw Error('permission_mismatch');
const report={at:new Date().toISOString(),project,originalAnswersUnchanged:true,originalVersionsUnchanged:true,permission};await writeFile(dir+'/deployment.json',JSON.stringify(report,null,2),'utf8');console.log(JSON.stringify(report));
