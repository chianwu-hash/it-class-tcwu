// Add only verified image allowlist entries; inherit bindings and preserve the live Worker source.
const fs=require('node:fs/promises'),path=require('node:path'),{createRequire}=require('node:module'),runtime=createRequire('D:/projects/cdp-tools/package.json');
const {connectCdp}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
(async()=>{const [id,out]=process.argv.slice(2),before=JSON.parse(await fs.readFile(path.join(out,'worker-before.private.json'),'utf8')),delta=JSON.parse(await fs.readFile(path.join(out,'drive-delta.private.json'),'utf8'));
 const parse=s=>JSON.parse(s.replace(/^export const assets\s*=\s*/,'').replace(/;\s*$/,'')),assets=parse(before.files['assets.mjs']);
 const oldCount=Object.keys(assets).length;if(oldCount!==5777||Object.keys(delta.assets).length!==39||Object.values(delta.assets).some(a=>!a.verified))throw Error('verified_scope_required');
 for(const [hash,a] of Object.entries(delta.assets)){const value={fileId:a.fileId,mime:a.mime,bytes:a.bytes};if(assets[hash]&&JSON.stringify(assets[hash])!==JSON.stringify(value))throw Error('existing_asset_conflict');assets[hash]=value;}
 const assetModule='export const assets = '+JSON.stringify(assets)+';\n';
 const p=runtime('puppeteer-core'),{browser}=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:'https://dash.cloudflare.com/6ecb5e147cf628802fbe42154ad531af/',puppeteer:{connect:o=>p.connect({...o,protocolTimeout:30000,targetFilter:t=>['browser','tab'].includes(t.type())||t._targetId===id})}});let page;try{
  page=await browser.targets().find(t=>t._targetId===id).page();const c=await page.target().createCDPSession();c.grantForegroundOnce('Page.bringToFront','確認 Cloudflare 帳號後，增補已驗證的 Unit 3 圖片白名單');await c.send('Page.bringToFront');await c.detach();
  await page.waitForFunction(()=>document.body.innerText.includes("Chianwu@gmail.com's Account"),{polling:1000,timeout:20000});
  const result=await page.evaluate(async({before,assetModule})=>{
   const base='/api/v4/accounts/6ecb5e147cf628802fbe42154ad531af/workers/scripts/dingxi-quiz-drive-library';
   const settings=await fetch(base+'/settings').then(r=>r.json());if(!settings.success||!settings.result.bindings.some(b=>b.name==='LIBRARY_MARKER'&&b.text==='prepared-20261027'))throw Error('worker_owner_mismatch');
   const read=async()=>{const r=await fetch(base);if(!r.ok)throw Error('worker_source_unavailable');const f=await r.formData(),v={};for(const [n,s] of f)v[n]=typeof s==='string'?s:await s.text();return v;};
   const current=await read();if(current['worker.mjs']!==before.files['worker.mjs']||current['assets.mjs']!==before.files['assets.mjs'])throw Error('live_worker_changed');
   const meta={main_module:'worker.mjs',compatibility_date:settings.result.compatibility_date,compatibility_flags:settings.result.compatibility_flags||[],bindings:settings.result.bindings.map(b=>({name:b.name,type:'inherit'}))};if(settings.result.observability)meta.observability=settings.result.observability;
   const form=new FormData();form.append('metadata',new Blob([JSON.stringify(meta)],{type:'application/json'}));form.append('worker.mjs',new File([current['worker.mjs']],'worker.mjs',{type:'application/javascript+module'}));form.append('assets.mjs',new File([assetModule],'assets.mjs',{type:'application/javascript+module'}));
   const r=await fetch(base,{method:'PUT',body:form}),j=await r.json();if(!r.ok||!j.success)throw Error('worker_update_failed_'+JSON.stringify(j.errors?.map(e=>e.code)));
   const after=await read();if(after['worker.mjs']!==current['worker.mjs']||after['assets.mjs']!==assetModule)throw Error('worker_post_update_mismatch');
   const s=await fetch(base+'/settings').then(r=>r.json());if(JSON.stringify(s.result.bindings.map(b=>[b.name,b.type]).sort())!==JSON.stringify(settings.result.bindings.map(b=>[b.name,b.type]).sort()))throw Error('worker_bindings_changed');
   return {passed:true,existing_worker_code_unchanged:true,bindings_inherited:true};
  },{before,assetModule});
  await fs.writeFile(path.join(out,'worker-updated-verified.json'),JSON.stringify({...result,existingImages:oldCount,totalImages:Object.keys(assets).length},null,2));await fs.writeFile(path.join(out,'worker-assets-after.private.mjs'),assetModule);console.log(JSON.stringify({...result,totalImages:Object.keys(assets).length}));
 }finally{await page?.close().catch(()=>{});await browser.disconnect();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
