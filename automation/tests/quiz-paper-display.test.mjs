import test from 'node:test';
import assert from 'node:assert/strict';
import {comparePapers,presetOrdinal,paperRange,paperTitle,paperMix,isExtension} from '../../shared/quiz-paper-display.mjs';
const preset=(unit,subject='國語',volume='3年級上學期',publisher='翰林')=>({id:unit,catalog:{unit,subject,volume,publisher,school_year:'115'}});
test('預設卷按中文課次、阿拉伯數字及英文課次排序，不按文字字典序',()=>{
 const units=['第十一課','第三課','第十課','第二課','第一課'];
 assert.deepEqual(units.map(x=>preset(x)).sort(comparePapers).map(x=>x.id),['第一課','第二課','第三課','第十課','第十一課']);
 assert.deepEqual(['Unit 10','Unit 2','Unit 1'].map(x=>preset(x,'英語')).sort(comparePapers).map(x=>x.id),['Unit 1','Unit 2','Unit 10']);
 assert.equal(presetOrdinal(preset('第12單元')),12);assert.equal(presetOrdinal(preset('二、加減')),2);
});
test('無編號單元使用已核對的教材順序，對不同年級版本不套用',()=>{
 const math=['比與比值','小數除法','分數除法','最大公因數與最小公倍數'];
 assert.deepEqual(math.map(x=>preset(x,'數學','6年級上學期')).sort(comparePapers).map(x=>x.id),math.toReversed());
 assert.equal(presetOrdinal(preset('植物大發現','自然')),1);assert.equal(presetOrdinal(preset('磁鐵好好玩','自然')),2);
 assert.equal(presetOrdinal(preset('日治時期臺灣的發展與變遷','社會','6年級上學期','南一')),1);
 assert.equal(presetOrdinal(preset('熱對物質的影響','自然','6年級上學期','南一')),2);
 assert.equal(presetOrdinal(preset('分數除法','數學','3年級上學期')),Infinity);
 assert.equal(presetOrdinal(preset('分數除法','數學','6年級上學期','南一')),Infinity);
 const a={generated:true,id:'a',saved_at:'2026-10-26',title:'第1單元'},b={...a,id:'b',saved_at:'2026-10-27',title:'第9單元'};assert.ok(comparePapers(a,b)>0);
});
test('新舊自組卷顯示中文範圍，去除重複與非法單元，保持實際題目配比',()=>{
 const p={...preset('自選單元：[8]','數學'),generated:true};
 assert.equal(paperRange(p),'第8單元：分數');assert.equal(paperRange({...p,unit_ids:[3,3,8,0,10,'1']}),'第3單元：毫米與數線、第8單元：分數');
 assert.equal(paperRange({...p,unit_ids:[1,2,3,4,5,6,7,8,9]}),'全冊9個單元');
 assert.equal(paperRange({...p,catalog:{...p.catalog,unit:'無法辨識'}}),'自選範圍');
 assert.equal(paperMix({...p,distribution:{easy:1,medium:3,hard:1}}),'題目組合：易 1 題・中 3 題・難 1 題');
});
test('錯題延伸標示學習重點，新舊卷一致且保留學生自訂名稱',()=>{
 const p={...preset('同重點再練習：同分母分數比較','數學'),generated:true,title:'數學同重點延伸練習'};
 assert.ok(isExtension(p));assert.equal(paperTitle(p),'同重點再練：同分母分數比較');assert.equal(paperRange(p),'學習重點：同分母分數比較');
 assert.equal(paperTitle({...p,display_name:'週五再練'}),'週五再練');assert.equal(paperRange({...p,generated_kind:'extension',learning_point:'長度換算'}),'學習重點：長度換算');
 assert.equal(isExtension({...p,generated:false}),false);
});
