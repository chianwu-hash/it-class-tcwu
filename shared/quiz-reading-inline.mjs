import {readingInlineSources} from './quiz-reading-inline-sources.mjs';
import {readingSignature} from './quiz-reading-signature.mjs';
import {taskReadingSource} from './quiz-task-instructions.mjs';
import {choiceQuestionPresentation} from './quiz-choice-conversion.mjs';
import {numberedReadingPresentation} from './quiz-reading-numbered.mjs';
import {sourceStream,sliceContent} from './quiz-content-slices.mjs';

export function inlineReadingPlan(question,registry=readingInlineSources){
 if(!question)return null;const q=taskReadingSource(choiceQuestionPresentation(question)),record=registry[q.id];
 if(!record||record.guard!==readingSignature(q)||q.prompt.media.length)return null;
 const n=record.slots.length;
 if(q.fields.slice(0,n).some((f,i)=>f.id!==record.slots[i].field||f.input!=='text'))return null;
 const reading=numberedReadingPresentation(q,{fieldIndices:q.fields.slice(n).map((_,i)=>n+i),sourceNumbers:q.fields.slice(n).map((_,i)=>i+1),minimumPassage:0,inlineBanks:true});if(!reading)return null;
 const text=sourceStream(reading.passage);if(text===null||record.end>text.length)return null;
 for(const slot of record.slots){const marked=text.slice(slot.start,slot.end);if(!/^[「『](?:[\p{Script=Han}]{1,2}|[ㄅ-ㄩˊˇˋ˙]+)[」』]$/u.test(marked)||slot.end>record.end)return null;}
 return {reading,passage:sliceContent(reading.passage,0,record.end),slots:record.slots.map(s=>({...s}))};
}
