import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {setupMatchDB} from '../fixtures/partner-match-db.mjs';
import {newDocument,newQuestion,content} from '../../shared/quiz-document.mjs';
test('候配整隊權限、私人自組卷與不可切割考古題組',async t=>{
 const f=await setupMatchDB(),{db,call,uid}=f,args=s=>({ticket:s.ticket,teamId:s.team.id,revision:s.team.revision});
 const clear=()=>db.exec("delete from partner_pilot.match_presence;update partner_pilot.match_batches set closed=true;update partner_pilot.match_teams set phase='closed' where phase='selecting'");
 const self=new Map();
 try{
 for(let n=2;n<=5;n++){
  const doc=structuredClone(f.twenty.document),bank=crypto.randomUUID(),version=crypto.randomUUID(),session=crypto.randomUUID();doc.title='合成私卷'+n;
  await db.query('insert into public.quiz_banks(id,owner_id,draft) values($1,$2,$3)',[bank,uid(n),doc]);await db.query('insert into public.quiz_versions(id,bank_id,revision,document) values($1,$2,1,$3)',[version,bank,doc]);
  await db.query("insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode) values($1,$2,$3,115,$4,'immediate',false,true,'self')",[session,uid(n),version,JSON.stringify(['30'+(n%7+1)])]);
  await db.query('insert into public.quiz_generated_papers(session_id,user_id,request_id,config,actual_distribution,display_name) values($1,$2,$3,$4,$5,$6)',[session,uid(n),crypto.randomUUID(),{kind:'self',count:20},{},doc.title]);self.set(n,{session,doc});
 }
 await t.test('只有隊長自己的私卷出現在候配清單，跨班隊友不取得原私卷',async()=>{
  await f.form([2,3,4,5]);const s=await call(2,{action:'status'}),host=Number(s.team.host.slice(-12)),leader=await call(host,{action:'status'}),other=[2,3,4,5].find(n=>n!==host);
  const catalog=await call(host,{action:'catalog',...args(leader)});assert(catalog.papers.some(p=>p.id==='self:'+self.get(host).session));assert(!catalog.papers.some(p=>p.id==='self:'+self.get(other).session));
  await assert.rejects(call(host,{action:'select',paper:'self:'+self.get(other).session,...args(leader)}),/MATCH_PAPER_UNAVAILABLE/);
  const selected=await call(host,{action:'select',paper:'self:'+self.get(host).session,...args(leader)});
  const canonical=(await db.query('select partner_pilot.match_self_key($1,3) k',[self.get(host).doc])).rows[0].k;
  const started=await call(host,{action:'start',...args(selected)});assert.equal(started.phase,'active');
  const paper=(await db.query('select p.* from partner_pilot.rooms r join partner_pilot.papers p on p.id=r.paper where r.id=$1',[started.roomId])).rows[0];assert.equal(paper.content_key,canonical);assert.equal(paper.origin,'self');assert.equal(paper.owner_id,uid(host));
  for(const n of[2,3,4,5])assert.equal((await call(n,{action:'snapshot',roomId:started.roomId},true)).exercise.mine.length,5);
  assert.equal((await db.query('select class_codes from public.quiz_sessions where id=$1',[self.get(host).session])).rows[0].class_codes.length,1);
 });
 let pastId,source,version;
 await t.test('考古卷按獨立題／題組包數檢查；十題四包可四人、只有一包不可以',async()=>{
  await clear();source='synthetic-past';version=crypto.randomUUID();pastId='synthetic-packed';const sha='a'.repeat(64),weights=[4,3,2,1],doc={groups:Array.from({length:10},(_,i)=>({id:'g'+i,fields:[{id:'f'+i,label:String(i+1),points:1}]}))};let start=0;const packs=weights.map((weight,i)=>{const p={id:'unit'+i,weight,fields:Array.from({length:weight},(_,j)=>({id:'f'+(start+j),group:'g'+(start+j)}))};start+=weight;return p;});
  await db.query('insert into public.quiz_past_papers(id,owner_id,grade,school_year,semester,title,active_version,enabled) values($1,$2,3,115,1,$1,$3,true)',[source,uid(1),version]);
  await db.query('insert into public.quiz_past_versions(id,paper_id,sha256,document,provenance) values($1,$2,$3,$4,$5)',[version,source,sha,doc,{}]);
  await db.query("insert into partner_pilot.papers(id,title,grade,subject,kind,total,content_key,source_version,is_real,past_meta) values($1,'合成題組卷',3,'自然','flower',10,$1,$2,true,$3)",[pastId,version,{sourcePaper:source}]);
  for(let i=0;i<10;i++){const qid=(await db.query("insert into partner_pilot.question_bank(id,title,prompt,options,correct,explanation,past_meta,past_config,past_answer) values(nextval('partner_pilot.self_question_id'),'合成題','條件','[\"甲\",\"乙\"]',0,'解析',$1,$2,$3) returning id",[{kind:'single',sourceKind:'single',group:'g'+i,label:'原題・'+(i+1),points:1,selfCheck:false},{kind:'single',choices:[{id:'a'},{id:'b'}]},JSON.stringify('a')])).rows[0].id;await db.query('insert into partner_pilot.paper_items values($1,$2,$3)',[pastId,i+1,qid]);}
  await db.query('insert into partner_pilot.allocation_specs values($1,$2,$3,$4)',[version,source,sha,{version,paper:source,sha256:sha,packs}]);
  assert.equal((await db.query('select partner_pilot.match_paper_ok($1,$2,$3) ok',[pastId,[2,3,4,5].map(uid),uid(2)])).rows[0].ok,true);
  const original=(await db.query('select plan from partner_pilot.allocation_specs where version=$1',[version])).rows[0].plan;
  await db.query('update partner_pilot.allocation_specs set plan=$1 where version=$2',[{...original,packs:[{id:'all',weight:10,fields:packs.flatMap(p=>p.fields)}]},version]);
  assert.equal((await db.query('select partner_pilot.match_paper_ok($1,$2,$3) ok',[pastId,[uid(2),uid(3)],uid(2)])).rows[0].ok,false);
  await db.query('update partner_pilot.allocation_specs set plan=$1 where version=$2',[original,version]);
  await f.form([2,3,4,5]);const s=await call(2,{action:'status'}),host=Number(s.team.host.slice(-12));let leader=await call(host,{action:'status'});leader=await call(host,{action:'select',paper:pastId,...args(leader)});const active=await call(host,{action:'start',...args(leader)});
  assert.equal((await db.query('select count(*)::int n from (select unit_id from partner_pilot.allocations where room_id=$1 group by unit_id having count(distinct user_id)>1) x',[active.roomId])).rows[0].n,0);
  const counts=(await db.query('select count(*)::int n from partner_pilot.allocations where room_id=$1 group by user_id order by n desc',[active.roomId])).rows.map(r=>r.n);assert.deepEqual(counts,[4,3,2,1]);
 });
 await t.test('補入新增老師卷索引可重跑，不改舊題鍵及原卷，四／九年級也按年級開放',async()=>{
  await clear();await f.teacher(10,4,false);await f.teacher(10,9,false);const before=(await db.query('select jsonb_agg(to_jsonb(p) order by id) x from partner_pilot.papers p')).rows[0].x;
  await db.exec(await fs.readFile('supabase/quiz-partner-sync-teacher-library.sql','utf8'));await db.exec(await fs.readFile('supabase/quiz-partner-sync-teacher-library.sql','utf8'));
  const after=(await db.query('select jsonb_agg(to_jsonb(p) order by id) x from partner_pilot.papers p')).rows[0].x;assert.equal(after.length,before.length+2);assert.deepEqual(after.filter(p=>before.some(b=>b.id===p.id)),before);
 });
 }finally{await db.close();}
});
