// Synthetic rewards only. Uses one leased exact-target tab; never signs in or writes real growth.
const {connectCdp}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
const puppeteer=require('D:/projects/browser-automation-workflow/node_modules/puppeteer-core'),fs=require('node:fs');
(async()=>{const c=await connectCdp({puppeteer,cdpUrl:process.env.CDP_URL,targetUrl:process.env.PARTNER_PREVIEW_URL}),p=c.page,out=[],errors=[];
const check=(name,ok)=>{out.push({name,ok});if(!ok)throw Error(name);};
try{if(p.target()._targetId!==process.argv[2])throw Error('wrong target');p.on('pageerror',e=>errors.push(e.message));await p.setViewport({width:1100,height:900});await p.reload({waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>document.querySelector('[data-scene]>iframe')?.contentWindow.__gardenScene?.snapshot().ready,{polling:5000,timeout:90000});
check('partner totals visible',await p.$eval('[data-partner-source]',e=>!e.hidden&&e.textContent.includes('1 片葉、1 朵花')));
await p.$eval('[data-show-partner]',e=>e.click());check('source shortcut opens filtered list',await p.$eval('[data-source-list]',e=>e.open&&e.querySelectorAll('[data-list] li').length===2));
await p.$eval('[data-list] button',e=>e.click());check('partner on later crown page selected and detailed',await p.evaluate(()=>document.querySelector('[data-page]').textContent.includes('2／2')&&document.getElementById('detail-title').textContent==='合成夥伴雙葉紀念'));
await p.$eval('[data-list] li:last-child button',e=>e.click());check('flower source detailed',await p.$eval('#detail-title',e=>e.textContent==='合成夥伴愛心花'));
await p.$eval('[data-source-all]',e=>e.click());check('all-source pagination retained',await p.$eval('[data-list]',e=>e.children.length===30));
for(const pet of ['cat','dog','rabbit'])for(const tree of ['a','b']){
await p.evaluate(({pet,tree})=>document.querySelector('[data-scene]>iframe').contentWindow.__gardenScene.configure({pet,home:'a',petUnlocked:false,treeSkin:tree,leaves:[{id:'test-leaf',kind:'quiz-leaf',sourceType:'partner',title:'雙葉來源'}],flowers:[{id:'test-flower',kind:'flower',sourceType:'partner',title:'愛心花來源'}]}),{pet,tree});
await p.waitForFunction(()=>document.querySelector('[data-scene]>iframe')?.contentWindow.__gardenScene?.snapshot().ready,{polling:5000,timeout:90000});
const result=await p.evaluate(async({pet,tree})=>{const stage=document.querySelector('[data-scene]>iframe').contentWindow,scene=stage.document.querySelector('#garden-scene').contentWindow,a=stage.__gardenScene;a.setReduce(true);a.pause();a.setTree(tree);const layout=await fetch('/garden/assets/processed/full-tree-v12/layout.json').then(r=>r.json()),canvas=scene.document.querySelector('canvas'),b=canvas.getBoundingClientRect(),scale=b.width/800;const titles=[];
for(const type of ['leaves','flowers']){const pt=layout[tree][type][0],clientX=b.left+((pt.x-380)*1.16+480-80)*scale,clientY=b.top+((pt.y-690)*1.16+725)*scale;canvas.dispatchEvent(new scene.PointerEvent('pointermove',{clientX,clientY,pointerType:'mouse'}));titles.push(canvas.title);}
canvas.dispatchEvent(new scene.PointerEvent('pointerleave'));return{titles,cleared:canvas.title==='',counts:a.snapshot().counts,issues:a.snapshot().assetIssues};},{pet,tree});
check(`${pet}/${tree} source hover for both earned leaf and flower`,result.titles[0]==='雙葉來源'&&result.titles[1]==='愛心花來源'&&result.cleared);check(`${pet}/${tree} renders with preserved earned counts`,result.counts.leaves===1&&result.counts.flowers===1&&!result.issues.length);
}
await p.evaluate(()=>fixture.set({user:null}));await p.evaluate(()=>fixture.render());check('logout hides partner count and sources',await p.$eval('.garden-upgrade',e=>e.hidden));
check('no uncaught browser errors',errors.length===0);fs.mkdirSync('.chat-mode/evidence/keepsake',{recursive:true});fs.writeFileSync('.chat-mode/evidence/keepsake/browser.json',JSON.stringify({out,errors},null,2));console.log(JSON.stringify({passed:out.length,out,errors}));
}catch(e){fs.mkdirSync('.chat-mode/evidence/keepsake',{recursive:true});fs.writeFileSync('.chat-mode/evidence/keepsake/failure.json',JSON.stringify({out,errors,error:e.message},null,2));console.error(e);process.exitCode=1;}finally{await p.close();await c.disconnect();}})();
