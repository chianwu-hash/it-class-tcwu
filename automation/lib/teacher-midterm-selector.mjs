import {createHash} from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex');
export const MIDTERM_UNITS={
 '115-1-hanlin-g3-english':[1,2],'115-1-hanlin-g3-math':[1,2,3,4],'115-1-hanlin-g3-science':[1,2],
 '115-1-kang-g3-ch':[1,2,3,4,5,6],'115-1-kang-g3-so':[1,2],
 '115-1-hanlin-g6-math':[1,2,3,4],'115-1-kang-g6-ch':[1,2,3,4,5,6],
 '115-1-kang-g6-en':[1,3],'115-1-nani-g6-science':[1,2],'115-1-nani-g6-social':[1,2]
};
const fingerprint=q=>JSON.stringify({prompt:q.prompt,options:q.options?.map(o=>o.content),answer:q.options?.find(o=>o.id===q.answer?.option_id)?.content});
// Maximum flow satisfies unit coverage and 4/12/4 difficulty together, rather than silently relabelling questions.
export function selectMidtermQuestions(course){
 const units=MIDTERM_UNITS[course.id];if(!units)throw Error('unknown_midterm_scope');
 const target=new Map(units.map((u,i)=>[u,Math.floor(20/units.length)+(i<20%units.length?1:0)]));
 const seen=new Set(),families=new Set(),buckets=new Map();
 const sorted=course.questions.slice().sort((a,b)=>Number(b.has_explanation)-Number(a.has_explanation)||hash(course.id+a.id).localeCompare(hash(course.id+b.id)));
 for(const q of sorted){
  if(!q.units?.length||q.units.some(u=>!units.includes(Number(u)))||q.question?.type!=='single'||![-3,0,3].includes(q.difficulty))continue;
  const fp=fingerprint(q.question);if(seen.has(fp)||(q.family&&families.has(q.family)))continue;seen.add(fp);if(q.family)families.add(q.family);
  const u=Number(q.units[0]),k=u+':'+q.difficulty;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push({...q,selectedUnit:u});
 }
 const source=0,sink=units.length+4,N=sink+1,edges=Array.from({length:N},()=>[]);
 function edge(a,b,capacity){const x={to:b,capacity,initial:capacity,reverse:edges[b].length},y={to:a,capacity:0,initial:0,reverse:edges[a].length};edges[a].push(x);edges[b].push(y);return x;}
 const slots=[];for(let i=0;i<units.length;i++){const u=units[i];edge(source,i+1,target.get(u));for(const [j,d]of[-3,0,3].entries())slots.push({u,d,edge:edge(i+1,units.length+1+j,buckets.get(u+':'+d)?.length||0)});}
 for(const [j,n]of[4,12,4].entries())edge(units.length+1+j,sink,n);
 let flow=0;for(;;){const path=Array(N).fill(null),queue=[source];path[source]=[-1,-1];for(let n=0;n<queue.length&&!path[sink];n++){const v=queue[n];for(const [i,e]of edges[v].entries())if(e.capacity>0&&!path[e.to]){path[e.to]=[v,i];queue.push(e.to);}}
  if(!path[sink])break;let amount=20;for(let v=sink;v!==source;){const[a,i]=path[v];amount=Math.min(amount,edges[a][i].capacity);v=a;}for(let v=sink;v!==source;){const[a,i]=path[v],e=edges[a][i];e.capacity-=amount;edges[v][e.reverse].capacity+=amount;v=a;}flow+=amount;
 }
 if(flow!==20)throw Error('midterm_distribution_unavailable:'+course.id+':'+flow);
 const selected=slots.flatMap(s=>(buckets.get(s.u+':'+s.d)||[]).slice(0,s.edge.initial-s.edge.capacity));
 selected.sort((a,b)=>a.selectedUnit-b.selectedUnit||a.difficulty-b.difficulty||a.id.localeCompare(b.id));
 return selected;
}
