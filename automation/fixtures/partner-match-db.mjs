import fs from 'node:fs/promises';import {setupProductionQuizDB} from './production-quiz-db.mjs';import {newDocument,newQuestion,content} from '../../shared/quiz-document.mjs';
export async function setupMatchDB(){
 const f=await setupProductionQuizDB(),{db,uid}=f;
 try{
 await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[uid(1),'teacher@example.invalid']);
 for(let n=2;n<=45;n++){await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[uid(n),`student${n}@example.invalid`]);await db.query('insert into public.student_enrollments(school_year,email,class_code,seat_no,display_name) values(115,$1,$2,$3,$4)',[`student${n}@example.invalid`,n>=40?'603':'30'+(n%7+1),n,'合成同學'+n]);}
 await db.exec('insert into partner_pilot.settings values(true,true)');
 await db.exec('create trigger quiz_version_meta after insert or update of document on public.quiz_versions for each row execute function public.quiz_version_meta_trigger()');
 await db.exec('create trigger partner_freeze_allocation before insert or update on partner_pilot.rooms for each row execute function partner_pilot.freeze_allocation()');
 await db.exec(await fs.readFile('supabase/quiz-grade-sharing.sql','utf8'));await db.exec(await fs.readFile('supabase/quiz-partner-import-teacher.sql','utf8'));await db.exec(await fs.readFile('supabase/quiz-partner-matchmaking.sql','utf8'));
 async function teacher(total,grade=3,importToPartner=true){const document=newDocument(),bank=crypto.randomUUID(),version=crypto.randomUUID(),session=crypto.randomUUID();document.title=`合成${grade}年級${total}題`;document.catalog={...document.catalog,volume:grade+'年級上學期',subject:'數學'};
  document.blocks=Array.from({length:total},(_,i)=>{const q=newQuestion();q.id='q'+i;q.prompt=content('合成題'+i);q.explanation=content('合成解析');return{id:'b'+i,material:content(),questions:[q]};});
  await db.query('insert into public.quiz_banks(id,owner_id,draft) values($1,$2,$3)',[bank,uid(1),document]);await db.query('insert into public.quiz_versions(id,bank_id,revision,document) values($1,$2,1,$3)',[version,bank,document]);await db.query("insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode) values($1,$2,$3,115,'[]','immediate',false,true,'practice')",[session,uid(1),version]);
  const paper=importToPartner?(await db.query('select partner_pilot.import_teacher_library_session($1) id',[session])).rows[0].id:null;return{paper,session,version,document};
 }
 const ten=await teacher(10),twenty=await teacher(20),six=await teacher(20,6);
 const call=async(n,p,legacy=false)=>{await f.as(n);try{return(await db.query(`select public.${legacy?'quiz_partner_pilot_action':'quiz_partner_match_action'}($1) data`,[{...p,requestId:p.requestId||crypto.randomUUID()}])).rows[0].data;}finally{await db.exec('reset role');}};
 const expire=async()=>db.exec("update partner_pilot.match_batches set deadline=clock_timestamp()-interval '1 second' where not closed and deadline is not null");
 const form=async(users)=>{await db.exec('update partner_pilot.match_settings set enabled=true');for(const n of users)await call(n,{action:'join'});await expire();return call(users[0],{action:'status'});};
 return{...f,ten,twenty,six,teacher,call,expire,form};
 }catch(e){await db.close();throw e;}
}
