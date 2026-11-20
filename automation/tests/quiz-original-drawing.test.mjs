import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {validateDrawing} from '../../shared/drawing/contract.mjs';import {validateSketch} from '../../shared/sketch/contract.mjs';import {setupProductionQuizDB} from '../fixtures/production-quiz-db.mjs';
const line={kind:'line',points:[[.1,.2],[.8,.9]],color:'#2459b3',width:.005},text={kind:'text',at:[.2,.4],text:'半徑3公分 <svg>',color:'#185e60',size:.04},sector={kind:'sector',center:[.5,.5],radius:.2,angle:160,rotation:0,color:'#b83246',width:.005,fill:false};
const valid=marks=>({version:2,strokes:[],marks});
test('原圖圖形契約：前後端一致、原v1保持、原生回應完整保存（隔離資料庫）',async t=>{
 const {db}=await setupProductionQuizDB({snapshot:true});try{
 const legacy={version:1,strokes:[[[.1,.2],[.5,.6]]]},original=(await db.query('select public.quiz_sketch_valid($1) ok',[legacy])).rows[0].ok;assert.equal(original,true);
 const sql=await fs.readFile('supabase/quiz-original-drawing.sql','utf8');await db.exec(sql);
 const cases=[legacy,valid([line]),valid([text,sector]),valid([{...line,kind:'polygon',points:[[0,0],[1,0],[.5,1]],fill:true}]),valid([{...line,kind:'ellipse',fill:false}]),{version:2,strokes:[[[0,0],[1,1]]],colors:['#e0b000'],marks:[]}];
 await t.test('六類圖形與舊筆跡不丟失文字、顏色、座標',async()=>{for(const v of cases){assert.equal(validateSketch(v),v);assert.equal((await db.query('select public.quiz_sketch_valid($1) ok',[v])).rows[0].ok,true);const q={type:'open',fields:[{id:'figure',input:'sketch'},{id:'note',input:'text'}]},raw=JSON.stringify({v:1,f:{figure:v,note:'保留自己的觀察'}});assert.deepEqual((await db.query('select public.quiz_open_response($1,$2) value',[q,raw])).rows[0].value,{figure:v,note:'保留自己的觀察'});}});
 await t.test('未知鍵、注入、非有限值、精度、字數與容量界線拒絕',async()=>{
  const bad=[valid([]),{...valid([line]),extra:1},valid([{...line,color:'url(javascript:x)'}]),valid([{...line,points:[[.1234567,0],[1,1]]}]),valid([{...line,points:[[0,0],[1.1,1]]}]),valid([{...line,points:[[0,0],['1',1]]}]),valid([{...line,extra:1}]),valid([{...text,text:'a'.repeat(41)}]),valid([{...text,text:'\u0085'}]),valid([{...text,size:1}]),valid([{...sector,angle:361}]),valid([{...sector,angle:0}]),valid([{...sector,radius:0}]),valid([{...sector,rotation:-1}]),valid([{...sector,fill:'true'}]),valid(Array(81).fill(line)),{...valid([line]),colors:['#2459b3']}];
  for(const v of bad){assert.throws(()=>validateDrawing(v));assert.equal((await db.query('select public.quiz_sketch_valid($1) ok',[v])).rows[0].ok,false,JSON.stringify(v));}
 });
 await t.test('80個標記、40字與6位小數接受',async()=>{const v=valid(Array.from({length:80},()=>({...text,text:'字'.repeat(40),at:[.123456,1]})));validateDrawing(v);assert.equal((await db.query('select public.quiz_sketch_valid($1) ok',[v])).rows[0].ok,true);});
 await t.test('重複安裝受基準保護；沒有擴大匿名或學生直接呼叫權限',async()=>{await assert.rejects(db.exec(sql),/drawing_validator_source_changed/);await db.exec('rollback');for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select public.quiz_sketch_valid($1)',[valid([line])]),/permission denied/);await db.exec('reset role');}});
 }finally{await db.close();}
});
