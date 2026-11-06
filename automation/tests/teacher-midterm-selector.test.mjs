import test from 'node:test';import assert from 'node:assert/strict';
import {selectMidtermQuestions} from '../lib/teacher-midterm-selector.mjs';
const question=(id,u,d)=>({id,family:id,units:[u],difficulty:d,has_explanation:true,question:{id,type:'single',prompt:{text:id,media:[]},options:[{id:'a',content:{text:'甲',media:[]}},{id:'b',content:{text:'乙',media:[]}}],answer:{option_id:'a'},explanation:{text:'解析',media:[]}}});
test('本次六英只取1/3，平衡單元且符合4易12中4難，固定結果可重現',()=>{
 const course={id:'115-1-kang-g6-en',questions:[1,2,3].flatMap(u=>[-3,0,3].flatMap(d=>Array.from({length:12},(_,i)=>question(`${u}-${d}-${i}`,u,d))))};
 const chosen=selectMidtermQuestions(course);assert.equal(chosen.length,20);assert.deepEqual(chosen.map(q=>q.id),selectMidtermQuestions({...course,questions:course.questions.slice().reverse()}).map(q=>q.id));
 assert(chosen.every(q=>q.units[0]!==2));assert.equal(chosen.filter(q=>q.units[0]===1).length,10);assert.deepEqual([-3,0,3].map(d=>chosen.filter(q=>q.difficulty===d).length),[4,12,4]);
});
test('不把同題族重複計入、不靠跨範圍補題或改難度',()=>{
 const base={id:'115-1-kang-g6-en',questions:Array.from({length:40},(_,i)=>({...question('q'+i,i%2?1:3,0),family:'same-family'}))};assert.throws(()=>selectMidtermQuestions(base),/distribution_unavailable/);
 const scope={...base,id:'unsupported'};assert.throws(()=>selectMidtermQuestions(scope),/unknown_midterm_scope/);
});
