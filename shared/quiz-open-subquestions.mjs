import {presentationSignature} from './quiz-presentation-signature.mjs';
import {sourceStream,sliceContent} from './quiz-content-slices.mjs';
import {taskReadingSource,taskReadingPresentation} from './quiz-task-instructions.mjs';
import {openSubquestionSources} from './quiz-open-subquestions-sources.mjs';

// Reviewed view-only source offsets. Never read examples, infer a solution,
// reorder fields or replace the saved response representation.
export function openSubquestionPresentation(q,registry=openSubquestionSources){
 const source=taskReadingSource(q),plan=registry[source?.id];
 if(source?.type!=='open'||!plan||plan.guard!==presentationSignature(source)||source.fields.length!==plan.ranges.length)return null;
 const stream=sourceStream(source.prompt);if(stream===null)return null;
 const fields=source.fields.map((f,i)=>{
  const [start,end]=plan.ranges[i],content=sliceContent(source.prompt,start,end);
  const heading=content.text.replace(/[（(][ \t　]*[）)]/gu,'').trim().replace(/[：:／/｜︱]\s*$/u,'');
  return {...f,label:heading+'：同部首的字'};
 });
 const view=taskReadingPresentation(q,{passage:sliceContent(source.prompt,0,plan.ranges[0][0])});
 return {passage:view.passage,fields,compact:true};
}
