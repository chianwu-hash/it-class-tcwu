import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lessons,expectedCount} from '../shared/typing-foundation-curriculum.mjs';
import {generateExercise} from '../prototypes/typing-foundation/level1/exercises.mjs';
import {getTargetFingers,physicalKey} from '../shared/typing-finger-guide.mjs';
const sql=readFileSync(new URL('../supabase/typing_foundation.sql',import.meta.url),'utf8');
assert.equal(lessons.length,12);
for(const lesson of lessons){
 assert.equal(lesson.stages.length,6);
 assert.ok(sql.includes(`('${lesson.key}',${lesson.number},${lesson.speed},${lesson.starterSpeed},array[${lesson.stages.map((_,i)=>expectedCount(lesson,i)).join(',')}]`),'SQL and UI curriculum must agree');
 for(let stage=0;stage<6;stage++){
  let previous=[];
  for(let n=0;n<100;n++){
   const rows=generateExercise(stage,previous,n<5?()=>0:Math.random,lesson.key);
   assert.equal(rows.reduce((sum,row)=>sum+row.length,0),expectedCount(lesson,stage));
   assert.ok(rows.every(row=>!previous.includes(row)),`${lesson.key} repeats a row`);
   for(const key of rows.join(''))assert.ok(getTargetFingers(key).length,`No finger for ${key}`);
   previous=rows;
  }
 }
}
assert.equal(physicalKey(':'),';');assert.equal(physicalKey('"'),"'");
assert.deepEqual(getTargetFingers('F'),['left-index','right-pinky']);
assert.deepEqual(getTargetFingers('?'),['right-pinky','left-pinky']);
console.log('PASS: 12 lessons / 72 stages / 7200 random and deterministic exercises, server counts, finger coverage, Shift mapping.');
