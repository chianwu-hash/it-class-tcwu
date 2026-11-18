import test from 'node:test';
import assert from 'node:assert/strict';
import {readQuizStudy} from '../../shared/quiz-study-data.mjs';
const qid='kxg3ch_ECH1505002429_vd4986cfede1d',bookId='c26493b9-ec9f-5f17-91af-99dc2d88a508',hash='1cafd0720d1f5a18b596d9a4a7c130d3c4e2e7eae8b5737877a90e679fd02749';
function fixture(){return {attempt_id:'attempt',version_id:'version',document:{questions:[{id:qid}]},reviews:[{question_id:qid}],responses:{[qid]:'existing'},study:{schema:1,kind:'normal',attemptId:'attempt',versionId:'version',packageId:'package',pages:[94,95,96].map(n=>({id:'G3CH_P0'+n,bookId,sequence:String(n),printedPages:[n],url:'https://quiz-media.invalid/'+bookId+'/'+(n===94?hash:'a'.repeat(64))})),references:{[qid]:{bookId,primary:95,references:[95,96]}},explanations:{[qid]:{text:'原解析',origin:'publisher'}}}};}
test('已固定題目的課本標示與開頁使用核定94頁，不改原資料、答案或解析',()=>{
 const source=fixture(),before=structuredClone(source),result=readQuizStudy(source,'normal');
 assert.equal(result.references[qid].primary,94);assert.deepEqual(result.references[qid].references,[94]);
 assert.equal(result.pages.find(p=>p.bookId===bookId&&p.printedPages.includes(result.references[qid].primary)).url,source.study.pages[0].url);
 assert.deepEqual(source,before);assert.equal(result.explanations[qid].text,'原解析');
});
test('沒有被授權的94頁或素材指紋不同時不生成錯誤替代連結',()=>{
 for(const change of [s=>s.study.pages.shift(),s=>s.study.pages[0].url='https://quiz-media.invalid/'+bookId+'/'+'b'.repeat(64)]){const s=fixture();change(s);assert.equal(readQuizStudy(s,'normal').references[qid],undefined);}
});
test('其他題目、其他教材與已修正對照維持原樣，場次版本不符仍拒絕',()=>{
 const other=fixture();other.document.questions[0].id='another';other.study.references.another=other.study.references[qid];assert.equal(readQuizStudy(other,'normal').references.another.primary,95);
 const otherBook=fixture();otherBook.study.references[qid].bookId='other';otherBook.study.pages.forEach(p=>p.bookId='other');assert.equal(readQuizStudy(otherBook,'normal').references[qid].primary,95);
 const corrected=fixture();corrected.study.references[qid]={bookId,primary:96,references:[96]};assert.equal(readQuizStudy(corrected,'normal').references[qid].primary,96);
 const wrongVersion=fixture();wrongVersion.study.versionId='wrong';assert.deepEqual(readQuizStudy(wrongVersion,'normal'),{pages:[],references:{},explanations:{}});
});
