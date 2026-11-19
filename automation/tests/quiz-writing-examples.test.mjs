import test from 'node:test';
import assert from 'node:assert/strict';
import {writingVocabulary} from '../../shared/quiz-writing-example-guides.mjs';
import {compositionExampleGuides} from '../../shared/quiz-composition-example-guides.mjs';
import {openCompositionSources} from '../../shared/quiz-open-composition-sources.mjs';
import {openCompositionReview} from '../../shared/quiz-open-composition.mjs';
import {presentationSignature} from '../../shared/quiz-presentation-signature.mjs';
import {pastWritingSources,partnerWritingSources} from '../../shared/quiz-writing-past-sources.mjs';
import {partnerWritingGuide,pastWritingGuide} from '../../shared/quiz-writing-past.mjs';
test('every reviewed composition version has a fixed guide with at least three distinct examples',()=>{
 assert.equal(Object.keys(openCompositionSources).length,168);
 for(const entry of Object.values(openCompositionSources)){const g=entry.family==='writing'?writingVocabulary[entry.guide]:compositionExampleGuides[entry.guide];assert(g,entry.guide);const examples=g.examples??g.variants;assert(examples.length>=3);assert.equal(new Set(examples.map(x=>JSON.stringify(x))).size,examples.length);assert(g.explanation);}
});
test('keyword examples require a supplied reference and exact source, and leave saved text unchanged',()=>{
 const q={id:'synthetic-writing',type:'open',prompt:{text:'請用指定詞語造句。',media:[]},fields:[{id:'old-field',input:'text',label:'原欄'}]},answer={format:'self-review-v1',fields:{'old-field':{examples:['原參考保留'],criteria:['指定條件保留']}}},registry={[q.id]:{guard:presentationSignature(q),family:'writing',guide:Object.keys(writingVocabulary)[0]}},raw=JSON.stringify({v:1,f:{'old-field':'學生既有文字'}}),before=JSON.stringify({q,answer,raw});
 assert.equal(openCompositionReview({...q,answer},undefined,{registry}),null);
 const model=openCompositionReview(q,answer,{registry,raw});assert.equal(model.groups[0].student,'學生既有文字');assert.deepEqual(model.groups[0].examples,['原參考保留']);assert.deepEqual(model.criteria,['指定條件保留']);assert(model.guide.examples.length>=3);assert.equal(JSON.stringify({q,answer,raw}),before);
 assert.equal(openCompositionReview({...q,prompt:{text:'異動',media:[]}},answer,{registry,raw}),null);
});
test('old paper and frozen partner registries are exact and unknown content receives no guide',()=>{
 assert.equal(Object.keys(pastWritingSources).length,23);assert.equal(Object.keys(partnerWritingSources).length,17);
 assert.equal(pastWritingGuide({id:'unknown',kind:'manual',fields:[]}),null);assert.equal(partnerWritingGuide({id:Object.keys(partnerWritingSources)[0],title:'異動'}),null);
 for(const p of Object.values(pastWritingSources)){const g=p.type==='writing'?writingVocabulary[p.key]:compositionExampleGuides[p.key];assert(g,p.key);assert((g.examples??g.variants).length>=3);}
});
test('contextual writing examples preserve explicit punctuation, length and contrast requirements',()=>{
 for(const key of ['earthquakeCause','earthquakeHope'])for(const text of compositionExampleGuides[key].examples){assert.equal([...text].filter(x=>x==='，').length,2);assert.equal([...text].filter(x=>x==='。').length,1);}
 for(const key of ['pictureStatic','weatherContrast'])for(const text of compositionExampleGuides[key].examples)assert([...text.replace(/\p{P}/gu,'')].length>=30);
 for(const text of compositionExampleGuides.weatherContrast.examples)assert(/卻/u.test(text));
});
