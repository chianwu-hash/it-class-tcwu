import test from 'node:test';
import assert from 'node:assert/strict';
import {splitWorkSketch,mergeWorkSketch} from '../../shared/quiz-work-sketch-groups.mjs';
import {validateSketch} from '../../shared/sketch/contract.mjs';

test('subquestion sheets round-trip one existing sketch envelope, colors and boundaries',()=>{
 const parts=[{version:1,strokes:[[[0,0],[1,1]]],colors:['#2459b3']},{version:1,strokes:[[[.2,.1],[.8,.9]]],colors:['#b83246']}],raw=mergeWorkSketch(parts);validateSketch(raw);assert.deepEqual(Object.keys(raw),['version','strokes','colors']);assert.deepEqual(raw.colors,['#2459b3','#b83246']);
 const restored=splitWorkSketch(raw,2);for(const [i,part]of restored.entries())for(const [j,stroke]of part.strokes.entries())for(const [k,point]of stroke.entries())point.forEach((n,axis)=>assert.ok(Math.abs(n-parts[i].strokes[j][k][axis])<1e-12));
 assert.equal(splitWorkSketch({version:1,strokes:[[[.1,.1],[.6,.9]]]},2),null,'old crossing stroke must remain one whole sheet');assert.deepEqual(splitWorkSketch(undefined,2),[{version:1,strokes:[],colors:[]},{version:1,strokes:[],colors:[]}]);
 assert.equal(splitWorkSketch(raw,1),null);assert.equal(splitWorkSketch({...raw,extra:1},2),null);assert.throws(()=>mergeWorkSketch([parts[0]]));
 assert.deepEqual(splitWorkSketch({version:1,strokes:[],colors:[]},2),splitWorkSketch(undefined,2),'cleared draft must reopen as separate empty regions');assert.equal(splitWorkSketch({version:1,strokes:[],colors:['#2459b3']},2),null);assert.equal(splitWorkSketch({version:1,strokes:[],extra:true},2),null);
});
test('subquestion sheets retain the shared eighty-stroke and point limits',()=>{
 const part=n=>({version:1,strokes:Array.from({length:n},()=>[[.2,.2],[.4,.4]])});assert.equal(mergeWorkSketch([part(45),part(35)]).strokes.length,80);assert.throws(()=>mergeWorkSketch([part(45),part(36)]));assert.throws(()=>mergeWorkSketch([{version:1,strokes:[Array.from({length:129},()=>[.1,.1])]},part(1)]));
 const partial=mergeWorkSketch([part(1),part(0)]);assert.equal(splitWorkSketch(partial,2)[1].strokes.length,0,'saved partial work remains readable even if new UI rejects incomplete groups');
});
test('the maximum real editor sample count stays below the existing byte limit after scaling',()=>{
 const make=offset=>({version:1,strokes:Array.from({length:40},(_,i)=>Array.from({length:128},(_,j)=>[((i*128+j+offset)%10001)/10000,((i*317+j*73+offset)%10001)/10000])),colors:Array(40).fill('#2459b3')}),parts=[make(17),make(838)],value=mergeWorkSketch(parts),bytes=new TextEncoder().encode(JSON.stringify(value)).length;validateSketch(value);assert.equal(value.strokes.length,80);assert.ok(bytes<200000,'actual4-decimal editor samples must fit well below256KiB');
 const restored=splitWorkSketch(value,2);for(const[i,p]of restored.entries())for(const[j,s]of p.strokes.entries())for(const[k,point]of s.entries())point.forEach((n,axis)=>assert.ok(Math.abs(n-parts[i].strokes[j][k][axis])<.000002));
});
