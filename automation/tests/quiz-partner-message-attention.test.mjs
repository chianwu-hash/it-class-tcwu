import test from 'node:test';
import assert from 'node:assert/strict';
import {createMessageAttention} from '../../shared/partner-pilot/message-attention.mjs';
test('attention persists across snapshots, expires motion after five seconds, and requires acknowledgement',()=>{
 let clock=1000;const a=createMessageAttention({now:()=>clock});
 const notes=[{id:1,user:'peer',kind:'ask',text:'我想問方法',at:'one'},{id:2,user:'me',kind:'reply',text:'自己留下的話'},{id:3,user:'peer',kind:'mark',text:'回顧提醒'}];
 a.update('room','me',notes);assert.equal(a.count(),1);assert(a.state(1).pulse);assert(!a.state(2).unread);
 clock+=3000;a.update('room','me',structuredClone(notes));assert.equal(a.state(1).elapsed,3000);
 clock+=2000;assert(!a.state(1).pulse);assert(a.state(1).unread);assert.equal(a.count(),1);
 a.read(1);a.update('room','me',notes);assert.equal(a.count(),0);
 notes[0].text='更新問題';a.update('room','me',notes);assert(a.state(1).pulse);assert.equal(a.count(),1);
 a.update('room','me',[]);assert.equal(a.count(),0);
});
test('new replies/chat alert independently, and room/account changes never retain another scope',()=>{
 const a=createMessageAttention(),notes=[{id:1,user:'peer',kind:'reply',text:'先想想'},{id:2,user:'peer',kind:'chat',text:'我在這裡'}];
 a.update('room','me',notes);assert.equal(a.count(),2);a.read(1);assert.equal(a.count(),1);
 a.update('other','me',[]);assert.equal(a.count(),0);a.update('room','peer',notes);assert.equal(a.count(),0);
 a.update('room','me',notes);assert.equal(a.count(),2);a.clear();assert.equal(a.count(),0);
});
test('chat unread count covers only the thirty messages displayed in the camp',()=>{
 const a=createMessageAttention();a.update('room','me',Array.from({length:35},(_,i)=>({id:i,user:'peer',kind:'chat',text:'小紙條'+i})));
 assert.equal(a.count(),30);assert(!a.state(0).unread);assert(a.state(34).unread);
});
