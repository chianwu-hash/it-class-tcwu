import {readingSignature} from './quiz-reading-signature.mjs';
import {pastMatchingSources,partnerMatchingSources} from './quiz-matching-past-sources.mjs';
const plain=text=>({text:text||'',media:[]});
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,canonical(v)])):typeof value==='string'?value.replace(/^https:\/\/(?:quiz-media\.invalid\/[0-9a-f-]{36}|partner-media\.invalid)\/([0-9a-f]{64})$/u,'https://source-media.invalid/$1'):value;
export const matchingGroupSignature=g=>readingSignature(canonical({id:String(g.id),prompt:{kind:g.kind,title:g.title,material:g.materialContent??plain(g.material),prompt:g.promptContent,choices:g.choices,codes:g.codes,assets:g.assets},fields:g.fields?.map(f=>({id:f.id,text:f.text,label:f.label}))}));
export function matchingPartnerSignature(q){const m=q.past??q.past_meta??q.past_config;return readingSignature(canonical({id:String(q.id),prompt:{title:q.title,prompt:q.text??q.prompt,past:{kind:m?.kind,codes:m?.codes,choices:m?.choices?.map(c=>({id:c.id,text:c.text})),group:m?.group},rich:q.rich?{prompt:q.rich.prompt,material:q.rich.material,options:q.rich.options}:null}}));}
function boardFor(fields,choices,kind,assets=[]){
 const right=choices.map(c=>({id:c.id,content:c.content??plain(c.text)}));
 const images=[...assets.map(a=>({...a,kind:'image'})),...right.flatMap(r=>r.content.media??[])].filter(m=>m.kind==='image');return {unique:false,left:fields.map(f=>({id:f.id,content:plain(f.text||f.label),multiple:kind==='set',options:choices.map(c=>({id:c.id,value:c.id}))})),right,...(assets.length===1&&fields.length===1?{material:{text:'',media:[{...assets[0],kind:'image'}]}}:{}),...(images.length?{original:{text:'',media:images}}:{})};
}
export function pastMatchingPresentation(g){
 const plan=pastMatchingSources[matchingGroupSignature(g)];if(!plan)return null;
 const board=boardFor(g.fields,g.choices,g.kind,g.assets);if(plan.sourceImages){board.left=board.left.map((l,i)=>({...l,content:{...l.content,media:[plan.sourceImages[i]]}}));board.original={text:'',media:plan.sourceImages};}return {board,plan};
}
export function partnerMatchingPresentation(q){
 const plan=partnerMatchingSources[String(q.id)];if(!plan||!plan.signatures.includes(matchingPartnerSignature(q)))return null;
 const m=q.past??q.past_meta??q.past_config,choices=m.choices.map((c,i)=>({...c,content:q.rich?.options?.[i]??c.content}));
 const board=boardFor([{id:'answer',text:q.text??q.prompt}],choices,m.kind,q.rich?.material?.media?.filter(m=>m.kind==='image'&&m.alt?.includes('磁鐵'))??[]);if(q.rich?.prompt?.media?.length){board.left[0].content=q.rich.prompt;board.original={text:'',media:[...(board.original?.media??[]),...q.rich.prompt.media.filter(m=>m.kind==='image')]};}return {board,plan};
}
