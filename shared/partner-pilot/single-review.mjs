import {choiceReviewModel} from '../quiz-review-choices.mjs';
// Released shared snapshots only. Indices and backend correctness stay unchanged.
export function partnerSingleReview(q,{revealed=false}={}){
 if(!revealed||q?.normal||q?.past||!Array.isArray(q?.options)||q.options.length<2||q.options.length>8||!q.options.every(o=>typeof o==='string')||!Number.isInteger(q.correct)||q.correct<0||q.correct>=q.options.length)return null;
 if(q.attempts!==undefined&&!Array.isArray(q.attempts))return null;const latest=q.attempts?.at(-1);
 if(latest&&(!Number.isInteger(latest.choice)||latest.choice<0||latest.choice>=q.options.length||typeof latest.correct!=='boolean'))return null;
 const model=choiceReviewModel({kind:'single',choices:q.options.map((text,i)=>({id:String(i),text})),official:String(q.correct),...(latest?{value:String(latest.choice),correct:latest.correct}:{}),revealed:true});
 if(model&&latest?.correct===true&&model.state!=='correct')return {...model,state:'reference',options:model.options.map(o=>({...o,state:'neutral',text:o.selected?'你的選擇；原作答判定為答對':''}))};
 return model;
}
