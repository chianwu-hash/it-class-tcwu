import test from 'node:test';import assert from 'node:assert/strict';
import {keepsakeGrowthSvg,createKeepsakeGrowth} from '../../shared/partner-pilot/keepsake-growth.mjs';
test('成長場景只採伺服器紀念數量，保留金邊雙葉與愛心花識別',()=>{
 for(const [leaves,flowers] of [[1,0],[2,0],[0,1]]){const a={leaves,flowers},before=JSON.stringify(a),s=keepsakeGrowthSvg(a);assert.equal((s.match(/data-kg-item="leaf"/g)||[]).length,leaves);assert.equal((s.match(/data-kg-item="flower"/g)||[]).length,flowers);assert.match(s,/#b88632/);assert.doesNotMatch(s,/\bid=|<script|onload=|href=/);assert.equal(JSON.stringify(a),before);}
 assert.equal(keepsakeGrowthSvg({leaves:0,flowers:0}),'');assert.equal(keepsakeGrowthSvg({leaves:'2',flowers:-1}),'');
 const two=keepsakeGrowthSvg({leaves:2,flowers:0});assert.equal((two.match(/data-kg="leaf-l"/g)||[]).length,2);
 assert(!keepsakeGrowthSvg({flowers:1},{label:'" onload="bad'}).includes('onload="bad'));
});
test('沒有場景與不支援動效時正常退回完整靜態圖',async()=>{
 const p=createKeepsakeGrowth();assert.equal(await p.play(null).finished,'none');
 const svg={matches:()=>true,dataset:{}};assert.equal(await p.play(svg,{reduced:true}).finished,'static');assert.equal(svg.dataset.growth,'static');p.stop();p.stop();
});
