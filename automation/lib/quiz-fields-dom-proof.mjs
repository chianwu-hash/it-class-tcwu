/** Saved native-field checks only; source rendering, grading and OAuth are separate gates. */
export async function verifyNativeFieldsDOM(items){
 const [{renderContent},{booleanChoicePresentation}]=await Promise.all([import('/shared/quiz-render.mjs'),import('/shared/quiz-boolean-choice.mjs')]);
 const check=(ok,message)=>{if(!ok)throw Error(message);},clean=s=>s.replace(/\s/gu,'');
 const optionText=el=>{const clone=el.cloneNode(true);clone.querySelectorAll('figure,.quiz-field-review-note').forEach(el=>el.remove());return clean(clone.textContent);};
 const imageURLs=content=>content.layout?content.layout.flatMap(p=>p.type==='paragraph'?p.runs:p.rows.flat(2)).filter(r=>r.type==='image').map(r=>content.media[r.media_index].url):content.media.filter(m=>m.kind==='image').map(m=>m.url);
 for(const {q,material,response} of items){
  const article=document.querySelector('article[data-question-id="'+q.id+'"]');check(article,'Missing question '+q.id);const slots=article.querySelectorAll('fieldset.quiz-field');check(slots.length===q.fields.length,'Fieldset count mismatch '+q.id);
  for(const [i,f] of q.fields.entries()){
   check(slots[i].querySelector('legend')?.textContent===f.label,'Field label mismatch '+q.id+'/'+f.id);
   if(['math','text'].includes(f.input)){const input=article.querySelector('[id="field-'+q.id+'-'+f.id+'"]');check(input?.value===response.f[f.id]&&input.disabled,'Saved field mismatch '+q.id+'/'+f.id);continue;}
   check(['single','set'].includes(f.input),'Unsupported native control '+q.id+'/'+f.id);
   const controls=[...slots[i].querySelectorAll('input')];check(controls.length===f.options.length+(f.input==='set'?1:0),'Option count mismatch '+q.id+'/'+f.id);const boolean=f.input==='single'?booleanChoicePresentation(f.options):null;
   for(const [j,o] of f.options.entries()){
    check(controls[j].checked===(f.input==='set'?response.f[f.id].includes(o.id):response.f[f.id]===o.id),'Option selection mismatch '+q.id+'/'+f.id);
    const label=controls[j].closest('label'),body=f.input==='single'?label.querySelector('.option-body'):label.querySelector(':scope > span');check(body,'Missing option body '+q.id+'/'+f.id);
    if(f.input==='single')check(controls[j].value===o.id&&controls[j].name==='field-'+q.id+'-'+f.id,'Option identity mismatch '+q.id+'/'+f.id);
    const expected=document.createElement('div');if(boolean)expected.textContent=boolean[j].text;else renderContent(expected,o.content,{strict:true,loadMedia:false});check(optionText(body)===optionText(expected),'Option content mismatch '+q.id+'/'+f.id);
    check(JSON.stringify([...body.querySelectorAll('img[data-quiz-media-url]')].map(i=>i.dataset.quizMediaUrl))===JSON.stringify(imageURLs(o.content)),'Option image order mismatch '+q.id+'/'+f.id);
   }
   if(f.input==='set')check(controls.at(-1).checked===(response.f[f.id].length===0),'Empty-set state mismatch '+q.id+'/'+f.id);check(controls.every(c=>c.disabled),'Saved choices remain editable '+q.id+'/'+f.id);
  }
  for(const [i,t] of (material.layout?.filter(p=>p.type==='table')??[]).entries()){const got=[...article.querySelectorAll('table')[i].rows].map(row=>[...row.cells].map(cell=>clean(cell.innerText))),expected=t.rows.map(row=>row.map(runs=>clean(runs.map(r=>r.text??'').join(''))));check(JSON.stringify(got)===JSON.stringify(expected),'Source table mismatch '+q.id);}
 }
 return {questions:items.length,all_saved_fields_exact:true,all_choice_states_exact:true,option_content_and_order_exact:true,all_native_tables_exact:true};
}
