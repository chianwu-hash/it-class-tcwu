// Dashboard-origin API calls use the verified visible account; never export its session.
const fs=require('node:fs/promises'),{createRequire}=require('node:module');
const runtime=createRequire('D:/projects/cdp-tools/package.json'),vault=require('./lib/quiz-drive-worker-private.cjs');
const {connectCdp}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
(async()=>{
 const manifest=JSON.parse(await fs.readFile('automation/output/quiz/drive-worker-poc/manifest.json','utf8'));
 const source=await fs.readFile('automation/workers/quiz-drive-media/worker.mjs','utf8'),assetsModule=await fs.readFile('automation/workers/quiz-drive-media/assets.mjs','utf8'),cfg=vault.load();
 if(cfg.email!=='th990821@mail.thps.ntpc.edu.tw'||!cfg.refreshToken||Object.keys(manifest.assets).length!==5)throw Error('verified_media_and_grant_required');
 const {browser,page}=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:'https://dash.cloudflare.com/6ecb5e147cf628802fbe42154ad531af/',puppeteer:runtime('puppeteer-core')});
 try{
  const visible=await page.evaluate(()=>document.body.innerText);
  if(!visible.includes("Chianwu@gmail.com's Account"))throw Error('cloudflare_account_not_visible');
  const result=await page.evaluate(async({source,assetsModule,cfg,assets})=>{
   const base='/api/v4/accounts/6ecb5e147cf628802fbe42154ad531af/workers/scripts/dingxi-quiz-drive-poc';
   const exists=await fetch(base+'/settings');
   if(exists.ok){const j=await exists.json();if(!j.result?.bindings?.some(b=>b.name==='POC_MARKER'&&b.text==='quiz-drive-20261027'))return {error:'existing_worker_not_owned'};}
   else if(exists.status!==404)return {error:'worker_preflight_failed',status:exists.status};
   const bindings=[['MEDIA_TICKET_KEY',cfg.ticketKey],['DRIVE_CLIENT_ID',cfg.clientId],['DRIVE_CLIENT_SECRET',cfg.clientSecret],['DRIVE_REFRESH_TOKEN',cfg.refreshToken]].map(([name,text])=>({type:'secret_text',name,text}));
   bindings.push({type:'plain_text',name:'POC_MARKER',text:'quiz-drive-20261027'},{type:'plain_text',name:'MEDIA_ASSETS',text:JSON.stringify(assets)},{type:'plain_text',name:'ALLOWED_ORIGINS',text:'http://127.0.0.1:4350,http://localhost:4350'});
   const form=new FormData();form.append('metadata',new Blob([JSON.stringify({main_module:'worker.mjs',compatibility_date:'2026-10-01',bindings,observability:{enabled:false}})],{type:'application/json'}));form.append('worker.mjs',new File([source],'worker.mjs',{type:'application/javascript+module'}));
   form.append('assets.mjs',new File([assetsModule],'assets.mjs',{type:'application/javascript+module'}));
   const r=await fetch(base,{method:'PUT',body:form}),d=await r.json();
   if(!r.ok||!d.success)return {error:'worker_upload_failed',status:r.status,codes:d.errors?.map(e=>e.code)};
   const enable=await fetch(base+'/subdomain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:true,previews_enabled:false})});
   const settings=await fetch(base+'/settings').then(r=>r.json());
   return {deployed:true,enabled:enable.ok,worker:'dingxi-quiz-drive-poc',secretNames:settings.result?.bindings?.filter(b=>b.type==='secret_text').map(b=>b.name),observability:settings.result?.observability};
  },{source,assetsModule,cfg,assets:manifest.assets});
  if(!result.deployed||!result.enabled)throw Error(JSON.stringify(result));
  await fs.writeFile('automation/output/quiz/drive-worker-poc/deployment.json',JSON.stringify({...result,origin:manifest.workerOrigin,deployedAt:new Date().toISOString()},null,2));console.log(JSON.stringify(result));
 }finally{await browser.disconnect();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
