import test from 'node:test';import assert from 'node:assert/strict';
import {EDIT_TASKS,newEditState,recordEdit,recordMove,checkEdit} from '../../grade3/115-1/week11-edit-practice.mjs';
test('兩組左刪、右刪與錯字替換都需指定的單字元刪除，不只比對最後文字',()=>{
 for(const task of EDIT_TASKS.slice(0,3))for(const variant of task.variants){
  const s=newEditState();assert.equal(checkEdit(s,task,variant,variant.target).ok,false);
  let index=0;while(variant.seed.slice(0,index)+variant.seed.slice(index+1)!==variant.intermediate)index++;
  const type=task.key||'deleteContentBackward',start=type==='deleteContentBackward'?index+1:index;
  recordEdit(s,task,variant,{value:variant.seed,start,end:start},variant.intermediate,type);
  assert.equal(checkEdit(s,task,variant,variant.target).ok,true);
 }
});
test('左刪不能以Delete代替，右刪不能以Backspace代替',()=>{
 for(const task of EDIT_TASKS.slice(0,2)){const v=task.variants[0],s=newEditState();let index=0;while(v.seed.slice(0,index)+v.seed.slice(index+1)!==v.target)index++;
 const type=task.key==='deleteContentBackward'?'deleteContentForward':'deleteContentBackward',start=type==='deleteContentBackward'?index+1:index;
 recordEdit(s,task,v,{value:v.seed,start,end:start},v.target,type);assert.equal(checkEdit(s,task,v,v.target).ok,false);}
});
test('整段清除或全選替換後，重打正確文字也須重新開始',()=>{
 const t=EDIT_TASKS[0],v=t.variants[0];for(const [after,type]of [['','deleteContentBackward'],[v.target,'insertText']]){const s=newEditState();
 recordEdit(s,t,v,{value:v.seed,start:0,end:v.seed.length},after,type);assert.equal(s.restartNeeded,true);assert.match(checkEdit(s,t,v,v.target).message,/整段/);}
});
test('兩行題要求局部刪除兩處，且上下方向都實際跨行',()=>{
 const t=EDIT_TASKS[3];for(const v of t.variants){const s=newEditState();let current=v.seed;
 for(let row=0;row<2;row++){const lines=current.split('\n'),target=v.target.split('\n')[row];let index=0;while(lines[row].slice(0,index)+lines[row].slice(index+1)!==target)index++;const start=lines.slice(0,row).reduce((n,line)=>n+line.length+1,0)+index;
 const next=current.slice(0,start)+current.slice(start+1);recordEdit(s,t,v,{value:current,start,end:start},next,'deleteContentForward');current=next;}
 assert.equal(checkEdit(s,t,v,current).ok,false);
 recordMove(s,current,current.length,0,'ArrowUp');assert.equal(checkEdit(s,t,v,current).ok,false);
 recordMove(s,current,0,current.length,'ArrowDown');assert.equal(checkEdit(s,t,v,current).ok,true);
 }
});
test('同一行的上下鍵不冒充跨行，錯誤回饋指出行次',()=>{
 const s=newEditState(),t=EDIT_TASKS[3],v=t.variants[0];recordMove(s,v.seed,2,3,'ArrowUp');assert.equal(s.moves.size,0);
 assert.match(checkEdit(s,t,v,v.target.split('\n')[0]+'\n還沒修好').message,/第 2 行/);
});
