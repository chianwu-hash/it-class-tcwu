import test from 'node:test';
import assert from 'node:assert/strict';
import {eraseStrokes,strokeColors,DEFAULT_PEN} from '../../shared/partner-pilot/sketch-model.mjs';
import {validateSketch} from '../../shared/partner-pilot/media-contract.mjs';
const old={version:1,strokes:[[[.1,.2],[.8,.2]],[[.1,.8],[.8,.8]]]};
test('legacy drawings retain default ink; optional color map is strictly bounded',()=>{assert.equal(validateSketch(old),old);assert.deepEqual(strokeColors(old),[DEFAULT_PEN,DEFAULT_PEN]);assert.doesNotThrow(()=>validateSketch({...old,colors:['#b83246','#2459b3']}));for(const colors of [['red'],['#b83246'],null,['#b83246','url(x)']])assert.throws(()=>validateSketch({...old,colors}));});
test('swept eraser catches crossed line, preserves other strokes and matching colors',()=>{const v={...structuredClone(old),colors:['#b83246','#2459b3']},next=eraseStrokes(v,[.4,0],[.4,.4]);assert.deepEqual(next.strokes,[old.strokes[1]]);assert.deepEqual(next.colors,['#2459b3']);assert.equal(v.strokes.length,2);assert.doesNotThrow(()=>validateSketch(next));});
test('empty eraser hit is unchanged; endpoint and short stroke hits work without white ink',()=>{assert.deepEqual(eraseStrokes(old,[.9,.5],[1,.5]),old);assert.equal(eraseStrokes(old,[.1,.2],[.1,.2]).strokes.length,1);const dot={version:1,strokes:[[[.5,.5]]]};assert.equal(eraseStrokes(dot,[.4,.5],[.6,.5]).strokes.length,0);});
