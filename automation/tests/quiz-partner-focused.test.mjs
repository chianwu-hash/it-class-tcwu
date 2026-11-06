import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampAttention} from '../../shared/partner-pilot/camp-attention.mjs';
import {practiceUnits} from '../../shared/partner-pilot/practice-model.mjs';

test('營地首次不彈歷史訊息，只有夥伴請教及回覆本人請教才提示',()=>{
 const a=createCampAttention(),notes=[{id:1,kind:'ask',user:'me',text:'我的問題'},{id:2,kind:'ask',user:'peer',text:'歷史請教'}];
 assert.deepEqual(a.update('r','me',notes),[]);assert.equal(a.count(),1);
 a.read([2]);assert.equal(a.count(),0);
 const unrelated={id:3,kind:'reply',thread:2,user:'other',text:'回覆別人'},related={id:4,kind:'reply',thread:1,user:'peer',text:'回覆我'},chat={id:5,kind:'chat',user:'peer',text:'我在這裡'};
 notes.push(unrelated,related,chat);assert.deepEqual(a.update('r','me',notes),[related]);assert.equal(a.count(),2);
 assert.deepEqual(a.update('r','me',structuredClone(notes)),[]);a.read([4]);assert.equal(a.count(),1);
 assert.deepEqual(a.update('new','me',notes),[]);assert.equal(a.count(),2);assert(!a.unread(5));
 a.update('new','peer',notes);assert(!a.unread(4));
});
test('已讀只清指定快照，後到訊息仍待查看；聊天只統計可見最近三十則',()=>{
 const a=createCampAttention();a.update('r','me',[]);
 const notes=Array.from({length:35},(_,i)=>({id:i+1,kind:'chat',user:'peer',text:String(i)}));
 a.update('r','me',notes);assert.equal(a.count(),30);assert(!a.unread(1));
 a.read([6,7]);notes.push({id:36,kind:'chat',user:'peer',text:'稍後抵達'});a.update('r','me',notes);assert(a.unread(36));assert.equal(a.count(),29);
 a.clear();assert.equal(a.count(),0);
});
test('只將本人原卷同段欄位一起顯示，不新增、改序或重配題目',()=>{
 const mine=[{id:1},{id:2,past:{group:'read'}},{id:3,past:{group:'read'}},{id:4,past:{group:'draw'}},{id:5}];
 const before=structuredClone(mine),units=practiceUnits(mine);
 assert.deepEqual(units.map(u=>u.questions.map(q=>q.id)),[[1],[2,3],[4],[5]]);assert.deepEqual(mine,before);assert.equal(units[1].questions[0],mine[1]);
 assert.deepEqual(practiceUnits([]),[]);
});

test('懸浮提醒可接新聊天，基準／本人／同快照不重播，舊toast預設規則保留',()=>{
 const a=createCampAttention(),chat={id:1,kind:'chat',user:'peer',text:'一起練',at:'1'};
 assert.deepEqual(a.update('r','me',[chat],{includeChat:true}),[]);
 const next={...chat,id:2,at:'2'},own={...chat,id:3,user:'me'};
 assert.deepEqual(a.update('r','me',[chat,next,own],{includeChat:true}),[next]);
 assert.deepEqual(a.update('r','me',[chat,next,own],{includeChat:true}),[]);
 assert.deepEqual(a.update('other','me',[chat,next],{includeChat:true}),[]);
 assert.deepEqual(a.update('other','me',[chat,next,{...next,id:4}]),[]);
});
