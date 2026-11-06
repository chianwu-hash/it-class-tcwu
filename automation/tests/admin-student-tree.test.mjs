import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {setupProductionQuizDB} from '../fixtures/production-quiz-db.mjs';
import {splitSnapshot} from '../lib/db-snapshot.mjs';

// Import exact browser projection functions without initializing network/auth clients.
const cache=new Map();
async function browserModule(url){
 if(cache.has(url.href))return cache.get(url.href);
 let code=await fs.readFile(url,'utf8');
 if(/\/(homework|reading)-api\.js$/.test(url.pathname)||/\/quiz-rewards\.mjs$/.test(url.pathname))code=code.replace(/^import .*;\r?\n/gm,line=>/auth\.js|garden-unlock-notice|thumbnail-storage|quiz-api/.test(line)?'':line);
 for(const m of [...code.matchAll(/from (["'])(\.\/[^"']+)\1/g)])code=code.replace(m[0],`from '${await browserModule(new URL(m[2],url))}'`);
 const result='data:text/javascript;base64,'+Buffer.from(code).toString('base64');cache.set(url.href,result);return result;
}
const {teacherTreeModel,teacherTreeScene}=await import(await browserModule(new URL('../../shared/admin-student-tree-model.mjs',import.meta.url)));
const course='grade3-115-1';
const fixture=()=>({identity:{mapping:'linked',class_code:'301',seat_no:1,display_name:'合成同學'},as_of:'2026-11-06T08:00:00Z',
 weekly_rows:[],foundation:[],assignments:[],periods:[],quiz:{awards:[],flowers:[],partner:[]},rehearsal:[],unlocks:[],catalog:[],growth:null,skin:'a',choices:null});

test('教師模型沿用學生花葉 ID、來源與紀念圖，沒有資料就不假造花葉',()=>{
 const d=fixture();d.quiz.awards=[{id:'learning:115:1:1',source_type:'learning',grade:3,title:'延伸葉',half_units:2,awarded_at:d.as_of}];
 d.quiz.flowers=[{id:'past:abc',source_type:'past_exam',title:'考古卷',grade:3,paper_id:'paper',attempt_id:'attempt',awarded_at:d.as_of}];
 d.quiz.partner=[{id:'00000000-0000-4000-8000-000000000100',course,leaves:2,flowers:1,record:{title:'一起練'},at:d.as_of}];
 const before=JSON.stringify(d),m=teacherTreeModel(d,course);
 assert.equal(m.leaves.length,3);assert.equal(m.flowers.length,2);assert.equal(m.rewards.filter(r=>r.sourceType==='partner').length,3);
 assert(m.rewards.some(r=>r.id.includes('practice_learning:115:1:1')));assert(m.flowers.some(r=>r.sourceType==='past_exam'));
 assert.equal(new Set(m.rewards.map(r=>r.id)).size,m.rewards.length);assert.equal(JSON.stringify(d),before);
 assert.equal(teacherTreeModel(fixture(),course).rewards.length,0);
 assert.throws(()=>teacherTreeModel({...d,quiz:{awards:[]}},course),/invalid_tree_snapshot/);
});

test('只讀場景保留排序空位、保存寵物與樹型；不替學生升級或解鎖',()=>{
 const d=fixture(),model={stats:{leafCount:44,flowerCount:10,pastExamFlowerCount:0},rewards:[{id:'new',kind:'typing-leaf'}]};
 assert.equal(teacherTreeScene(d,model).level,1);assert.match(teacherTreeScene(d,model).warning,/待學生端同步/);
 d.growth={reward_version:2,foundation_reward_version:1,order:[{id:'old',kind:'typing-leaf'}]};
 d.skin='b';d.catalog=[{key:'pet:dog',pet:'dog',leaves:12}];d.choices={pet:'dog',homes:{dog:'c'},modes:{dog:'rest'}};
 assert.equal(teacherTreeScene(d,model).pet,null);
 d.unlocks=['pet:dog'];let s=teacherTreeScene(d,model);
 assert.equal(s.level,2);assert.equal(s.treeSkin,'b');assert.equal(s.pet,'dog');assert.equal(s.home,'a');assert.equal(s.homeVisible,true);
 assert.deepEqual(s.order.map(r=>r.id),['old','new']);assert.equal(d.growth.order.length,1);
 d.unlocks.push('home:dog:c');assert.equal(teacherTreeScene(d,model).home,'c');
 d.growth.reward_version=1;assert.equal(teacherTreeScene(d,model).level,1);assert.match(teacherTreeScene(d,model).warning,/同步/);
});

test('唯讀 SQL：教師權限、名冊隔離、來源查詢與所有學生資料不變',async t=>{
 const f=await setupProductionQuizDB(),{db,uid,as}=f;
 try{
 const blocks=splitSnapshot(await fs.readFile('supabase/production-snapshot/functions.sql','utf8'));
 for(const name of ['quiz_session_class_allowed(uuid,text)','admin_learning_rewards(text,text,jsonb)'])await db.exec(blocks.find(b=>b.signature===name).definition+';');
 await db.exec(await fs.readFile('supabase/admin-learning-tree.sql','utf8'));
 for(const [n,email]of [[1,'teacher@example.invalid'],[2,'student@example.invalid'],[3,'other@example.invalid'],[4,'conflict@example.invalid'],[5,'CONFLICT@example.invalid']])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[uid(n),email]);
 await db.exec(`insert into public.student_enrollments(school_year,email,class_code,seat_no,display_name) values
 (115,'student@example.invalid','301',1,'合成甲'),(115,'other@example.invalid','603',1,'合成乙'),
 (115,'missing@example.invalid','301',2,'未連結'),(115,'conflict@example.invalid','301',3,'衝突');`);
 await db.query("insert into public.student_progress(user_id,course_id,week_code,activity_key,current_level,completed) values($1,$2,'09','practice',1,true)",[uid(2),course]);
 await db.exec('insert into public.quiz_learning_settings(id,school_year,semester,enabled) values(true,115,1,true)');
 await db.query('insert into public.quiz_learning_leaves(user_id,school_year,semester,ordinal) values($1,115,1,1),($2,115,1,1)',[uid(2),uid(3)]);
 await db.query(`insert into partner_pilot.awards(content_key,member_key,members,room_id,leaves,flowers,record,course_id,school_year,semester)
  values('synthetic','pair',array[$1::uuid],gen_random_uuid(),1,0,'{"title":"合成紀念","private":"其他隊員的內容不應外洩"}',$2,115,1)`,[uid(2),course]);
 const read=async(n,p={class_code:'301',seat_no:1},c=course,role='authenticated')=>{await as(n,role);try{return(await db.query("select public.admin_learning_tree('tree_snapshot',$1,$2) data",[c,p])).rows[0].data;}finally{await db.exec('reset role');}};
 const fingerprint=async()=>{const rows=(await db.query("select schemaname,tablename from pg_tables where schemaname in ('public','partner_pilot') order by 1,2")).rows;
  return JSON.stringify(await Promise.all(rows.map(async r=>[r.schemaname,r.tablename,(await db.query(`select coalesce(jsonb_agg(x order by x::text),'[]') items from (select to_jsonb(t) x from "${r.schemaname}"."${r.tablename}" t) s`)).rows[0].items])));};
 await t.test('匿名無權執行；學生與其他帳號無權讀取',async()=>{await assert.rejects(read(null,undefined,course,'anon'),/permission denied/);await assert.rejects(read(2),/teacher_required/);});
 await t.test('參數與名冊都在伺服器驗證，拒絕指定 UUID 與跨年級',async()=>{await assert.rejects(read(1,{class_code:'301',seat_no:1,user_id:uid(3)}),/invalid_request/);await assert.rejects(read(1,{class_code:'603',seat_no:1}),/invalid_class/);await assert.rejects(read(1,{class_code:'301',seat_no:99}),/student_unavailable/);for(const seat_no of[2,3])await assert.rejects(read(1,{class_code:'301',seat_no}),/student_unavailable/);});
 await t.test('正向讀取可還原模型、不外洩 UID 或其他人的紀錄，前後整庫內容一致',async()=>{
  const before=await fingerprint(),d=await read(1);assert.equal(d.identity.display_name,'合成甲');assert.equal(d.weekly_rows.length,1);assert.equal(d.growth,null);
  assert.equal(d.quiz.awards.length,1);assert.equal(d.quiz.partner.length,1);assert.equal(d.quiz.partner[0].record.title,'合成紀念');assert.equal(d.quiz.partner[0].record.private,undefined);
  assert(!JSON.stringify(d).includes(uid(2)));assert(!JSON.stringify(d).includes('example.invalid'));assert(Array.isArray(d.catalog));teacherTreeModel(d,course);
  await db.query("insert into public.garden_growth(user_id,course_id,grown_at,baseline,reward_order,reward_version,foundation_reward_version) values($1,$2,now(),'[]','[]',2,1)",[uid(2),course]);
  const withGrowth=await fingerprint();const loaded=await read(1);assert.equal(loaded.growth.reward_version,2);assert.equal(await fingerprint(),withGrowth);
  await db.query('delete from public.garden_growth where user_id=$1',[uid(2)]);assert.equal(await fingerprint(),before);
 });
 }finally{await db.close();}
});
