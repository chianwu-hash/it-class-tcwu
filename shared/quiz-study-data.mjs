import {isSavedMedia} from './quiz-media.mjs';

// sequence is source ordering metadata, not a navigation or authorization boundary.
export const textbookBookPages=(pages,bookId)=>pages.filter(p=>p.bookId===bookId).slice().sort((a,b)=>a.printedPages[0]-b.printedPages[0]);

// Server-disclosed, version-bound data only. No mappings or answer corpus shipped here.
export function readQuizStudy(snapshot,kind){
 const value=snapshot?.study,attempt=kind==='past'?snapshot?.attemptId:snapshot?.attempt_id,version=kind==='past'?snapshot?.version:snapshot?.version_id;
 const empty={pages:[],references:{},explanations:{}};
 if(value?.schema!==1||value.kind!==kind||value.attemptId!==attempt||value.versionId!==version||typeof value.packageId!=='string')return empty;
 if(!Array.isArray(value.pages)||!value.references||!value.explanations)return empty;
 const pages=value.pages.filter(p=>p&&typeof p.id==='string'&&typeof p.bookId==='string'&&typeof p.sequence==='string'&&isSavedMedia(p.url)&&Array.isArray(p.printedPages)&&p.printedPages.length>0&&p.printedPages.every(n=>Number.isInteger(n)&&n>0));
 const references={},explanations={},groups=kind==='past'?snapshot.groups||[]:snapshot.document?.questions||[];
 for(const q of groups){
  const ref=value.references[q.id];
  if(ref&&typeof ref.bookId==='string'&&Number.isInteger(ref.primary)&&Array.isArray(ref.references)&&ref.references.includes(ref.primary)&&ref.references.every(n=>pages.some(p=>p.bookId===ref.bookId&&p.printedPages.includes(n)))){
   const fields=kind==='past'?(q.fields||[]).flatMap(f=>{const field=Array.isArray(ref.fields)?ref.fields.find(x=>x&&x.questionId===f.id):null;return field&&pages.some(p=>p.bookId===ref.bookId&&p.printedPages.includes(field.page))?[{selector:'[data-study-question-id='+JSON.stringify(f.id)+']',page:field.page,label:'第（'+f.label+'）小題'}]:[];}):[];
   references[q.id]={bookId:ref.bookId,primary:ref.primary,references:[...new Set(ref.references)],fields,key:attempt+':'+version+':'+value.packageId+':'+q.id};
  }
  const disclosed=kind==='past'?Boolean(snapshot.records?.[q.id]):snapshot.reviews?.some(r=>r.question_id===q.id);
  if(!disclosed)continue;
  for(const id of kind==='past'?(q.fields||[]).map(f=>f.id):[q.id]){
   const e=value.explanations[id];if(typeof e?.text==='string'&&e.text.trim()&&e.text.length<=12000&&['ai','publisher','official'].includes(e.origin))explanations[id]={text:e.text,origin:e.origin};
  }
 }
 return {pages,references,explanations};
}

export const studySourceLabel=origin=>origin==='ai'?'解題說明由 AI 整理。':origin==='publisher'?'解題說明依書商資料整理。':'解題說明依官方參考資料整理。';
