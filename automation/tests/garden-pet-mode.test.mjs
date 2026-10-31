import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {setup,growth,leaves} from '../lib/garden-level2-local-db.mjs';import {createCompanionPolicy} from '../../shared/garden-companion-policy.mjs';
test('each pet remembers its own mode; additive migration preserves legacy choices, reruns and rejects invalid writes',async()=>{
 const db=await setup();try{await leaves(db,48);await growth(db);const call=async(action='get',data={})=>(await db.query('select garden_companions($1,$2,$3) r',['grade3-115-1',action,data])).rows[0].r;
 assert.equal((await call()).petMode,'walk');await call('save',{pet:'cat',home:'b',homeVisible:false});const before=(await db.query("select to_jsonb(c)-'modes' v from garden_companion_choices c")).rows[0].v;
 // Model the currently deployed legacy table, which has no modes column.
 await db.exec('alter table garden_companion_choices drop column modes');
 await db.exec(await fs.readFile('supabase/garden-pet-mode.sql','utf8'));assert.deepEqual((await db.query("select to_jsonb(c)-'modes' v from garden_companion_choices c")).rows[0].v,before);
 assert.equal((await call('save',{petMode:'rest'})).homeVisible,true);assert.equal((await call()).petMode,'rest');
 assert.equal((await call('save',{pet:'dog'})).petMode,'walk');await call('save',{petMode:'rest'});assert.equal((await call('save',{pet:'rabbit'})).petMode,'walk');
 assert.equal((await call('save',{pet:'cat'})).petMode,'rest');assert.equal((await call('save',{home:'a'})).petMode,'rest');
 assert.equal((await call('save',{homeVisible:false})).petMode,'walk');assert.equal((await call('save',{pet:'dog'})).petMode,'rest');
 await db.exec(await fs.readFile('supabase/garden-pet-mode.sql','utf8'));assert.equal((await call()).petMode,'rest');
 for(const petMode of [null,1,true,{},[],'sleep','REST'])await assert.rejects(call('save',{petMode}),/invalid_request/);
 await db.query("select set_config('test.uid','00000000-0000-4000-8000-000000000002',false)");assert.equal((await call()).petMode,'walk');
 await db.exec('set role anon');await assert.rejects(db.query("select garden_companions('grade3-115-1')"),/permission denied/);await db.exec('reset role');
 }finally{await db.close()}
});
test('saved intent restores once; rain does not overwrite it or wake the pet on repeated state messages',()=>{
 const p=createCompanionPolicy();p.configure({petUnlocked:true,homeVisible:true,petMode:'rest'});assert.equal(p.snapshot().mode,'rest');
 p.configure({petUnlocked:true,homeVisible:true,petMode:'walk'});assert.equal(p.snapshot().mode,'walk');
 p.weather('downpour');p.weather('day');p.configure({petUnlocked:true,homeVisible:true,petMode:'walk'});assert.equal(p.snapshot().mode,'rest');
 p.command('walk');assert.equal(p.snapshot().mode,'walk');p.reset();p.configure({petUnlocked:true,petMode:'rest'});assert(p.snapshot().forceRest);
});
