// Classroom practice only. No storage, scores, rewards or simulated OS shortcuts.
export function initWeek13Practice(root = document) {
 const fields = [...root.querySelectorAll('[data-tab-field]')];
 const status = root.querySelector('#tab-status');
 fields.forEach((field,index) => field.addEventListener('focus',()=>{
  status.textContent = `現在在第 ${index+1} 格「${field.dataset.tabField}」。${index===2?'在這個多行框，Enter 可以換行。':'Tab 前進一格，Shift＋Tab 返回一格。'} 回來看到反白，先別急著打字。`;
 }));
 const shift = root.querySelector('#shift-practice');
 const shiftStatus = root.querySelector('#shift-status');
 shift?.addEventListener('keydown',event=>{
  if (!event.isComposing && event.shiftKey && !event.ctrlKey && !event.altKey && event.key.length===1)
   shiftStatus.textContent = `你剛剛搭配 Shift 按了「${event.key}」。看看畫面，再放開 Shift 繼續輸入。`;
 });
 root.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',()=>{
  const section=root.querySelector(a.getAttribute('href'));
  // Opening the inner typing section also opens the parent fast-task group.
  for(let el=section;el;el=el.parentElement)if(el.tagName==='DETAILS')el.open=true;
  const details=section?.querySelector('details.task-section');if(details)details.open=true;
 }));
}
if (typeof document!=='undefined') initWeek13Practice();
