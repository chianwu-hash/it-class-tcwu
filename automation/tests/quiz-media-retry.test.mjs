import test from 'node:test';import assert from 'node:assert/strict';import {configureQuizMedia,resolveQuizMedia} from '../../shared/quiz-media.mjs';
test('媒體短暫讀取失敗只重試一次，登入或存取拒絕不重試',async()=>{
 const url='https://quiz-media.invalid/00000000-0000-4000-8000-000000000001/'+'a'.repeat(64);let calls=0;
 configureQuizMedia(async()=>{if(++calls===1)throw Object.assign(Error('暫時不可用'),{code:'service_unavailable'});return 'https://example.invalid/signed';});assert.equal(await resolveQuizMedia(url),'https://example.invalid/signed');assert.equal(calls,2);
 calls=0;configureQuizMedia(async()=>{calls++;throw Object.assign(Error('登入已變更'),{code:'login_required'});});await assert.rejects(resolveQuizMedia(url),/登入已變更/);assert.equal(calls,1);
 calls=0;configureQuizMedia(async()=>{calls++;throw Object.assign(Error('媒體不可用'),{code:'media_unavailable'});});await assert.rejects(resolveQuizMedia(url),/媒體不可用/);assert.equal(calls,2);
});
