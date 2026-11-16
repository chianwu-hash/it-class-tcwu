import {sourceStream,sliceContent,omitRanges,compactParagraphs} from './quiz-content-slices.mjs';
import {numberedReadingPresentation} from './quiz-reading-numbered.mjs';
import {labelledReadingPresentation} from './quiz-reading-context.mjs';

// View only: require a complete ordered question list. No answer inference.
function strictPresentation(q){
 if(q.type!=='fields'||!q.fields||q.fields.length<2||q.fields.some(f=>!['set','single'].includes(f.input))||q.prompt?.media?.some(m=>m.kind==='audio'))return null;
 const text=sourceStream(q.prompt);
 if(text===null||!/^閱讀理解題\s*\n/u.test(text))return null;
 const marks=[...text.matchAll(/^[ \t　]*[（(]([0-9０-９]{1,2})[）)]([^\n]*)/gmu)];
 if(marks.length!==q.fields.length)return null;
 const number=s=>Number(s.normalize('NFKC'));
 if(marks.some((m,i)=>number(m[1])!==i+1||!m[2].trim()||!new RegExp('^[（(]'+(i+1)+'[）)](?:[（(]選出全部正確項，未選表示不正確[）)])?$','u').test(q.fields[i].label)))return null;
 const questions=marks.map((m,i)=>sliceContent(q.prompt,m.index,marks[i+1]?.index??text.length));
 // Ambiguous multiline tails, options or images must remain untouched.
 if(questions.some(c=>c.media.length||c.text.split('\n').filter(s=>s.trim()).length!==1||c.text.length>600))return null;
 let passage=sliceContent(q.prompt,0,marks[0].index);
 const stream=sourceStream(passage),remove=[];
 for(const m of stream.matchAll(/^閱讀理解題\s*\n|^閱讀下文後回答問題，正確的，請在（　）裡打ˇ，錯誤的打╳：[ \t]*\n/gmu))remove.push([m.index,m.index+m[0].length]);
 passage=compactParagraphs(omitRanges(passage,remove));
 if(passage.text.length<100)return null;
 return {passage,questions};
}
export function readingPresentation(q){return strictPresentation(q)??numberedReadingPresentation(q)??labelledReadingPresentation(q);}
