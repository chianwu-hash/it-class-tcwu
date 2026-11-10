import test from 'node:test';import assert from 'node:assert/strict';
import {EDIT_TASKS,newEditState,copyEditState,recordEdit,recordMove,checkEdit,isRescueDeletion,restoreEditSnapshot} from '../../grade3/115-1/week11-edit-practice.mjs';
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
test('整段誤刪經復原後解除重做限制，可以繼續局部修正',()=>{
 const task=EDIT_TASKS[0],v=task.variants[0];let s=newEditState();
 const before={value:v.seed,start:0,end:v.seed.length,state:copyEditState(s)};
 recordEdit(s,task,v,before,'','deleteContentBackward');assert.equal(s.restartNeeded,true);
 s=restoreEditSnapshot(before,s);assert.equal(s.restartNeeded,false);assert.equal(s.undoCount,1);
 recordEdit(s,task,v,{value:v.seed,start:2,end:2},v.target,'deleteContentBackward');assert.equal(checkEdit(s,task,v,v.target).ok,true);
});
test('復原誤刪保留先前已完成的正確操作，文字補回後可完成',()=>{
 const task=EDIT_TASKS[2],v=task.variants[0];let s=newEditState();
 recordEdit(s,task,v,{value:v.seed,start:6,end:6},v.intermediate,'deleteContentBackward');
 const before={value:v.intermediate,start:0,end:v.intermediate.length,state:copyEditState(s)};
 recordEdit(s,task,v,before,'','deleteContentBackward');s=restoreEditSnapshot(before,s);
 assert.equal(s.deletions.size,1);assert.equal(checkEdit(s,task,v,v.target).ok,true);
 s.deletions.clear();assert.equal(before.state.deletions.size,1,'snapshot sets cannot share mutable state');
});
test('復原專題兩組都需先誤刪指定正確字並救回，直接修多字不算',()=>{
 const task=EDIT_TASKS.find(t=>t.id==='undo');for(const v of task.variants){let s=newEditState();
 recordEdit(s,task,v,{value:v.seed,start:2,end:2},v.target,'deleteContentBackward');assert.equal(checkEdit(s,task,v,v.target).ok,false);
 s=newEditState();const i=v.seed.indexOf(v.rescueChar),before={value:v.seed,start:i,end:i,state:copyEditState(s)},wrong=v.seed.slice(0,i)+v.seed.slice(i+1);
 assert.equal(isRescueDeletion(task,v,before,wrong,'deleteContentForward'),true);
 assert.equal(isRescueDeletion(task,v,before,v.target,'deleteContentForward'),false);
 s=restoreEditSnapshot(before,s,true);recordEdit(s,task,v,{value:v.seed,start:2,end:2},v.target,'deleteContentBackward');assert.equal(checkEdit(s,task,v,v.target).ok,true);
 }
});
test('取消組字或沒有文字改動，不誤判為整段替換',()=>{
 const task=EDIT_TASKS[0],v=task.variants[0],s=newEditState();recordEdit(s,task,v,{value:v.seed,start:0,end:v.seed.length},v.seed,'insertCompositionText');assert.equal(s.restartNeeded,false);
});
