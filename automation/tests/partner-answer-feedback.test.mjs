import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {setupMatchDB} from '../fixtures/partner-match-db.mjs';
import {answerFeedback,feedbackExplanation,revealedPastChoice} from '../../shared/partner-pilot/answer-feedback.mjs';
const q={id:7,past:{kind:'single',choices:[{id:'2',text:'水庫儲水'},{id:'3',text:'讓船浮在水面'}]},pastReference:'3',correct:0,attempts:[{value:'2',correct:false}],explanation:'參考："3"\n水有浮力。'};
test('正解使用伺服器原始ID；忽略考古題佔位correct=0，不猜未揭露答案',()=>{
 assert.deepEqual(revealedPastChoice(q),{index:1,id:'3'});assert.equal(revealedPastChoice({...q,pastReference:3}),null);
 const hidden={...q};delete hidden.pastReference;assert.equal(revealedPastChoice(hidden),null);
 const fragment=(q,p,i)=>p==='option'?q.past.choices[i].text:'解析',esc=s=>s;
 const html=answerFeedback(q,{fragment,esc});assert.match(html,/data-feedback-state="incorrect"/);assert.match(html,/3・讓船浮在水面/);assert.doesNotMatch(html,/2・水庫/);
 assert.equal(feedbackExplanation(q).text,'水有浮力。');assert.equal(feedbackExplanation({...q,explanation:'參考："2"\n保留原文'}).text,'參考："2"\n保留原文');
 assert.match(answerFeedback({...q,attempts:[{correct:true,value:'3'}]},{fragment,esc}),/data-feedback-state="correct"/);
 assert.match(answerFeedback({...q,past:{...q.past,selfCheck:true},attempts:[{correct:null,value:'2'}]},{fragment,esc}),/不自動判分/);
 assert.equal(answerFeedback({...q,attempts:[]},{fragment,esc}),'');
 const rich={text:q.explanation,media:[{kind:'image',url:'synthetic-only'}]};assert.deepEqual(feedbackExplanation({...q,rich:{explanation:rich}}).media,rich.media);
 assert.equal(feedbackExplanation({...q,rich:{explanation:{...rich,layout:[{type:'paragraph',runs:[]}]}}}).text,rich.text);
 const tf={...q,past:{kind:'single',choices:[{id:'O',text:'O'},{id:'X',text:'X'}]},pastReference:'O'};
 assert.match(answerFeedback(tf,{fragment,esc}),/○ 正確/);assert.doesNotMatch(answerFeedback(tf,{fragment,esc}),/O・O/);
});
test('新增參考值沿用揭答界線、會員權限、媒體wrapper、歷次作答及評分',async()=>{
 const f=await setupMatchDB(),{db,call}=f;try{
 await db.exec(await fs.readFile('supabase/quiz-partner-answer-feedback.sql','utf8'));
 const acl=(await db.query("select has_function_privilege('authenticated','partner_pilot.learning_snapshot(uuid)','execute') ok")).rows[0];assert.equal(acl.ok,false);
 await f.form([2,3]);let s=await call(2,{action:'status'}),host=Number(s.team.host.slice(-12));let leader=await call(host,{action:'status'});const args=s=>({ticket:s.ticket,teamId:s.team.id,revision:s.team.revision});
 leader=await call(host,{action:'select',paper:f.ten.paper,...args(leader)});const active=await call(host,{action:'start',...args(leader)}),rid=active.roomId;
 // Synthetic imported past questions; preserve existing room, allocation and paper.
 await db.query(`update partner_pilot.question_bank set past_meta=$1,past_config=$1,past_answer='"3"',options='["水庫儲水","讓船浮在水面"]',explanation='參考："3"',rich='{}' where id in(select qid from partner_pilot.paper_items where paper_id=$2)`,[{kind:'single',choices:q.past.choices},f.ten.paper]);
 const snap=n=>call(n,{action:'snapshot',roomId:rid},true);let a=await snap(2),b=await snap(3);assert(a.exercise.mine.every(q=>!('pastReference'in q)));const mine=a.exercise.mine[0],other=b.exercise.mine[0];
 await call(3,{action:'ask',roomId:rid,qid:other.id,text:'一起想'},true);a=await snap(2);assert(a.exercise.shared.some(q=>q.id===other.id));assert(a.exercise.shared.every(q=>!('pastReference'in q)));
 a=await call(2,{action:'answer',roomId:rid,qid:mine.id,expectedAttempt:0,value:'2'},true);let answered=a.exercise.mine.find(q=>q.id===mine.id);assert.equal(answered.pastReference,'3');assert.equal(answered.attempts.at(-1).correct,false);assert(a.exercise.notes.every(n=>Array.isArray(n.attachments)));
 await assert.rejects(()=>snap(4),/NOT_MEMBER/);
 for(const n of[2,3]){const s=await snap(n);for(const x of s.exercise.mine)if(!x.attempts.length)await call(n,{action:'answer',roomId:rid,qid:x.id,expectedAttempt:0,value:'3'},true);}
 a=await snap(2);assert(a.exercise.reviewOpen);assert(a.exercise.shared.every(q=>q.pastReference==='3'));
 a=await call(2,{action:'answer',roomId:rid,qid:mine.id,expectedAttempt:1,value:'3'},true);answered=a.exercise.mine.find(q=>q.id===mine.id);assert.deepEqual(answered.attempts.map(x=>x.correct),[false,true]);assert.equal(a.exercise.correct,10);
 }finally{await db.close();}
});
