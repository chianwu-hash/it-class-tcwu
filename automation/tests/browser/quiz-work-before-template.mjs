export async function verifyWorkBeforeTemplate(page,base){
 return page.evaluate(async base=>{
  const {workAnswerSources,answerTemplateSources}=await import(new URL('shared/quiz-answer-template-sources.mjs',base));
  const {presentationSignature}=await import(new URL('shared/quiz-presentation-signature.mjs',base));
  const {deriveAnswerTemplate}=await import(new URL('shared/quiz-answer-templates.mjs',base));
  const {renderFieldsInputs}=await import(new URL('shared/quiz-fields.mjs',base));
  const {mountWorkAnswerInputs}=await import(new URL('shared/quiz-work-answer-layout.mjs',base));
  const q={id:'synthetic-original-work-first',type:'fields',prompt:{text:'完整分裝情境。\n乘法算式紀錄：\n除法算式：（ ）÷（ ）＝（ ）…（ ）\n答：裝成（ ）盒，剩（ ）個',media:[]},fields:Array.from({length:6},(_,i)=>({id:'f'+(i+1),label:'原第'+(i+1)+'格',input:'math'})),work:{input:'expression',label:'乘法算式紀錄'}},guard=presentationSignature(q);
  const raw=JSON.stringify({v:1,f:Object.fromEntries(q.fields.map((f,i)=>[f.id,String(i+1)])),w:'保留的乘法紀錄：3×3＝9'}),results=[],check=(v,m)=>{if(!v)throw Error(m);};
  workAnswerSources[q.id]={guard,work:{...q.work},initialChars:2,passageEnd:q.prompt.text.indexOf('乘法算式紀錄：'),workPosition:'before-template'};answerTemplateSources[q.id]={guard,model:deriveAnswerTemplate(q)};
  try{for(const state of ['editing','saved','pending']){
   const host=document.createElement('div'),changes=[];document.body.append(host);
   try{const g=renderFieldsInputs(host,q,{raw,locked:state!=='editing',saved:state==='saved',onChange:v=>changes.push(v),renderContent(n,c){n.textContent=c.text;}}),work=g.querySelector(':scope > .quiz-work-input,:scope > .quiz-saved-work,:scope > .quiz-pending-work'),template=g.querySelector(':scope > .quiz-answer-templates'),inputs=[...template.querySelectorAll('input[type=text]')];
    check(g.classList.contains('quiz-work-before-template')&&Boolean(work.compareDocumentPosition(template)&4),'work not before original formula');check(inputs.length===6&&inputs.every((n,i)=>n.id==='field-'+q.id+'-f'+(i+1)&&n.value===String(i+1)),'original six fields or values changed');check(JSON.stringify([...template.querySelectorAll('.quiz-answer-template-row')].map(n=>n.getAttribute('aria-label')))===JSON.stringify(['除法算式','答']),'source group names lost');
    if(state==='editing'){const input=work.querySelector('input');input.focus();mountWorkAnswerInputs(g,q);check(document.activeElement===input,'repeat mount stole work focus');input.value='3×3＝9；9－9＝0';input.dispatchEvent(new Event('input',{bubbles:true}));check(JSON.parse(changes.at(-1)).w===input.value,'original work listener lost');const target=inputs[0];target.value='123456';target.dispatchEvent(new Event('input',{bubbles:true}));check(JSON.parse(changes.at(-1)).f.f1==='123456','original field listener lost');check(target.closest('.quiz-answer-template-slot').style.getPropertyValue('--answer-slot-width')==='calc(6em + 1em)','slot failed to grow right');}
    else check(work.textContent.includes('保留的乘法紀錄：3×3＝9'),'saved or pending work hidden');
    results.push({state,originalControlsAndValues:true,originalOrder:true,listenerAndFocusPreserved:true});
   }finally{host.remove();}
  }return results;}finally{delete workAnswerSources[q.id];delete answerTemplateSources[q.id];}
 },base);
}
