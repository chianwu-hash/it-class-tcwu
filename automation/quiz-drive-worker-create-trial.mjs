import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createQuizDb,quizCall,TEACHER} from './lib/quiz-local-db.mjs';
import {createLocalMedia} from './lib/quiz-local-media.mjs';
const dir=resolve('automation/output/quiz/drive-worker-poc'),origin='http://127.0.0.1:4350';
const doc=JSON.parse(await readFile(resolve(dir,'source.quiz.json'),'utf8')),manifest=JSON.parse(await readFile(resolve(dir,'upload-manifest.json'),'utf8'));
process.env.QUIZ_MEDIA_SOURCE_HOSTS='quiz-drive-poc.example.invalid';
const db=await createQuizDb(resolve(dir,'db'));
try{
 const media=createLocalMedia({db,directory:resolve(dir,'quiz-local-media'),origin,sourceFetch:async input=>{
  const u=new URL(input),hash=u.pathname.slice(1).split('.')[0],a=manifest.assets[hash];
  if(u.hostname!=='quiz-drive-poc.example.invalid'||!a)throw Error('source_not_allowed');return new Response(await readFile(a.localFile),{headers:{'Content-Type':a.mime}});
 }});
 const bank=crypto.randomUUID();await quizCall(db,TEACHER,'save',{bank_id:bank,expected_revision:0,document:doc});
 const frozen=await media.call({action:'freeze',data:{bank_id:bank,expected_revision:1}});
 if(frozen.status!==200)throw Error('local_freeze_failed');
 const session=await quizCall(db,TEACHER,'open',{session_id:crypto.randomUUID(),version_id:frozen.result.id,school_year:115,class_codes:['603'],reveal:'immediate',shuffle_questions:false,shuffle_options:true});
 const link=n=>`${origin}/grade6/115-1/quiz.html?local=1&session=${session.id}&student=${n}`;
 await writeFile(resolve(dir,'trial.json'),JSON.stringify({sessionId:session.id,userUrl:link(1),verificationUrl:link(2),questions:3,answers:doc.blocks.map(b=>b.questions[0].answer.option_id)},null,2),'utf8');
 await writeFile(resolve(dir,'frozen.json'),JSON.stringify(frozen.result.document,null,2),'utf8');
 console.log(JSON.stringify({questions:3,localTrialPrepared:true,images:media.objects.size}));
}finally{await db.close();}
