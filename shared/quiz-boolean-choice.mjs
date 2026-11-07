// Presentation only. Never rename option IDs or change stored/submitted answers.
const yes=new Set(['O','○','◯','〇','⭕','✓','✔','√','✅','T','TRUE','是','對','正確']);
const no=new Set(['X','×','✕','✖','╳','❌','F','FALSE','否','錯','錯誤','不正確']);
export function booleanChoicePresentation(choices,contents){
 if(!Array.isArray(choices)||choices.length!==2)return null;
 const tokens=choices.map((choice,i)=>{
  const c=contents?.[i]??choice.content??{text:choice.text??'',media:[]};
  if(c.media?.length||c.layout?.length)return null;
  return typeof c.text==='string'?c.text.normalize('NFKC').trim().toUpperCase():null;
 });
 const truth=t=>yes.has(t)?true:no.has(t)?false:null;
 const values=tokens.map(truth);if(values.includes(null)||values[0]===values[1])return null;
 return values.map((value,i)=>({badge:['T','F'].includes(tokens[i])?tokens[i]:value?'○':'×',text:value?'正確':'不正確'}));
}
