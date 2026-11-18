// Stored sequence answers are option IDs, never positions or visible labels.
export function completeSequence(field,value){
 return Array.isArray(value)&&value.length===field.options.length&&new Set(value).size===value.length&&value.every(id=>field.options.some(o=>o.id===id));
}
export function initialSequence(field,value){
 if(completeSequence(field,value))return [...value];
 const ids=field.options.map(o=>o.id),used=new Set(),partial=ids.map((_,i)=>{
  const id=Array.isArray(value)?value[i]:null;if(ids.includes(id)&&!used.has(id)){used.add(id);return id;}return null;
 });
 const remaining=ids.filter(id=>!used.has(id));return partial.map(id=>id??remaining.shift());
}
export function moveSequence(order,id,to){
 const from=order.indexOf(id);if(from<0||!Number.isInteger(to)||to<0||to>=order.length||from===to)return order;
 const next=[...order];next.splice(from,1);next.splice(to,0,id);return next;
}
export function sequenceReference(field,value,accepted){
 const choices=(accepted||[]).filter(a=>completeSequence(field,a));if(!choices.length||!completeSequence(field,value))return null;
 const score=a=>a.filter((id,i)=>id===value[i]).length;
 return choices.reduce((best,a)=>score(a)>score(best)?a:best,choices[0]);
}
