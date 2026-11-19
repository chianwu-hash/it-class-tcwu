import {matchingGroupSignature,matchingPartnerSignature} from './quiz-matching-past.mjs';
import {pastWritingSources,partnerWritingSources} from './quiz-writing-past-sources.mjs';
import {writingVocabulary} from './quiz-writing-example-guides.mjs';
import {compositionExampleGuides} from './quiz-composition-example-guides.mjs';
function guide(plan){
 if(!plan)return null;
 const source=plan.type==='writing'?writingVocabulary[plan.key]:compositionExampleGuides[plan.key];if(!source)return null;
 const examples=source.examples??source.variants?.map(row=>plan.frame?.replace(/\{(\d+)\}/gu,(_,i)=>row[Number(i)]));
 if(!examples||examples.length<3||examples.some(t=>!t||/undefined|\{\d+\}/u.test(t)))return null;
 return {...source,examples,sentences:source.sentences??[]};
}
// Call only in the existing saved-response review path, never while answering.
export const pastWritingGuide=g=>guide(pastWritingSources[matchingGroupSignature(g)]);
export function partnerWritingGuide(q){const plan=partnerWritingSources[String(q.id)];return plan?.signatures.includes(matchingPartnerSignature(q))?guide(plan):null;}
