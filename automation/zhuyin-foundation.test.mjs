import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {zhuyinLessons,zhuyinKeys,generateZhuyin,zhuyinCount,textDistance} from '../shared/zhuyin-foundation-curriculum.mjs';
import {getTargetFingers} from '../shared/typing-finger-guide.mjs';
const sql=readFileSync(new URL('../supabase/typing_foundation.sql',import.meta.url),'utf8');
assert.equal(Object.values(zhuyinKeys).filter(c=>/[ㄅ-ㄩ]/.test(c)).length,37);
assert.equal(zhuyinKeys.f,'ㄑ');assert.equal(zhuyinKeys.j,'ㄨ');assert.equal(zhuyinKeys[' '],'一聲');
for(const lesson of zhuyinLessons){
 const counts=lesson.stages.map((_,i)=>zhuyinCount(lesson,i));
 assert.ok(sql.includes(`('${lesson.key}',${lesson.number+12},0,0,array[${counts.join(',')}]`));
 for(let s=0;s<6;s++){
  let previous=[];
  for(let n=0;n<100;n++){
   const rows=generateZhuyin(lesson,s,previous,n<10?()=>0:Math.random);
   assert.equal(rows.reduce((sum,t)=>sum+t.length,0),counts[s],`${lesson.key}:${s} count`);
   assert.ok(rows.every((r,i)=>r!==previous[i]),`${lesson.key}:${s} unchanged row`);
   if(lesson.mode!=='ime')for(const key of rows.join('')){assert.ok(zhuyinKeys[key]);assert.ok(getTargetFingers(key).length);if(lesson.mode==='keys')assert.notEqual(key,' ');}
   previous=rows;
  }
 }
}
assert.equal(textDistance('時間','石間'),1);assert.equal(textDistance('你好','你好。'),1);assert.equal(textDistance('你好。','你好。'),0);
console.log('PASS: 12 Chinese lessons / 7200 exercises, all 37 keys, exact server counts, no separator spaces, fresh retries, error distance.');
