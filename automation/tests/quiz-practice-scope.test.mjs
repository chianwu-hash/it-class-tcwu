import test from 'node:test';import assert from 'node:assert/strict';
import{paperPracticeScope,unitPracticeScope,matchesPracticeScope,practiceScopeOptions,practiceScopeBadge}from'../../shared/quiz-practice-scope.mjs';
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
