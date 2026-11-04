import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {runPreflight,PROJECT,SOURCES} from '../../release/garden-preflight.mjs';
import {expectedCatalog,compareCatalog} from '../../release/garden-catalog.mjs';
import {prepareGardenRelease} from '../prepare-garden-release.mjs';
async function fixture(fn){const root=await fs.mkdtemp(path.join(os.tmpdir(),'garden-gate-'));try{
 await fs.mkdir(root+'/shared');await fs.writeFile(root+'/shared/reward-tree-config.js',`export function getRewardTreeCourses(){return [{id:'grade3-115-1',activities:[{weekCode:'10',activityKey:'typing_task_5',type:'typing',totalLevels:5}]}]}`);
 await fs.writeFile(root+'/shared/typing-foundation-curriculum.mjs',`export const lessons=[{key:'english_01'}]`);await fs.writeFile(root+'/shared/zhuyin-foundation-curriculum.mjs',`export const zhuyinLessons=[{key:'zhuyin_01'}]`);
 await fs.writeFile(root+'/shared/auth.js',`export const SUPABASE_URL='https://${PROJECT}.supabase.co';export const SUPABASE_ANON_KEY='public-test-key';`);
 const catalog=expectedCatalog([{id:'grade3-115-1',activities:[{weekCode:'10',activityKey:'typing_task_5',type:'typing',totalLevels:5}]}],['english_01','zhuyin_01']);
 await fn(root,catalog);
 }finally{await fs.rm(root,{recursive:true,force:true})}}
const response=catalog=>({ok:true,json:async()=>({version:1,project:PROJECT,asOf:new Date().toISOString(),catalog})});
test('matching staged source is checked live with only the public anon key',()=>fixture(async(root,catalog)=>{
 let calls=0;const result=await runPreflight({root,fetcher:async(url,options)=>{calls++;assert.equal(url,`https://${PROJECT}.supabase.co/rest/v1/rpc/garden_catalog_manifest`);assert.equal(options.method,'POST');assert.equal(options.cache,'no-store');assert.equal(options.headers.apikey,'public-test-key');return response(catalog)}});assert(result.passed);assert.equal(calls,1);assert.equal(Object.keys(result.sourceHashes).length,SOURCES.length);assert(!JSON.stringify(result).includes('public-test-key'));
}));
test('missing week10 blocks release',()=>fixture(async(root,catalog)=>{const r=await runPreflight({root,fetcher:async()=>response(catalog.slice(1))});assert(!r.passed);assert.deepEqual(r.missing,['grade3-115-1:10:typing_task_5'])}));
for(const [field,value] of [['kind','quiz'],['total_levels',4],['reward_mode','boss']])test('mismatched '+field+' blocks release',()=>fixture(async(root,catalog)=>{catalog[0][field]=value;const r=await runPreflight({root,fetcher:async()=>response(catalog)});assert(!r.passed);assert(r.mismatched[0].fields.includes(field))}));
test('a changed source is rechecked rather than using an old pass receipt',()=>fixture(async(root,catalog)=>{assert((await runPreflight({root,fetcher:async()=>response(catalog)})).passed);await fs.writeFile(root+'/shared/reward-tree-config.js',`export function getRewardTreeCourses(){return [{id:'grade3-115-1',activities:[{weekCode:'11',activityKey:'new_task',type:'typing',totalLevels:5}]}]}`);assert(!(await runPreflight({root,fetcher:async()=>response(catalog)})).passed)}));
test('unreachable API, missing RPC and timeout all fail closed',()=>fixture(async(root)=>{
 await assert.rejects(runPreflight({root,fetcher:async()=>{throw Error('offline')}}));await assert.rejects(runPreflight({root,fetcher:async()=>({ok:false,status:404})}),/404/);
 await assert.rejects(runPreflight({root,fetcher:()=>new Promise(()=>{}),timeoutMs:10}),/逾時/);
 await assert.rejects(runPreflight({root,fetcher:async()=>({ok:true,json:()=>new Promise(()=>{})}),timeoutMs:10}),/逾時/);
}));
test('wrong project, stale response, empty and duplicate data fail closed',()=>fixture(async(root,catalog)=>{
 for(const data of [{project:'wrong'},{asOf:'2020-01-01T00:00:00Z'},{catalog:[]},{catalog:[...catalog,catalog[0]]}])await assert.rejects(runPreflight({root,fetcher:async()=>({ok:true,json:async()=>({...await response(catalog).json(),...data})})}));
}));
test('retired historical definitions do not remove rewards or block new valid source',()=>fixture(async(root,catalog)=>{const r=compareCatalog(catalog,[...catalog,{...catalog[0],activity_key:'retired'}]);assert(r.passed);assert.equal(r.retainedHistorical.length,1)}));
test('checked-in cloud configuration runs the gate before serving static files',async()=>{const config=JSON.parse(await fs.readFile(new URL('../../vercel.json',import.meta.url),'utf8'));assert.equal(config.buildCommand,'node release/garden-preflight.mjs');assert.equal(config.outputDirectory,'.');assert.equal(config.builds,undefined)});
test('frozen release packaging preserves routing and source bytes while installing cloud gate',()=>fixture(async(root,catalog)=>{
 const config={headers:[{source:'/api/(.*)',headers:[{key:'X-Test',value:'yes'}]}],rewrites:[{source:'/old',destination:'/index.html'}]};await fs.writeFile(root+'/vercel.json',JSON.stringify(config));
 const source=await fs.readFile(root+'/shared/reward-tree-config.js');await prepareGardenRelease(root,{fetcher:async()=>response(catalog)});
 const next=JSON.parse(await fs.readFile(root+'/vercel.json'));assert.deepEqual(next.headers,config.headers);assert.deepEqual(next.rewrites,config.rewrites);assert.equal(next.buildCommand,'node release/garden-preflight.mjs');assert.deepEqual(await fs.readFile(root+'/shared/reward-tree-config.js'),source);await fs.access(root+'/release/garden-preflight.mjs');
}));
test('invalid catalogue or conflicting build config prevents packaging changes',()=>fixture(async(root,catalog)=>{
 await assert.rejects(prepareGardenRelease(root,{fetcher:async()=>response(catalog.slice(1))}),/未通過/);await assert.rejects(fs.access(root+'/vercel.json'));
 await fs.writeFile(root+'/vercel.json',JSON.stringify({buildCommand:'existing-build'}));await assert.rejects(prepareGardenRelease(root,{fetcher:async()=>response(catalog)}),/不能覆蓋/);assert.equal(JSON.parse(await fs.readFile(root+'/vercel.json')).buildCommand,'existing-build');
}));
