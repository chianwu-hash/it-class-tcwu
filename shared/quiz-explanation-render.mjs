import {renderContent} from './quiz-render.mjs';

// Display-only conversion for reviewed prose. Never evaluate or change answers.
// A small numeric grammar deliberately rejects dates, units inside expressions,
// malformed notation and arbitrary TeX. Explicit math keeps the existing renderer.
function numericMath(source){
 const value=source.replace(/[０-９]/g,c=>String(c.charCodeAt(0)-0xff10))
  .replace(/[（]/g,'(').replace(/[）]/g,')').replace(/／/g,'/')
  .replace(/[＋]/g,'+').replace(/[－−]/g,'-').replace(/＝/g,'=')
  .replace(/＜/g,'<').replace(/＞/g,'>');
 if(value.length>500||!/[又/×✕*÷=≤≥]/.test(value))return null;
 let position=0,operand=true,depth=0,atoms=0,result='';
 while(position<value.length){
  if(/\s/.test(value[position])){position++;continue;}
  const ch=value[position];
  if(operand){
   if(ch==='('){depth++;result+='\\left(';position++;continue;}
   if(ch==='-'||ch==='+'){result+=ch;position++;continue;}
   const match=/^(\d+(?:\.\d+)?)(?:\s*又\s*(\d+)\s*\/\s*(\d+)|\s*\/\s*(\d+))?/.exec(value.slice(position));
   if(!match)return null;
   result+=match[2]!==undefined?`${match[1]}\\frac{${match[2]}}{${match[3]}}`
    :match[4]!==undefined?`\\frac{${match[1]}}{${match[4]}}`:match[1];
   position+=match[0].length;operand=false;atoms++;continue;
  }
  if(ch===')'){if(!depth)return null;depth--;result+='\\right)';position++;continue;}
  const operator={'+':'+','-':'-','×':'\\times ','✕':'\\times ','*':'\\times ','÷':'\\div ','=':'=','<':'<','>':'>','≤':'\\le ','≥':'\\ge '}[ch];
  if(!operator)return null;result+=operator;position++;operand=true;
 }
 return operand||depth||!atoms?null:result;
}

export function formatExplanationMath(text){
 const protectedMath=/(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g;
 return String(text??'').split(protectedMath).map((part,index)=>{
  if(index%2){if(part.startsWith('\\('))return '$'+part.slice(2,-2)+'$';if(part.startsWith('\\['))return '$$'+part.slice(2,-2)+'$$';return part;}
  return part.replace(/[0-9０-９（(][0-9０-９.又/／＋+\-−－×✕*÷=＝<>＜＞≤≥()（） \t]*/g,(run,offset)=>{
   const source=run.trimEnd(),tail=run.slice(source.length);
   // Avoid slash-form dates and identifiers; do not turn a question/page label
   // into a fraction just because the prose contains a slash.
   if(/[A-Za-z0-9_./第]/.test(part[offset-1]||'')||/^[年月日題頁]/.test(part.slice(offset+source.length)))return run;
   const latex=numericMath(source);return latex?'$'+latex+'$'+tail:run;
  });
 }).join('');
}

export function renderExplanation(container,text){
 const box=renderContent(container,{text:formatExplanationMath(text),media:[]});
 for(const span of box.children)if(span.querySelector?.('.katex'))span.classList.add('quiz-explanation-formula');
 return box;
}
