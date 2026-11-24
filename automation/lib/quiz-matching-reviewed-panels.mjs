import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateDocument} from '../../shared/quiz-document.mjs';
import {presentationSignature} from '../../shared/quiz-presentation-signature.mjs';
import {weightInGrams} from './quiz-matching-table.mjs';

// Source-only adapter: existing fields-v1, rich image choices, matching boards
// and materialIndex are unchanged. Observations are independently SHA-bound.
export function reviewedWeightMatching(src,review,observation,{catalog,owner}){
 const {config:c,panels,original}=observation;
 assert.equal(observation.source,src.id);assert.equal(observation.visuallyReviewed,true);
 assert.equal(src.question.content.media.length,1);assert.equal(original.sourceUrl,src.question.content.media[0].url);
 assert.ok(panels.every(p=>p.source===src.id&&['right','left','material'].includes(p.kind)&&p.crop.sourcePngSha256===original.sha256));
 assert.equal(review.logical_targets.length,1);
 const positions=review.logical_targets[0].positions,n=c.labels.length;
 assert.equal(positions.length,n);assert.ok(n>=2&&n<=8);
 assert.equal(c.rightGrams.length,n);assert.ok(c.rightGrams.every(v=>Number.isSafeInteger(v)&&v>0));
 const raw=src.answer.content.text.normalize('NFKC').replace(/\s/gu,'').replace(/^答案[:：]/u,'');
 const parts=[...raw.matchAll(/(?:\((\d)\)|([1-8]))(?:→|->)?([ㄅㄆㄇㄈㄉㄊㄋㄌ])/gu)];
 assert.equal(parts.map(m=>m[0]).join(';'),raw);assert.equal(parts.length,n);
 const media=a=>{assert.match(a.sha256,/^[a-f0-9]{64}$/);return {kind:'image',url:`https://quiz-media.invalid/${owner}/${a.sha256}`,alt:a.alt};};
 const rightPanels=panels.filter(p=>p.kind==='right').sort((a,b)=>a.index-b.index);
 if(c.rightText){assert.equal(rightPanels.length,0);assert.equal(c.rightText.length,n);c.rightText.forEach((t,i)=>assert.equal(weightInGrams(t),c.rightGrams[i]));}
 else{assert.equal(rightPanels.length,n);rightPanels.forEach((p,i)=>assert.equal(p.index,i));}
 const options=c.rightText?c.rightText.map((text,i)=>({id:'r'+(i+1),content:{text,media:[]}})):rightPanels.map((p,i)=>({id:'r'+(i+1),content:{text:'',media:[media({...p.crop,alt:`原卷第${i+1}個秤面`})]}}));
 const accepted={},mapping=[];
 for(const [i,k] of parts.entries()){
  assert.equal(Number(k[1]??k[2]),i+1);const j='ㄅㄆㄇㄈㄉㄊㄋㄌ'.indexOf(k[3]);assert.ok(j<n);
  assert.equal(positions[i].kind,'single_choice');assert.equal(positions[i].reference_value,k[3]);
  if(c.leftGrams){assert.equal(c.leftGrams.length,n);assert.equal(weightInGrams(c.labels[i].split('：').at(-1)),c.leftGrams[i]);assert.equal(c.leftGrams[i],c.rightGrams[j]);}
  accepted['f'+(i+1)]=[options[j].id];mapping.push({position:positions[i].position_id,leftIndex:i,rightIndex:j,originalTeacherKey:k[3],check:c.leftGrams?'equal_grams':c.balance?'balance_order':'source_estimation_key'});
 }
 if(c.balance){assert.equal(n,2);assert.equal(panels.filter(p=>p.kind==='material').length,1);const first=c.rightGrams[mapping[0].rightIndex],second=c.rightGrams[mapping[1].rightIndex];assert.ok(c.balance==='left_lighter'?first<second:first>second);}
 else assert.ok(c.leftGrams||c.estimate===true);
 const promptMedia=[media({...original,alt:'原卷連線圖'})],board={indices:Array.from({length:n},(_,i)=>i),unique:false};
 for(const p of panels.filter(p=>p.kind==='material')){board.materialIndex=promptMedia.length;promptMedia.push(media({...p.crop,alt:'原卷完整天平比較圖'}));}
 if(c.leftPictures){const left=panels.filter(p=>p.kind==='left').sort((a,b)=>a.index-b.index);assert.equal(left.length,n);board.leftCrops=left.map((p,i)=>{assert.equal(p.index,i);const index=promptMedia.length;promptMedia.push(media({...p.crop,alt:c.labels[i]}));const [width,height]=p.crop.size;return {index,viewBox:{x:0,y:0,width,height,sourceWidth:width,sourceHeight:height}};});}
 // quiz_media_visible authorizes prompt/material and top-level options. Keep
 // these visible field-choice images in this question's prompt references too.
 // The source plan omits reference images from the visible introductory passage.
 for(const option of options)for(const image of option.content.media)if(!promptMedia.some(m=>m.url===image.url))promptMedia.push(structuredClone(image));
 const text=src.question.content.text||'把相同重量的連起來。';
 const explanation=c.balance?`${c.balance==='left_lighter'?'天平左盤較高，表示左盤較輕；右盤較低，表示右盤較重。':'天平左盤較低，表示左盤較重；右盤較高，表示右盤較輕。'}比較兩個秤面的指針刻度，較重物品配較大的重量，較輕物品配較小的重量。`:mapping.map((m,i)=>`${c.labels[i]}${c.estimate?'，可能的重量是':'，重量是'}${c.rightGrams[m.rightIndex]}公克。`).join('\n');
 const version=createHash('sha256').update(JSON.stringify({contract:'prompt-media-references-v1',source:original.sha256,config:c,panels:panels.map(p=>[p.kind,p.index,p.crop.sha256])})).digest('hex').slice(0,12);
 const q={id:`hlg3m_${src.id.slice(-8)}_wm${version}`,type:'fields',prompt:{text,media:promptMedia,layout:[{type:'paragraph',runs:[{type:'text',text}]},...promptMedia.map((_,i)=>({type:'paragraph',runs:[{type:'image',media_index:i,width:640}]}))]},fields:c.labels.map((label,i)=>({id:'f'+(i+1),label,input:'single',options:structuredClone(options)})),answer:{format:'fields-v1',fields:accepted},explanation:{text:explanation,media:[]}};
 const doc=validateDocument({schema:1,title:'重量與秤面連線',catalog,blocks:[{id:'source_'+src.id.slice(-8),material:{text:'',media:[]},questions:[q]}]});
 const partner=structuredClone(q);
 const project=value=>{if(!value||typeof value!=='object')return;if(typeof value.url==='string'&&value.url.startsWith(`https://quiz-media.invalid/${owner}/`))value.url='https://partner-media.invalid/'+value.url.split('/').at(-1);for(const child of Object.values(value))if(typeof child==='object')project(child);};project(partner);
 return {candidate:{source:src.id,doc},mapping,partnerSignature:presentationSignature(partner),plan:{signature:presentationSignature(q),boards:[board],omit:[[text.length,text.length+2*promptMedia.length+1]],sourceSha256:src.source_files.find(f=>f.name==='preamble-question.docx.gz').sha256}};
}
