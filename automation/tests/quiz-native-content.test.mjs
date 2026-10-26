import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {newDocument,validateDocument} from '../../shared/quiz-document.mjs';
import {createQuizDb,quizCall,TEACHER,studentId} from '../lib/quiz-local-db.mjs';
import {createLocalMedia,fixturePng} from '../lib/quiz-local-media.mjs';

const png='https://quiz-fixture.example.invalid/native.png';
function fixture(){
 const d=newDocument(),q=d.blocks[0].questions[0];
 q.prompt={text:'原圖中的數量是多少？',media:[{kind:'image',url:png,alt:'數量原圖'}],layout:[{type:'paragraph',runs:[{type:'text',text:'原圖中的數量是多少？'},{type:'image',media_index:0,width:120}]}]};
 q.explanation={text:'千位 百位 3 0 原解析',media:[{kind:'image',url:png,alt:'解析原圖'}],layout:[{type:'table',rows:[[[{type:'text',text:'千位'}],[{type:'text',text:'百位'}]],[[{type:'text',text:'3'}],[{type:'text',text:'0'}]]]},{type:'paragraph',runs:[{type:'text',text:'原解析'},{type:'image',media_index:0,width:20}]}]};
 return d;
}
test('原圖圖文格式：前後端同時拒絕錯誤索引、任意HTML欄位及不規則表格',async()=>{
 const d=fixture();validateDocument(d);const db=await createQuizDb();
 try{
  const accepted=await db.query('select public.quiz_valid_content($1::jsonb) ok',[JSON.stringify(d.blocks[0].questions[0].explanation)]);assert.equal(accepted.rows[0].ok,true);
  const boundary={text:'邊界',media:[],layout:[{type:'paragraph',runs:[{type:'text',text:'字'.repeat(20000)}]}]};
  const edge=structuredClone(d);edge.blocks[0].questions[0].explanation=boundary;validateDocument(edge);
  assert.equal((await db.query('select public.quiz_valid_content($1::jsonb) ok',[JSON.stringify(boundary)])).rows[0].ok,true);
  const invalid=[];
  let c=structuredClone(d.blocks[0].questions[0].explanation);c.layout[1].runs[1].media_index=3;invalid.push(c);
  c=structuredClone(d.blocks[0].questions[0].explanation);c.layout[0].html='<script>alert(1)</script>';invalid.push(c);
  c=structuredClone(d.blocks[0].questions[0].explanation);c.layout[0].rows[1].pop();invalid.push(c);
  c=structuredClone(d.blocks[0].questions[0].explanation);c.layout[1].runs[1].width=9000;invalid.push(c);
  c=structuredClone(d.blocks[0].questions[0].explanation);c.layout=null;invalid.push(c);
  c=structuredClone(boundary);c.layout[0].runs[0].text+='字';invalid.push(c);
  for(const bad of invalid){const copy=structuredClone(d);copy.blocks[0].questions[0].explanation=bad;assert.throws(()=>validateDocument(copy));assert.equal((await db.query('select public.quiz_valid_content($1::jsonb) ok',[JSON.stringify(bad)])).rows[0].ok,false);}
 }finally{await db.close();}
});
test('原圖與原生表格：固定版本保留結構，送答前無解析／表格／圖片授權',async()=>{
 const db=await createQuizDb(),directory=await mkdtemp(join(tmpdir(),'quiz-native-'));
 const priorHosts=process.env.QUIZ_MEDIA_SOURCE_HOSTS;process.env.QUIZ_MEDIA_SOURCE_HOSTS='native.example.test';
 const media=createLocalMedia({db,directory,origin:'http://127.0.0.1:4340',sourceFetch:async url=>new Response(url.endsWith('explanation.png')?Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'):fixturePng,{headers:{'Content-Type':'image/png'}})});
 const call=(user,action,data)=>quizCall(db,user,action,data);
 try{
  const d=fixture();
  // 解析使用另一張圖，避免與已公開題幹相同檔案的合法重用混淆。
  d.blocks[0].questions[0].prompt.media[0].url='https://native.example.test/question.png';
  d.blocks[0].questions[0].explanation.media[0].url='https://native.example.test/explanation.png';
  const bank=crypto.randomUUID();await call(TEACHER,'save',{bank_id:bank,expected_revision:0,document:d});
  const v=await media.call({action:'freeze',data:{bank_id:bank,expected_revision:1}});assert.equal(v.status,200);
  assert.deepEqual(v.result.document.blocks[0].questions[0].explanation.layout,d.blocks[0].questions[0].explanation.layout);
  const session={session_id:crypto.randomUUID(),version_id:v.result.id,school_year:115,class_codes:['603'],reveal:'complete',shuffle_questions:false,shuffle_options:false};await call(TEACHER,'open',session);
  const before=await call(studentId(1),'join',session);assert.equal(before.reviews.length,0);assert.equal('explanation'in before.document.questions[0],false);
  const url=v.result.document.blocks[0].questions[0].explanation.media[0].url;
  assert.equal((await media.call({action:'read',url,attempt_id:before.attempt_id},'student-1')).status,400);
  const result=await call(studentId(1),'submit',{session_id:session.session_id,question_id:d.blocks[0].questions[0].id,response:'b',request_id:crypto.randomUUID()});
  assert.equal(result.complete,true);assert.equal(result.reviews[0].correct,false);assert.deepEqual(result.reviews[0].explanation.layout,d.blocks[0].questions[0].explanation.layout);
  const saved=await call(studentId(1),'resume',session);assert.deepEqual(saved.reviews,result.reviews);
  assert.equal((await media.call({action:'read',url,attempt_id:before.attempt_id},'student-1')).status,200);
 }finally{if(priorHosts===undefined)delete process.env.QUIZ_MEDIA_SOURCE_HOSTS;else process.env.QUIZ_MEDIA_SOURCE_HOSTS=priorHosts;await db.close();await rm(directory,{recursive:true,force:true});}
});
