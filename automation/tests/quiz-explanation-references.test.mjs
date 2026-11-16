import test from 'node:test';import assert from 'node:assert/strict';
import {explanationReferencePresentation,explanationReferenceContent,choiceReferenceTokens} from '../../shared/quiz-explanation-references.mjs';
import {studentPromptContent} from '../../shared/quiz-student-content.mjs';
import {fieldPresentation,fieldsPromptPresentation} from '../../shared/quiz-fields-presentation.mjs';
import {canonicalizeQuestion} from '../../shared/quiz-question-contract.mjs';
const c=text=>({text,media:[]}),options=['甲內容','乙內容','丙內容','丁內容'].map((text,i)=>({id:'o'+(i+1),content:c(text)}));
const q={id:'synthetic',type:'single',options},orders={$single:options.map(o=>o.id)};
const permutations=a=>a.length?a.flatMap((v,i)=>permutations(a.filter((_,j)=>i!==j)).map(rest=>[v,...rest])):[[]];
test('all 24 permutations cite the same source content; answers and order never change',()=>{
 for(const shuffled of permutations(options)){const current={...q,options:shuffled},before=structuredClone(current);const r=explanationReferencePresentation(current,'因此①敘述錯誤。選項B、C也要核對。',{orders});assert.equal(r.text,'因此「甲內容」敘述錯誤。選項「乙內容」、「丙內容」也要核對。');assert.equal(r.issues.length,0);assert.deepEqual(current,before);}
});
test('image-only choice resolves its current visible letter and keeps media',()=>{const rich={...q,options:[options[1],options[2],{id:'o1',content:{text:'',media:[{kind:'image',url:'https://example.invalid/a',alt:'圖'}]}},options[3]]};assert.match(explanationReferencePresentation(rich,'選第1個選項。',{orders}).text,/畫面選項 C（圖示）/);const content={text:'因此①敘述錯誤。',media:[{kind:'audio',url:'https://example.invalid/a',alt:'音檔'}],layout:[{type:'paragraph',runs:[{type:'text',text:'因此①敘述錯誤。'}]}]};const r=explanationReferenceContent(q,content,{orders});assert.equal(r.media,content.media);assert.equal(r.layout[0].runs[0].text,'因此「甲內容」敘述錯誤。');});
test('dates, quantities, numbered steps, unknown mappings and stable subquestion codes are not guessed',()=>{const text='2024年，第1步是3公分，答案是3106。①先讀題。';assert.equal(choiceReferenceTokens(text).length,0);assert.equal(explanationReferencePresentation(q,'因此①敘述錯誤。',{orders:{}}).text,'因此①敘述錯誤。');assert.equal(explanationReferencePresentation(q,'因此①敘述錯誤。',{orders:{}}).issues.length,1);assert.equal(explanationReferencePresentation({id:'multi',type:'fields',fields:[{id:'f1',input:'single',options},{id:'f2',input:'single',options}]},'第1題選①。').retained,'non_shuffled_multi_field');});
test('existing content quotes replace bare position codes without duplicating prose',()=>{assert.equal(explanationReferencePresentation(q,'選項①「甲內容」不正確，答案為③丙內容。',{orders}).text,'選項「甲內容」不正確，答案為丙內容。');});
test('literal printed codes inside an existing quotation remain source content',()=>{assert.equal(choiceReferenceTokens('資料寫著「選項①」是固定圖例代號。').length,0);});
test('new-source common converter stores content references before freezing a candidate',()=>{const source={...q,prompt:c('問句'),answer:{option_id:'o1'},explanation:c('因此①敘述錯誤。')},r=canonicalizeQuestion(source);assert.equal(r.question.explanation.text,'因此「甲內容」敘述錯誤。');assert.equal(source.explanation.text,'因此①敘述錯誤。');assert.equal(r.question.answer,source.answer);});
test('hide only leading standalone type captions, preserve source, images, tables and real quoted words',()=>{
 for(const title of ['是非題','選擇題','選擇題：']){const source={text:title+'\n真正題幹。',media:[{kind:'audio',url:'https://example.invalid/a',alt:'聽題'}],layout:[{type:'paragraph',runs:[{type:'text',text:title}]},{type:'paragraph',runs:[{type:'text',text:'真正題幹。'}]},{type:'table',rows:[]}]},before=structuredClone(source),view=studentPromptContent(source);assert.equal(view.text,'真正題幹。');assert.deepEqual(view.media,source.media);assert.equal(view.layout[1].type,'table');assert.deepEqual(source,before);}
 for(const text of ['文章說明什麼是選擇題？','請判斷「是非題」這個詞。','選擇題-字音字形','選擇題'])assert.equal(studentPromptContent(c(text)).text,text);
 const legacy={id:'kg6ch_synthetic',type:'fields',prompt:c('選擇題\n真正題幹。\n①甲②乙'),fields:[{id:'f1',input:'text',label:'①甲②乙'}]};assert.equal(fieldPresentation(legacy,legacy.fields[0]).input,'single');assert.equal(fieldsPromptPresentation(legacy).text,'真正題幹。');assert.equal(legacy.prompt.text.startsWith('選擇題'),true);
});
