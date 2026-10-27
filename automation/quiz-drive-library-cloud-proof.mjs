import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
const dir='automation/output/quiz/drive-library',qa=JSON.parse(await readFile(`${dir}/qa-session.json`,'utf8'));
if(!/^[a-f0-9-]{36}$/.test(qa.session)||!/^[a-f0-9-]{36}$/.test(qa.testUserId))throw Error('invalid_test_identity');
const sql=`select a.id as attempt_id,a.user_id,count(x.question_id)::int as saved_answers,count(x.question_id) filter(where not x.correct)::int as wrong_answers from public.quiz_attempts a left join public.quiz_answers x on x.attempt_id=a.id where a.session_id='${qa.session}' and a.user_id='${qa.testUserId}' group by a.id,a.user_id;`;
const raw=execFileSync('pwsh',['-NoProfile','-Command',"& supabase-personal db query --linked --project-ref upxgyusodibaqcrocdzj '"+sql.replaceAll("'","''")+"' --output json"],{encoding:'utf8',windowsHide:true,timeout:90000,maxBuffer:1000000,stdio:['ignore','pipe','pipe']});
const result=JSON.parse(raw.slice(raw.indexOf('{'))).rows;
if(result.length!==1||result[0].saved_answers!==3||result[0].wrong_answers!==3||result[0].user_id!==qa.testUserId)throw Error('cloud_progress_not_verified');
await writeFile(`${dir}/supabase-save-proof.json`,JSON.stringify({at:new Date().toISOString(),realDatabase:true,session:qa.session,answers:result[0].saved_answers,wrongAnswers:result[0].wrong_answers,expectedTestStudentMatched:true},null,2),'utf8');console.log(JSON.stringify({realSupabaseSaveVerified:true,answers:3}));
