import test from 'node:test';import assert from 'node:assert/strict';
import {convertChoiceQuestion} from '../../shared/quiz-choice-conversion.mjs';
import {booleanChoicePresentation} from '../../shared/quiz-boolean-choice.mjs';
import {answerTemplateSources} from '../../shared/quiz-answer-template-sources.mjs';
import {presentationSignature} from '../../shared/quiz-presentation-signature.mjs';
import {convertChoiceBatch} from '../convert-choice-content.mjs';
import {partnerChoicePresentation} from '../../shared/partner-pilot/choice-presentation.mjs';
const c=text=>({text,media:[]});
const rich=text=>({...c(text),layout:[{type:'paragraph',runs:[{type:'text',text}]}]});
const question=()=>({id:'any_publisher',type:'fields',prompt:rich('選擇題\n依原題完成全部答案欄，再一起送出。\n合成題目問哪一個？\n①甲國　②乙國　③丙國　④丁國'),fields:[{id:'f1',input:'single',label:'答案',options:[...'①②③④'].map((text,i)=>({id:'o'+(i+1),content:rich(text)}))}],answer:{format:'fields-v1',fields:{f1:['o2']}}});

test('only exact reviewed diagram symbols retain literal marks through choice conversion',()=>{
 const q={id:'synthetic_diagram_symbols',type:'fields',prompt:rich('相同畫○，不同打╳。'),fields:[{id:'f1',input:'single',label:'①',options:['○','╳'].map((text,i)=>({id:'o'+i,content:c(text)}))}]},before=JSON.stringify(q);
 answerTemplateSources[q.id]={guard:presentationSignature(q),model:{mode:'diagram-symbols'}};
 try{
  assert.deepEqual(convertChoiceQuestion(q).question.fields[0].options,q.fields[0].options);
  assert.equal(JSON.stringify(q),before);
  const drift={...q,prompt:rich('請判斷正確或不正確。')};
  assert.notDeepEqual(convertChoiceQuestion(drift).question.fields[0].options,q.fields[0].options);
 }finally{delete answerTemplateSources[q.id];}
});
test('the reported code-only case becomes full choices without mutating IDs, keys or source',()=>{
 const q=question(),before=structuredClone(q),r=convertChoiceQuestion(q);assert.equal(r.issues.length,0);
 assert.deepEqual(r.question.fields[0].options.map(o=>o.content.text),['甲國','乙國','丙國','丁國']);assert.deepEqual(r.question.answer,q.answer);
 assert.doesNotMatch(r.question.prompt.text,/[①②③④]|依原題完成/);assert.deepEqual(q,before);assert.equal(convertChoiceQuestion(r.question).changes.length,0);
 assert.equal(convertChoiceBatch([q],{check:true}).report.passed,false);assert.equal(convertChoiceBatch([r.question],{check:true}).report.passed,true);
 assert.equal(convertChoiceBatch([{schema:1,blocks:[]}],{check:true}).report.issues[0].code,'unsupported_question_format');
});
test('compound true-false and matching native text layouts use one display; incompatible rich data stays intact',()=>{
 const options=[{id:'old-O',content:rich('O ○ 正確')},{id:'old-X',content:rich('X ╳ 不正確')}];
 assert.deepEqual(booleanChoicePresentation(options),[{badge:'○',text:'正確'},{badge:'×',text:'不正確'}]);
 const q=question();q.fields[0].options=options;const r=convertChoiceQuestion(q);assert.deepEqual(r.question.fields[0].options.map(o=>o.id),['old-O','old-X']);
 options[0].content.layout[0].runs[0].text='另一段實際題意';assert.equal(booleanChoicePresentation(options),null);
});
test('numbered reading subquestions map each choice set to its own original field',()=>{
 const q=question();q.prompt=c('閱讀文章保留\n（　）１第一題？\n①甲②乙③丙④丁\n（　）２第二題？\n①一②二③三④四');q.fields.push({...structuredClone(q.fields[0]),id:'f2'});
 const r=convertChoiceQuestion(q);assert.equal(r.issues.length,0);assert.deepEqual(r.question.fields.map(f=>f.options.map(o=>o.content.text)),[['甲','乙','丙','丁'],['一','二','三','四']]);assert.match(r.question.prompt.text,/文章保留/);assert.match(r.question.prompt.text,/第二題/);assert.doesNotMatch(r.question.prompt.text,/[①②③④]/);
});
test('ordinary codes, numeric answers, unknown mapping, mixed fields and unsupported tables are never guessed',()=>{
 const q=question();q.prompt=c('只有題目，沒有可靠選項原文');assert.equal(convertChoiceQuestion(q).issues[0].code,'choice_source_mapping_required');
 q.fields[0].options.forEach((o,i)=>o.content=c(String(i+1)));assert.equal(convertChoiceQuestion(q).question,q);
 const table=question();table.prompt.layout=[{type:'table',rows:[]}];assert.equal(convertChoiceQuestion(table).question,table);
 const mixed=question();mixed.fields.push({id:'f2',input:'text',label:'說明'});assert.equal(convertChoiceQuestion(mixed).issues.length,1);
});
test('an option image moves with its exact choice and is not dropped from the source',()=>{
 const q=question(),media={kind:'image',url:'https://example.invalid/image.png',alt:'合成原圖'};
 q.prompt={text:'題目\n①甲②乙③丙④丁',media:[media],layout:[{type:'paragraph',runs:[{type:'text',text:'題目\n①甲'},{type:'image',media_index:0,width:40},{type:'text',text:'②乙③丙④丁'}]}]};
 const r=convertChoiceQuestion(q);assert.equal(r.issues.length,0);assert.deepEqual(r.question.fields[0].options[0].content.media,[media]);assert.equal(r.question.prompt.media.length,0);assert.equal(q.prompt.media.length,1);
});
test('shuffled original IDs keep their exact meaning, and partner numeric indices stay fixed',()=>{
 const q=question();q.fields[0].options.reverse();const r=convertChoiceQuestion(q).question;
 assert.deepEqual(r.fields[0].options.map(o=>[o.id,o.content.text]),[['o4','丁國'],['o3','丙國'],['o2','乙國'],['o1','甲國']]);
 const p={id:9,text:q.prompt.text,options:['④','③','②','①'],correct:2,attempts:[{choice:1,correct:false}]},before=structuredClone(p),view=partnerChoicePresentation(p);
 assert.deepEqual(view.options,['丁國','丙國','乙國','甲國']);assert.equal(view.correct,2);assert.deepEqual(view.attempts,p.attempts);assert.deepEqual(p,before);
});
test('shared word banks and mixed reading fields retain every original response target',()=>{
 const q=question();q.prompt=c('共用詞庫\n①甲②乙③丙④丁\n１第一個句子（　）\n２第二個句子（　）');q.fields.push({...structuredClone(q.fields[0]),id:'f2'});
 const r=convertChoiceQuestion(q);assert.equal(r.issues.length,0);assert.deepEqual(r.question.fields.map(f=>f.options.map(o=>o.content.text)),[['甲','乙','丙','丁'],['甲','乙','丙','丁']]);assert.match(r.question.prompt.text,/第二個句子/);
 const mixed=question();mixed.fields.unshift({id:'blank',input:'text',label:'第1空'});mixed.prompt=c('文章與字音填空\n（　）１問題？\n①甲②乙③丙④丁');const m=convertChoiceQuestion(mixed);assert.equal(m.issues.length,0);assert.equal(m.question.fields[0],mixed.fields[0]);
});
test('unanchored source audio survives instruction removal and choice extraction exactly once',()=>{
 const q=question(),audio={kind:'audio',url:'https://example.invalid/source.mp3',alt:'合成來源音檔'};q.prompt.media=[audio];
 const view=convertChoiceQuestion(q).question;assert.deepEqual(view.prompt.media,[audio]);assert(view.fields[0].options.every(o=>!o.content.media.length));assert.deepEqual(convertChoiceQuestion(view).question,view);
});
test('reviewed judgment captions normalize, while genuine two-choice meanings stay literal',()=>{
 for(const [a,b]of [['ˇ（符合題意）','☓（不符合題意）'],['ˇ 正確','╳ 錯誤'],['ˇ：正確／符合','╳：錯誤／不符合'],['ˇ：是，符合題意','╳：不是，不符合題意'],['正確：正確','錯誤：錯誤']]){
  assert.deepEqual(booleanChoicePresentation([{content:rich(a)},{content:rich(b)}]),[{badge:'○',text:'正確'},{badge:'×',text:'不正確'}]);
 }
 for(const [a,b]of [['可以','不可以'],['N極：N極','S極：S極'],['ˇ：岩石','△：礦物']])assert.equal(booleanChoicePresentation([{content:c(a)},{content:c(b)}]),null);
});
