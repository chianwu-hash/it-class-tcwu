import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {WEEK13_LEVELS as levels,getWeek13KeyboardTarget as target} from '../../grade3/115-1/week13-content.mjs';
import {buildKeyboardGuideModel as model} from '../../shared/typing-guide-model.mjs';
import {WEEK11_LEVELS} from '../../grade3/115-1/week11-content.mjs';
import {WEEK12_LEVELS} from '../../grade3/115-1/week12-content.mjs';
const read=p=>fs.readFile(new URL('../../'+p,import.meta.url),'utf8');

test('boss original and replay advance to distinct Chinese sentences while retaining five-line difficulty',()=>{
 const boss=levels.find(x=>x.id===6),earlier=new Set(levels.filter(x=>x.id<6).flatMap(x=>[x.ans,x.replay]));
 const original=boss.ans.split('\n'),replay=boss.replay.split('\n');
 assert.equal(original.length,5);assert.equal(replay.length,5);
 assert.ok(!earlier.has(original[0]));assert.ok(!earlier.has(replay[0]));assert.notEqual(original[0],replay[0]);
 assert.ok([...original[0]].length>=25&&[...replay[0]].length>=25);
 const english=[...original.slice(1),...replay.slice(1)];
 const previous=new Set([...WEEK11_LEVELS,...WEEK12_LEVELS].flatMap(x=>[x.ans,x.replay]).flatMap(x=>x.split('\n')));
 assert.equal(new Set(english).size,8,'原題與換題應有八行不同的新英文');
 for(const line of english){assert.ok(!earlier.has(line));assert.ok(!previous.has(line));assert.ok(!/what color|it.s (red|white|blue)/i.test(line));}
 assert.match(boss.ans,/I lost my bag\./);assert.match(boss.ans,/I see a rainbow!/);assert.match(boss.replay,/Good afternoon\./);
});

test('all six original/replay texts have complete phonetics and working keys',()=>{
 assert.equal(levels.length,6);
 for(const l of levels){assert.notEqual(l.ans,l.replay);for(const answer of [l.ans,l.replay])for(const line of answer.split('\n')){
  const t=target(line),m=model(typeof t==='string'?{lang:'en',text:t}:t);
  assert.equal(m.warning,'',line);assert.equal(m.items.map(x=>x.char).join(''),line);
  assert.ok(m.items.filter(x=>x.kind==='han').every(x=>x.keys.length>0),line);
 }}
 const growing=model(target(levels[4].replay)).items.find(x=>x.char==='長');assert.equal(growing.syllable,'ㄓㄤˇ');
 assert.equal(model(target('紅紅的屋頂')).items.find(x=>x.char==='的').keys.at(-1),'7');
 assert.equal(model(target('安平古堡')).items[0].keys.at(-1),'space');
 assert.match(model(target('未核新句')).warning,/注音/);
});
test('the entire formal typing UI is in fast tasks; primary exercises remain native and separate',async()=>{
 const html=await read('grade3/115-1/week13.html');
 const mainEnd=html.indexOf('<section id="fast-tasks"');
 assert.ok(mainEnd>html.indexOf('<section id="message-card"'));
 assert.ok(html.indexOf('id="typing-levels-container"')>mainEnd);
 assert.equal((html.match(/id="input-level[1-6]"/g)||[]).length,6);
 assert.equal((html.match(/data-tab-field=/g)||[]).length,3);
 assert.ok(!html.slice(0,mainEnd).includes('onclick="checkLevel'));
 assert.match(html,/中英打沒有全班必做關數/);
 assert.ok(!html.includes('先完成中文、英文各一關'));
 assert.ok(!html.includes('先確認是自己的帳號'));assert.ok(!html.includes('id="course-identity-status"'));assert.ok(!html.includes('id="login"'));
 for(const id of ['shift-practice','mood-practice','tab-greeting','tab-mood','tab-wish'])assert.match(html,new RegExp('id="'+id+'"(?![^>]*disabled)'));
 const practice=await read('grade3/115-1/week13-practice.mjs');assert.ok(!/localStorage|supabase|preventDefault|checkLevel/.test(practice));
});
test('formal auth, guide refresh, registration and reward catalog use exactly week13 six-level identity',async()=>{
 const js=await read('grade3/115-1/week13.js');
 assert.match(js,/initGoogleCourseAuth/);assert.match(js,/createGoogleCourseProgress/);assert.match(js,/weekCode: '13'/);assert.match(js,/activityKey: 'typing_task_6'/);assert.match(js,/getWeek13KeyboardTarget/);
 assert.ok(!/weekCode: '12'|localStorage|\.upsert\(/.test(js));
 const sql=await read('supabase/grade3_week13_typing.sql');assert.match(sql,/'13','typing_task_6',6/);assert.match(sql,/five-then-flower/);assert.ok(!/create function|delete from|student_progress/i.test(sql));
 const config=await read('shared/reward-tree-config.js');assert.match(config,/weekCode: '13', activityKey: 'typing_task_6'.*week13\.html#typing/);
});
