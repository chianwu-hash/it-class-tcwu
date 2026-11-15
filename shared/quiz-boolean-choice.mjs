// Presentation only. Never rename option IDs or change stored/submitted answers.
const yes=new Set(['O','○','◯','〇','⭕','✓','✔','√','ˇ','✅','T','TRUE','是','對','正確']);
const no=new Set(['X','×','✕','✖','╳','☓','❌','F','FALSE','否','錯','錯誤','不正確']);
// Importers may have combined a source value, a symbol and its caption. Only
// these reviewed equivalents are accepted; ordinary words/OO/XX stay intact.
const normalize=t=>t.normalize('NFKC').replace(/\s/gu,'').toUpperCase();
const yesLabels=new Set(['O○正確','O◯正確','O〇正確','O正確','○正確','◯正確','〇正確','T正確','TRUE正確','ˇ（符合題意）','ˇ正確','ˇ：正確／符合','ˇ：是，符合題意','正確：正確','ˇ（正確）'].map(normalize));
const noLabels=new Set(['X×不正確','X╳不正確','X✕不正確','X不正確','×不正確','╳不正確','✕不正確','F不正確','FALSE不正確','╳（不符合題意）','☓（不符合題意）','╳錯誤','╳：錯誤／不符合','╳：不是，不符合題意','錯誤：錯誤','×（錯誤）','×（不符合題意）'].map(normalize));
export function booleanChoicePresentation(choices,contents){
 if(!Array.isArray(choices)||choices.length!==2)return null;
 const tokens=choices.map((choice,i)=>{
  const c=contents?.[i]??choice.content??{text:choice.text??'',media:[]};
  if(c.media?.length||typeof c.text!=='string')return null;
  if(c.layout?.length){
   if(c.layout.some(p=>p.type!=='paragraph'||!Array.isArray(p.runs)||p.runs.some(r=>r.type!=='text')))return null;
   const rich=c.layout.map(p=>p.runs.map(r=>r.text).join('')).join('\n');
   if(rich.replace(/\s/gu,'')!==c.text.replace(/\s/gu,''))return null;
  }
  return normalize(c.text);
 });
 const truth=t=>yes.has(t)||yesLabels.has(t)?true:no.has(t)||noLabels.has(t)?false:null;
 const values=tokens.map(truth);if(values.includes(null)||values[0]===values[1])return null;
 return values.map((value,i)=>({badge:/^T(?:正確)?$/.test(tokens[i])?'T':/^F(?:不正確)?$/.test(tokens[i])?'F':value?'○':'×',text:value?'正確':'不正確'}));
}
