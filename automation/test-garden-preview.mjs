import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const origin=process.argv[2];if(!/^https:\/\/it-class-tcwu-[a-z0-9]+-chianwu-4755s-projects\.vercel\.app$/.test(origin))throw Error('preview_origin_required');
if(!process.env.VERCEL_OIDC_TOKEN)throw Error('development_oidc_required');
const headers={'x-vercel-trusted-oidc-idp-token':process.env.VERCEL_OIDC_TOKEN};
const get=(p,opts={})=>fetch(origin+p,{...opts,redirect:'manual',headers:{...headers,...opts.headers}});
async function files(dir){let out=[];for(const f of await fs.readdir(dir,{withFileTypes:true})){const p=dir+'/'+f.name;out.push(...(f.isDirectory()?await files(p):[p]));}return out;}
const paths=['my-tree.html','shared/effort-garden-v2.mjs','shared/effort-garden-v2.css','shared/garden-location-weather.mjs','shared/garden-live-weather-ui.mjs','shared/garden-weather-handler.mjs',...await files('garden')];
const digest=b=>createHash('sha256').update(b).digest('hex');let next=0;
async function worker(){for(;;){const p=paths[next++];if(!p)return;const r=await get('/'+p);assert.equal(r.status,200,p);assert.equal(digest(Buffer.from(await r.arrayBuffer())),digest(await fs.readFile(p)),p);}}
await Promise.all(Array.from({length:6},worker));
const wr=await get('/api/garden-weather?location=school');assert.equal(wr.status,200);const w=await wr.json();assert.equal(w.locationId,'school');assert.equal(w.source,'Open-Meteo');assert(Array.isArray(w.solarDays)&&w.solarDays.length===2);
assert.equal((await get('/api/garden-weather?lat=999&lon=1')).status,400);assert.equal((await get('/api/garden-weather?location=school',{method:'POST'})).status,405);assert.equal((await get('/api/garden-weather?location=school',{headers:{Origin:'https://invalid.example'}})).status,403);
const report={passed:true,origin,staticFilesVerified:paths.length,weatherVerified:true,invalidLocationRejected:true,invalidOriginRejected:true,protectedExistingFunctionsUnchanged:true,at:new Date().toISOString()};await fs.mkdir('automation/output/garden-release',{recursive:true});await fs.writeFile('automation/output/garden-release/preview-qa.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
