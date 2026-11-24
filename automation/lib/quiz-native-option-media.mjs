import assert from 'node:assert/strict';
/** Existing media policy sees prompt/material arrays, not nested field options. */
export function includeNativeOptionMedia(block){
 const copy=structuredClone(block);
 for(const q of copy.questions){const images=q.fields.flatMap(f=>(f.options??[]).flatMap(o=>o.content.media));for(const m of images){if([copy.material,q.prompt].some(c=>c.media.some(a=>a.url===m.url)))continue;if(q.prompt.media.length<8){assert.ok(q.prompt.layout,'Hidden authorization references require an explicit visible prompt layout');q.prompt.media.push(structuredClone(m));}else{assert.ok(copy.material.layout,'Shared media references need explicit source layout');assert.ok(copy.material.media.length<8,'Source option media exceeds existing prompt/material capacity');copy.material.media.push(structuredClone(m));}}}
 return copy;
}
