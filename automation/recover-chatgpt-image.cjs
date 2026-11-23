// Read-only recovery of a completed image from an already accepted request.
// Run through D:/ai-browser/run-background.cjs with the exact task-owned target.
const fs=require('node:fs'),path=require('node:path');
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){if(!['--page-url','--output-dir','--meta'].includes(args[i])||!args[i+1])throw Error('Use --page-url <exact conversation> --output-dir <ignored evidence> --meta <JSON>');options[args[i].slice(2)]=args[i+1];}
(async()=>{
 if(!process.env.AI_WORK_BROWSER_TARGET_ID||!process.env.AI_WORK_BROWSER_LEASE_ID||!process.env.CDP_URL)throw Error('Use the shared leased runner and an exact target');
 if(!options['page-url']||!/^https:\/\/chatgpt\.com\/c\//.test(options['page-url'])||!options['output-dir']||!options.meta)throw Error('An exact conversation URL and output paths are required');
 const {connectCdp}=require(process.env.CDP_SAFE_CLIENT_PATH||'D:/projects/cdp-tools/packages/cdp-safe-client');
 const {downloadGeneratedImages}=require(path.join(process.env.CHATGPT_IMAGE_WORKFLOW_ROOT||'D:/projects/browser-automation-workflow','lib/chatgpt'));
 const c=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:options['page-url']});
 try{
  const p=await (await c.browser.waitForTarget(t=>t._targetId===process.env.AI_WORK_BROWSER_TARGET_ID,{timeout:10000})).page();
  if(p.url()!==options['page-url'])throw Error('Task target URL changed; nothing downloaded');
  const images=await p.evaluate(()=>[...document.images].filter(x=>x.alt==='產生的圖片 1'&&x.src.startsWith('blob:')&&x.naturalWidth>0).map(x=>({src:x.src,alt:x.alt,width:x.naturalWidth,height:x.naturalHeight})));
  if(images.length!==1)throw Error('Expected exactly one completed generated blob image, excluding reference attachments');
  const meta=path.resolve(options.meta);if(fs.existsSync(meta))throw Error('Do not overwrite existing generation metadata; use a new recovery receipt path');
  const dir=path.resolve(options['output-dir']);fs.mkdirSync(dir,{recursive:true});
  if(fs.readdirSync(dir).some(name=>name.startsWith('recovered-image-')))throw Error('Use a new output directory; existing recovered files are preserved');
  // The shared downloader validates file magic, MIME, byte count and SHA-256.
  const result=await downloadGeneratedImages(p,images,{outputDir:dir,outputPrefix:'recovered-image',startIndex:1});
  fs.mkdirSync(path.dirname(meta),{recursive:true});fs.writeFileSync(meta,JSON.stringify({status:'completed',driver:'same-request-blob-recovery',pageUrl:p.url(),result},null,2));
  console.log(JSON.stringify({status:'completed',downloads:result.downloads.length}));
 }finally{await c.disconnect();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
