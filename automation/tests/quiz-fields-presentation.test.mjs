import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldPresentation,fieldsAreSingleChoice,fieldsPromptPresentation} from '../../shared/quiz-fields-presentation.mjs';
import {fieldsResponseError,fieldsResponseSummary,fieldsAnswerSummary} from '../../shared/quiz-fields.mjs';
const fixture=()=>({id:'kg6ch_synthetic',type:'fields',prompt:{text:'選擇題-字音字形\n依原題順序完成所有答案欄；同一份原題保留為一組。\n合成注音選擇題\n①ㄅ②ㄆ③ㄇ④ㄈ。',media:[]},fields:[{id:'f1',input:'text',label:'①ㄅ②ㄆ③ㄇ④ㄈ。'}]});
test('舊匯入選擇題只轉換呈現，原題、欄位與圈號答案保持',()=>{
 const q=fixture(),before=JSON.stringify(q),f=fieldPresentation(q,q.fields[0]);
 assert.equal(f.input,'single');assert.deepEqual(f.options.map(o=>o.id),['①','②','③','④']);assert.equal(f.options[1].content.text,'ㄆ');
 assert.equal(fieldsAreSingleChoice(q),true);assert.equal(fieldsResponseError(q,JSON.stringify({v:1,f:{f1:'②'}})),'');
 for(const value of ['','2','ㄆ','⑤'])assert.notEqual(fieldsResponseError(q,JSON.stringify({v:1,f:{f1:value}})),'');
 assert.equal(fieldsResponseSummary(q,JSON.stringify({v:1,f:{f1:'②'}})),'答案：ㄆ');
 assert.equal(fieldsAnswerSummary(q,{fields:{f1:['②']}}),'答案：ㄆ');
 const prompt=fieldsPromptPresentation(q);assert.match(prompt.text,/合成注音選擇題/);assert.doesNotMatch(prompt.text,/依原題|①|④/);assert.equal(JSON.stringify(q),before);
});
test('真正填空、多欄、非指定匯入、有圖表或圈號不完整的題目不推測題型',()=>{
 const cases=[q=>q.id='other',q=>q.prompt.text='填空題\n'+q.fields[0].label,q=>q.fields.push({...q.fields[0],id:'f2'}),q=>q.prompt.media.push({type:'image'}),q=>q.prompt.layout=[{type:'table'}],q=>q.prompt.layout=[{type:'paragraph',runs:[{type:'image'}]}],q=>q.fields[0].label='①甲③丙',q=>q.fields[0].label='①甲①乙',q=>q.fields[0].label='①甲②',q=>q.prompt.text+='別的內容'];
 for(const change of cases){const q=fixture();change(q);assert.equal(fieldPresentation(q,q.fields[0]),q.fields[0]);assert.equal(fieldsPromptPresentation(q),q.prompt);}
});
