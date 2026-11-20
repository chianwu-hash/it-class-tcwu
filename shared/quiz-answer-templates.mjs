import {presentationSignature} from './quiz-presentation-signature.mjs';
import {sourceStream,sliceContent,omitRanges} from './quiz-content-slices.mjs';
import {taskReadingSource,taskReadingPresentation} from './quiz-task-instructions.mjs';
import {answerTemplateSources} from './quiz-answer-template-sources.mjs';
import {openCompositionSources} from './quiz-open-composition-sources.mjs';
import {projectSourceBoxes} from './quiz-source-boxes.mjs';
const widthDocuments=new WeakSet();
function installWidthReflow(doc){
 if(widthDocuments.has(doc)||!doc.defaultView)return;widthDocuments.add(doc);let pending=false;
 const refit=()=>{if(pending)return;pending=true;doc.defaultView.requestAnimationFrame(()=>{pending=false;doc.querySelectorAll('.quiz-answer-template-slot textarea').forEach(input=>input.dispatchEvent(new doc.defaultView.Event('quiz-answer-refit')));});};
 doc.defaultView.addEventListener('resize',refit);doc.fonts?.addEventListener('loadingdone',refit);
}
export function growingSlotWidth({text,fontSize,letterSpacing=0,padding=0,borders=0,measure}){
 return Math.ceil(Math.max(0,...String(text).split(/\r?\n/u).map(line=>measure(line)+[...line].length*letterSpacing))+padding+borders+Math.max(4,fontSize*.1));
}

// Width comes from the publisher's populated example, never a reference answer
// or the student's response. A differing or ambiguous pattern keeps its width.
export function exampleSlotCharacters(plan){
 if(plan?.mode!=='blanks')return null;const text=sourceStream(plan.source.prompt);if(text===null)return null;
 const examples=text.slice(0,plan.start).split('\n').toReversed(),result={};
 for(const row of plan.rows.filter(r=>r.fields.length)){
  const blanks=plan.blanks.filter(b=>row.fields.includes(b.field));
  const matches=examples.map(line=>({line,parts:[...line.matchAll(/[（(]([^（）()\n]+)[）)]/gu)]})).filter(({line,parts})=>parts.length===blanks.length&&parts.every((p,i)=>{
   const value=p[1].replace(/[\sˉ]/gu,'');if(!value||/[^\p{Script=Han}０-９]/u.test(value)||[...value].length>40)return false;
   return i===parts.length-1||line.slice(p.index+p[0].length,parts[i+1].index).replace(/\s/gu,'')===text.slice(blanks[i].end,blanks[i+1].start).replace(/\s/gu,'');
  }));
  const counts=matches.map(m=>m.parts.map(p=>[...p[1].replace(/[\sˉ]/gu,'')].length));if(!counts.length||counts.some(c=>c.some((n,i)=>n!==counts[0][i])))return null;blanks.forEach((b,i)=>result[b.field]=counts[0][i]);
 }
 return Object.keys(result).length===plan.source.fields.length?result:null;
}

// Only empty publisher blanks, never a populated example, unit or answer.
const blankPattern=({symbols=false,underscores=false}={})=>new RegExp('[（(][\\s　ˉ_＿﹏…．.]*[）)]'+(symbols?'|□':'')+(underscores?'|[_＿]{2,}':''),'gu');
const sourceBlanks=(text,options)=>[...text.matchAll(blankPattern(options))].filter(m=>!( /(?:寫|填|輸入|打|畫)[^。\n]{0,12}在\s*$/u.test(text.slice(Math.max(0,m.index-24),m.index))&&/^(?:內|中|裡)/u.test(text.slice(m.index+m[0].length))||/在\s*$/u.test(text.slice(Math.max(0,m.index-3),m.index))&&/^(?:內|中|裡)[^。\n]{0,6}(?:寫|填|輸入|打|畫)/u.test(text.slice(m.index+m[0].length))));
export function deriveGroupedTemplate(q,{groupMarker='number',subgroups=false}={}){
 if(!['number','bopomofo'].includes(groupMarker))return null;
 if(!q?.fields?.length||q.fields.some(f=>!['text','math'].includes(f.input)))return null;
 const text=sourceStream(q?.prompt);if(text===null||!q?.fields?.length)return null;
 const phonetic=groupMarker==='bopomofo',markers=[...text.matchAll(phonetic?/^[ \t　]*([ㄅ-ㄩ])(?=[ \t　]*(?:□|[（(]))/gmu:/^[ \t　]*[（(]([0-9０-９]{1,2})[）)]/gmu)];if(markers.length<2)return null;
 const key=value=>phonetic?value:Number(value.normalize('NFKC')),numbers=markers.map(m=>key(m[1]));if(new Set(numbers).size!==numbers.length)return null;
 const owners=q.fields.map(f=>{const m=(phonetic?/^([ㄅ-ㄩ])/u:/^(?:第\s*)?[（(]?([0-9０-９]{1,2})[）)]/u).exec(f.label);return m?key(m[1]):null;});if(owners.some(n=>!numbers.includes(n)))return null;
 let rows=markers.map((m,i)=>({start:m.index,end:markers[i+1]?.index??text.length,number:numbers[i],fields:q.fields.filter((f,j)=>owners[j]===numbers[i]).map(f=>f.id)}));
 if(subgroups){
  if(phonetic)return null;let found=0;const next=[];
  for(const row of rows){const child=[...text.slice(row.start,row.end).matchAll(/^[ \t　]*([ㄅ-ㄩ])[ \t　]*(?=\n)/gmu)];if(!child.length){next.push(row);continue;}
   const keys=child.map(m=>m[1]);if(new Set(keys).size!==keys.length)return null;
   const fields=row.fields.map(id=>{const f=q.fields.find(f=>f.id===id),m=/^(?:第\s*)?[（(]?([0-9０-９]{1,2})[）)]([ㄅ-ㄩ])/u.exec(f.label);return m&&Number(m[1].normalize('NFKC'))===row.number&&keys.includes(m[2])?{id,key:m[2]}:null;});if(fields.some(f=>!f))return null;
   next.push({...row,end:row.start+child[0].index,fields:[]});for(const[i,m]of child.entries()){const owned=fields.filter(f=>f.key===m[1]).map(f=>f.id);if(!owned.length)return null;next.push({start:row.start+m.index,end:child[i+1]?row.start+child[i+1].index:row.end,number:m[1],parentNumber:row.number,fields:owned});}found++;
  }
  if(!found)return null;rows=next;
 }
 return {mode:'groups',start:markers[0].index,rows,...(phonetic?{groupMarker}:{}),...(subgroups?{subgroups}:{})};
}
export function deriveOptionTemplate(q){
 if(!q?.fields?.length||q.fields.some(f=>!['text','math'].includes(f.input)))return null;
 const text=sourceStream(q?.prompt);if(text===null||!q?.fields?.length)return null;
 const marks=[...text.matchAll(/[（(][^（）()\n]*[／/][^（）()\n]*[）)]/gu)];if(marks.length!==q.fields.length)return null;
 return {mode:'options',start:0,rows:[{start:0,end:text.length,fields:q.fields.map(f=>f.id)}],blanks:marks.map((m,i)=>({start:m.index+m[0].length,end:m.index+m[0].length,field:q.fields[i].id,width:8})),omissions:[]};
}
// Only literal publisher option banks, in their original order. No answer reads.
export function deriveInlineChoiceTemplate(q,{grouped=false}={}){
 if(q?.type!=='fields'||!q.fields?.length||q.fields.some(f=>f.input!=='single'))return null;
 const text=sourceStream(q.prompt);if(text===null)return null;
 const banks=[...text.matchAll(/[（(]([^（）()\n]*[，,][^（）()\n]*)[）)]/gu)];if(banks.length!==q.fields.length)return null;
 const compact=s=>s.replace(/\s/gu,'');
 for(const[i,m]of banks.entries()){
  const parts=m[1].split(/[，,]/u).map(s=>s.trim()),options=q.fields[i].options;
  if(parts.length<2||parts.length>8||parts.some(s=>!s)||!Array.isArray(options)||options.length!==parts.length||options.some((o,j)=>o.content?.media?.length||compact(sourceStream(o.content)??'')!==compact(parts[j])))return null;
 }
 let start=text.lastIndexOf('\n',banks[0].index)+1;const rows=[];
 if(grouped){const headers=[...text.matchAll(/^[ \t　]*[（(]([0-9０-９]{1,2})[）)]/gmu)];if(headers.length<2||headers.some((m,i)=>Number(m[1].normalize('NFKC'))!==i+1)||banks[0].index<headers[0].index)return null;start=headers[0].index;for(const[i,m]of headers.entries()){const end=headers[i+1]?.index??text.length,fields=banks.flatMap((b,j)=>b.index>=m.index&&b.index<end?[q.fields[j].id]:[]);if(!fields.length)return null;rows.push({start:m.index,end,fields});}}
 else{let at=start;for(const line of text.slice(start).split('\n')){const end=at+line.length+1,fields=banks.flatMap((m,i)=>m.index>=at&&m.index<end?[q.fields[i].id]:[]);rows.push({start:at,end:Math.min(end,text.length),fields});at=end;}}
 return {mode:'inline-choices',start,rows,blanks:banks.map((m,i)=>({start:m.index,end:m.index+m[0].length,field:q.fields[i].id})),omissions:[],...(grouped?{grouped:true}:{})};
}
// Reviewed pixel regions refer to the immutable original image, never a key.
export function deriveImagePanelTemplate(q,{media_index,sourceSize,width,panels}={}){
 if(q?.type!=='fields'||!q.fields?.length||q.fields.some(f=>f.input!=='math')||sourceStream(q.prompt)===null||q.prompt.media?.[media_index]?.kind!=='image')return null;
 if(!Number.isInteger(media_index)||!Array.isArray(sourceSize)||sourceSize.length!==2||sourceSize.some(n=>!Number.isInteger(n)||n<=0)||!Number.isFinite(width)||width<120||width>400||!Array.isArray(panels)||panels.length!==q.fields.length)return null;
 let at=0;const ranges=[];for(const p of q.prompt.layout||[]){for(const r of p.runs){if(r.type==='image'&&r.media_index===media_index)ranges.push([at,at+1]);at+=r.type==='text'?r.text.length:1;}at++;}if(ranges.length!==1)return null;
 for(const[i,p]of panels.entries()){
  const match=/^[（(]([0-9０-９]{1,2})[）)]/u.exec(q.fields[i].label),c=p.crop;
  if(p.field!==q.fields[i].id||!match||Number(match[1].normalize('NFKC'))!==i+1||!['公斤','張','片'].includes(p.unit)||!Array.isArray(c)||c.length!==4||c.some(n=>!Number.isInteger(n)||n<0)||!c[2]||!c[3]||c[0]+c[2]>sourceSize[0]||c[1]+c[3]>sourceSize[1])return null;
 }
 return {mode:'image-panels',media_index,sourceSize,width,imageRange:ranges[0],panels};
}
export function deriveAnswerTemplate(q,{marked=false,targetOffsets=null,symbols=false,underscores=false,grouped=false,groupMarker='number',keepMassUnits=false,fractionNumerators=false,subgroups=false}={}){
 if(!['open','fields'].includes(q?.type)||!q.fields?.length||q.fields.some(f=>!['text','math'].includes(f.input)))return null;
 if(keepMassUnits&&(!grouped||q.fields.some(f=>f.input!=='math')))return null;
 const stream=sourceStream(q.prompt);
 if(stream===null){
  if(!q.prompt.layout?.some(p=>p.type==='table'))return null;
  const text=q.prompt.layout.map(p=>(p.type==='table'?p.rows.flat(2):p.runs).filter(r=>r.type==='text').map(r=>r.text).join('')).join('\n');
  return sourceBlanks(text,{symbols,underscores}).length===q.fields.length?{mode:'rich',fields:q.fields.map(f=>f.id),...(symbols?{symbols}:{}),...(underscores?{underscores}:{})}:null;
 }
 const referenced=new Set(q.prompt.layout?.flatMap(p=>p.runs.filter(r=>r.type==='image').map(r=>r.media_index))??[]);
 if(q.prompt.media?.some((m,i)=>m.kind!=='image'||!referenced.has(i)))return null;
 let matches=sourceBlanks(stream,{symbols,underscores});
 const fractions=[...stream.matchAll(/\$\\frac\{([（(][\s　_＿]*[）)])\}\{([0-9]{1,3})\}\$/gu)];
 if(fractions.length&&!fractionNumerators)return null;
 if(fractionNumerators){
  if(!grouped||marked||targetOffsets||q.fields.some(f=>f.input!=='math'))return null;
  if(!fractions.length||fractions.some(m=>Number(m[2])===0))return null;
  matches=matches.filter(m=>!fractions.some(f=>m.index>=f.index&&m.index+m[0].length<=f.index+f[0].length));
  matches.push(...fractions.map(m=>({index:m.index,0:m[0],fraction:{start:m.index+m[0].lastIndexOf('{')+1,end:m.index+m[0].length-2}})));matches.sort((a,b)=>a.index-b.index);
 }
 if(matches.length!==q.fields.length)return null;
 const targets=targetOffsets?targetOffsets.map(index=>({index,0:''})):marked?[...stream.matchAll(/「[^「」\n]+」/gu)]:matches;
 if(targets.length!==q.fields.length)return null;
 const blanks=targets.map((m,i)=>{const end=m.index+m[0].length,unit=keepMassUnits?/^[ \t　]*(?:公斤|公克)/u.exec(stream.slice(end)):null;return {start:m.index+(marked?m[0].length:0),end,field:q.fields[i].id,width:m[0]==='□'||m.fraction?4:marked?7:Math.max(7,Math.min(18,m[0].replace(/[（()）\n\r]/gu,'').length)),...(m.fraction?{fraction:m.fraction}:{}),...(unit?{unit:{start:end,end:end+unit[0].length}}:{})};});
 if(grouped){
  if(marked||targetOffsets)return null;const groups=deriveGroupedTemplate(q,{groupMarker,subgroups});if(!groups)return null;
  if(groups.rows.some(row=>JSON.stringify(blanks.filter(b=>b.start>=row.start&&b.end<=row.end).map(b=>b.field))!==JSON.stringify(row.fields)))return null;
  return {mode:'grouped-blanks',start:groups.start,rows:groups.rows,blanks,omissions:[],...(symbols?{symbols}:{}),...(underscores?{underscores}:{}),...(groupMarker!=='number'?{groupMarker}:{}),...(keepMassUnits?{keepMassUnits}:{}),...(fractionNumerators?{fractionNumerators}:{}),...(subgroups?{subgroups}:{})};
 }
 const start=stream.lastIndexOf('\n',Math.min(blanks[0].start,matches[0].index)-1)+1,rows=[];let at=start;
 // Newlines inside a publisher blank are not a new sentence/group.
 const limit=stream.length,omissions=marked?matches.map(m=>[m.index,m.index+m[0].length]):[];
 for(let i=start;i<=limit;i++)if(i===limit||stream[i]==='\n'&&!blanks.some(b=>i>=b.start&&i<b.end)){
  let keep=stream.slice(at,i);for(const [a,b]of [...omissions].reverse())if(a>=at&&b<=i)keep=keep.slice(0,a-at)+keep.slice(b-at);
  if(keep.replace(/[\s　‧．ˉ]/gu,'').length)rows.push({start:at,end:i,fields:blanks.filter(b=>b.start>=at&&b.end<=i).map(b=>b.field)});at=i+1;
 }
 return {mode:marked?'marked':'blanks',start,rows,blanks,omissions,...(targetOffsets?{targetOffsets}:{}),...(symbols?{symbols}:{}),...(underscores?{underscores}:{})};
}
// A reviewed native transcription of a number/symbol task. Symbols come from
// the printed instruction; this projection never inspects answer keys.
export function deriveNumberSymbolTemplate(q){
 if(q?.type!=='fields'||!q.fields?.length||q.prompt?.media?.length||q.fields.some(f=>f.input!=='single'))return null;
 const text=sourceStream(q.prompt);if(text===null)return null;
 const lines=text.trim().split('\n').filter(s=>s.trim());if(!lines.length||lines.length%2)return null;
 const rows=[];let at=0;
 for(let i=0;i<lines.length;i+=2){
  const instruction=lines[i],match=/^(?:[（(][0-9０-９]+[）)])?(?:下面的數)?是奇數的(?:在[（(] *[）)]裡)?畫○，是偶數的(?:畫△|打ˇ)。$/u.exec(instruction);
  if(!match||!/^\d+(?:、\d+)*$/u.test(lines[i+1]))return null;
  const numbers=lines[i+1].split('、'),symbols=['○',instruction.includes('△')?'△':'ˇ'],fields=q.fields.slice(at,at+numbers.length);
  if(fields.length!==numbers.length||fields.some((f,j)=>f.label!==numbers[j]||f.options?.length!==2||f.options.some((o,k)=>o.content?.media?.length||sourceStream(o.content)!==symbols[k])))return null;
  rows.push({instruction,fields:fields.map(f=>f.id)});at+=numbers.length;
 }
 return at===q.fields.length?{mode:'number-symbols',start:0,rows}:null;
}
// Reviewed diagrams stay immutable. Views only locate original pixels and their
// original response controls; the printed task supplies the symbol choices.
export function deriveDiagramSymbolTemplate(q,{groups,reference}={}){
 if(q?.type!=='fields'||!q.fields?.length||q.fields.some(f=>f.input!=='single')||!Array.isArray(groups)||!groups.length)return null;
 const text=sourceStream(q.prompt);if(text===null)return null;const end=text.indexOf('\n');if(end<0)return null;
 const symbols=[...text.slice(0,end).matchAll(/(?:打|畫)\s*([○△ˇ╳])/gu)].map(m=>m[1]);
 if(symbols.length<2||symbols.length>3||new Set(symbols).size!==symbols.length||!/^[\s①-⑳ㄅ-ㄩ□\ufffc]*$/u.test(text.slice(end)))return null;
 if(q.fields.some(f=>f.options?.length!==symbols.length||f.options.some((o,i)=>o.content?.media?.length||sourceStream(o.content)!==symbols[i])))return null;
 const fields=groups.flatMap(g=>g.fields||[]);if(JSON.stringify(fields)!==JSON.stringify(q.fields.map(f=>f.id)))return null;
 const widths=new Map(),sizes=new Map(),used=new Set();
 for(const g of [...(reference?[reference]:[]),...groups]){
  if(typeof g.label!=='string'||!g.label.trim()||g.label.length>30||!Array.isArray(g.views)||!g.views.length||g!==reference&&(!g.fields.length||g.fields.length>2))return null;
  for(const v of g.views){const i=v.media_index,c=v.crop,s=v.sourceSize;
   if(!Number.isInteger(i)||q.prompt.media?.[i]?.kind!=='image'||!Array.isArray(s)||s.length!==2||s.some(n=>!Number.isInteger(n)||n<=0)||!Array.isArray(c)||c.length!==4||c.some(n=>!Number.isInteger(n)||n<0)||!c[2]||!c[3]||c[0]+c[2]>s[0]||c[1]+c[3]>s[1]||!Number.isInteger(v.width)||v.width<80||v.width>500)return null;
   if(widths.has(i)&&widths.get(i)!==v.width||sizes.has(i)&&sizes.get(i)!==JSON.stringify(s))return null;widths.set(i,v.width);sizes.set(i,JSON.stringify(s));used.add(i);
  }
 }
 if(used.size!==q.prompt.media.length)return null;
 return {mode:'diagram-symbols',start:end,groups,...(reference?{reference}:{})};
}
export function answerTemplatePresentation(q,registry=answerTemplateSources){
 const source=taskReadingSource(q),p=registry[source?.id];if(!p)return null;
 const guard=presentationSignature(source);if(p.guard!==guard&&p.partnerGuard!==guard)return null;
 if(p.model.mode==='diagram-symbols'){
  const model=deriveDiagramSymbolTemplate(source,p.model);if(!model||JSON.stringify(model)!==JSON.stringify(p.model))return null;
  const renderPrompt=projectSourceBoxes(source.prompt,q.prompt);return {...model,source,renderPrompt,passage:sliceContent(renderPrompt,0,model.start)};
 }
 if(p.model.mode==='number-symbols'){
  const model=deriveNumberSymbolTemplate(source);if(!model||JSON.stringify(model)!==JSON.stringify(p.model))return null;
  return {...model,source,renderPrompt:projectSourceBoxes(source.prompt,q.prompt),passage:{text:'',media:[]}};
 }
 const model=p.model.mode==='inline-choices'?deriveInlineChoiceTemplate(source,p.model):p.model.mode==='image-panels'?deriveImagePanelTemplate(source,p.model):p.model.mode==='groups'?deriveGroupedTemplate(source,{groupMarker:p.model.groupMarker}):p.model.mode==='options'?deriveOptionTemplate(source):p.model.mode==='material'&&source.prompt.media.length?{mode:'material',fields:source.fields.map(f=>f.id)}:deriveAnswerTemplate(source,{marked:p.model.mode==='marked',targetOffsets:p.model.targetOffsets,symbols:p.model.symbols,underscores:p.model.underscores,grouped:p.model.mode==='grouped-blanks',groupMarker:p.model.groupMarker,keepMassUnits:p.model.keepMassUnits,fractionNumerators:p.model.fractionNumerators,subgroups:p.model.subgroups});if(!model||JSON.stringify(model)!==JSON.stringify(p.model))return null;
 const renderPrompt=projectSourceBoxes(source.prompt,q.prompt);
 return {...model,source,renderPrompt,passage:taskReadingPresentation(q,{passage:model.mode==='image-panels'?omitRanges(renderPrompt,[model.imageRange]):['rich','material'].includes(model.mode)?{text:'',media:[]}:sliceContent(renderPrompt,0,model.start)}).passage};
}

// Move the original controls (and listeners/feedback/keyboards), never clone,
// recreate values, change field names or introduce another submit action.
export function compactTemplateFeedback(feedback){
 if(feedback?.input!=='math')return null;
 if(feedback.state==='correct')return {state:'correct',text:'✓ 答對'};
 if(feedback.state==='incorrect')return {state:'incorrect',text:'✕ 請修正'};
 if(!['reference','paired'].includes(feedback.state)||!Array.isArray(feedback.accepted)||!feedback.accepted.length||feedback.accepted.some(v=>typeof v!=='string'||!v.trim()))return null;
 return {state:'reference',text:(feedback.state==='paired'?'整組核對：':'參考：')+[...new Set(feedback.accepted)].join(' 或 ')};
}
export function mountAnswerTemplate(group,q,{renderContent,registry,fieldFeedback}={}){
 const plan=answerTemplatePresentation(q,registry);if(!plan)return false;const renderPrompt=plan.renderPrompt;
 const slots=[...group.querySelectorAll(':scope > .quiz-field')];if(slots.length!==q.fields.length)return false;
 const byId=new Map(q.fields.map((f,i)=>[f.id,slots[i]]));
 const exampleSource=openCompositionSources[plan.source.id],characters=exampleSource?.guard===presentationSignature(plan.source)?exampleSlotCharacters(plan):null;
 slots.forEach(slot=>slot.classList.add('quiz-answer-paired-field'));
 if(plan.source.prompt.media.length&&!renderContent)throw Error('answer_template_media_renderer_required');
 const doc=group.ownerDocument,container=doc.createElement('div');container.className='quiz-answer-templates';if(plan.mode==='grouped-blanks')container.classList.add('quiz-answer-grouped-blanks');if(plan.mode==='inline-choices')container.classList.add('quiz-answer-inline-choices');let number=0;
 const finish=()=>{container.querySelectorAll('img').forEach(img=>{img.dataset.imageLightbox='';img.dataset.partnerImage='';if(img.closest('[data-image-panel-proxy]')){img.tabIndex=-1;return;}img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label',(img.alt||'原題圖片')+'，點擊放大');});group.classList.add('quiz-has-answer-template');group.append(container);const work=group.querySelector(':scope > .quiz-work-input');if(work)group.append(work);return true;};
 const prepare=(slot,input,width,label)=>{slot.classList.add('quiz-answer-template-slot');slot.style.setProperty('--answer-slot-width',width+'ch');slot.querySelector('legend').classList.add('quiz-answer-template-label');input.setAttribute('aria-label',label);
  if(input.disabled&&q.type==='fields'&&q.fields.every(f=>f.input==='math')){
   const index=slots.indexOf(slot),mark=compactTemplateFeedback(fieldFeedback?.[index]);
   if(mark){slot.dataset.templateReview=mark.state;slot.querySelectorAll(':scope > .quiz-field-review-status,:scope > .quiz-field-review-reference').forEach(n=>n.remove());const note=doc.createElement('span');note.className='quiz-answer-template-result';note.id=input.id+'-template-result';note.textContent=mark.text;input.setAttribute('aria-describedby',note.id);slot.append(note);}
  }
  if(input.tagName==='TEXTAREA'){input.rows=1;const resize=()=>{
  if(!input.isConnected)return;
  {const style=doc.defaultView.getComputedStyle(input),context=doc.createElement('canvas').getContext('2d');context.font=style.font;const px=name=>parseFloat(style[name])||0;slot.style.setProperty('--answer-slot-grown-width',growingSlotWidth({text:input.value,fontSize:px('fontSize'),letterSpacing:px('letterSpacing'),padding:px('paddingLeft')+px('paddingRight'),borders:px('borderLeftWidth')+px('borderRightWidth'),measure:text=>context.measureText(text).width})+'px');}
  input.style.height='auto';input.style.height=Math.max(48,Math.min(300,input.scrollHeight+4))+'px';input.style.overflowY=input.scrollHeight>300?'auto':'hidden';
 };input.addEventListener('input',resize);input.addEventListener('quiz-answer-refit',resize);installWidthReflow(doc);queueMicrotask(resize);doc.defaultView?.requestAnimationFrame(resize);}};
 if(plan.mode==='rich'){
  if(!renderContent)throw Error('answer_template_rich_renderer_required');renderContent(container,renderPrompt);
  const walker=doc.createTreeWalker(container,4),nodes=[];while(walker.nextNode())if(!walker.currentNode.parentElement?.closest('.katex,script,style'))nodes.push(walker.currentNode);
  const joined=nodes.map(n=>n.textContent).join(''),matches=sourceBlanks(joined,plan);
  // Keep a complete source beside the original controls if rendered math cannot
  // expose exactly the original blanks. No partial replacement or lost source.
  if(matches.length!==q.fields.length){group.prepend(container);return false;}
  const positions=[];let at=0;for(const node of nodes){positions.push({node,start:at,end:at+node.textContent.length});at+=node.textContent.length;}
  matches.forEach((m,i)=>{const slot=byId.get(q.fields[i].id),input=slot.querySelector('input[type=text],textarea');prepare(slot,input,10,q.fields[i].label);});
  for(let i=matches.length-1;i>=0;i--){const m=matches[i],first=positions.find(n=>m.index>=n.start&&m.index<n.end),last=positions.find(n=>m.index+m[0].length>n.start&&m.index+m[0].length<=n.end),range=doc.createRange();range.setStart(first.node,m.index-first.start);range.setEnd(last.node,m.index+m[0].length-last.start);range.deleteContents();range.insertNode(byId.get(q.fields[i].id));}
  container.querySelectorAll('.quiz-table-wrap:has(.quiz-answer-template-slot)').forEach(wrapper=>{wrapper.tabIndex=0;wrapper.setAttribute('role','region');wrapper.setAttribute('aria-label','原題表格，可左右捲動');});
  return finish();
 }
 const render=(host,content)=>{if(renderContent)renderContent(host,content);else host.textContent=content.text;};
 if(plan.mode==='diagram-symbols'){
  container.classList.add('quiz-answer-diagram-symbols','quiz-answer-number-symbols');const groups=doc.createElement('div');groups.className='quiz-diagram-groups';
  const views=[...(plan.reference?.views||[]),...plan.groups.flatMap(g=>g.views)],maxWidths=new Map();for(const v of views)maxWidths.set(v.media_index,Math.max(maxWidths.get(v.media_index)||0,v.crop[2]));
  const diagram=(host,v)=>{const frame=doc.createElement('div'),button=doc.createElement('button'),hint=doc.createElement('p'),[x,y,w,h]=v.crop;frame.className='quiz-answer-image-panel-frame';frame.style.width=v.width+'px';button.type='button';button.className='quiz-answer-image-panel-view';button.dataset.imagePanelProxy='';button.setAttribute('aria-label','放大完整原圖');button.style.width=w/maxWidths.get(v.media_index)*100+'%';button.style.aspectRatio=w+'/'+h;button.style.setProperty('--panel-image-width',v.sourceSize[0]/w*100+'%');button.style.setProperty('--panel-image-left',-x/w*100+'%');button.style.setProperty('--panel-image-top',-y/h*100+'%');render(button,{text:'',media:[renderPrompt.media[v.media_index]],layout:[{type:'paragraph',runs:[{type:'image',media_index:0}]}]});button.addEventListener('click',event=>{if(event.target===button)button.querySelector('img')?.click();});frame.append(button);hint.className='quiz-answer-image-panel-hint';hint.textContent='點圖看完整原圖';host.append(frame,hint);};
  const card=row=>{const section=doc.createElement('section'),title=doc.createElement('h4');section.className='quiz-diagram-symbol-card';title.className='quiz-answer-template-title';title.textContent=row.label;section.append(title);for(const v of row.views)diagram(section,v);return section;};
  if(plan.reference){const ref=card(plan.reference);ref.classList.add('quiz-diagram-reference');container.append(ref);}
  for(const row of plan.groups){const section=card(row),controls=doc.createElement('div');controls.className='quiz-number-symbol-grid quiz-diagram-controls';controls.style.gridTemplateColumns=`repeat(${row.fields.length},minmax(0,1fr))`;
   for(const id of row.fields){const slot=byId.get(id);slot.classList.add('quiz-number-symbol-card');if(row.fields.length===1)slot.querySelector('legend').classList.add('quiz-answer-template-label');const status=slot.querySelector(':scope > .quiz-field-review-status');if(status){status.title=status.textContent;status.textContent=slot.dataset.fieldReview==='correct'?'✓ 答對':slot.dataset.fieldReview==='incorrect'?'✕ 請修正':'請核對';}for(const note of slot.querySelectorAll('.quiz-field-review-note')){note.title=note.textContent;const state=note.closest('[data-field-result]')?.dataset.fieldResult;note.textContent=state==='correct'?'✓ 選對':state==='wrong'?'✕ 選錯':state==='answer'?'答案':note.textContent;}controls.append(slot);}
   section.append(controls);groups.append(section);
  }
  container.append(groups);return finish();
 }
 if(plan.mode==='number-symbols'){
  container.classList.add('quiz-answer-number-symbols');
  for(const row of plan.rows){
   const section=doc.createElement('section'),title=doc.createElement('h4'),grid=doc.createElement('div');title.className='quiz-answer-template-title';title.textContent=row.instruction;grid.className='quiz-number-symbol-grid';section.append(title,grid);
   for(const id of row.fields){
    const slot=byId.get(id);slot.classList.add('quiz-number-symbol-card');
    const status=slot.querySelector(':scope > .quiz-field-review-status');if(status){status.title=status.textContent;status.textContent=slot.dataset.fieldReview==='correct'?'✓ 答對':slot.dataset.fieldReview==='incorrect'?'✕ 請修正':'請核對';}
    for(const note of slot.querySelectorAll('.quiz-field-review-note')){note.title=note.textContent;const state=note.closest('[data-field-result]')?.dataset.fieldResult;note.textContent=state==='correct'?'✓ 選對':state==='wrong'?'✕ 選錯':state==='answer'?'答案':note.textContent;}
    grid.append(slot);
   }
   container.append(section);
  }
  return finish();
 }
 if(plan.mode==='image-panels'){
  container.classList.add('quiz-answer-image-panels');const maxWidth=Math.max(...plan.panels.map(p=>p.crop[2]));
  for(const[i,p]of plan.panels.entries()){
   const card=doc.createElement('section'),title=doc.createElement('h4'),frame=doc.createElement('div'),view=doc.createElement('button'),hint=doc.createElement('p'),line=doc.createElement('div'),unit=doc.createElement('span');card.className='quiz-answer-template-row';title.className='quiz-answer-template-title';title.textContent=`第${i+1}小題`;card.setAttribute('role','group');card.setAttribute('aria-label',title.textContent);frame.className='quiz-answer-image-panel-frame';frame.style.width=plan.width+'px';view.type='button';view.className='quiz-answer-image-panel-view';view.dataset.imagePanelProxy='';view.setAttribute('aria-label',title.textContent+'原圖，放大完整原圖');const[x,y,w,h]=p.crop;view.style.width=w/maxWidth*100+'%';view.style.aspectRatio=w+'/'+h;view.style.setProperty('--panel-image-width',plan.sourceSize[0]/w*100+'%');view.style.setProperty('--panel-image-left',-x/w*100+'%');view.style.setProperty('--panel-image-top',-y/h*100+'%');
   render(view,{text:'',media:[renderPrompt.media[plan.media_index]],layout:[{type:'paragraph',runs:[{type:'image',media_index:0}]}]});view.addEventListener('click',event=>{if(event.target===view)view.querySelector('img')?.click();});frame.append(view);hint.className='quiz-answer-image-panel-hint';hint.textContent='點圖看完整原圖';line.className='quiz-answer-template-line';const slot=byId.get(p.field),input=slot.querySelector('input[type=text],textarea');if(!input)throw Error('answer_template_original_input_required');prepare(slot,input,7,q.fields[i].label);unit.className='quiz-answer-template-unit-text';unit.textContent=p.unit;line.append(slot,unit);card.append(title,frame,hint,line);container.append(card);
  }
  return finish();
 }
 if(plan.mode==='material'){
  if(!renderContent)throw Error('answer_template_media_renderer_required');const source=doc.createElement('section'),answers=doc.createElement('section');source.className='quiz-answer-source-panel';source.tabIndex=0;source.setAttribute('aria-label','原題與共用圖表');render(source,renderPrompt);answers.className='quiz-answer-source-controls';for(const f of q.fields)answers.append(byId.get(f.id));container.classList.add('quiz-answer-material');container.append(source,answers);return finish();
 }
 if(plan.mode==='groups'){
  for(const row of plan.rows){const section=doc.createElement('section');section.className='quiz-answer-template-row quiz-answer-question-group';const stem=doc.createElement('div');stem.className='quiz-answer-group-stem';render(stem,sliceContent(renderPrompt,row.start,row.end));section.append(stem);const inputs=doc.createElement('div');inputs.className='quiz-answer-group-controls';for(const id of row.fields)inputs.append(byId.get(id));section.append(inputs);container.append(section);}return finish();
 }
 for(const row of plan.rows){
  const box=doc.createElement('section');box.className='quiz-answer-template-row';box.setAttribute('role','group');
  if(row.fields.length){const title=doc.createElement('h4');title.className='quiz-answer-template-title';number++;title.textContent=row.parentNumber?`第${row.parentNumber}組・${row.number}`:`第${plan.subgroups?row.number:number}組`;box.append(title);box.setAttribute('aria-label',title.textContent);}
  const line=doc.createElement('div');line.className='quiz-answer-template-line';box.append(line);let at=row.start;
  const text=(a,b)=>{if(a>=b)return;let at=a;const pieces=[];for(const [x,y]of plan.omissions.filter(([x,y])=>x>=a&&y<=b)){if(at<x)pieces.push([at,x]);at=y;}if(at<b)pieces.push([at,b]);for(const [x,y]of pieces){const span=doc.createElement('div');span.className='quiz-answer-template-text';render(span,sliceContent(renderPrompt,x,y));line.append(span);}};
  for(const blank of plan.blanks.filter(b=>row.fields.includes(b.field))){
   text(at,blank.start);const slot=byId.get(blank.field);
   if(plan.mode==='inline-choices'){slot.classList.add('quiz-inline-choice-slot');slot.querySelector('legend').classList.add('quiz-answer-template-label');line.append(slot);at=blank.end;continue;}
   const input=slot.querySelector('input[type=text],textarea');if(!input)throw Error('answer_template_original_input_required');
   prepare(slot,input,blank.width,`${row.parentNumber?`第${row.parentNumber}組・${row.number}・`:number?`第${number}組・`:''}${slot.querySelector('legend').textContent}`);
   if(characters){slot.classList.add('quiz-answer-example-width');slot.style.setProperty('--answer-slot-characters',characters[blank.field]);}
   if(blank.fraction){
    const fraction=doc.createElement('span'),body=doc.createElement('span'),denominator=doc.createElement('span');fraction.className='quiz-answer-fraction';body.className='quiz-answer-fraction-body';denominator.className='quiz-answer-fraction-denominator';denominator.textContent=sourceStream(renderPrompt).slice(blank.fraction.start,blank.fraction.end);
    input.setAttribute('aria-label',input.getAttribute('aria-label')+'（分母'+denominator.textContent+'，只填分子）');input.placeholder='分子';input.inputMode='numeric';body.append(slot,denominator);fraction.append(body);for(const result of slot.querySelectorAll(':scope > .quiz-answer-template-result'))fraction.append(result);line.append(fraction);at=blank.end;
   }
   else if(blank.unit){const pair=doc.createElement('span'),unit=doc.createElement('span');pair.className='quiz-answer-template-unit';unit.className='quiz-answer-template-unit-text';render(unit,sliceContent(renderPrompt,blank.unit.start,blank.unit.end));pair.append(slot,unit);line.append(pair);at=blank.unit.end;}
   else{line.append(slot);at=blank.end;}
  }
  text(at,row.end);container.append(box);
 }
 return finish();
}
