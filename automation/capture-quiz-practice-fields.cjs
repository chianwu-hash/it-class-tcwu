const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const sha=b=>createHash('sha256').update(b).digest('hex');
(async()=>{
 const packetPath=path.resolve(process.argv[2]),raw=await fs.readFile(packetPath),p=JSON.parse(raw),E=p.outputDir,prefix=p.prefix;assert.equal(path.basename(packetPath),prefix+'-batch-packet.private.json');
 const file=n=>path.join(E,prefix+'-'+n+'.private.json'),plan=JSON.parse(await fs.readFile(file('plan'),'utf8'));assert.equal(plan.packetSha,sha(raw));
 try{const existing=JSON.parse(await fs.readFile(file('ui-proof'),'utf8'));assert.equal(existing.packetSha,plan.packetSha);for(const r of existing.checks){assert.ok(r.file);assert.equal(sha(await fs.readFile(r.file)),r.sha256);}console.log('Fixed UI proof already present; unchanged');return;}catch(e){if(e.code!=='ENOENT')throw e;}
 const sample=plan.ids.samples[0],q=p.candidates.flatMap(c=>c.doc.blocks.flatMap(b=>b.questions)).find(q=>q.id===sample.question_id),{chromium}=require(process.env.QUIZ_PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.connectOverCDP(process.env.CDP_URL);let page;
 try{
  const context=browser.contexts()[0];for(const tab of context.pages()){if(!tab.url().startsWith('https://it-class-tcwu.vercel.app/'))continue;const cdp=await context.newCDPSession(tab),{targetInfo}=await cdp.send('Target.getTargetInfo');await cdp.detach();if(targetInfo.targetId===process.env.AI_WORK_BROWSER_TARGET_ID){page=tab;break;}}
  assert.ok(page);assert.ok(await page.evaluate(async expected=>{const {supabase}=await import('/shared/auth.js');const {data,error}=await supabase.auth.getUser();return !error&&data.user.id===expected.student&&data.user.email===expected.studentEmail;},p.identities));
  const front=await context.newCDPSession(page);front.grantForegroundOnce('Page.bringToFront','Verify all sampled saved fields at desktop and mobile widths');await front.send('Page.bringToFront');await front.detach();
  await page.goto('https://it-class-tcwu.vercel.app/grade3/115-1/quiz.html?cloud=1&session='+sample.session,{waitUntil:'domcontentloaded'});const board=page.locator('article.question[data-question-id="'+q.id+'"]');await board.waitFor();await board.locator('fieldset.quiz-field,input[id^=field-]').first().waitFor({timeout:30000});const clean=t=>t.replace(/\s/g,''),checks=[];
  for(const width of [1280,390]){
   await page.setViewportSize({width,height:960});await board.scrollIntoViewIfNeeded();await board.evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+window.scrollY-20));const fields=[];
   for(const [fieldIndex,f] of q.fields.entries()){const expected=q.answer.fields[f.id][0];
    if(f.input==='set'){
     const group=board.locator('fieldset.quiz-field').nth(fieldIndex),rows=group.locator(':scope > label');assert.equal(await rows.count(),f.options.length+1);
     for(const [j,o] of f.options.entries()){const row=rows.nth(j),box=row.locator('input[type=checkbox]');assert.ok(clean(await row.innerText()).includes(clean(o.content.text)));assert.equal(await box.isChecked(),expected.includes(o.id));assert.ok(await box.isDisabled());assert.equal(await row.getAttribute('data-field-result'),expected.includes(o.id)?'correct':null);}
     assert.equal(await rows.last().locator('input').isChecked(),expected.length===0);fields.push({id:f.id,input:f.input,options:f.options.length,selected:expected});
    }else if(f.input==='single'){
     const radios=board.locator('input[type=radio][name="field-'+q.id+'-'+f.id+'"]');assert.equal(await radios.count(),f.options.length);for(const [j,o] of f.options.entries()){assert.equal(await radios.nth(j).isChecked(),o.id===expected);assert.ok(await radios.nth(j).isDisabled());}fields.push({id:f.id,input:f.input,selected:expected});
    }else{assert.equal(f.input,'math');const input=board.locator('[id="field-'+q.id+'-'+f.id+'"]');if(await input.count()){assert.equal(await input.inputValue(),expected);assert.ok(await input.isDisabled());}else assert.ok((await board.innerText()).includes(expected));fields.push({id:f.id,input:f.input,value:expected});}
   }
   const bounds=await board.evaluate(el=>({scroll:el.scrollWidth,width:el.clientWidth}));assert.ok(bounds.scroll<=bounds.width+2);const target=path.join(E,prefix+'-ui-'+width+'.private.png');await board.screenshot({path:target});checks.push({width,fields,no_horizontal_overflow:true,file:target,sha256:sha(await fs.readFile(target))});if(width===1280)await page.waitForTimeout(10000);
  }
  await fs.writeFile(file('ui-proof'),JSON.stringify({passed:true,packetSha:plan.packetSha,sample:q.id,checks},null,2),{flag:'wx'});
 }finally{if(page)await page.close().catch(()=>{});await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
