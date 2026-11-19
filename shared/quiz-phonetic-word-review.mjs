import {answerTemplatePresentation} from './quiz-answer-templates.mjs';
import {phoneticWordFields} from './quiz-field-input-aids.mjs';
import {sourceStream} from './quiz-content-slices.mjs';
import {phoneticWordExamples} from './quiz-phonetic-word-examples.mjs';
import {checkPhonetic} from './quiz-phonetic-check.mjs';

const notes={植:'多用於植物、栽種或移入的意思。',直:'可表示不彎曲，也可用於直接、一直等詞。',值:'可表示價值、數值，也可表示輪班負責。',殖:'常用於生物繁衍、生長或增加的詞語。',丞:'這個字多用在古代官名，先理解意思再記詞語。',棵:'「棵」是量詞；下方是量詞的用法組合。'};
export function phoneticWordReview(q,answer,{raw='',templateRegistry,examples=phoneticWordExamples}={}){
 if(q?.type!=='open'||answer?.format!=='self-review-v1')return null;
 const phonetic=phoneticWordFields(q,templateRegistry),plan=answerTemplatePresentation(q,templateRegistry);if(!phonetic.size||!plan)return null;
 const text=sourceStream(plan.source.prompt),cards=new Map();let character=null,values=null;
 try{const p=JSON.parse(raw);if(p.v===1&&p.f&&q.fields.every(f=>typeof p.f[f.id]==='string'))values=p.f;}catch{}
 for(const row of plan.rows.filter(r=>r.fields.length)){
  const blanks=plan.blanks.filter(b=>row.fields.includes(b.field));
  for(let i=0;i<blanks.length;i+=2){
   const a=blanks[i],b=blanks[i+1],prefix=text.slice(i?blanks[i-1].end:row.start,a.start);
   character=prefix.match(/\p{Script=Han}/gu)?.at(-1)??character;
   if(!character||!phonetic.has(a.field))return null;
   const ph=answer.fields?.[a.field],word=b?answer.fields?.[b.field]:null;
   if(!ph?.examples?.length||!Array.isArray(ph.criteria)||(b&&(!word?.examples?.length||!Array.isArray(word.criteria))))return null;
   const given=text.slice(a.end,b?.start??row.end).match(/[\p{Script=Han}]{2,}/gu)??[],original=[...(word?.examples??[]),...given],supplements=[];
   for(const reading of ph.examples){const words=(examples[character+'|'+reading]??[]).filter(w=>!original.includes(w.word)).slice(0,6);if(words.length)supplements.push({reading,words});}
   const issues=[];
   if(character==='靦'&&ph.examples.includes('ㄊㄧㄢˇ')&&original.includes('靦腆'))issues.push('原參考的「靦腆」讀作「ㄇㄧㄢˇ　ㄊㄧㄢˇ」，第一字與本組原參考「ㄊㄧㄢˇ」不同。請把字音與詞語一起核對；原資料在此保留，不自動改寫作答。');
   if(character==='佼'&&original.includes('佼好'))issues.push('原參考「佼好」有字形疑義：「姣好」的「姣」是女部，不能當作「佼」的造詞；「佼」可見於「佼佼者」。原參考仍保留供核對。');
   if(character==='耶'&&ph.examples.includes('ㄧㄝ'))issues.push('「耶」的部分詞語在兩部辭典中有不同音讀資料。下方只列《重編國語辭典修訂本》中符合本組「ㄧㄝ」的詞例，不將另一讀音混入。');
   const entry={phoneticField:a.field,wordField:b?.field??null,readings:[...ph.examples],words:[...(word?.examples??[])],given,student:values?{phonetic:values[a.field],word:b?values[b.field]:null}:null,criteria:[...new Set([...ph.criteria,...(word?.criteria??[])])],supplements,issues};
   if(!cards.has(character))cards.set(character,{character,note:notes[character]??'先核對本字在題目中的讀音，再用這個字組成意思通順的詞語。',entries:[]});cards.get(character).entries.push(entry);
  }
 }
 for(const card of cards.values())for(const entry of card.entries)entry.phoneticCheck=checkPhonetic(card.character,entry,{splitReading:card.entries.length>1});
 return {cards:[...cards.values()]};
}
