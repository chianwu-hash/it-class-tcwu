import {choiceQuestionPresentation} from './quiz-choice-conversion.mjs';
import {answerTemplatePresentation} from './quiz-answer-templates.mjs';
import {sourceStream} from './quiz-content-slices.mjs';
import {wordMeaningGuides} from './quiz-word-meaning-guides.mjs';
import {reviewedTaskInstructions} from './quiz-task-instructions-sources.mjs';
import {presentationSignature} from './quiz-presentation-signature.mjs';

// Accept only complete, reviewed native word-formation templates. The caller
// must supply the reference already disclosed by the existing reveal gate.
export function wordMeaningReview(question,answer,{templateRegistry,guides=wordMeaningGuides}={}){
 if(!question||!answer)return null;
 const q=choiceQuestionPresentation(question);
 if(q?.type!=='open'||answer?.format!=='self-review-v1')return null;
 const p=answerTemplatePresentation(q,templateRegistry);
 if(!p||p.mode!=='blanks'||p.source.prompt.media.length||q.fields.some(f=>f.input!=='text'))return null;
 const text=sourceStream(p.source.prompt),rows=p.rows.filter(r=>r.fields.length),cards=[];
 if(!text||rows.flatMap(r=>r.fields).length!==q.fields.length)return null;
 if(!text.startsWith('造詞-造詞\n')&&!(reviewedTaskInstructions[p.source.id]??[]).some(r=>r.code==='16'&&r.guard===presentationSignature(p.source)))return null;
 for(const row of rows){
  const blanks=p.blanks.filter(b=>row.fields.includes(b.field));if(![1,2].includes(blanks.length))return null;
  const prefix=text.slice(row.start,blanks[0].start),m=/^([\p{Script=Han}]{1,2})[：:]$/u.exec(prefix);
  if(!m||(blanks.length===2&&text.slice(blanks[0].end,blanks[1].start).trim()!=='、')||text.slice(blanks.at(-1).end,row.end).trim())return null;
  const character=m[1],guide=guides[character];if(!guide?.meaning||!guide.examples?.length)return null;
  if(row.fields.some(id=>!answer.fields?.[id]?.examples?.length||!Array.isArray(answer.fields[id].criteria)))return null;
  // Whole source targets such as 劈啪 must never be reduced to their last字.
  cards.push({character,meaning:guide.meaning,examples:[...guide.examples],fields:[...row.fields]});
 }
 return cards.length?{cards}:null;
}
