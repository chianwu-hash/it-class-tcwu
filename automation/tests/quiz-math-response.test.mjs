import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {PGlite} from '../lib/quiz-local-db.mjs';
import {mathResponseValue,mathResponseComplete,mathResponseError} from '../../shared/quiz-math-response.mjs';
import {sourceCropStyle} from '../../shared/quiz-source-crop.mjs';

test('數學輸入正規化分數、小數、符號與座標，保留除法及座標次序',async()=>{
 const db=new PGlite();try{await db.exec('create role anon;create role authenticated;');await db.exec(fs.readFileSync(new URL('../../supabase/quiz-math-response.sql',import.meta.url),'utf8'));
 const norm=async x=>(await db.query('select public.quiz_math_answer_normalize($1) s',[x])).rows[0].s;
 for(const [input,expected]of [['２１／１４','3/2'],['1.500','3/2'],['-6/4','-3/2'],['0/7','0'],['3 * π + 2','3pi+2'],['4√3−2','4sqrt(3)-2'],['（1.5，√3/2）','(3/2,sqrt(3)/2)'],['９＜ｒ＜３０','9<r<30']])assert.equal(await norm(input),expected);
 assert.equal(await norm('(4/3)π'),await norm('4π/3'));assert.equal(await norm('(D)'),'d');assert.equal(await norm('(sqrt(3))/2'),await norm('sqrt(3)/2'));assert.equal(await norm('4/3*pi'),await norm('4π/3'));assert.notEqual(await norm('4π/3'),await norm('4/(3π)'));assert.notEqual(await norm('4π/3'),await norm('4/3pi'));assert.notEqual(await norm('(1,2)'),await norm('(2,1)'));
 for(const x of ['1/0','a'.repeat(251),'x;drop table test',''])await assert.rejects(norm(x),/invalid_response/);
 await db.exec('set role authenticated');await assert.rejects(norm('1/2'),/permission denied/);
 }finally{await db.close()}
});
test('最後答案與計算過程分開保存，過程選填且不替代最後答案',()=>{
 const value={answer:'3/2',working:'先列比例，再約分。'};assert.deepEqual(mathResponseValue(value),value);assert(mathResponseComplete(value));assert(!mathResponseComplete({answer:' ',working:'有過程'}));assert.deepEqual(mathResponseValue('2'),{answer:'2',working:''});assert.deepEqual(mathResponseValue(null),{answer:'',working:''});
 assert.equal(mathResponseError(value),'');for(const answer of ['55°','55度','1/0','1;DROP','1^2'])assert(mathResponseError({answer,working:''}));assert.equal(mathResponseError({answer:'55',working:''}),'');
});
test('原頁局部顯示保留原圖比例，錯誤或越界座標不套用',()=>{
 assert.deepEqual(sourceCropStyle({x:100,y:200,width:400,height:300,sourceWidth:800,sourceHeight:1200}),{aspectRatio:String(4/3),width:'200%',left:'-25%',top:String(-200/3)+'%'});
 for(const x of [null,{}, {x:-1,y:0,width:1,height:1,sourceWidth:10,sourceHeight:10},{x:9,y:0,width:2,height:1,sourceWidth:10,sourceHeight:10}])assert.equal(sourceCropStyle(x),null);
});
