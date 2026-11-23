const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
 const {loadBatch,expectedResponse,readJson,recordBatchTime,preserveOAuthReceipt}=await import('./lib/quiz-batch-plan.mjs');
 const {matchingPresentation}=await import('../shared/quiz-matching-presentation.mjs');
 const {packet:p,counts:n,sha256:packetSha}=await loadBatch(process.argv[2]);
 const file=s=>path.join(p.outputDir,p.prefix+'-'+s+'.private.json');
 const plan=await readJson(file('plan')),ids=plan.ids;
 const {chromium}=require(process.env.QUIZ_PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.connectOverCDP(process.env.CDP_URL,{timeout:12000});let page;
 const proof={packetSha,formalOAuth:true,samples:[]};
 try{
  const context=browser.contexts()[0];
  for(const candidate of context.pages()){
   if(!candidate.url().startsWith('https://it-class-tcwu.vercel.app/'))continue;
   const cdp=await context.newCDPSession(candidate);const {targetInfo}=await cdp.send('Target.getTargetInfo');await cdp.detach();
   if(targetInfo.targetId===process.env.AI_WORK_BROWSER_TARGET_ID){page=candidate;break;}
  }
  assert.ok(page,'assigned formal target unavailable');page.setDefaultTimeout(30000);
  const identity=async()=>page.evaluate(async expected=>{
   const {supabase}=await import('/shared/auth.js');const {data,error}=await supabase.auth.getUser();
   if(error||data.user?.id!==expected.student||data.user?.email!==expected.studentEmail)throw Error('wrong dedicated OAuth identity');
   return true;
  },p.identities);
  await identity();const foreground=await context.newCDPSession(page);foreground.grantForegroundOnce('Page.bringToFront','Verify sampled textbook and persisted calculation');await foreground.send('Page.bringToFront');await foreground.detach();
  if(process.argv[3]==='library'){
   await page.goto('https://it-class-tcwu.vercel.app/grade3/115-1/quiz-library.html',{waitUntil:'domcontentloaded'});await identity();
   const link=page.locator('#cloud-papers a[href*="'+ids.session+'"]').first();await link.waitFor({state:'attached'});
   const total=await page.evaluate(async id=>{const {supabase}=await import('/shared/auth.js');const {data}=await supabase.auth.getUser();const {createQuizRequest}=await import('/shared/quiz-api.mjs');const go=await createQuizRequest({getSession:()=>({user:{id:data.user.id}})});const r=await go('library_sessions');if(r.role!=='student'||Number(r.grade)!==3)throw Error('wrong library role');return r.sessions.find(s=>s.id===id)?.total;},ids.session);
   assert.equal(total,n.questions);const url=new URL(await link.getAttribute('href'),page.url()).href;
   await fs.writeFile(file('library-proof'),JSON.stringify({passed:true,questions:total,sources:n.sources,url},null,2));await recordBatchTime(p,packetSha,'entry-verified');return;
  }
  await recordBatchTime(p,packetSha,'oauth-started');
  for(const s of ids.samples){
   const question=p.candidates.flatMap(c=>c.doc.blocks.flatMap(b=>b.questions)).find(q=>q.id===s.question_id);
   const expected=plan.sampleExpected[s.question_id];assert.deepEqual(expected,expectedResponse(question,s.work));const ref=p.studyRows.find(r=>r.question_id===s.question_id);
   const primaryPage=p.pages.find(a=>a.printedPages.includes(ref.primary));const neighbor=p.pages.filter(a=>a.id!==primaryPage.id).sort((a,b)=>Math.abs(a.printed-ref.primary)-Math.abs(b.printed-ref.primary))[0]?.printedPages[0];assert.ok(neighbor);
   await page.goto('https://it-class-tcwu.vercel.app/grade3/115-1/quiz.html?cloud=1&session='+s.session,{waitUntil:'domcontentloaded',timeout:45000});
   const article=page.locator('article.question[data-question-id="'+s.question_id+'"]');await article.waitFor();await identity();
   assert.ok((await page.locator('body').innerText()).includes('307 \u73ed 30 \u865f'),'dedicated account not visibly identified');
   const read=()=>page.evaluate(async args=>{const {supabase}=await import('/shared/auth.js');const {data}=await supabase.auth.getUser();const {createQuizRequest}=await import('/shared/quiz-api.mjs');const go=await createQuizRequest({getSession:()=>({user:{id:data.user.id}})});const r=await go('resume',{session_id:args.session});return {version:r.version_id,pkg:r.study.packageId,refs:r.study.references,questions:r.document.questions,responses:r.responses,reviews:r.reviews};},s);
   const before=await read();assert.equal(before.version,s.version);assert.equal(before.pkg,s.pkg);assert.equal(before.questions.length,1);
   assert.deepEqual(before.refs[s.question_id],{bookId:plan.book,primary:ref.primary,references:ref.reference,fields:[]});
   const saved=before.responses[s.question_id]!==undefined;
   if(saved){assert.deepEqual(JSON.parse(before.responses[s.question_id]),expected);assert.equal(before.reviews.find(r=>r.question_id===s.question_id)?.correct,true);}
   else assert.deepEqual(before.responses,{});
   const checkMatching=async()=>{await article.locator('.quiz-matching').waitFor();for(const f of question.fields){assert.equal(f.input,'single');const index=f.options.findIndex(o=>o.id===expected.f[f.id]);assert.equal(await article.locator('.qm-card[data-side=left][data-id=\"'+f.id+'\"] .qm-pair').innerText(),String.fromCharCode(65+index));}};
   const matching=matchingPresentation(question),isMatching=Boolean(matching);if(isMatching)assert.equal(matching.covered.size,question.fields.length);
   const checkPlain=async()=>{
    if(isMatching){await checkMatching();return;}
    for(const [i,f] of question.fields.entries()){
     if(f.input==='set'){
      const chosen=expected.f[f.id];
      await article.locator('fieldset.quiz-field,.quiz-field-preview-set').nth(i).waitFor();
      const live=article.locator('fieldset.quiz-field').nth(i);
      if(await live.count()){const boxes=live.locator('input[type=checkbox]');assert.equal(await boxes.count(),f.options.length+1);for(const [j,o] of f.options.entries()){assert.equal(await boxes.nth(j).isChecked(),chosen.includes(o.id));if(saved)assert.ok(await boxes.nth(j).isDisabled());}assert.equal(await boxes.last().isChecked(),chosen.length===0);}
      else{assert.ok(saved);const rows=article.locator('.quiz-field-preview-set').nth(i).locator('.preview-option');for(const [j,o] of f.options.entries())assert.equal(await rows.nth(j).getAttribute('data-field-result'),chosen.includes(o.id)?'correct':null);if(chosen.length===0)assert.equal(await rows.last().getAttribute('data-field-result'),'correct');}
     }else if(f.input==='single'){
      const radios=article.locator('input[type=radio][name="field-'+s.question_id+'-'+f.id+'"]');await article.locator('input[type=radio][name="field-'+s.question_id+'-'+f.id+'"],.quiz-field-preview').first().waitFor();
      if(await radios.count()){assert.equal(await radios.count(),f.options.length);for(const [j,o] of f.options.entries()){assert.equal(await radios.nth(j).isChecked(),o.id===expected.f[f.id]);if(saved)assert.ok(await radios.nth(j).isDisabled());}}
      else{assert.ok(saved);const rows=article.locator('.quiz-field-preview').nth(i).locator('.preview-option');for(const [j,o] of f.options.entries())assert.equal(await rows.nth(j).getAttribute('data-field-result'),o.id===expected.f[f.id]?'correct':null);}
     }else if(!saved||await article.locator('#field-'+s.question_id+'-'+f.id).count())assert.equal(await article.locator('#field-'+s.question_id+'-'+f.id).inputValue(),expected.f[f.id]);
     else assert.ok((await article.innerText()).includes(expected.f[f.id]));
    }
   };
   const checkAnswer=async()=>{
    if(saved){if(question.work?.input==='expression'){const text=await article.innerText();assert.ok(text.includes(s.work));}else if(question.work)assert.equal(await article.locator('.quiz-saved-work svg polyline').count(),expected.w.strokes.length);else await checkPlain();return;}
    if(!question.work){await checkPlain();return;}
    for(const [id,value] of Object.entries(expected.f))assert.equal(await article.locator('#field-'+s.question_id+'-'+id).inputValue(),value);
    if(question.work?.input==='expression')assert.equal(await article.locator('#work-'+s.question_id).inputValue(),s.work);
    else assert.deepEqual(await article.locator('.camp-sketch-board').evaluate(svg=>({version:1,strokes:[...svg.querySelectorAll('polyline')].map(p=>p.getAttribute('points').split(' ').map(pair=>pair.split(',').map((v,i)=>Math.round(Number(v)/(i?360:600)*10000)/10000))),colors:[...svg.querySelectorAll('polyline')].map(p=>p.getAttribute('stroke'))})),expected.w);
   };
   const checks=[],book=page.locator('#lightbox');
   const assertPage=async number=>{
    const label='\u7b2c'+plan.assets.find(a=>a.printedPages.includes(number)).printedPages.join('\u2013')+'\u9801';
    await page.waitForFunction(label=>{const t=document.querySelector('.qtb-book-toolbar strong')?.textContent,img=document.querySelector('#lightbox-img'),status=document.querySelector('.qtb-reading-status');return t?.includes(label)&&img?.complete&&img.naturalWidth>9&&!status?.classList.contains('is-error')&&status?.textContent.includes('80%');},label,{timeout:35000,polling:5000});
    const hash=await page.locator('#lightbox-img').evaluate(async img=>{const r=await fetch(img.currentSrc||img.src);if(!r.ok)throw Error('page unavailable');return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await r.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');});
    assert.equal(hash,plan.assets.find(a=>a.printedPages.includes(number)).sha);
   };
   for(const width of [1280,390]){
    await page.setViewportSize({width,height:960});
    if(!saved){
     if(!question.work&&isMatching){await article.locator('.quiz-matching').waitFor();for(const [id,value] of Object.entries(expected.f)){await article.locator('.qm-card[data-side=left][data-id=\"'+id+'\"]').click();await article.locator('.qm-card[data-side=right][data-id=\"'+value+'\"]').click();}}
     else if(!question.work){for(const [i,f] of question.fields.entries()){
      if(f.input==='set'){const boxes=article.locator('fieldset.quiz-field').nth(i).locator('input[type=checkbox]');for(const [j,o] of f.options.entries())await boxes.nth(j).setChecked(expected.f[f.id].includes(o.id));await boxes.last().setChecked(expected.f[f.id].length===0);}
      else if(f.input==='single')await article.locator('input[type=radio][name="field-'+s.question_id+'-'+f.id+'"][value="'+expected.f[f.id]+'"]').check();
      else await article.locator('#field-'+s.question_id+'-'+f.id).fill(expected.f[f.id]);
     }}
     else for(const [id,value] of Object.entries(expected.f))await article.locator('#field-'+s.question_id+'-'+id).fill(value);
     if(question.work?.input==='expression')await article.locator('#work-'+s.question_id).fill(s.work);
     else if(question.work&&width===1280){
      const board=article.locator('.camp-sketch-board');await board.scrollIntoViewIfNeeded();const rect=await board.boundingBox();assert.ok(rect&&rect.width>100);
      for(const stroke of expected.w.strokes){await page.mouse.move(rect.x+stroke[0][0]*rect.width,rect.y+stroke[0][1]*rect.height);await page.mouse.down();for(const point of stroke.slice(2))await page.mouse.move(rect.x+point[0]*rect.width,rect.y+point[1]*rect.height);await page.mouse.up();}
     }
    }
    await checkAnswer();await article.locator('.qtb-entry').click();await book.waitFor();await assertPage(ref.primary);
    await book.locator('.qtb-book-toolbar select').selectOption(String(neighbor));await assertPage(neighbor);
    await book.getByRole('button',{name:'\u56de\u672c\u984c\u9801',exact:true}).click();await assertPage(ref.primary);
    await book.locator('#lightbox-close').click();await book.waitFor({state:'hidden'});await checkAnswer();
    checks.push({width,pages:[ref.primary,neighbor],sha_verified:true,returned_to_primary:true,retained_answer_and_work:true});
   }
   // Resume is checked before any submit; a saved exact response is never resent.
   if(!saved){await page.locator('#server-submit').click();await page.locator('#server-submit').waitFor({state:'detached'});}
   let after=await read();assert.deepEqual(JSON.parse(after.responses[s.question_id]),expected);assert.equal(after.reviews.find(r=>r.question_id===s.question_id)?.correct,true);
   await page.reload({waitUntil:'domcontentloaded'});await article.waitFor();after=await read();assert.deepEqual(JSON.parse(after.responses[s.question_id]),expected);
   proof.samples.push({source:s.source,question:s.question_id,session:s.session,version:s.version,package:s.pkg,checks,correct:true,saved_and_reopened:true,reused_saved_answer:saved});
   await fs.writeFile(file('oauth-progress'),JSON.stringify(proof,null,2));
  }
  assert.equal(proof.samples.length,n.samples);proof.sampleCount=proof.samples.length;proof.passed=true;
  await preserveOAuthReceipt(file('oauth-proof'),{packet:p,counts:n,sha256:packetSha},proof);
  await recordBatchTime(p,packetSha,'oauth-finished');
 }catch(error){await fs.writeFile(file('oauth-error'),JSON.stringify({...proof,error:{message:error.message,stack:error.stack}},null,2));throw error;}
 finally{if(page)await page.close().catch(()=>{});await browser.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
