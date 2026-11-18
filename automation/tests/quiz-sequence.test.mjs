import test from 'node:test';
import assert from 'node:assert/strict';
import {completeSequence,initialSequence,moveSequence,sequenceReference} from '../../shared/quiz-sequence-model.mjs';
import {fieldPresentation,fieldsPromptPresentation} from '../../shared/quiz-fields-presentation.mjs';
import {explanationReferencePresentation,explanationReferenceContent} from '../../shared/quiz-explanation-references.mjs';
const field={id:'f1',label:'排序',input:'sequence',options:['a','b','c'].map(id=>({id,content:{text:id,media:[]}}))};
test('讀回既有順序與部分草稿，不改原陣列或把來源順序寫入答案',()=>{
 const saved=['c','a','b'],before=[...saved];assert(completeSequence(field,saved));assert.deepEqual(initialSequence(field,saved),saved);assert.deepEqual(saved,before);
 const partial=['','c',''];assert.deepEqual(initialSequence(field,partial),['a','c','b']);assert.deepEqual(partial,['','c','']);assert(!completeSequence(field,partial));assert(!completeSequence(field,['a','a','b']));assert(!completeSequence(field,['a','b','unknown']));assert.deepEqual(initialSequence(field,null),['a','b','c']);
});
test('移動只變排列，保留原ID與來源；越界或未知項目不更動',()=>{
 const order=['a','b','c'];assert.deepEqual(moveSequence(order,'a',2),['b','c','a']);assert.deepEqual(order,['a','b','c']);assert.strictEqual(moveSequence(order,'a',-1),order);assert.strictEqual(moveSequence(order,'missing',1),order);assert.strictEqual(moveSequence(order,'a',0),order);
});
test('回顧依完整可接受順序核對，不混合多個答案，也不改判分',()=>{
 const accepted=[['a','b','c'],['c','b','a']],before=structuredClone(accepted);
 assert.deepEqual(sequenceReference(field,['c','b','a'],accepted),accepted[1]);assert.deepEqual(sequenceReference(field,['c','a','b'],accepted),accepted[1]);assert.equal(sequenceReference(field,['a','a','c'],accepted),null);assert.deepEqual(accepted,before);
});
test('已核排序題移除重複選項與紙本空格，保留原題、欄位與媒體',()=>{
 const options=Array.from({length:6},(_,i)=>({id:'o'+i,content:{text:String.fromCodePoint(0x2460+i)+' 句子'+i,media:[]}}));
 const q={id:'kxg3ch_ECH1505004444_v677084c12fb1',type:'fields',prompt:{text:'排一排（寫代號）：\n'+options.map(o=>o.content.text).join('\n')+'\n↓（　）（　）（　）（　）（　）（　）',media:[]},fields:[{id:'f1',label:'第1格',input:'sequence',options}]};
 const before=structuredClone(q),view=fieldPresentation(q,q.fields[0]),prompt=fieldsPromptPresentation(q);
 assert.equal(prompt.text,'排一排：');assert.deepEqual(view.options.map(o=>o.id),options.map(o=>o.id));assert.deepEqual(view.options.map(o=>o.content.text),options.map((_,i)=>'句子'+i));assert.deepEqual(q,before);
 const unknown={...q,id:'unknown-version'};assert.strictEqual(fieldPresentation(unknown,unknown.fields[0]),unknown.fields[0]);
});
test('時間軸原圖與真正數值留下，題型不能依文字猜成排序',()=>{
 const media={kind:'image',url:'https://quiz-media.invalid/00000000-0000-4000-8000-000000000001/'+'a'.repeat(64),alt:'合成時間軸'};
 const q={id:'ng6so_1504552_v6c3404290567',type:'fields',prompt:{text:'填充題\n依原題完成全部答案欄，再一起送出。\n依先後順序排列',media:[media],layout:[{type:'paragraph',runs:[{type:'text',text:'填充題\n依原題完成全部答案欄，再一起送出。\n依先後順序排列'}]},{type:'paragraph',runs:[{type:'image',media_index:0,width:300}]}]},fields:[{...field,options:['A 100年','B 2.75年','C 3年'].map((text,i)=>({id:'o'+i,content:{text,media:[]}}))}]};
 const before=structuredClone(q),prompt=fieldsPromptPresentation(q),view=fieldPresentation(q,q.fields[0]);assert.deepEqual(prompt.media,[media]);assert(prompt.layout.some(p=>p.runs.some(r=>r.type==='image')));assert.equal(view.options[1].content.text,'2.75年');assert.deepEqual(q,before);
 const other={...q,type:'short',fields:undefined};assert.strictEqual(fieldPresentation(other,field),field);
});
test('已核排序解析的原字母引用改用內容，不與目前位置混淆',()=>{
 const q={id:'ng6so_1504552_v6c3404290567',type:'fields',prompt:{text:'合成題',media:[]},fields:[{...field,options:['A 事件甲','B 事件乙','C 事件丙'].map((text,i)=>({id:'o'+i,content:{text,media:[]}}))}]};
 const text='先事件乙（B），再事件丙（C）。順序為B→C→A。A型保留。',before=structuredClone(q),expected='先事件乙，再事件丙。順序為「事件乙」→「事件丙」→「事件甲」。A型保留。';
 assert.equal(explanationReferencePresentation(q,text).text,expected);
 const content={text,media:[],layout:[{type:'paragraph',runs:[{type:'text',text}]}]};assert.equal(explanationReferenceContent(q,content).text,expected);assert.equal(content.text,text);assert.deepEqual(q,before);
 assert.equal(explanationReferencePresentation({...q,id:'unknown'},text).text,text);
});
