import test from 'node:test';import assert from 'node:assert/strict';
import {createCompanionPolicy} from '../../shared/garden-companion-policy.mjs';
test('顯示偏好獨立於休息指令；隱藏先要求散步，不直接清掉屋內角色',()=>{
 const p=createCompanionPolicy();assert.equal(p.command('rest').reason,'locked');p.configure({petUnlocked:true,homeVisible:false});
 assert.equal(p.snapshot().mode,'walk');p.command('show');assert.equal(p.snapshot().preferredVisible,true);assert.equal(p.snapshot().mode,'walk');
 p.command('rest');p.observe({inside:true,visible:true});assert.equal(p.snapshot().forceRest,true);
 p.command('hide');assert.equal(p.snapshot().preferredVisible,false);assert.equal(p.snapshot().forceRest,false);assert.equal(p.snapshot().visible,true);assert.equal(p.snapshot().inside,true);
 p.observe({visible:false,inside:false});assert.equal(p.snapshot().visible,false);
});
test('大雨雷雨強制回窩，拒絕出窩／隱藏；雨停保留休息而非自動出窩',()=>{
 for(const scene of ['downpour','thunder']){const p=createCompanionPolicy();p.configure({petUnlocked:true,homeVisible:false});p.weather(scene);
 assert.equal(p.snapshot().preferredVisible,false);assert.equal(p.snapshot().forceRest,true);assert.equal(p.command('walk').reason,'rain');assert.equal(p.command('hide').reason,'rain');
 p.configure({petUnlocked:true,homeVisible:false});assert.equal(p.snapshot().mode,'rest');p.weather('drizzle');assert.equal(p.snapshot().mode,'rest');assert.equal(p.snapshot().canLeave,true);
 assert.equal(p.command('walk').ok,true);assert.equal(p.snapshot().forceRest,false);
 }
});
test('晴陰與毛毛雨可自由進出，狀態觀察不能偽造解鎖；重設清除前一使用者',()=>{
 const p=createCompanionPolicy();for(const scene of ['day','cloudy','drizzle']){p.configure({petUnlocked:true,homeVisible:true});p.weather(scene);assert.equal(p.command('rest').ok,true);assert.equal(p.command('walk').ok,true)}
 p.reset();p.observe({inside:true,visible:true,owned:true,wet:false});assert.equal(p.command('walk').reason,'locked');assert.equal(p.command('javascript:alert(1)').reason,'locked');p.configure({petUnlocked:true});assert.equal(p.command('bad').reason,'invalid_command');
});
