import {presentationSignature} from './quiz-presentation-signature.mjs';
import {reviewedTaskInstructions} from './quiz-task-instructions-sources.mjs';
import {sourceStream,omitRanges} from './quiz-content-slices.mjs';
const context=Symbol('source-reviewed-task');
export const taskRules={
 '41':{instruction:'找出題文中多餘的字，填在下方。',label:'多餘的字'},
 '01':{instruction:'依題目標示，將國字寫成注音，或將注音寫成國字；請按出現順序填寫。',label:'國字或注音'},
 '02':{instruction:'依題目標示，將國字寫成注音，或將注音寫成國字；請按出現順序填寫。',label:'國字或注音'},
 '03':{instruction:'依題目標示，將國字寫成注音，或將注音寫成國字；請按出現順序填寫。',label:'國字或注音'},
 '16':{instruction:'請用題目指定的字造詞。',label:'造詞'},
 '17':{instruction:'請先依題目填寫國字或注音，再用這個字造詞。',label:'依題示作答'},
 '21':{instruction:'依句意，在空格填入適合的字。',label:'適合的字'},
 '22':{instruction:'依句意，在空格填入適合的詞語。',label:'適合的詞語'},
 '26':{instruction:'在題目的空格填入適當的標點符號。',label:'標點符號'},
 '31':{instruction:'將題目提供的部件組合成一個字，填在下方。',label:'組合後的字'},
 '43':{instruction:'將題目的片段排成正確順序，依序填入原題代號。',label:'排列順序（填代號）'},
 '47':{instruction:'依題目要求，從括號或選項中選出答案，填在下方。',label:'選出的答案'},
 '33':{instruction:'請寫出題目指定字詞的相反詞。',label:'相反詞'},
 '35':{instruction:'請依題目要求，寫出同部首的字。',label:'同部首的字'},
 '51':{instruction:'看圖並依句意，在空格填入適合的字。',label:'適合的字'},
 '65':{instruction:'仿照題目中的例子，在空格寫出短語。',label:'照樣寫短語'},
 '67':{instruction:'仿照題目中的例句，完成下方句子。',label:'照樣造句'},
 '71':{instruction:'請用題目指定的詞語造句。',label:'造句'},
 '73':{instruction:'依題目前面的內容，接寫句子。',label:'接寫句子'},
};
const explicit={
 '41':/(?:畫掉|刪(?:去|除|掉)?|找出)[^。\n]{0,35}多餘[^。\n]{0,8}(?:字|詞)|(?:填|寫)[^。\n]{0,20}多餘[^。\n]{0,8}(?:字|詞)/u,
 '01':/(?:國字|注音)[^。\n]{0,16}(?:填|寫)|(?:填|寫)[^。\n]{0,16}(?:國字|注音)/u,
 '02':/(?:國字|注音)[^。\n]{0,16}(?:填|寫)|(?:填|寫)[^。\n]{0,16}(?:國字|注音)/u,
 '03':/(?:國字|注音)[^。\n]{0,16}(?:填|寫)|(?:填|寫)[^。\n]{0,16}(?:國字|注音)/u,
 '16':/造詞/u,'17':/(?:先寫|先填)[^。\n]{0,25}(?:再|後)造詞/u,
 '21':/(?:填|寫)[^。\n]{0,20}(?:適合|適當|國字|字)/u,
 '22':/(?:填|寫|選詞)[^。\n]{0,20}(?:適合|適當|詞)/u,
 '26':/(?:填|寫)[^。\n]{0,12}標點/u,'31':/組合成一個字/u,'43':/(?:填|寫|輸入)[^。\n]{0,12}代號/u,'47':/圈出|選出|請選/u,'33':/寫出?相反詞/u,'35':/寫出?同部首/u,
 '51':/看圖[^。\n]{0,20}(?:填|寫)/u,'65':/照樣寫(?:短語)?/u,'67':/照樣造句/u,
 '71':/造句/u,'73':/接寫句子/u,
};
const generic=s=>/^(?:第\s*\d+\s*(?:格|空|欄)(?:答案)?|答案)$/u.test(s.trim());
export function taskInstructionPlan(q,code,sourceName){
 let rule=taskRules[code];if(!rule||!['fields','open'].includes(q.type)||!q.fields?.length||q.fields.some(f=>!['text','sketch'].includes(f.input)))return null;
 const wordChain=code==='31'&&q.prompt.text.includes('詞語接龍：');
 if(wordChain)rule={instruction:'以前一個詞語的最後一個字，作為下一個詞語的第一個字，依序接寫詞語。',label:'接龍詞語'};
 else if(code==='31'&&!q.prompt.text.includes('組合成一個字'))return null;
 const lines=q.prompt.text.split('\n').filter(s=>s.trim()!==sourceName&&s.trim()!==sourceName.replace('-','－'));
 const text=lines.join('\n'),labels=q.fields.map((f,i)=>{
  if(!generic(f.label)||f.input==='sketch')return null;
  const role=code==='17'&&q.fields.length===2?(i===0?'先填國字或注音':'再造詞'):rule.label;
  return q.fields.length===1?role:`第${i+1}處：${role}`;
 });
 const instruction=!wordChain&&explicit[code]?.test(text)?null:rule.instruction;
 return instruction||labels.some(label=>label!==null)?{code,sourceName,instruction,labels}:null;
}
function prepend(content,instruction){if(!instruction||content.text.startsWith(instruction))return content;return {...content,text:instruction+'\n'+content.text,layout:[{type:'paragraph',runs:[{type:'text',text:instruction}]},...(content.layout||[{type:'paragraph',runs:[{type:'text',text:content.text}]}])]};}
function taskPrompt(content,plan){
 if(!plan.instruction)return content;const stream=sourceStream(content),ranges=[];let at=0;
 if(stream!==null)for(const line of stream.split('\n')){if(line.trim()===plan.sourceName)ranges.push([at,at+line.length]);at+=line.length+1;}
 return prepend(ranges.length?omitRanges(content,ranges):content,plan.instruction);
}
export function taskQuestionPresentation(q,registry=reviewedTaskInstructions){
 if(q?.[context])return q;const plans=registry[q?.id];if(!plans)return q;
 const p=plans.find(p=>p.guard===presentationSignature(q));if(!p||p.labels.length!==q.fields?.length)return q;
 return {...q,prompt:taskPrompt(q.prompt,p),fields:q.fields.map((f,i)=>p.labels[i]===null||p.labels[i]===f.label?f:{...f,label:p.labels[i]}),[context]:{source:q,plan:p}};
}
// Reading parsing uses the unchanged source, so adding an instruction cannot
// invalidate a reviewed table/image plan or move its original source offsets.
export const taskReadingSource=q=>q?.[context]?.source??q;
export function taskReadingPresentation(q,result){const c=q?.[context];if(!c||!result)return result;return {...result,passage:taskPrompt(result.passage,c.plan),fields:result.fields?.map(f=>{const shown=q.fields.find(x=>x.id===f.id);return shown?{...f,label:shown.label}:f})};}
