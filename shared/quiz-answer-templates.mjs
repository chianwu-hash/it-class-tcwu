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
export function deriveGroupedTemplate(q){
 if(!q?.fields?.length||q.fields.some(f=>!['text','math'].includes(f.input)))return null;
 const text=sourceStream(q?.prompt);if(text===null||!q?.fields?.length)return null;
 const markers=[...text.matchAll(/^[ \t　]*[（(]([0-9０-９]{1,2})[）)]/gmu)];if(markers.length<2)return null;
 const numbers=markers.map(m=>Number(m[1].normalize('NFKC')));if(new Set(numbers).size!==numbers.length)return null;
 const owners=q.fields.map(f=>{const m=/^(?:第\s*)?[（(]?([0-9０-９]{1,2})[）)]/u.exec(f.label);return m?Number(m[1].normalize('NFKC')):null;});if(owners.some(n=>!numbers.includes(n)))return null;
 return {mode:'groups',start:markers[0].index,rows:markers.map((m,i)=>({start:m.index,end:markers[i+1]?.index??text.length,number:numbers[i],fields:q.fields.filter((f,j)=>owners[j]===numbers[i]).map(f=>f.id)}))};
}
export function deriveOptionTemplate(q){
 if(!q?.fields?.length||q.fields.some(f=>!['text','math'].includes(f.input)))return null;
 const text=sourceStream(q?.prompt);if(text===null||!q?.fields?.length)return null;
 const marks=[...text.matchAll(/[（(][^（）()\n]*[／/][^（）()\n]*[）)]/gu)];if(marks.length!==q.fields.length)return null;
 return {mode:'options',start:0,rows:[{start:0,end:text.length,fields:q.fields.map(f=>f.id)}],blanks:marks.map((m,i)=>({start:m.index+m[0].length,end:m.index+m[0].length,field:q.fields[i].id,width:8})),omissions:[]};
}
export function deriveAnswerTemplate(q,{marked=false,targetOffsets=null,symbols=false,underscores=false,grouped=false}={}){
 if(!['open','fields'].includes(q?.type)||!q.fields?.length||q.fields.some(f=>!['text','math'].includes(f.input)))return null;
 const stream=sourceStream(q.prompt);
 if(stream===null){
  if(!q.prompt.layout?.some(p=>p.type==='table'))return null;
  const text=q.prompt.layout.map(p=>(p.type==='table'?p.rows.flat(2):p.runs).filter(r=>r.type==='text').map(r=>r.text).join('')).join('\n');
  return sourceBlanks(text,{symbols,underscores}).length===q.fields.length?{mode:'rich',fields:q.fields.map(f=>f.id),...(symbols?{symbols}:{}),...(underscores?{underscores}:{})}:null;
 }
 const referenced=new Set(q.prompt.layout?.flatMap(p=>p.runs.filter(r=>r.type==='image').map(r=>r.media_index))??[]);
 if(q.prompt.media?.some((m,i)=>m.kind!=='image'||!referenced.has(i)))return null;
 const matches=sourceBlanks(stream,{symbols,underscores});if(matches.length!==q.fields.length)return null;
 const targets=targetOffsets?targetOffsets.map(index=>({index,0:''})):marked?[...stream.matchAll(/「[^「」\n]+」/gu)]:matches;
 if(targets.length!==q.fields.length)return null;
 const blanks=targets.map((m,i)=>({start:m.index+(marked?m[0].length:0),end:m.index+m[0].length,field:q.fields[i].id,width:m[0]==='□'?4:marked?7:Math.max(7,Math.min(18,m[0].replace(/[（()）\n\r]/gu,'').length))}));
 if(grouped){
  if(marked||targetOffsets)return null;const groups=deriveGroupedTemplate(q);if(!groups)return null;
  if(groups.rows.some(row=>JSON.stringify(blanks.filter(b=>b.start>=row.start&&b.end<=row.end).map(b=>b.field))!==JSON.stringify(row.fields)))return null;
  return {mode:'grouped-blanks',start:groups.start,rows:groups.rows,blanks,omissions:[],...(symbols?{symbols}:{}),...(underscores?{underscores}:{})};
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
export function answerTemplatePresentation(q,registry=answerTemplateSources){
 const source=taskReadingSource(q),p=registry[source?.id];if(!p)return null;
 const guard=presentationSignature(source);if(p.guard!==guard&&p.partnerGuard!==guard)return null;
 const model=p.model.mode==='groups'?deriveGroupedTemplate(source):p.model.mode==='options'?deriveOptionTemplate(source):p.model.mode==='material'&&source.prompt.media.length?{mode:'material',fields:source.fields.map(f=>f.id)}:deriveAnswerTemplate(source,{marked:p.model.mode==='marked',targetOffsets:p.model.targetOffsets,symbols:p.model.symbols,underscores:p.model.underscores,grouped:p.model.mode==='grouped-blanks'});if(!model||JSON.stringify(model)!==JSON.stringify(p.model))return null;
 const renderPrompt=projectSourceBoxes(source.prompt,q.prompt);
 return {...model,source,renderPrompt,passage:taskReadingPresentation(q,{passage:['rich','material'].includes(model.mode)?{text:'',media:[]}:sliceContent(renderPrompt,0,model.start)}).passage};
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
 const doc=group.ownerDocument,container=doc.createElement('div');container.className='quiz-answer-templates';let number=0;
 const finish=()=>{container.querySelectorAll('img').forEach(img=>{img.dataset.imageLightbox='';img.dataset.partnerImage='';img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label',(img.alt||'原題圖片')+'，點擊放大');});group.classList.add('quiz-has-answer-template');group.append(container);const work=group.querySelector(':scope > .quiz-work-input');if(work)group.append(work);return true;};
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
  return finish();
 }
 const render=(host,content)=>{if(renderContent)renderContent(host,content);else host.textContent=content.text;};
 if(plan.mode==='material'){
  if(!renderContent)throw Error('answer_template_media_renderer_required');const source=doc.createElement('section'),answers=doc.createElement('section');source.className='quiz-answer-source-panel';source.tabIndex=0;source.setAttribute('aria-label','原題與共用圖表');render(source,renderPrompt);answers.className='quiz-answer-source-controls';for(const f of q.fields)answers.append(byId.get(f.id));container.classList.add('quiz-answer-material');container.append(source,answers);return finish();
 }
 if(plan.mode==='groups'){
  for(const row of plan.rows){const section=doc.createElement('section');section.className='quiz-answer-template-row quiz-answer-question-group';const stem=doc.createElement('div');stem.className='quiz-answer-group-stem';render(stem,sliceContent(renderPrompt,row.start,row.end));section.append(stem);const inputs=doc.createElement('div');inputs.className='quiz-answer-group-controls';for(const id of row.fields)inputs.append(byId.get(id));section.append(inputs);container.append(section);}return finish();
 }
 for(const row of plan.rows){
  const box=doc.createElement('section');box.className='quiz-answer-template-row';box.setAttribute('role','group');
  if(row.fields.length){const title=doc.createElement('h4');title.className='quiz-answer-template-title';title.textContent=`第${++number}組`;box.append(title);box.setAttribute('aria-label',title.textContent);}
  const line=doc.createElement('div');line.className='quiz-answer-template-line';box.append(line);let at=row.start;
  const text=(a,b)=>{if(a>=b)return;let at=a;const pieces=[];for(const [x,y]of plan.omissions.filter(([x,y])=>x>=a&&y<=b)){if(at<x)pieces.push([at,x]);at=y;}if(at<b)pieces.push([at,b]);for(const [x,y]of pieces){const span=doc.createElement('div');span.className='quiz-answer-template-text';render(span,sliceContent(renderPrompt,x,y));line.append(span);}};
  for(const blank of plan.blanks.filter(b=>row.fields.includes(b.field))){
   text(at,blank.start);const slot=byId.get(blank.field),input=slot.querySelector('input[type=text],textarea');if(!input)throw Error('answer_template_original_input_required');
   prepare(slot,input,blank.width,`${number?`第${number}組・`:''}${slot.querySelector('legend').textContent}`);
   if(characters){slot.classList.add('quiz-answer-example-width');slot.style.setProperty('--answer-slot-characters',characters[blank.field]);}
   line.append(slot);at=blank.end;
  }
  text(at,row.end);container.append(box);
 }
 return finish();
}
