// Lossless paragraph/run slices; preserve inline and unanchored media.
const plain=text=>({text,media:[]});
export function sourceStream(c){
 if(!c?.layout)return typeof c?.text==='string'&&!c.media?.length?c.text:null;
 if(c.layout.some(p=>p.type!=='paragraph'||!Array.isArray(p.runs)||p.runs.some(r=>!['text','image'].includes(r.type))))return null;
 // A placeholder gives each original image a stable source position.
 return c.layout.map(p=>p.runs.map(r=>r.type==='text'?r.text:'\ufffc').join('')).join('\n');
}
export function sliceContent(c,start,end){
 if(!c.layout)return plain(c.text.slice(start,end).trim());
 let cursor=0;const layout=[],media=[],indices=new Map();
 for(const p of c.layout){const runs=[];
  for(const r of p.runs){const length=r.type==='text'?r.text.length:1,a=Math.max(start,cursor),b=Math.min(end,cursor+length);
   if(a<b){if(r.type==='text')runs.push({...r,text:r.text.slice(a-cursor,b-cursor)});
    else{if(!indices.has(r.media_index)){indices.set(r.media_index,media.length);media.push(c.media[r.media_index]);}runs.push({...r,media_index:indices.get(r.media_index)});}}
   cursor+=length;
  }
  if(runs.length)layout.push({...p,runs});cursor++;
 }
 const text=layout.map(p=>p.runs.filter(r=>r.type==='text').map(r=>r.text).join('')).join('\n').trim();
 return {text,media,layout};
}
export function omitRanges(c,ranges){
 const text=sourceStream(c);if(text===null)return c;
 if(!c.layout){let result=text;for(const [a,b]of [...ranges].sort((a,b)=>b[0]-a[0]))result=result.slice(0,a)+result.slice(b);return plain(result.trim());}
 // Keep paragraph/run styles and source images. Adjacent retained slices are
 // complete paragraphs except at a choice boundary; empty pieces are harmless.
 const sorted=[...ranges].sort((a,b)=>a[0]-b[0]),parts=[];let pos=0;
 for(const [a,b]of sorted){if(a>pos)parts.push(sliceContent(c,pos,a));pos=Math.max(pos,b);}if(pos<text.length)parts.push(sliceContent(c,pos,text.length));
 const media=[],layout=[];for(const part of parts){const offset=media.length;media.push(...part.media);layout.push(...part.layout.map(p=>({...p,runs:p.runs.map(r=>r.type==='image'?{...r,media_index:r.media_index+offset}:r)})));}
 // Audio is attached to the content rather than an inline run. It stays with
 // the prompt, including when only an importer instruction is removed.
 const referenced=new Set(c.layout.flatMap(p=>p.runs.filter(r=>r.type==='image').map(r=>r.media_index)));
 media.push(...(c.media||[]).filter((_,i)=>!referenced.has(i)));
 return {text:layout.map(p=>p.runs.filter(r=>r.type==='text').map(r=>r.text).join('')).join('\n').trim(),media,layout};
}
