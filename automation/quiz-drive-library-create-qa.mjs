import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {validateDocument} from '../shared/quiz-document.mjs';
const dir='automation/output/quiz/drive-library',project='upxgyusodibaqcrocdzj';
try{await readFile(`${dir}/qa-session.json`);console.log('Existing isolated QA session retained');process.exit(0);}catch{}
function cli(args){let raw;try{raw=execFileSync('pwsh',['-NoProfile','-Command',['&','supabase-personal',...args.map(a=>"'"+a.replaceAll("'","''")+"'")].join(' ')],{encoding:'utf8',windowsHide:true,timeout:90000,maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe']});}catch{throw Error('management_query_failed');}const x=raw.indexOf('{'),y=raw.indexOf('[');return JSON.parse(raw.slice(y>=0&&(x<0||y<x)?y:x));}
const ps=cli(['projects','list','--output','json']);if(!ps.some(p=>p.id===project&&p.name==="chianwu-hash's Project"))throw Error('project_mismatch');
const query=sql=>cli(['db','query','--linked','--project-ref',project,sql,'--output','json']).rows;
// This exact test account was verified on the visible localhost student page.
const actors=query("select u.id,e.class_code from auth.users u join public.student_enrollments e on lower(u.email)=e.email and e.school_year=115 where lower(u.email)='chianwu@apps.ntpc.edu.tw' and u.email_confirmed_at is not null;");
const owners=query("select id from auth.users where lower(email)='chianwu@gmail.com' and email_confirmed_at is not null;");
if(actors.length!==1||owners.length!==1||!/^3\d{2}$/.test(actors[0].class_code))throw Error('verified_test_actor_required');
const originals=JSON.parse(await readFile(`${dir}/supabase-versions.json`,'utf8'));
const sourceIds=['midterm_0404807d','midterm_004474ea','midterm_01ebc471'];
const chosen=sourceIds.map(id=>{for(const v of originals){for(const b of v.document.blocks){const q=b.questions.find(q=>q.id===id);if(q)return {version:v.id,block:{...structuredClone(b),questions:[structuredClone(q)]}};}}throw Error('source_question_missing');});
const base=originals.find(v=>v.id===chosen[0].version).document;
const document={...structuredClone(base),title:'圖片與雲端作答驗收（獨立測試場次）',catalog:{...base.catalog,unit:'圖片與雲端保存驗收'},blocks:chosen.map(x=>x.block)};
validateDocument(document);
const ids={bank:crypto.randomUUID(),version:crypto.randomUUID(),session:crypto.randomUUID()},literal=s=>"'"+s.replaceAll("'","''")+"'",encoded=literal(JSON.stringify(document))+'::jsonb';
const originalSignatures=query("select id,md5(document::text) as signature from public.quiz_versions order by id;");
const sql=`begin;
select public.quiz_validate(${encoded});
insert into public.quiz_banks(id,owner_id,draft) values('${ids.bank}','${owners[0].id}',${encoded});
insert into public.quiz_versions(id,bank_id,revision,document) values('${ids.version}','${ids.bank}',1,${encoded});
insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode) values('${ids.session}','${owners[0].id}','${ids.version}',115,'["${actors[0].class_code}"]','immediate',false,true,'classroom');
commit;`;
await writeFile(`${dir}/qa-create.sql`,sql,'utf8');cli(['db','query','--linked','--project-ref',project,'--file',resolve(dir,'qa-create.sql'),'--output','json']);
const after=query("select id,md5(document::text) as signature from public.quiz_versions order by id;");
if(!originalSignatures.every(a=>after.some(b=>b.id===a.id&&b.signature===a.signature)))throw Error('existing_versions_changed');
await writeFile(`${dir}/qa-document.json`,JSON.stringify(document,null,2),'utf8');
await writeFile(`${dir}/qa-session.json`,JSON.stringify({...ids,testUserId:actors[0].id,classCode:actors[0].class_code,sourceIds,sourceVersions:chosen.map(x=>x.version),existingVersionsUnchanged:true,url:`http://localhost:3000/grade3/115-1/quiz.html?cloud=1&session=${ids.session}`,documentSha256:createHash('sha256').update(JSON.stringify(document)).digest('hex')},null,2),'utf8');
console.log(JSON.stringify({createdIsolatedQaSession:true,questions:3,existingVersionsUnchanged:true}));
