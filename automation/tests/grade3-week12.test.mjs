import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {CLIPBOARD_TASKS as tasks,freshClipboardState,sourceRecord,applyClipboardEdit,checkClipboard} from '../../grade3/115-1/week12-clipboard.mjs';
import {WEEK12_LEVELS as levels,describeWeek12Mismatch} from '../../grade3/115-1/week12-content.mjs';
import {WEEK11_LEVELS as old} from '../../grade3/115-1/week11-content.mjs';
for(const task of tasks)for(const [index,v]of task.variants.entries())test(`${task.id} variant ${index+1}: result alone cannot replace required native operation`,()=>{
 const state=freshClipboardState();
 if(!v.target){assert.equal(checkClipboard(v,state,v.seed,v.word).ok,true);assert.equal(checkClipboard(v,state,v.seed,v.word+'。').ok,false);return;}
 assert.equal(checkClipboard(v,state,v.target,'').ok,false);
 const start=v.seed.indexOf(v.word),end=start+v.word.length;
 state.record=sourceRecord(v,v.kind,v.seed,start,end);assert.ok(state.record);
 assert.equal(sourceRecord(v,v.kind,v.seed,start,end+1),null);
 let current=v.seed,s=state;
 if(v.kind==='cut'){
  current=v.seed.slice(0,start)+v.seed.slice(end);
  s=applyClipboardEdit(v,s,{type:'deleteByCut',before:v.seed,after:current,cut:state.record});
  assert.equal(s.record.removed,true);
 }
 const from=v.replace?current.lastIndexOf(v.replace):v.kind==='cut'&&task.id==='decide'?current.indexOf('\n'):current.length;
 const to=v.replace?from+v.replace.length:from;
 const after=current.slice(0,from)+v.word+current.slice(to);
 assert.equal(after,v.target);
 s=applyClipboardEdit(v,s,{type:'insertFromPaste',before:current,start:from,end:to,text:v.word,after});
 assert.equal(checkClipboard(v,s,after,'').ok,true);
 const wrong=applyClipboardEdit(v,s,{type:'insertText',after:after+'x'});
 assert.equal(wrong.proof,false);
 assert.equal(checkClipboard(v,wrong,v.target,'').ok,false);
 assert.equal(applyClipboardEdit(v,freshClipboardState(),{type:'insertFromPaste',before:current,start:from,end:to,text:v.word,after}).proof,false);
});
test('six fixed textbook texts remain exact previously verified excerpts, and mixed questions retain line boundaries',()=>{
 const existing=new Set(old.flatMap(v=>[v.ans,v.replay]));
 for(const v of levels){assert.ok(existing.has(v.ans));assert.ok(existing.has(v.replay));assert.notEqual(v.ans,v.replay);}
 assert.equal(levels.length,6);assert.equal(levels[5].ans.split('\n').length,3);
 assert.match(describeWeek12Mismatch(levels[5].ans,levels[5].ans.replace('book','boox')),/第 3 行/);
});
test('page follows shared auth/progress, native clipboard exception and explicit opt-in rewards',async()=>{
 const read=p=>fs.readFile(p,'utf8');
 const html=await read('grade3/115-1/week12.html'),js=await read('grade3/115-1/week12.js'),sql=await read('supabase/grade3_week12_typing.sql');
 assert.match(js,/container\.inert/);assert.match(js,/if \(!auth.hasIdentity\(\) \|\| container.inert\) return false/);assert.match(js,/weekCode: '12'/);assert.match(js,/initTypingChallenge/);
 assert.doesNotMatch(js,/localStorage|signInWithOAuth/);assert.match(html,/id="clipboard-practice"/);
 assert.match(html,/quiz-library.html/);assert.match(html,/期末範圍/);assert.match(html,/data-image-lightbox/);
 assert.equal((html.match(/data-clip-task=/g)||[]).length,5);
 assert.equal((html.match(/onpaste="return false"/g)||[]).length,6);
 assert.match(sql,/five-then-flower/);assert.doesNotMatch(sql,/create or replace function|update public\.student_progress|disable row level security/i);
});
