// A view adapter only. Values stay in the caller's original response envelope.
export const matchingPatch=(board,values)=>Object.fromEntries(board.left.map(item=>[item.id,values[item.id]]));
export const matchingValues=(item,value)=>{
 const values=item.multiple?(Array.isArray(value)?value:[]):typeof value==='string'&&value?[value]:[];
 return values.map(v=>{const normalized=item.trimSpaces&&typeof v==='string'?v.replace(/^ +| +$/g,''):v;return item.options.find(o=>o.value===normalized||item.caseInsensitive&&typeof normalized==='string'&&o.value===normalized.toUpperCase())?.id;}).filter(Boolean);
};
export function matchingConnect(board,values,leftId,rightId){
 const item=board.left.find(l=>l.id===leftId),option=item?.options.find(o=>o.id===rightId);if(!option)return values;
 const next={...values};
 if(item.multiple){const old=Array.isArray(values[item.id])?values[item.id]:[],at=old.indexOf(option.value);next[item.id]=at<0?[...old,option.value]:old.filter(v=>v!==option.value);}
 else next[item.id]=option.value;
 // Repeated destinations are valid unless the original source explicitly says
 // otherwise. Never impose the demo's one-to-one restriction on classifications.
 if(board.unique)for(const other of board.left)if(other.id!==leftId&&matchingValues(other,next[other.id]).includes(rightId))next[other.id]=other.multiple?next[other.id].filter(v=>v!==other.options.find(o=>o.id===rightId).value):'';
 return next;
}
export function matchingRemove(board,values,leftId,rightId){
 const item=board.left.find(l=>l.id===leftId);if(!item)return values;
 const option=item.options.find(o=>o.id===rightId),next={...values};
 next[item.id]=item.multiple?(Array.isArray(values[item.id])?values[item.id]:[]).filter(v=>v!==option?.value):'';return next;
}
export function matchingReference(item,value,accepted){
 if(!Array.isArray(accepted)||!accepted.length)return null;
 const selected=matchingValues(item,value),alternatives=accepted.map(v=>matchingValues(item,v)),exact=alternatives.find(a=>a.length===selected.length&&a.every(id=>selected.includes(id))),target=exact??alternatives[0];
 return {selected,target,correct:Boolean(exact),alternatives,wrong:selected.filter(id=>!target.includes(id)),missing:target.filter(id=>!selected.includes(id))};
}
