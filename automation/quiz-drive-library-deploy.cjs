const fs=require('node:fs/promises'),{createRequire}=require('node:module');
const runtime=createRequire('D:/projects/cdp-tools/package.json'),vault=require('./lib/quiz-drive-worker-private.cjs');
const {connectCdp}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
(async()=>{
 const dir='automation/output/quiz/drive-library',manifest=JSON.parse(await fs.readFile(dir+'/manifest.json','utf8'));
 const cfg=vault.load(),source=await fs.readFile('automation/workers/quiz-drive-media/worker.mjs','utf8');
 if(cfg.email!=='th990821@mail.thps.ntpc.edu.tw'||!cfg.refreshToken||manifest.audience!=='quiz-drive-media-library')throw Error('verified_library_required');
 const assets=Object.fromEntries(Object.entries(manifest.assets).filter(([,a])=>a.verified).map(([h,a])=>[h,{fileId:a.fileId,mime:a.mime,bytes:a.bytes}]));
 const inventory=JSON.parse(await fs.readFile(dir+'/inventory.json','utf8'));
 if(!process.argv.includes('--partial')&&Object.keys(assets).length!==inventory.images)throw Error('library_upload_incomplete');
 const assetModule='export const assets = '+JSON.stringify(assets)+';\n';await fs.writeFile(dir+'/worker-assets.mjs',assetModule,'utf8');
 const {browser,page}=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:'https://dash.cloudflare.com/6ecb5e147cf628802fbe42154ad531af/',puppeteer:runtime('puppeteer-core')});
 try{
  if(!(await page.evaluate(()=>document.body.innerText)).includes("Chianwu@gmail.com's Account"))throw Error('cloudflare_account_not_visible');
  const result=await page.evaluate(async({source,assetModule,cfg})=>{
   const base='/api/v4/accounts/6ecb5e147cf628802fbe42154ad531af/workers/scripts/dingxi-quiz-drive-library';
   const exists=await fetch(base+'/settings');if(exists.ok){const j=await exists.json();if(!j.result?.bindings?.some(b=>b.name==='LIBRARY_MARKER'&&b.text==='prepared-20261027'))return {error:'worker_not_owned'};}else if(exists.status!==404)return {error:'preflight_failed'};
   const bindings=[['MEDIA_TICKET_KEY',cfg.ticketKey],['DRIVE_CLIENT_ID',cfg.clientId],['DRIVE_CLIENT_SECRET',cfg.clientSecret],['DRIVE_REFRESH_TOKEN',cfg.refreshToken]].map(([name,text])=>({type:'secret_text',name,text}));
   bindings.push({type:'plain_text',name:'LIBRARY_MARKER',text:'prepared-20261027'},{type:'plain_text',name:'MEDIA_AUDIENCE',text:'quiz-drive-media-library'},{type:'plain_text',name:'ALLOWED_ORIGINS',text:'http://localhost:3000,http://127.0.0.1:3000,https://it-class-tcwu.vercel.app'});
   const form=new FormData();form.append('metadata',new Blob([JSON.stringify({main_module:'worker.mjs',compatibility_date:'2026-10-01',bindings,observability:{enabled:false}})],{type:'application/json'}));
   form.append('worker.mjs',new File([source],'worker.mjs',{type:'application/javascript+module'}));form.append('assets.mjs',new File([assetModule],'assets.mjs',{type:'application/javascript+module'}));
   const r=await fetch(base,{method:'PUT',body:form}),d=await r.json();if(!r.ok||!d.success)return {error:'deployment_failed',status:r.status,codes:d.errors?.map(e=>e.code)};
   const enabled=await fetch(base+'/subdomain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:true,previews_enabled:false})});return {deployed:true,enabled:enabled.ok};
  },{source,assetModule,cfg});
  if(!result.deployed||!result.enabled)throw Error(JSON.stringify(result));
  const report={...result,at:new Date().toISOString(),origin:manifest.workerOrigin,verifiedImages:Object.keys(assets).length,assetModuleBytes:Buffer.byteLength(assetModule),complete:Object.keys(assets).length===inventory.images};
  await fs.writeFile(dir+'/deployment.json',JSON.stringify(report,null,2),'utf8');console.log(JSON.stringify(report));
 }finally{await browser.disconnect();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
