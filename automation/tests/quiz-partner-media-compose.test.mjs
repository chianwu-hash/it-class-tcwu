import test from 'node:test';
import assert from 'node:assert/strict';
import {pcmWav,validateWav,validateSketch,hasMessageContent} from '../../shared/partner-pilot/media-contract.mjs';
import {createVoiceRecorder} from '../../shared/partner-pilot/voice-recorder.mjs';
const value=()=>({blob:new Blob([pcmWav(new Float32Array(16000))],{type:'audio/wav'}),duration:1,byteLength:32044,mime:'audio/wav'});
class Recorder {static isTypeSupported(){return true;}constructor(){this.state='inactive';this.mimeType='audio/webm';}start(){this.state='recording';}stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['synthetic'])});this.onstop?.();});}}
const hardware=()=>{const track={stopped:false,stop(){this.stopped=true;}};return {track,stream:{getTracks:()=>[track]}};};
const delay=()=>new Promise(resolve=>setTimeout(resolve,10));
test('WAV validates exact format/duration and trims overlong PCM to thirty seconds',()=>{
 const bytes=pcmWav(new Float32Array(31*16000));assert.equal(bytes.byteLength,960044);assert.equal(validateWav(bytes).duration,30);
 assert.throws(()=>pcmWav(new Float32Array(100)));const corrupt=bytes.slice(0);new DataView(corrupt).setUint32(24,44100,true);assert.throws(()=>validateWav(corrupt));assert.throws(()=>validateWav(bytes.slice(0,-1)));
 const samples=new Float32Array(16000);samples[5]=NaN;assert.throws(()=>pcmWav(samples));
});
test('drawing rejects empty, invalid coordinates and excessive points; media-only messages are valid',()=>{
 const drawing={version:1,strokes:[[[0,0],[1,1]]]};assert.equal(validateSketch(drawing),drawing);for(const bad of [{version:1,strokes:[]},{version:1,strokes:[[[NaN,0]]]},{version:1,strokes:[[[2,0]]]},{version:1,strokes:[Array.from({length:129},()=>[0,0])]},{...drawing,html:'x'}])assert.throws(()=>validateSketch(bad));
 assert(hasMessageContent({audio:value()}));assert(hasMessageContent({sketch:drawing}));assert(!hasMessageContent({text:' ',sketch:{strokes:[]}}));
});
test('microphone is requested only on start; stopping frees every track and preserves processed draft',async()=>{
 const h=hardware();let calls=0;const r=createVoiceRecorder({Recorder,getStream:async()=>{calls++;return h.stream;},normalize:async()=>value()});assert.equal(calls,0);await r.start();assert.equal(calls,1);assert.equal(r.state.status,'recording');await r.stop();assert(h.track.stopped);assert.equal(r.state.status,'ready');assert.equal(r.state.draft.duration,1);r.dispose();
});
test('late microphone permission after camp closes stops tracks without recording',async()=>{
 const h=hardware();let release;const r=createVoiceRecorder({Recorder,getStream:()=>new Promise(resolve=>release=resolve),normalize:async()=>value()});const starting=r.start();assert.equal(r.state.status,'requesting');await r.stop();release(h.stream);await starting;assert(h.track.stopped);assert.equal(r.state.status,'idle');r.dispose();
});
test('failed rerecord keeps previous ready draft; stale processing cannot overwrite the next slot',async()=>{
 const old={...value(),clientAttachmentId:'previous'};let finish;const h=hardware(),r=createVoiceRecorder({Recorder,getStream:async()=>h.stream,normalize:()=>new Promise(resolve=>finish=resolve)});r.setDraft(old);await r.start();const stopping=r.stop();await delay();r.cancel();finish(value());await stopping;await delay();assert.equal(r.state.draft.clientAttachmentId,'previous');r.dispose();
 const h2=hardware(),r2=createVoiceRecorder({Recorder,getStream:async()=>h2.stream,normalize:async()=>{throw Error('轉檔未完成');}});r2.setDraft(old);await r2.start();await r2.stop();assert.equal(r2.state.draft.clientAttachmentId,'previous');assert.match(r2.state.error,/轉檔/);assert(h2.track.stopped);r2.dispose();
});
test('timeout stops recording, denied permission is recoverable and unsupported devices request nothing',async()=>{
 const h=hardware(),r=createVoiceRecorder({Recorder,getStream:async()=>h.stream,normalize:async()=>value(),maxSeconds:.01});await r.start();await new Promise(resolve=>setTimeout(resolve,40));assert.equal(r.state.status,'ready');assert(h.track.stopped);r.dispose();
 const denied=createVoiceRecorder({Recorder,getStream:async()=>{throw Object.assign(Error('no'),{name:'NotAllowedError'});}});await denied.start();assert.match(denied.state.error,/允許/);denied.dispose();let calls=0;const unsupported=createVoiceRecorder({Recorder:null,getStream:async()=>calls++});await unsupported.start();assert.equal(calls,0);assert.match(unsupported.state.error,/不支援/);unsupported.dispose();
});
