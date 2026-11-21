import {validateSketch} from './sketch/contract.mjs';
import {strokeColors} from './sketch/model.mjs';

// Separate views of one existing sketch-v1 sheet. No extra response keys.
export function splitWorkSketch(value,count){
 if(!Number.isInteger(count)||count<2||count>4)return null;
 const parts=Array.from({length:count},()=>({version:1,strokes:[],colors:[]}));
 if(value===undefined)return parts;
 if(value&&value.version===1&&Array.isArray(value.strokes)&&!value.strokes.length&&Object.keys(value).every(k=>['version','strokes','colors'].includes(k))&&(!Object.hasOwn(value,'colors')||Array.isArray(value.colors)&&!value.colors.length))return parts;
 try{validateSketch(value);}catch{return null;}
 const colors=strokeColors(value);
 for(const [i,stroke] of value.strokes.entries()){
  const bands=stroke.map(([,y])=>Math.floor(y*count));
  if(new Set(bands).size!==1||bands[0]>=count)return null;
  const band=bands[0],local=stroke.map(([x,y])=>[x,(y*count-band-.01)/.98]);
  if(local.some(([,y])=>y<-.0000001||y>1.0000001))return null;
  parts[band].strokes.push(local.map(([x,y])=>[x,Math.max(0,Math.min(1,y))]));parts[band].colors.push(colors[i]);
 }
 return parts;
}
export function mergeWorkSketch(parts){
 if(!Array.isArray(parts)||parts.length<2||parts.length>4)throw Error('invalid_work_sketch_groups');
 const value={version:1,strokes:[],colors:[]};
 for(const [i,part] of parts.entries()){
  if(part?.strokes?.length)validateSketch(part);
  else if(!part||part.version!==1||!Array.isArray(part.strokes)||part.strokes.length||Object.keys(part).some(k=>!['version','strokes','colors'].includes(k))||part.colors?.length)throw Error('invalid_empty_work_sketch');
  // Six decimals preserve the editor's 1e-4 input precision after scaling and
  // avoid floating-point tails overflowing the existing 256KiB envelope.
  for(const stroke of part.strokes)value.strokes.push(stroke.map(([x,y])=>[x,Math.round((i+.01+y*.98)/parts.length*1e6)/1e6]));
  value.colors.push(...strokeColors(part));
 }
 if(value.strokes.length)validateSketch(value);
 return value;
}
