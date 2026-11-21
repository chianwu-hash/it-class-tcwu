// Run against a local, authenticated synthetic fixture that serves shared/.
// The caller supplies its browser page; this probe never launches a browser.
export async function verifyTemplateWorkOrder(page,moduleBase){
 return page.evaluate(async base=>{
  const {mountAnswerTemplate,deriveAnswerTemplate}=await import(new URL('shared/quiz-answer-templates.mjs',base));
  const {presentationSignature}=await import(new URL('shared/quiz-presentation-signature.mjs',base));
  const check=(condition,message)=>{if(!condition)throw Error(message);},results=[];
  for(const text of ['39÷6＝（ ）…（ ）','15公斤800公克－7公斤632公克\n＝（ ）公斤（ ）公克']){
   for(const state of ['quiz-work-input','quiz-saved-work','quiz-pending-work']){
    const host=document.createElement('div'),q={id:'synthetic-work-order',type:'fields',prompt:{text,media:[]},fields:[{id:'f1',input:'math',label:'第1格'},{id:'f2',input:'math',label:'第2格'}],work:{input:'expression',label:'算式'}};
    const work=document.createElement('section');work.className=state;const workInput=document.createElement('input');workInput.value='原先的計算過程';work.append(workInput);host.append(work);
    let changed=0;const inputs=q.fields.map(f=>{const slot=document.createElement('fieldset'),legend=document.createElement('legend'),input=document.createElement('input');slot.className='quiz-field';legend.textContent=f.label;input.type='text';input.value=f.id;input.addEventListener('input',()=>changed++);slot.append(legend,input);host.append(slot);return input;});
    document.body.append(host);
    try{
     const registry={[q.id]:{guard:presentationSignature(q),model:deriveAnswerTemplate(q)}};
     check(mountAnswerTemplate(host,q,{registry}),'template was not mounted');
     const template=host.querySelector('.quiz-answer-templates');
     check(template.nextElementSibling===work&&host.lastElementChild===work,'work must follow original formula and answer controls');
     check(work.firstElementChild===workInput&&workInput.value==='原先的計算過程','existing work node/value was replaced');
     for(const input of inputs){check(template.contains(input),'original answer control was replaced');input.dispatchEvent(new Event('input',{bubbles:true}));}
     check(changed===2,'original control listeners were lost');
     results.push({text,state,originalNodesAndListeners:true});
    }finally{host.remove();}
   }
  }
  return results;
 },moduleBase);
}
