export const DRAWING_COLORS=['#185e60','#2459b3','#b83246','#7643a8','#a94b0b','#263238','#e0b000'];
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const number=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max&&Number(v.toFixed(6))===v;
const point=p=>Array.isArray(p)&&p.length===2&&p.every(n=>number(n,0,1));
const color=c=>typeof c==='string'&&/^#[0-9a-f]{6}$/u.test(c);
export function validateDrawing(value){
 const fail=()=>{throw Error('請完成圖形，最多80筆或標記；文字每處最多40字。');};
 if(!object(value)||value.version!==2||Object.keys(value).some(k=>!['version','strokes','colors','marks'].includes(k))||!Array.isArray(value.strokes)||!Array.isArray(value.marks)||value.strokes.length+value.marks.length<1||value.strokes.length+value.marks.length>80)fail();
 if(value.strokes.some(s=>!Array.isArray(s)||s.length<1||s.length>128||!s.every(point)))fail();
 if(Object.hasOwn(value,'colors')&&(!Array.isArray(value.colors)||value.colors.length!==value.strokes.length||!value.colors.every(color)))fail();
 for(const m of value.marks){
  if(!object(m)||!color(m.color))fail();
  if(m.kind==='text'){
   if(!exact(m,['kind','at','text','color','size'])||!point(m.at)||typeof m.text!=='string'||![...m.text].length||[...m.text].length>40||/[\u0000-\u001f\u007f-\u009f]/u.test(m.text)||!number(m.size,.015,.12))fail();
  }else if(m.kind==='sector'){
   if(!exact(m,['kind','center','radius','angle','rotation','color','width','fill'])||!point(m.center)||!number(m.radius,.000001,1)||!number(m.angle,.001,360)||!number(m.rotation,0,360)||!number(m.width,.001,.04)||typeof m.fill!=='boolean')fail();
  }else{
   const closed=['polygon','ellipse'].includes(m.kind);if(!exact(m,closed?['kind','points','color','width','fill']:['kind','points','color','width'])||!['line','polygon','ellipse'].includes(m.kind)||!number(m.width,.001,.04)||!Array.isArray(m.points)||!m.points.every(point))fail();
   if(m.kind==='polygon'?(m.points.length<3||m.points.length>128):m.points.length!==2)fail();
   if(closed&&typeof m.fill!=='boolean')fail();
  }
 }
 if(new TextEncoder().encode(JSON.stringify(value)).length>262144)fail();return value;
}
