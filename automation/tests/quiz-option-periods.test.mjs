import test from 'node:test';
import assert from 'node:assert/strict';
import {terminalOptionPeriodCandidate,finalOptionPeriodProjection,optionPeriodSignature} from '../../shared/quiz-option-periods.mjs';
import {auditFinalOptionPeriods} from '../audit-option-periods.mjs';
import {partnerChoicePresentation} from '../../shared/partner-pilot/choice-presentation.mjs';
const content=text=>({text,media:[]});
const fixture=()=>({id:'synthetic-final-term',type:'single',prompt:content('下列哪一個是國家名稱？'),options:['甲國','乙國','丙國','丁國。'].map((s,i)=>({id:'o'+i,content:content(s)})),answer:{option_id:'o3'}});
const group=q=>({id:'$single',input:'single',options:q.options});
const registry=q=>({[q.id]:[{field:'$single',guard:optionPeriodSignature(q,group(q)),optionId:'o3'}]});
test('only an audited final-range bank changes, preserving source, IDs, keys and option order',()=>{
 const q=fixture(),before=structuredClone(q),r=registry(q),view=finalOptionPeriodProjection(q,r);
 assert.equal(view.options[3].content.text,'丁國');assert.deepEqual(q,before);assert.deepEqual(view.answer,before.answer);assert.deepEqual(view.options.map(o=>o.id),before.options.map(o=>o.id));
 assert.equal(finalOptionPeriodProjection(q,{}),q);assert.equal(finalOptionPeriodProjection({...q,id:'midterm'},r).options[3].content.text,'丁國。');assert.equal(finalOptionPeriodProjection(view,r),view);
});
test('shuffled display follows the original option ID rather than the last displayed position',()=>{
 const q=fixture(),r=registry(q);q.options=[q.options[3],q.options[1],q.options[0],q.options[2]];
 const view=finalOptionPeriodProjection(q,r);assert.equal(view.options[0].id,'o3');assert.equal(view.options[0].content.text,'丁國');assert.deepEqual(view.answer,q.answer);
});
test('any changed bank, prompt, field label or option ID fails closed',()=>{
 const q=fixture(),r=registry(q);for(const mutate of [x=>x.options[0].content.text='別國',x=>x.prompt.text='標點如何使用？',x=>x.options[3].id='new-id']){const x=structuredClone(q);mutate(x);assert.equal(finalOptionPeriodProjection(x,r),x);}
});
test('complete sentences, quotations, punctuation tasks, decimal points and multiple periods are retained',()=>{
 for(const [prompt,options]of [['哪個句子的標點正確？',['甲','乙','丙','丁。']],['選出正確答案',['人在家','鳥在飛','魚在游','狗在跑。']],['選出正確答案',['「甲」','「乙」','「丙」','「丁」。']],['選出正確答案',['1.2','2.3','3.4','4.5.']],['選出正確答案',['甲。','乙。','丙。','丁。']]]){const q=fixture();q.prompt=content(prompt);q.options.forEach((o,i)=>o.content=content(options[i]));assert.notEqual(terminalOptionPeriodCandidate(q,group(q)).status,'candidate');assert.equal(finalOptionPeriodProjection(q,registry(q)),q);}
});
test('numeric quantities retain decimals and units, removing only the Chinese terminal period',()=>{
 const q=fixture();q.prompt=content('總重量是多少？');q.options.forEach((o,i)=>o.content=content(['1.25 公斤','2.5 公斤','3 公斤','4.75 公斤。'][i]));
 assert.equal(terminalOptionPeriodCandidate(q,group(q)).kind,'numeric_quantity');assert.equal(finalOptionPeriodProjection(q,registry(q)).options[3].content.text,'4.75 公斤');
});
test('a stem mentioning a sentence must not exclude character-valued spelling choices',()=>{
 const q=fixture();q.prompt=content('句子中哪個字是錯誤的？');q.options.forEach((o,i)=>o.content=content(['桶','網','愈','硬。'][i]));
 assert.equal(terminalOptionPeriodCandidate(q,group(q)).status,'candidate');assert.equal(finalOptionPeriodProjection(q,registry(q)).options[3].content.text,'硬');
 q.options.forEach((o,i)=>o.content=content(['的','得','地','是。'][i]));assert.equal(finalOptionPeriodProjection(q,registry(q)).options[3].content.text,'是');
 q.prompt=content('句子中哪個字應加引號？');assert.equal(finalOptionPeriodProjection(q,registry(q)),q);
 q.prompt=content('句子中哪個字是錯誤的？');q.options.forEach((o,i)=>o.content=content(['人在家','鳥在飛','魚在游','狗在跑。'][i]));assert.equal(finalOptionPeriodProjection(q,registry(q)),q);
});
test('rich runs keep styles, spaces and source bytes; media and mismatched text are retained',()=>{
 const q=fixture();q.options[3].content={text:'丁國。 ',media:[],layout:[{type:'paragraph',align:'left',runs:[{type:'text',text:'丁國',bold:true},{type:'text',text:'。 ' }]}]};const original=structuredClone(q),view=finalOptionPeriodProjection(q,registry(q));
 assert.equal(view.options[3].content.text,'丁國 ');assert.deepEqual(view.options[3].content.layout[0].runs,[{type:'text',text:'丁國',bold:true},{type:'text',text:' '}]);assert.deepEqual(q,original);
 q.options[3].content.media=[{kind:'image',url:'https://example.invalid/img'}];assert.notEqual(terminalOptionPeriodCandidate(q,group(q)).status,'candidate');
});
test('fields preserve raw response values; non-single controls are never opted in',()=>{
 const source=fixture(),q={id:'synthetic-fields',type:'fields',prompt:source.prompt,fields:[{id:'f1',input:'single',label:'國家名稱',options:source.options},{id:'f2',input:'text',label:'理由'}],answer:{fields:{f1:['o3'],f2:['其他']}}};
 const r={[q.id]:[{field:'f1',guard:optionPeriodSignature(q,q.fields[0]),optionId:'o3'}]},raw=JSON.stringify({v:1,f:{f1:'o3',f2:'我的理由'}}),view=finalOptionPeriodProjection(q,r);
 assert.equal(view.fields[0].options[3].content.text,'丁國');assert.deepEqual(view.answer,q.answer);assert.equal(raw,JSON.stringify({v:1,f:{f1:'o3',f2:'我的理由'}}));assert.equal(view.fields[1],q.fields[1]);
 q.fields[0].input='set';assert.equal(finalOptionPeriodProjection(q,r),q);
});
test('audit rejects midterm, unknown scope and non-terminal source punctuation',()=>{
 const courses=[{id:'115-1-kang-g3-ch',grade:3,definition:{subject:'國語',publisher:'康軒',volume:'3年級上學期'}}];
 const make=(id,unit)=>({question_id:id,course_id:courses[0].id,unit_ids:[unit],question:{...fixture(),id}});
 const pool=[make('final',7),make('before',1),make('unknown',99),make('reordered',7)];pool[3].question.options.reverse();
 const {registry:r,report}=auditFinalOptionPeriods({courses,pool});assert.deepEqual(Object.keys(r),['final']);assert.equal(report.sourceMutations,0);assert.equal(report.responseContractChanges,0);assert.equal(report.idempotenceFailures,0);
});
test('unregistered partner papers remain identical, including zero-based response indices',()=>{
 const q={id:999999,options:['甲國','乙國','丙國','丁國。'],text:'合成選項',rich:{}};const view=partnerChoicePresentation(q);assert.equal(view.options[3],'丁國。');assert.deepEqual(q.options,['甲國','乙國','丙國','丁國。']);
});
