// Isolated visual check. No auth, student records, or reward writes.
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const puppeteer=require('D:/projects/cdp-tools/node_modules/puppeteer-core');
const root=path.resolve(__dirname,'../..'),origin='http://127.0.0.1:4488',out=path.join(root,'.chat-mode/evidence/level-one');
const fixture=`import {renderRewardTree} from '/shared/reward-tree-renderer.js';import {LEAF_SLOTS,FLOWER_SLOTS} from '/shared/reward-tree-config.js';
 const leaves=Array.from({length:50},(_,i)=>({id:'leaf-'+i,kind:'quiz-leaf',sourceType:[36,43,49].includes(i)?'partner':'learning',title:'合成來源 '+i}));
 const flowers=Array.from({length:10},(_,i)=>({id:'flower-'+i,kind:'flower',sourceType:i===9?'partner':'english',title:'合成花 '+i}));
 window.fixture={page:0,leaves,render(page=0){this.page=page;renderRewardTree({layer:document.getElementById('reward-layer'),leaves:leaves.slice(page*44,(page+1)*44),flowers,pendingLeaves:[],pendingFlowers:[],leafSlots:LEAF_SLOTS,flowerSlots:FLOWER_SLOTS,onSelect:r=>{document.getElementById('detail-title').textContent=r.title;},ghostLeafCount:0,ghostFlowerCount:0});}};
 fixture.render();document.documentElement.dataset.rewardColorMode='source';`;
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,origin),file=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!file.startsWith(root+path.sep))throw Error();
 let body=await fs.readFile(file);if(u.pathname==='/my-tree.html')body=body.toString('utf8').replace(/<script type="module">[\s\S]*?<\/script>/,`<script type="module">${fixture}</script>`);
 const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png'};res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end();}});
(async()=>{await fs.mkdir(out,{recursive:true});await new Promise(r=>server.listen(4488,'127.0.0.1',r));const b=await puppeteer.connect({browserURL:process.env.AI_WORK_BROWSER_CDP_URL,defaultViewport:null,protocolTimeout:30000});const t=b.targets().find(t=>t._targetId===process.env.AI_WORK_BROWSER_TARGET_ID);assert(t);const p=await t.page(),errors=[],checks=[];
const check=(name,ok)=>{assert(ok,name);checks.push(name);};
try{
 p.on('pageerror',e=>errors.push(e.message));await p.setRequestInterception(true);p.on('request',r=>new URL(r.url()).origin===origin||r.url().startsWith('data:')?r.continue():r.abort());
 const c=await p.target().createCDPSession();c.grantForegroundOnce('Page.bringToFront','驗證第一級紀念葉尺寸與桌機手機樹枝對齊');await c.send('Page.bringToFront');
 await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await p.setViewport({width:1360,height:1000});await p.goto(origin+'/my-tree.html',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.fixture&&document.querySelector('.tree-image').naturalWidth>0,{polling:5000});
 for(const width of [1360,1024,768,390]){
  await p.setViewport({width,height:1000});await p.evaluate(()=>fixture.render(0));
  const result=await p.evaluate(async()=>{
   const {LEAF_SLOTS,FLOWER_SLOTS}=await import('/shared/reward-tree-config.js'),img=document.querySelector('.tree-image'),layer=document.getElementById('reward-layer'),a=img.getBoundingClientRect(),b=layer.getBoundingClientRect();
   const cv=document.createElement('canvas');cv.width=img.naturalWidth;cv.height=img.naturalHeight;const cx=cv.getContext('2d');cx.drawImage(img,0,0);
   const bark=slot=>{const x=Math.round(slot.x/100*cv.width),y=Math.round(slot.y/100*cv.height);for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const [r,g,b]=cx.getImageData(x+dx,y+dy,1,1).data;if(r>90&&r<225&&r>g*1.22&&g>b*1.22&&g>35&&g<170)return true;}return false;};
   const partner=[...layer.querySelectorAll('.leaf[data-partner-reward]')].map(el=>{const s=getComputedStyle(el);return{width:parseFloat(s.width),height:parseFloat(s.height),slot:parseFloat(s.getPropertyValue('--size'))};});
   const onAnchor=[...layer.querySelectorAll('.leaf')].every((el,i)=>{const r=el.getBoundingClientRect(),slot=LEAF_SLOTS[i];return Math.abs((r.left+r.width/2)-(a.left+slot.x/100*a.width))<.6&&Math.abs((r.top+r.height/2)-(a.top+slot.y/100*a.height))<.6;});
   return{same:Math.abs(a.left-b.left)<.5&&Math.abs(a.top-b.top)<.5&&Math.abs(a.width-b.width)<.5&&Math.abs(a.height-b.height)<.5,
    square:Math.abs(a.width-a.height)<.5,onAnchor,bark:[...LEAF_SLOTS,...FLOWER_SLOTS].every(bark),partner,noOverflow:document.documentElement.scrollWidth<=innerWidth+1,count:layer.querySelectorAll('.leaf').length};
  });
  console.log(JSON.stringify({width,...result}));
  check(width+' 圖片與獎勵共用正方形座標',result.same&&result.square);check(width+' 全部葉花落點都在樹枝上',result.onAnchor&&result.bark);
  check(width+' 紀念雙葉可見高度接近普通葉、寬度可辨識',result.partner.every(s=>s.width>=36&&s.height>=s.slot*1.3));check(width+' 數量不變且無水平溢出',result.count===44&&result.noOverflow);
  if(width===1360||width===390)await p.screenshot({path:path.join(out,'tree-'+width+'.png'),fullPage:true});
 }
 await p.evaluate(()=>fixture.render(1));check('下一頁仍保留其餘花葉與紀念樣式',await p.$eval('#reward-layer',e=>e.querySelectorAll('.leaf').length===6&&e.querySelectorAll('.leaf[data-partner-reward]').length===1));
 await p.click('.leaf[data-partner-reward]');check('紀念葉點選來源仍可操作',await p.$eval('#detail-title',e=>e.textContent==='合成來源 49'));check('無瀏覽器例外',errors.length===0);
 await fs.writeFile(path.join(out,'browser.json'),JSON.stringify({passed:checks.length,checks,errors},null,2));console.log(JSON.stringify({passed:checks.length,checks,errors}));
}catch(e){await fs.writeFile(path.join(out,'failure.json'),JSON.stringify({error:e.message,checks,errors},null,2));throw e;}finally{await p.close();await b.disconnect();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
