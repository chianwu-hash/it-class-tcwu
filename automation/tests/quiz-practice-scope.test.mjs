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

test('三年級翰林英語及康軒社會的期末單元由正式課程 ID 對應',()=>{
 for(const [id,publisher,subject,after] of [
  ['115-1-hanlin-g3-english','翰林','英語',[3,4,5]],
  ['115-1-kang-g3-so','康軒','社會',[3,4]],
 ]){
  const course={id,grade:3,volume:'3年級上學期',subject};
  for(const unit of [1,2])assert.equal(unitPracticeScope(course,{id:unit}),'before');
  for(const unit of after)assert.equal(unitPracticeScope(course,{id:unit}),'after');
  assert.equal(unitPracticeScope(course,{id:99}),'unknown');
  const catalog={...course,school_year:'115',publisher,course_id:id,unit:after.join('、')};
  assert.equal(paperPracticeScope({catalog}),'after');
  assert.equal(paperPracticeScope({catalog:{...catalog,unit:'2、3'}}),'mixed');
  for(const invalid of [{grade:6},{volume:'3年級下學期'},{publisher:'其他'},{subject:'其他'},{school_year:'114'}])
   assert.equal(paperPracticeScope({catalog:{...catalog,...invalid}}),'unknown');
 }
});

test('正式單元目錄的數字、列舉與範圍依完整內容分類',()=>{
 const catalog={course_id:'115-1-hanlin-g3-math',school_year:'115',volume:'3年級上學期',publisher:'翰林',subject:'數學'};
 const classify=unit=>paperPracticeScope({catalog:{...catalog,unit}});
 for(const unit of ['6','6、7、9','第 6、9 單元｜生活應用','第 7 至 9 單元｜重量'])assert.equal(classify(unit),'after');
 for(const unit of ['5、6','第 5 至 7 單元'])assert.equal(classify(unit),'mixed');
 for(const unit of ['6、99','第 9 至 7 單元','期末綜合練習'])assert.equal(classify(unit),'unknown');
 assert.equal(paperPracticeScope({catalog:{...catalog,course_id:undefined,unit:'5、6'}}),'mixed');
 assert.equal(paperPracticeScope({catalog:{...catalog,course_id:'115-1-hanlin-g3-science',subject:'自然',unit:'3'}}),'after');
});

test('四年級翰林社會自組卷依核對過的書商單元分類',()=>{
 const course={id:'115-1-hanlin-g4-social',grade:4,publisher:'翰林',subject:'社會',volume:'4年級上學期',school_year:'115'};
 for(const unit of [3,4,5,6])assert.equal(unitPracticeScope(course,{id:unit}),'after');
 assert.equal(unitPracticeScope(course,{id:2}),'before');
 assert.equal(unitPracticeScope(course,{id:7}),'unknown');
 assert.equal(unitPracticeScope({...course,publisher:'康軒'},{id:4}),'unknown');
 const catalog={...course,course_id:course.id,unit:'第4單元｜家鄉的多元文化'};
 assert.equal(paperPracticeScope({catalog,generated:true}),'after');
 assert.equal(paperPracticeScope({catalog}),'unknown');
});

test('四年級康軒國語自組卷依核對過的書商課次分類',()=>{
 const course={id:'115-1-kang-g4-chinese',grade:4,publisher:'康軒',subject:'國語',volume:'4年級上學期',school_year:'115'};
 for(const unit of [7,8,9,10,11,12])assert.equal(unitPracticeScope(course,{id:unit}),'after');
 assert.equal(unitPracticeScope(course,{id:6}),'before');
 assert.equal(unitPracticeScope(course,{id:13}),'unknown');
 assert.equal(unitPracticeScope({...course,school_year:'114'},{id:7}),'unknown');
 assert.equal(paperPracticeScope({catalog:{...course,course_id:course.id,unit:'第七課｜美味的一堂課'},generated:true}),'after');
});

test('四年級五科的自組單元保留期中，九年級七科使用歷年第二次段考範圍',()=>{
 for(const [grade,id,subject,unit,scope] of [
  [4,'115-1-hanlin-g4-english','英語',2,'before'],[4,'115-1-hanlin-g4-english','英語',3,'after'],
  [4,'115-1-hanlin-g4-english','英語',4,'after'],[4,'115-1-hanlin-g4-english','英語',5,'after'],
  [4,'115-1-hanlin-g4-social','社會',2,'before'],
  [4,'115-1-kang-g4-chinese','國語',6,'before'],[4,'115-1-nani-g4-math','數學',5,'before'],
  [4,'115-1-nani-g4-science','自然',2,'before'],[4,'115-1-nani-g4-science','自然',3,'after'],
  [4,'115-1-nani-g4-science','自然',4,'after'],[9,'115-1-g9-hanlin-chinese','國文',6,'after'],
  [9,'115-1-g9-hanlin-math','數學',3,'after'],[9,'115-1-g9-hanlin-science','自然',11,'after'],
  [9,'115-1-g9-kang-civics','公民',4,'after'],[9,'115-1-g9-kang-geography','地理',4,'after'],
  [9,'115-1-g9-kang-history','歷史',2,'after'],[9,'115-1-g9-nani-english','英語',8,'after'],
 ]){
  const course={id,grade,subject,volume:grade+'年級上學期'};
  assert.equal(unitPracticeScope(course,{id:unit}),scope);
  assert.equal(unitPracticeScope(course,{id:99}),'unknown');
  assert.equal(unitPracticeScope({...course,school_year:'114'},{id:unit}),'unknown');
  assert.equal(unitPracticeScope({...course,subject:'其他'},{id:unit}),'unknown');
  const own={catalog:{...course,course_id:id},generated:true,unit_ids:[unit]};
  assert.equal(paperPracticeScope(own),scope);
  assert.equal(paperPracticeScope({...own,generated:false}),'unknown');
  assert.equal(paperPracticeScopeBasis(own),grade===9?'historical_reference':null);
 }
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

test('六年級已核自然、社會與英語期末單元可在預設範圍選用，版本及科目隔離',()=>{
 for(const [id,publisher,subject]of [['115-1-nani-g6-science','南一','自然'],['115-1-nani-g6-social','南一','社會'],['115-1-kang-g6-en','康軒','英語']]){
  const c={id,school_year:'115',grade:6,volume:'6年級上學期',publisher,subject};
  assert.deepEqual([1,2,3,4].filter(id=>matchesPracticeScope(unitPracticeScope(c,{id}),'after')),[3,4]);
  assert.deepEqual([1,2,3,4].filter(id=>matchesPracticeScope(unitPracticeScope(c,{id}),'before')),[1,2]);
  assert.equal(paperPracticeScope({catalog:{...c,course_id:id},unit_ids:[3,4]}),'after');
  assert.equal(paperPracticeScope({catalog:{...c,course_id:id},unit_ids:[2,3]}),'mixed');
  for(const invalid of [{school_year:'114'},{grade:3},{volume:'6年級下學期'},{publisher:'其他'},{subject:'其他'}])assert.equal(unitPracticeScope({...c,...invalid},{id:3}),'unknown');
  assert.equal(unitPracticeScope(c,{id:99}),'unknown');
 }
 assert.equal(unitPracticeScope({id:'115-1-other-g6-science',grade:6},{id:3}),'unknown');
});

test('六年級康軒國語及翰林數學依115上實際課本區分期末，隔離版本及未知單元',()=>{
 for(const [id,publisher,subject,before,after]of [
  ['115-1-kang-g6-ch','康軒','國語',[1,2,3,4,5,6],[7,8,9,10,11,12]],
  ['115-1-hanlin-g6-math','翰林','數學',[1,2,3,4],[5,6,7,8]],
 ]){
  const c={id,school_year:'115',grade:6,volume:'6年級上學期',publisher,subject};
  const units=[...before,...after];
  assert.deepEqual(units.filter(id=>matchesPracticeScope(unitPracticeScope(c,{id}),'after')),after);
  assert.deepEqual(units.filter(id=>matchesPracticeScope(unitPracticeScope(c,{id}),'before')),before);
  assert.equal(paperPracticeScope({catalog:{...c,course_id:id},unit_ids:after}),'after');
  assert.equal(paperPracticeScope({catalog:{...c,course_id:id},unit_ids:[before.at(-1),after[0]]}),'mixed');
  for(const invalid of [{school_year:'114'},{grade:3},{grade:4},{grade:9},{volume:'6年級下學期'},{publisher:'其他'},{subject:'其他'}])assert.equal(unitPracticeScope({...c,...invalid},{id:after[0]}),'unknown');
  for(const id of [0,13,99])assert.equal(unitPracticeScope(c,{id}),'unknown');
 }
});
