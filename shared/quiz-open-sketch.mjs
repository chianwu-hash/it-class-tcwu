import {validateSketch} from './sketch/contract.mjs';

export const OPEN_SKETCH_RESPONSE_BYTES=300000;
export const hasSketchFields=q=>q.type==='open'&&q.fields?.some(f=>f.input==='sketch');
export function openSketchResponseError(q,raw){
 if(!hasSketchFields(q))throw Error('handwriting_question_required');
 const fail='請完成每個答案欄與手寫內容；每張紙最多80筆。';
 if(typeof raw!=='string'||new TextEncoder().encode(raw).length>OPEN_SKETCH_RESPONSE_BYTES)return fail;
 let data;try{data=JSON.parse(raw);}catch{return fail;}
 if(!data||data.v!==1||!data.f||Array.isArray(data.f)||typeof data.f!=='object'||Object.keys(data).some(k=>!['v','f'].includes(k))||Object.keys(data.f).length!==q.fields.length)return fail;
 for(const field of q.fields){
  if(!Object.hasOwn(data.f,field.id))return fail;
  const value=data.f[field.id];
  if(field.input==='sketch'){try{validateSketch(value);}catch{return fail;}}
  else if(field.input!=='text'||typeof value!=='string'||!value.trim()||value.length>250)return fail;
 }
 return '';
}
