import test from 'node:test';import assert from 'node:assert/strict';
import {reviewedPracticePapers} from '../../shared/quiz-practice-scope-reviewed.mjs';
import{paperPracticeScope,paperPracticeScopeBasis,unitPracticeScope,matchesPracticeScope,practiceScopeOptions,practiceScopeBadge}from'../../shared/quiz-practice-scope.mjs';
test('已核固定教師卷依版本及來源分類，換版或相似名稱不套用',()=>{
 assert.equal(reviewedPracticePapers.length,89);
 for(const p of reviewedPracticePapers){const original=structuredClone(p);assert.equal(paperPracticeScope(p),p.scope);assert.deepEqual(p,original);}
 const p=reviewedPracticePapers.find(p=>p.catalog.subject==='英語'&&p.catalog.volume.startsWith('6')&&!p.title.includes('期中'));
 assert.ok(p);
 for(const changed of [{version_id:'new-version'},{id:'another-session'},{title:'相似名稱'},{generated:true},{catalog:{...p.catalog,publisher:'翰林'}},{catalog:{...p.catalog,school_year:'114'}}])assert.equal(paperPracticeScope({...p,...changed}),'unknown');
 assert.equal(paperPracticeScope({...p,catalog:{...p.catalog,practice_scope:'mixed'}}),'mixed');
 assert.equal(paperPracticeScope({catalog:{school_year:'115',volume:'4年級上學期',publisher:'康軒',subject:'國語',unit:'第一課'},title:'期中練習'}),'unknown');
 assert.equal(paperPracticeScope({catalog:{school_year:'115',volume:'9年級上學期',scope_status:'historical_reference',source_scope:'113、114上第二次段考參考'}}),'unknown');
});
test('四年級依書商期中來源、九年級依歷年第二次段考，來源與換版隔離',()=>{
 const four=reviewedPracticePapers.filter(p=>p.catalog.volume==='4年級上學期'),nine=reviewedPracticePapers.filter(p=>p.catalog.volume==='9年級上學期');
 assert.equal(four.length,23);assert.equal(nine.length,30);
 for(const p of [...four,...nine]){
  const is4=p.catalog.volume.startsWith('4');
  assert.equal(paperPracticeScope(p),is4?'before':'after');
  assert.equal(paperPracticeScopeBasis(p),is4?'publisher_midterm':'historical_reference');
  assert.equal(paperPracticeScope({...p,version_id:'new-version'}),'unknown');
  assert.equal(paperPracticeScopeBasis({...p,version_id:'new-version'}),null);
  assert.equal(paperPracticeScope({...p,generated:true}),'unknown');
 }
 assert.equal(paperPracticeScope({...nine[0],catalog:{...nine[0].catalog,scope_status:'official'}}),'unknown');
 assert.equal(paperPracticeScope({...nine[0],catalog:{...nine[0].catalog,source_scope:'other'}}),'unknown');
 assert.match(practiceScopeBadge('after',{grade:9,basis:paperPracticeScopeBasis(nine[0])}),/歷年參考/);
 assert.match(practiceScopeBadge('before',{grade:4,basis:paperPracticeScopeBasis(four[0])}),/依書商分類/);
 assert.equal(practiceScopeBadge('unknown',{grade:9,basis:'historical_reference'}),'範圍待核對');
});
test('已核範圍依課程／來源資料分前後，跨範圍保留，未知不硬配',()=>{
 const catalog={school_year:'115',volume:'3年級上學期',publisher:'翰林',subject:'數學'};
 assert.equal(paperPracticeScope({catalog:{...catalog,unit:'第5單元'}}),'before');
 assert.equal(paperPracticeScope({catalog:{...catalog,unit:'除法'}}),'after');
 assert.equal(paperPracticeScope({catalog,unit_ids:[5,6]}),'mixed');
 assert.equal(paperPracticeScope({catalog:{...catalog,school_year:'114'},unit_ids:[6]}),'unknown');
 assert.equal(paperPracticeScope({catalog:{...catalog,publisher:'其他'},unit_ids:[6]}),'unknown');
 assert.equal(paperPracticeScope({catalog,unit_ids:[6,99]}),'unknown');
 assert.equal(paperPracticeScope({catalog:{...catalog,practice_scope:'before'},unit_ids:[6]}),'before');
 assert.equal(paperPracticeScope({catalog:{subject:'自然'},title:'期末神奇標題'}),'unknown');
 assert.equal(unitPracticeScope({id:'115-1-hanlin-g3-science'},{id:3}),'after');
 assert.equal(unitPracticeScope({id:'unknown'},{id:3}),'unknown');
 assert.equal(unitPracticeScope({id:'115-1-hanlin-g3-math',grade:6},{id:6}),'unknown');
 assert.equal(unitPracticeScope({id:'115-1-hanlin-g3-math',school_year:'114'},{id:6}),'unknown');
 assert.equal(matchesPracticeScope('mixed','after'),true);assert.equal(matchesPracticeScope('mixed','before'),true);assert.equal(matchesPracticeScope('unknown','after'),false);assert.equal(matchesPracticeScope('unknown','all'),true);
});
test('考次收納不更改原學年度、開放狀態或整份卷，九年級保留段考用語',()=>{
 const p={id:'past',enabled:false,catalog:{sourceYear:'113-1',exam:2,subject:'數學'}};const original=structuredClone(p);
 assert.equal(paperPracticeScope(p,{past:true}),'after');assert.deepEqual(p,original);
 assert.equal(paperPracticeScope({catalog:{exam:1}},{past:true}),'before');
 assert.equal(paperPracticeScope({catalog:{exam:3}},{past:true}),'unknown');
 assert.match(practiceScopeOptions(9)[0][1],/第2次段考/);assert.match(practiceScopeBadge('after',{past:true}),/依原卷範圍/);
});

test('115上康軒三年級國語依已核課本區分1–6及7–12課',()=>{
 const c={id:'115-1-kang-g3-ch',school_year:'115',grade:3,volume:'3年級上學期',publisher:'康軒',subject:'國語'};
 for(const id of [1,2,3,4,5,6])assert.equal(unitPracticeScope(c,{id}),'before');
 for(const id of [7,8,9,10,11,12])assert.equal(unitPracticeScope(c,{id}),'after');
 for(const id of [0,13,99])assert.equal(unitPracticeScope(c,{id}),'unknown');
 const catalog={...c,course_id:c.id};
 assert.equal(paperPracticeScope({catalog,unit_ids:[7,12]}),'after');
 assert.equal(paperPracticeScope({catalog,unit_ids:[6,7]}),'mixed');
 assert.equal(paperPracticeScope({catalog:{...catalog,unit:'第五課　飛舞的絲帶、第七課　淡水小鎮'}}),'mixed');
 for(const unit of ['第5～8課','第5課至8課','第5課－第8課','期末綜合練習'])assert.equal(paperPracticeScope({catalog:{...catalog,unit}}),'unknown');
 assert.equal(paperPracticeScope({catalog:{school_year:'115',volume:'3年級上學期',publisher:'康軒',subject:'國語'},unit_ids:[7]}),'after');
 for(const invalid of [{school_year:'114'},{grade:6},{publisher:'翰林'},{volume:'3年級下學期'}])assert.equal(unitPracticeScope({...c,...invalid},{id:7}),'unknown');
 assert.equal(unitPracticeScope({school_year:'115',grade:6,volume:'3年級上學期',publisher:'康軒',subject:'國語'},{id:7}),'unknown');
 assert.equal(unitPracticeScope({school_year:'115',volume:'3年級下學期',publisher:'康軒',subject:'國語'},{id:7}),'unknown');
});
