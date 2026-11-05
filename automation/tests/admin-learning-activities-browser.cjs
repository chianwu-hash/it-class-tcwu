const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const puppeteer=require('D:/projects/cdp-tools/node_modules/puppeteer-core');
const out=path.resolve('automation/output/admin-learning-activities-20261105');
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const browser=await puppeteer.connect({browserURL:process.env.AI_WORK_BROWSER_CDP_URL,defaultViewport:null,protocolTimeout:25000});
 try{
  const target=browser.targets().find(t=>t._targetId===process.argv[2]);if(!target)throw Error('owned_target_missing');
  const page=await target.page();await page.setViewport({width:1280,height:1000});
  await page.goto('http://localhost:4486/admin-learning.html',{waitUntil:'networkidle0'});
  const controls=await page.evaluate(()=>({courses:[...document.querySelector('#course').options].map(x=>x.value),activities:[...document.querySelector('#paper-activity').options].map(x=>x.value)}));
  assert.deepEqual(controls.courses.sort(),['grade3-115-1','grade4-115-1','grade6-115-1','grade9-115-1']);
  assert.ok(['past_exam','extension','self'].every(x=>controls.activities.includes(x)));
  await page.evaluate(async()=>{
   const {renderPastAnswerItem,pastAnswerText}=await import('/shared/admin-learning-activities.mjs');
   const host=document.createElement('main');host.className='wrap';host.id='synthetic-learning-preview';
   const title=document.createElement('h1');title.textContent='學習檔案・合成資料版面驗證';host.append(title);document.body.replaceChildren(host);
   const mediaScope={resolve:async()=>{throw Error('synthetic_no_media');},active:()=>true};
   const values=[['single','A','B',false],['mark',true,false,false],['sequence',['甲','乙'],['乙','甲'],false],['short',{answer:'原始填答'},['正解一','正解二'],false],['manual',{text:'合成手寫答案',strokes:[[[.1,.1],[.5,.5]]],confirmed:true},'參考資訊',null]];
   values.forEach(([kind,response,official,correct],i)=>renderPastAnswerItem(host,{number:i+1,group:{id:'g'+i,kind,prompt:'這是用來驗證唯讀明細的合成題目。',choices:kind==='single'?[{id:'A',text:'合成選項甲'},{id:'B',text:'合成選項乙'}]:[]},field:{id:'q'+i,label:String(i+1)},response,official,correct,answered:true,manual:kind==='manual'},mediaScope));
   if(pastAnswerText(false,'mark')!=='不勾選'||pastAnswerText(['甲','乙'],'sequence')!=='甲 → 乙')throw Error('answer_format_failed');
  });
  const widths=[];
  for(const width of [1280,768,390]){await page.setViewport({width,height:1000});
   const r=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,cards:document.querySelectorAll('.question-card').length,manualLocked:document.querySelector('.saved-drawing textarea')?.disabled===true,strokes:document.querySelectorAll('.saved-drawing polyline').length,body:document.body.innerText}));
   assert.equal(r.overflow,false);assert.equal(r.cards,5);assert.equal(r.manualLocked,true);assert.equal(r.strokes,1);assert.ok(r.body.includes('已自評／需人工核對'));widths.push(width);
  }
  await page.screenshot({path:path.join(out,'synthetic-mobile.png'),fullPage:true});await page.setViewport({width:1280,height:1000});
  const report={passed:true,synthetic:true,courses:controls.courses,activityTypes:controls.activities,widths,manualReadOnly:true,rawResponsesPreserved:true};
  await fs.writeFile(path.join(out,'synthetic-browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.disconnect();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
