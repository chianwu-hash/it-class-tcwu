import test from 'node:test';import assert from 'node:assert/strict';
import {setupMediaDB} from '../fixtures/partner-message-db.mjs';
test('message media authenticated ownership, private drafts, atomic send, idempotency and original state',async()=>{
 const {db,call,set,room,other}=await setupMediaDB();try{
 const qid=(await call(1,{action:'snapshot',roomId:room.id})).exercise.mine[0].id,payload={version:1,strokes:[[[0,0],[1,1]]]};
 const intent=async(n=1,overrides={})=>call(n,{action:'intent',roomId:room.id,purpose:'ask',qid,kind:'drawing_v1',clientId:crypto.randomUUID(),sha256:'a'.repeat(64),bytes:48,strokeCount:1,...overrides},true);
 let a=await intent();const cid=crypto.randomUUID(),once=await intent(1,{clientId:cid});assert.equal((await intent(1,{clientId:cid})).id,once.id);await assert.rejects(()=>intent(1,{clientId:cid,sha256:'b'.repeat(64)}),/CONFLICT/);
 await set(1);await assert.rejects(()=>db.query(`select public.quiz_partner_message_finalize($1,$2,$3)`,[a.id,'a'.repeat(64),payload]),/permission denied/);await db.exec('reset role');
 const finalize=async attachment=>{await db.exec('set role service_role');try{return(await db.query('select public.quiz_partner_message_finalize($1,$2,$3) data',[attachment.id,'a'.repeat(64),payload])).rows[0].data;}finally{await db.exec('reset role');}};
 await finalize(a);assert.equal((await call(1,{action:'describe',roomId:room.id,id:a.id},true)).state,'ready');await assert.rejects(()=>call(2,{action:'describe',roomId:room.id,id:a.id},true),/MEDIA_DENIED/);await assert.rejects(()=>call(3,{action:'describe',roomId:room.id,id:a.id},true),/NOT_MEMBER/);
 const before=(await db.query(`select jsonb_build_object('answers',(select jsonb_agg(to_jsonb(x)) from partner_pilot.answers x),'awards',(select jsonb_agg(to_jsonb(x)) from partner_pilot.awards x),'leaves',(select jsonb_agg(to_jsonb(x)) from public.quiz_learning_leaves x)) data`)).rows[0].data;
 const state={view:'practice',drafts:{},editing:[],open:[],attempts:{},media:{['ask-'+qid]:[a]}};
 await call(1,{action:'save_draft',roomId:room.id,draftRevision:0,state},true);assert.equal((await call(1,{action:'describe',roomId:room.id,id:a.id},true)).state,'draft_saved');
 const send={action:'ask',roomId:room.id,qid,text:'',attachmentIds:[a.id],requestId:crypto.randomUUID()},snapshot=await call(1,send,true);assert.equal(snapshot.exercise.notes.length,1);assert.equal(snapshot.exercise.notes[0].attachments[0].id,a.id);assert.equal(snapshot.exercise.notes[0].text,'');assert(!JSON.stringify(snapshot.exercise.notes).includes('strokes'));assert(!JSON.stringify(snapshot.exercise.notes).includes('objectKey'));
 const repeated=await call(1,send,true);assert.equal(repeated.revision,snapshot.revision);assert.equal(repeated.exercise.notes.length,1);await assert.rejects(()=>call(1,{...send,text:'different'},true),/REQUEST_REUSED/);await assert.rejects(()=>call(1,{...send,requestId:crypto.randomUUID()},true),/MEDIA_DENIED/);assert.equal((await call(2,{action:'describe',roomId:room.id,id:a.id},true)).state,'linked');
 await assert.rejects(()=>call(1,{action:'save_draft',roomId:room.id,draftRevision:1,state},true),/INVALID_DRAFT_MEDIA/);
 const thread=snapshot.exercise.notes[0].id;const reply=await call(2,{action:'intent',roomId:room.id,purpose:'reply',thread,kind:'drawing_v1',clientId:crypto.randomUUID(),sha256:'a'.repeat(64),bytes:48,strokeCount:1},true);await finalize(reply);await assert.rejects(()=>call(2,{action:'chat',roomId:room.id,text:'',attachmentIds:[reply.id]},true),/MEDIA_DENIED/);const rs=await call(2,{action:'reply',roomId:room.id,thread,text:'',attachmentIds:[reply.id]},true);assert.equal(rs.exercise.notes[1].qid,qid);
 await assert.rejects(()=>call(1,{action:'intent',roomId:other.id,purpose:'ask',qid,kind:'drawing_v1',clientId:crypto.randomUUID(),sha256:'a'.repeat(64),bytes:48,strokeCount:1},true),/NOT_MEMBER/);
 const after=(await db.query(`select jsonb_build_object('answers',(select jsonb_agg(to_jsonb(x)) from partner_pilot.answers x),'awards',(select jsonb_agg(to_jsonb(x)) from partner_pilot.awards x),'leaves',(select jsonb_agg(to_jsonb(x)) from public.quiz_learning_leaves x)) data`)).rows[0].data;assert.deepEqual(after,before);
 await call(2,{action:'chat',roomId:room.id,text:'原文字訊息仍可用'});assert.equal((await call(1,{action:'snapshot',roomId:room.id})).exercise.notes.length,3);
 const again=await intent();await finalize(again);const fresh=await call(1,{action:'snapshot',roomId:room.id});
 await call(1,{action:'save_draft',roomId:room.id,draftRevision:fresh.exercise.privateDraft.revision,state:{view:'practice',drafts:{['ask-'+qid]:'draft sent'},attempts:{},open:[],editing:[],media:{'chat-':'legacy malformed value'}}});
 const cleaned=await call(1,{action:'ask',roomId:room.id,qid,text:'draft sent',attachmentIds:[again.id]},true);assert.equal(cleaned.exercise.privateDraft.state.drafts['ask-'+qid],undefined);
 for(const fn of ['public.quiz_partner_message_action(jsonb)','public.quiz_partner_message_finalize(uuid,text,jsonb)','partner_pilot.learning_snapshot(uuid)','partner_pilot.learning_snapshot_pre_message_media(uuid)'])assert.equal((await db.query(`select has_function_privilege('anon',$1,'execute') ok`,[fn])).rows[0].ok,false);
 assert.equal((await db.query(`select public from storage.buckets where id='partner-message-media'`)).rows[0].public,false);
 }finally{await db.close();}
});
