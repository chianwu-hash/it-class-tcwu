import {createHash} from 'node:crypto';

// Loopback fixture only. Never a production migration or student_progress writer.
const clean=s=>String(s||'').normalize('NFKC').replace(/\s+/gu,' ').trim();
const content=c=>({text:clean(c?.text||(c?.runs||[]).filter(r=>r.type==='text').map(r=>r.text).join('')),media:(c?.media||[]).map(m=>({type:m.type,url:m.url}))});
export function extensionQuestionKey(publisher,q){
 return createHash('sha256').update(JSON.stringify({publisher:clean(publisher.name),grade:publisher.grade,subject:clean(publisher.subject),type:q.type,material:content(q.material),prompt:content(q.prompt),options:(q.options||[]).map(o=>JSON.stringify(content(o.content))).sort()})).digest('hex');
}
export async function createPastExtensionRewards({db,packet,minSeconds=2}){
 const keys=new Map();
 for(const entry of Object.values(packet.documents))for(const q of entry.document.blocks.flatMap(b=>b.questions)){
  const source=entry.sources.find(s=>s.normalizedQuestionId===q.id);if(!source)throw Error('extension_source_missing');
  const key=extensionQuestionKey(packet.publisher,q),previous=keys.get(q.id);
  if(previous&&previous.key!==key)throw Error('extension_question_identity_conflict');
  keys.set(q.id,{key,evidence:JSON.stringify({id:source.id,member:source.isoMember,sha256:source.sha256})});
 }
 await db.exec(`create schema if not exists past_extension_fixture;
 revoke all on schema past_extension_fixture from public,anon,authenticated;
 create table past_extension_fixture.sessions(session_id uuid primary key references public.quiz_sessions(id),user_id uuid not null,source_attempt uuid not null references public.quiz_past_attempts(id),source_version uuid not null,source_paper text not null,concept_id text not null,mode text not null,school_year integer not null,semester integer not null);
 create table past_extension_fixture.views(session_id uuid not null,question_id text not null,user_id uuid not null,seen_at timestamptz not null default clock_timestamp(),primary key(session_id,question_id,user_id));
 create table past_extension_fixture.completed(user_id uuid not null,school_year integer not null,semester integer not null,question_key text not null,attempt_id uuid not null references public.quiz_attempts(id),question_id text not null,evidence jsonb not null,created_at timestamptz not null default clock_timestamp(),primary key(user_id,school_year,semester,question_key));
 create table past_extension_fixture.leaves(user_id uuid not null,school_year integer not null,semester integer not null,ordinal integer not null,created_at timestamptz not null default clock_timestamp(),primary key(user_id,school_year,semester,ordinal));`);
 async function register({sessionId,uid,sourceAttempt,conceptId,mode,schoolYear=115,semester=1}){
  if(!Number.isInteger(schoolYear)||schoolYear<100||![1,2].includes(semester))throw Error('extension_term_invalid');
  const r=await db.query(`insert into past_extension_fixture.sessions select $1,$2,a.id,a.version_id,a.paper_id,$4,$5,$6,$7 from public.quiz_past_attempts a where a.id=$3 and a.user_id=$2 returning session_id`,[sessionId,uid,sourceAttempt,conceptId,mode,schoolYear,semester]);
  if(r.rows.length!==1)throw Error('practice_source_unavailable');
 }
 async function view(uid,sessionId,qid){
  await db.query(`insert into past_extension_fixture.views(session_id,question_id,user_id) select s.session_id,$2,s.user_id from past_extension_fixture.sessions s join public.quiz_sessions qs on qs.id=s.session_id join public.quiz_versions v on v.id=qs.version_id where s.session_id=$1 and s.user_id=$3 and exists(select 1 from jsonb_array_elements(v.document->'blocks') b,lateral jsonb_array_elements(b->'questions') q where q->>'id'=$2) on conflict do nothing`,[sessionId,qid,uid]);
 }
 async function ready(uid,sessionId,qid){
  // A saved answer may be resent without waiting; it cannot create another credit.
  const r=(await db.query(`select exists(select 1 from public.quiz_answers a join public.quiz_attempts at on at.id=a.attempt_id where at.session_id=$1 and at.user_id=$3 and a.question_id=$2) or exists(select 1 from past_extension_fixture.views where session_id=$1 and question_id=$2 and user_id=$3 and seen_at<=clock_timestamp()-($4*interval '1 second')) as ready`,[sessionId,qid,uid,minSeconds])).rows[0];return r.ready;
 }
 async function reconcile(uid,sessionId){
  return db.transaction(async tx=>{
   const s=(await tx.query('select * from past_extension_fixture.sessions where session_id=$1 and user_id=$2',[sessionId,uid])).rows[0];if(!s)throw Error('practice_session_unavailable');
   // Serialize awards at threshold across different sessions for this student/term.
   await tx.query('select id from auth.users where id=$1 for update',[uid]);
   const answers=(await tx.query(`select a.* from public.quiz_answers a join public.quiz_attempts at on at.id=a.attempt_id where at.session_id=$1 and at.user_id=$2`,[sessionId,uid])).rows;
   let added=0;
   for(const a of answers){const source=keys.get(a.question_id);if(!source)throw Error('extension_source_missing');
    const r=await tx.query(`insert into past_extension_fixture.completed(user_id,school_year,semester,question_key,attempt_id,question_id,evidence) values($1,$2,$3,$4,$5,$6,$7) on conflict do nothing returning question_key`,[uid,s.school_year,s.semester,source.key,a.attempt_id,a.question_id,source.evidence]);added+=r.rows.length;
   }
   const count=Number((await tx.query('select count(*) n from past_extension_fixture.completed where user_id=$1 and school_year=$2 and semester=$3',[uid,s.school_year,s.semester])).rows[0].n);
   const awarded=await tx.query(`insert into past_extension_fixture.leaves(user_id,school_year,semester,ordinal) select $1,$2,$3,n from generate_series(1,$4::integer) n on conflict do nothing returning ordinal`,[uid,s.school_year,s.semester,Math.floor(count/10)]);
   return {count,leaves:Math.floor(count/10),remainder:count%10,added,earnedNow:awarded.rows.length,schoolYear:s.school_year,semester:s.semester};
  });
 }
 async function summary(uid,schoolYear=115,semester=1){
  const counts=(await db.query(`select count(*) n from past_extension_fixture.completed where user_id=$1 and school_year=$2 and semester=$3`,[uid,schoolYear,semester])).rows[0];
  const leaves=(await db.query(`select ordinal,created_at from past_extension_fixture.leaves where user_id=$1 and school_year=$2 and semester=$3 order by ordinal`,[uid,schoolYear,semester])).rows;
  const history=(await db.query(`select school_year,semester,count(*)::integer count from past_extension_fixture.completed where user_id=$1 group by school_year,semester order by school_year,semester`,[uid])).rows;
  return {count:Number(counts.n),leaves:leaves.length,remainder:Number(counts.n)%10,awards:leaves,history,schoolYear,semester};
 }
 return {register,view,ready,reconcile,summary};
}
