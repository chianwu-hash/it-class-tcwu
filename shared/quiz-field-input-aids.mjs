import {answerTemplatePresentation} from './quiz-answer-templates.mjs';
import {sourceStream} from './quiz-content-slices.mjs';

// Use reviewed source blanks and explicit instructions, never reference answers
// or saved input. A source/field change invalidates the template guard first.
export function phoneticWordFields(q,registry){
 const plan=answerTemplatePresentation(q,registry);if(plan?.mode!=='blanks')return new Set();
 const text=sourceStream(plan.source.prompt);
 if(!/(?:^|\n)先寫(?:出多音字的|多音字的)?注音[，,、]\s*再造詞[：:]?(?:\n|$)/u.test(text))return new Set();
 const rows=plan.rows.filter(r=>r.fields.length);
 if(!rows.length||rows.some(r=>![1,2,4].includes(r.fields.length))||plan.source.fields.some(f=>f.input!=='text'))return new Set();
 return new Set(rows.flatMap(r=>r.fields.filter((_,i)=>i%2===0)));
}
