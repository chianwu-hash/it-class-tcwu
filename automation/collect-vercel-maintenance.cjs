// GET-only collector. Run through the managed AI browser lease supervisor.
const fs=require('node:fs/promises'),path=require('node:path');
const {pathToFileURL}=require('node:url');

async function main(){
 const args=process.argv.slice(2),options={};
 for(let i=0;i<args.length;i+=2){if(!['--config','--target-id','--out'].includes(args[i])||!args[i+1]||options[args[i]])throw Error('Invalid collector arguments');options[args[i]]=args[i+1];}
 if(!options['--config']||!options['--target-id']||!options['--out']||!process.env.AI_WORK_BROWSER_CDP_URL)throw Error('Managed browser lease, config, exact target and output are required');
 const {validateConfig,fingerprint}=await import(pathToFileURL(path.join(__dirname,'lib/vercel-maintenance.mjs')));
 const config=validateConfig(JSON.parse(await fs.readFile(options['--config'],'utf8'))),expected=config.project;
 const output=path.resolve(options['--out']);
 try{await fs.lstat(output);throw Error('Snapshot already exists');}catch(e){if(e.code!=='ENOENT')throw e;}
 const safe=require(process.env.CDP_SAFE_CLIENT_MODULE||'@local/cdp-safe-client');
 const puppeteer=require(process.env.PUPPETEER_MODULE||'puppeteer-core');
 safe.assertLocalCdpUrl(process.env.AI_WORK_BROWSER_CDP_URL);
 const snapshot={version:1,startedAt:new Date().toISOString(),collectedAt:null,source:'managed-browser-get-only',identity:{},coverage:{deploymentsComplete:false,aliasesComplete:false,domainsComplete:false},verification:{},usage:{},errors:[]};
 const browser=await puppeteer.connect({browserURL:process.env.AI_WORK_BROWSER_CDP_URL,defaultViewport:null,protocolTimeout:40000});
 try{
  const target=browser.targets().find(t=>t._targetId===options['--target-id']);if(!target)throw Error('Exact leased page target missing');
  const page=await target.page();if(new URL(page.url()).origin!=='https://vercel.com')throw Error('Unexpected page origin');
  const api=async endpoint=>{
   if(!/^\/api\/(v2\/user|v9\/projects\/|v6\/deployments\?|v2\/aliases\?)/.test(endpoint))throw Error('Endpoint not allowed by GET-only collector');
   for(let attempt=0;attempt<2;attempt++){
    let result;
    try{result=await page.evaluate(async endpoint=>{const r=await fetch(endpoint,{method:'GET',credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(25000)});return{status:r.status,data:r.ok?await r.json():null};},endpoint);}
    catch(e){if(attempt===0){await safe.sleep(5000);continue;}throw Error('Read-only timeout/network failure '+endpoint.split('?')[0]);}
    if(result.status===200)return result.data;
    if(result.status>=500&&attempt===0){await safe.sleep(5000);continue;}
    throw Error('Read-only request failed: HTTP '+result.status+' '+endpoint.split('?')[0]);
   }
  };
  const user=await api('/api/v2/user');snapshot.identity.accountEmail=user.user?.email??null;
  if(snapshot.identity.accountEmail!==expected.accountEmail)throw Error('Signed-in account does not match maintenance config');
  const team=encodeURIComponent(expected.teamId),project=encodeURIComponent(expected.id);
  const projectRead=async()=>{const p=await api('/api/v9/projects/'+project+'?teamId='+team);if(p.id!==expected.id||p.accountId!==expected.teamId||p.name!==expected.name)throw Error('Project or team identity mismatch');return{id:p.id,name:p.name,teamId:p.accountId,productionId:p.targets?.production?.id??null};};
  const readAll=async(endpoint,key)=>{
   const rows=[],seen=new Set();let cursor=null;
   for(let count=0;count<100;count++){
    const data=await api(endpoint+(cursor===null?'':'&until='+encodeURIComponent(cursor))),items=data[key];
    if(!Array.isArray(items))throw Error('Unexpected pagination result '+key);rows.push(...items);
    const next=data.pagination?.next;
    if(next===null||next===undefined){if(items.length>=100&&next===undefined)throw Error('Cannot certify complete pagination '+key);return rows;}
    if(seen.has(next))throw Error('Repeated pagination cursor');seen.add(next);cursor=next;
   }throw Error('Pagination bound exceeded');
  };
  const readDeployments=async()=> (await readAll('/api/v6/deployments?projectId='+project+'&teamId='+team+'&limit=100','deployments')).map(d=>({id:d.uid??d.id,projectId:d.projectId,url:d.url??null,createdAt:d.createdAt??d.created,readyState:d.readyState??d.state,target:d.target??null,branch:d.meta?.githubCommitRef??d.meta?.gitlabCommitRef??null,commitSha:d.meta?.githubCommitSha??null,isRollbackCandidate:d.isRollbackCandidate??null}));
  const readAliases=async()=> (await readAll('/api/v2/aliases?projectId='+project+'&teamId='+team+'&limit=100','aliases')).map(a=>({name:a.alias,projectId:a.projectId,deploymentId:a.deploymentId??a.deployment?.id??null})).sort((a,b)=>a.name.localeCompare(b.name));
  const readDomains=async()=> (await readAll('/api/v9/projects/'+project+'/domains?teamId='+team+'&limit=100','domains')).map(d=>({name:d.name,projectId:expected.id,redirect:d.redirect??null,gitBranch:d.gitBranch??null})).sort((a,b)=>a.name.localeCompare(b.name));
  const before=await projectRead();snapshot.identity={...expected,accountEmail:snapshot.identity.accountEmail};snapshot.project=before;
  const [deployments,aliases,domains]=await Promise.all([readDeployments(),readAliases(),readDomains()]);
  snapshot.deployments=deployments;snapshot.aliases=aliases;snapshot.domains=domains;
  snapshot.coverage={deploymentsComplete:true,aliasesComplete:true,domainsComplete:true};
  const session=await page.target().createCDPSession();session.grantForegroundOnce('Page.bringToFront','Render exact usage charts for the authorized read-only maintenance trial');await session.send('Page.bringToFront');
  snapshot.dashboard={};
  await page.goto('https://vercel.com/'+encodeURIComponent(expected.teamSlug),{waitUntil:'domcontentloaded',timeout:25000});await safe.sleep(5000);
  snapshot.dashboard=await page.evaluate(()=>{const t=document.body.innerText;return{url:location.href,exceededLabel:t.includes('Exceeded free resources'),deploymentStorage:t.match(/Deployment Storage\s+([\d.]+\s*[KMGT]?B\s*\/\s*[\d.]+\s*[KMGT]?B)/i)?.[1]??null,functionsStorage:t.match(/Functions Storage\s+([\d.]+\s*[KMGT]?B\s*\/\s*[\d.]+\s*[KMGT]?B)/i)?.[1]??null};});
  for(const [metric,route]of[['deploymentStorage','deployments-storage'],['functionsStorage','deployments-functions']]){
   try{
    await page.goto('https://vercel.com/'+encodeURIComponent(expected.teamSlug)+'/~/usage/'+route+'?view=Projects',{waitUntil:'domcontentloaded',timeout:25000});
    let data;
    for(let attempt=0;attempt<4;attempt++){
     await safe.sleep(5000);
     data=await page.evaluate(()=>{
      const svg=[...document.querySelectorAll('svg')].find(e=>e.getBoundingClientRect().width>350&&e.getBoundingClientRect().height>50);let best=null;
      if(svg){let node=svg;for(let i=0;i<5&&node;i++,node=node.parentElement){const key=Object.keys(node).find(k=>k.startsWith('__reactFiber'));let fiber=key&&node[key];for(let j=0;j<24&&fiber;j++,fiber=fiber.return){const rows=fiber.memoizedProps?.data;if(Array.isArray(rows)&&rows.length&&rows.every(r=>Number.isFinite(r.date)&&Array.isArray(r.resources)&&Array.isArray(r['0'])&&r['0'][1]===1)&&(!best||rows.length>best.length))best=rows;}}}
      if(!best)return null;
      const text=document.body.innerText;
      return{url:location.href,uiPeriod:[...document.querySelectorAll('[data-testid="calendar/trigger/button"]')].find(e=>e.getBoundingClientRect().width)?.innerText??null,uiUpdated:text.match(/Updated[^\n]*/)?.[0]??null,browserTimeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,points:best.map(r=>({date:new Date(r.date).toISOString(),totalBytes:r['0'][0],projects:r.resources.map(p=>({name:p.name,bytes:p.sum}))}))};
     });if(data)break;
    }
    if(!data)throw Error('No readable rendered daily chart data');
    snapshot.usage[metric]={unit:'bytes',aggregation:'daily-maximum',readAt:new Date().toISOString(),ingestedAt:null,...data};
    await safe.safeScreenshot(page,{path:output+'.'+metric+'.png',waitForFonts:false,timeout:15000});
   }catch(e){snapshot.usage[metric]={error:e.message};}
  }
  const [after,afterDeployments,afterAliases,afterDomains]=await Promise.all([projectRead(),readDeployments(),readAliases(),readDomains()]);
  const inventoryHash=rows=>fingerprint([...rows].sort((a,b)=>a.id.localeCompare(b.id)));
  snapshot.verification={productionUnchanged:before.productionId===after.productionId,aliasesUnchanged:fingerprint(aliases)===fingerprint(afterAliases),inventoryUnchanged:inventoryHash(deployments)===inventoryHash(afterDeployments),domainsUnchanged:fingerprint(domains)===fingerprint(afterDomains)};
  const endUser=await api('/api/v2/user');if(endUser.user?.email!==expected.accountEmail)throw Error('Account changed during collection');
 }catch(e){snapshot.errors.push(e.message);snapshot.collectionFailed=true;}
 finally{await browser.disconnect();snapshot.collectedAt=new Date().toISOString();await fs.writeFile(output,JSON.stringify(snapshot,null,2)+'\n',{flag:'wx'});}
 console.log(JSON.stringify({snapshot:output,account:snapshot.identity.accountEmail,production:snapshot.project?.productionId,deployments:snapshot.deployments?.length,coverage:snapshot.coverage,verification:snapshot.verification,errors:snapshot.errors}));
 if(snapshot.collectionFailed)process.exitCode=1;
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
