// Run only via the shared ai-browser run-background.cjs worker/lease entry point.
// Reuse the image workflow library, not its legacy, separate BrowserStore CLI.
const fs=require('node:fs'),path=require('node:path');
const args=process.argv.slice(2),options={references:[]};
for(let i=0;i<args.length;i++){
 const key=args[i];if(key==='--help'){console.log('Shared runner required. --prompt-file <UTF8> --reference-image <file> (repeatable) --output-dir <dir> --meta <JSON> --expected-account <visible name>');process.exit(0);}
 if(!['--prompt-file','--reference-image','--output-dir','--meta','--expected-account'].includes(key)||!args[i+1])throw Error('Unknown or missing argument: '+key);
 if(key==='--reference-image')options.references.push(path.resolve(args[++i]));else options[key.slice(2)]=args[++i];
}
(async()=>{
 for(const key of ['prompt-file','output-dir','meta','expected-account'])if(!options[key])throw Error('Required --'+key);
 if(!options.references.length)throw Error('A same-grade style reference is required');
 for(const file of [options['prompt-file'],...options.references])if(!fs.statSync(file).size)throw Error('Empty input: '+file);
 if(!process.env.AI_WORK_BROWSER_LEASE_ID||!process.env.AI_WORK_BROWSER_TARGET_ID||!process.env.CDP_URL)throw Error('Use the registered shared ai-browser runner; no independent lease/profile is created here.');
 const workflow=process.env.CHATGPT_IMAGE_WORKFLOW_ROOT||path.resolve(__dirname,'../../browser-automation-workflow');
 const safeClient=process.env.CDP_SAFE_CLIENT_PATH||path.resolve(__dirname,'../../cdp-tools/packages/cdp-safe-client');
 const {connectCdp}=require(safeClient),{openChatGPTImageChat,runImageBatch,writeRunMeta}=require(path.join(workflow,'lib/chatgpt'));
 const c=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:'https://chatgpt.com/'});
 try{
  const p=c.page;c.session.grantForegroundOnce('Page.bringToFront','Verify the visible account and attach the same-grade weekly infographic reference.');await c.session.send('Page.bringToFront');
  await p.waitForSelector('button[aria-label="開啟個人檔案選單"]');await p.click('button[aria-label="開啟個人檔案選單"]');
  await p.waitForFunction(()=>[...document.querySelectorAll('[role="menu"]')].some(e=>/codex|@|設定|Settings/i.test(e.innerText)&&!/正在載入/.test(e.innerText)),{timeout:20000});
  const text=await p.$$eval('[role="menu"]',es=>es.map(e=>e.innerText).join('\n'));
  if(!text.toLowerCase().includes(options['expected-account'].toLowerCase()))throw Error('Expected visible account not found; no reference or prompt submitted');
  await p.keyboard.press('Escape');
 }finally{await c.disconnect();}
 let browser,page;const meta=path.resolve(options.meta);
 try{
  ({browser,page}=await openChatGPTImageChat(process.env.CDP_URL,{reuseChat:false,directPrompt:false}));
  const result=await runImageBatch(page,{cdpUrl:process.env.CDP_URL,promptFile:path.resolve(options['prompt-file']),referenceImages:options.references,count:1,minImages:1,maxRounds:1,reuseChat:false,directPrompt:false,timeoutMs:600000,generationStartTimeoutMs:120000,idleTimeoutMs:15000,pollMs:8000,outputDir:path.resolve(options['output-dir']),outputPrefix:'weekly-infographic'});
  writeRunMeta(meta,{status:'completed',driver:'shared-ai-browser-registered-worker',pageUrl:page.url(),promptFile:path.resolve(options['prompt-file']),referenceImages:options.references,result});
  console.log('Weekly infographic generated and downloaded; metadata: '+meta);
 }catch(error){writeRunMeta(meta,{status:'failed',driver:'shared-ai-browser-registered-worker',pageUrl:page?.url(),failure:{message:error.message},partialResult:error.partialResult||null});throw error;}
 finally{await browser?.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
