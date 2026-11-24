/** Batch browser-side checks; one CDP evaluation per viewport, no production writes. */
export function verifyNativeFieldsDOM(items){
 const check=(ok,message)=>{if(!ok)throw Error(message);},clean=s=>s.replace(/\s/gu,'');
 for(const {q,material,response} of items){
  const article=document.querySelector('article[data-question-id="'+q.id+'"]');check(article,'Missing question '+q.id);
  const slots=article.querySelectorAll('fieldset.quiz-field');
  for(const [i,f] of q.fields.entries()){
   if(['math','text'].includes(f.input)){check(article.querySelector('[id="field-'+q.id+'-'+f.id+'"]')?.value===response.f[f.id],'Saved field mismatch '+q.id+'/'+f.id);continue;}
   const controls=[...slots[i].querySelectorAll('input')];check(controls.length===f.options.length+(f.input==='set'?1:0),'Option count mismatch '+q.id+'/'+f.id);
   for(const [j,o] of f.options.entries())check(controls[j].checked===(f.input==='set'?response.f[f.id].includes(o.id):response.f[f.id]===o.id),'Option selection mismatch '+q.id+'/'+f.id);
   if(f.input==='set')check(controls.at(-1).checked===(response.f[f.id].length===0),'Empty-set state mismatch '+q.id+'/'+f.id);
   check(controls.every(c=>c.disabled),'Saved choices remain editable '+q.id+'/'+f.id);
  }
  for(const [i,t] of (material.layout?.filter(p=>p.type==='table')??[]).entries()){
   const got=[...article.querySelectorAll('table')[i].rows].map(row=>[...row.cells].map(cell=>clean(cell.innerText))),expected=t.rows.map(row=>row.map(runs=>clean(runs.map(r=>r.text??'').join(''))));
   check(JSON.stringify(got)===JSON.stringify(expected),'Source table mismatch '+q.id);
  }
 }
 return {questions:items.length,all_saved_fields_exact:true,all_choice_states_exact:true,all_native_tables_exact:true};
}
