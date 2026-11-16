// Student view only. Keep the original document, IDs, answer and response type.
// Deliberately limited to one fully matched, text-only checkbox group.
const compact=s=>s.normalize('NFKC').replace(/\s/gu,'');
const plain=text=>({text,media:[]});
const body=s=>s.replace(/^\s*[（(][0-9０-９]+[）)]\s*/u,'').trim();
const instructions=[
 '依原題完成全部答案欄，再一起送出。',
 '原本逐項打ˇ／╳者：每小題選出所有正確敘述，未選表示不正確；若全部不正確，勾選「這些選項都不選」。',
 '是的打ˇ．不是的打╳'
];
function textOnly(c){return typeof c?.text==='string'&&!c.media?.length&&(!c.layout||c.layout.every(p=>p.type==='paragraph'&&p.runs.every(r=>r.type==='text')))&&(!c.layout||compact(c.layout.map(p=>p.runs.map(r=>r.text).join('')).join('\n'))===compact(c.text));}
export function checkboxPresentationIssues(source,view){
 const issues=[],fail=code=>issues.push({code});
 if(source.type!==view.type||source.fields?.length!==view.fields?.length||JSON.stringify(source.answer)!==JSON.stringify(view.answer))fail('checkbox_contract_changed');
 for(const [i,f]of(source.fields||[]).entries()){
  const v=view.fields?.[i];if(!v||f.id!==v.id||f.input!==v.input||JSON.stringify(f.options?.map(o=>o.id))!==JSON.stringify(v.options?.map(o=>o.id)))fail('checkbox_contract_changed');
  if(f.input==='set')for(const o of v?.options||[]){const text=compact(body(o.content.text));if(text&&compact(view.prompt.text).includes(text))fail('checkbox_duplicate_statement');}
 }
 if(instructions.some(s=>view.prompt.text.includes(s))||/【(?:題目校訂|用語說明)】/u.test(view.prompt.text))fail('checkbox_importer_text_visible');
 return issues;
}
export function convertCheckboxQuestion(q,{reviewedPresentation}={}){
 const unchanged=(code)=>({question:q,changes:[],issues:code?[{code}]:[]});
 if(q?.type!=='fields'||q.fields?.length!==1||q.fields[0].input!=='set')return unchanged();
 const f=q.fields[0];if(!textOnly(q.prompt)||!f.options?.every(o=>textOnly(o.content)))return unchanged('checkbox_rich_source_review_required');
 const source=q.prompt.text,headers=[...source.matchAll(/^[ \t　]*[（(][ \t　]*[）)]\s*[（(]([0-9０-９]+)[）)]/gmu)];
 if(!headers.length){const issues=checkboxPresentationIssues(q,q);return {question:q,changes:[],issues};}
 if(headers.length!==f.options.length||headers.some((m,i)=>Number(m[1].normalize('NFKC'))!==i+1))return unchanged('checkbox_source_mapping_required');
 const statements=headers.map((m,i)=>source.slice(m.index+m[0].length,headers[i+1]?.index??source.length).trim());
 if(statements.some((s,i)=>compact(s)!==compact(body(f.options[i].content.text))))return unchanged('checkbox_source_mapping_required');
 let context=source.slice(0,headers[0].index);let options=f.options.map((o,i)=>({...o,content:plain(statements[i])}));
 for(const instruction of instructions)context=context.split('\n').filter(line=>line.trim()!==instruction).join('\n');
 context=context.replace(/依題意回答下列問題，正確的，請在（\s*）裡打ˇ，錯誤的打╳：\s*$/u,'').trim();
 const review=reviewedPresentation;
 if(review){
  if(review.questionId!==q.id)return unchanged('checkbox_revision_source_mismatch');
  for(const note of review.removeNotes||[]){if(!note||context.split(note).length!==2)return unchanged('checkbox_revision_note_mismatch');context=context.replace(note,'');}
  for(const revision of review.optionRevisions||[]){const i=options.findIndex(o=>o.id===revision.optionId);if(revision.fieldId!==f.id||i<0||compact(options[i].content.text)!==compact(revision.expectedText)||!revision.text?.trim())return unchanged('checkbox_revision_source_mismatch');options[i]={...options[i],content:plain(revision.text.trim())};}
  if(review.contextNote)context+='\n'+review.contextNote;
 }
 if(/【(?:題目校訂|用語說明)】/u.test(context))return unchanged('checkbox_editorial_review_required');
 context=context.replace(/\n{3,}/gu,'\n\n').trim();if(!context)return unchanged('checkbox_context_missing');
 const question={...q,prompt:plain(context),fields:[{...f,label:'勾選所有正確的敘述',options}]};
 const issues=checkboxPresentationIssues(q,question);if(issues.length)return {question:q,changes:[],issues};
 return {question,changes:[{field:f.id,kind:'checkbox_student_view',reviewed_revision:!!review}],issues:[]};
}
