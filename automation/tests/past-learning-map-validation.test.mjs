import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateLearningMap} from '../lib/past-learning-map.mjs';

const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function fixture(kind='manual'){
 const field={id:'q1',text:'合成自核題',reference:'合成參考說明'};
 if(kind==='single')field.answer='a';
 const document={groups:[{id:'g1',kind,fields:[field]}]},source={id:'q1',source:{sha256:'a'.repeat(64)}};
 const bundle={paperId:'synthetic',document,sha256:hash(document),provenance:{entries:[source]}};
 const map={schema:2,paperId:bundle.paperId,documentSha256:bundle.sha256,concepts:[{id:'synthetic',title:'合成重點',connection:'合成關聯',points:['合成說明']}],questions:[{groupId:'g1',questionId:'q1',selfCheck:kind!=='single',expectedAnswer:field.answer??null,reference:field.reference,source:structuredClone(source),conceptIds:['synthetic'],explanation:'合成解析'}]};
 return {bundle,map};
}
test('自核題保留參考文字，沒有自動答案也能驗證',()=>{
 for(const kind of ['manual','annotation'])assert.equal(validateLearningMap(fixture(kind)).length,1);
});
test('拒絕被改動的參考、偽造自動答案、誤標題型與來源',()=>{
 for(const corrupt of [e=>e.reference='變造',e=>e.expectedAnswer='a',e=>e.selfCheck=false,e=>e.source.source.sha256='b'.repeat(64)]){
  const f=fixture();corrupt(f.map.questions[0]);assert.throws(()=>validateLearningMap(f));
 }
});
test('選擇題仍要求原答案，不能靠自核分支跳過比對',()=>{
 const f=fixture('single');assert.equal(validateLearningMap(f).length,1);f.map.questions[0].expectedAnswer=null;assert.throws(()=>validateLearningMap(f));
});
test('有參考但沒有答案的非自核題必須拒絕',()=>{
 const f=fixture('unknown');assert.throws(()=>validateLearningMap(f));
});
test('原單題schema1仍依來源與官方答案核對',()=>{
 const f=fixture('single'),entry=f.map.questions[0];f.bundle.provenance.entries[0].answerSource={sha256:'b'.repeat(64),raw:'a'};
 const map={schema:1,paperId:f.bundle.paperId,documentSha256:f.bundle.sha256,...entry,concepts:f.map.concepts,source:{paperSha256:'a'.repeat(64),keySha256:'b'.repeat(64),officialRaw:'a'}};
 assert.equal(validateLearningMap({bundle:f.bundle,map}).length,1);map.source.officialRaw='b';assert.throws(()=>validateLearningMap({bundle:f.bundle,map}));
});
