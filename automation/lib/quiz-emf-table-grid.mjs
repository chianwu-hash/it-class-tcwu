import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {emfTextRuns} from './quiz-emf-text.mjs';
const normalized=s=>s.normalize('NFKC').replace(/\s/gu,'');

// Only fixed, visually checked source geometry. All nonblank original text must
// land in exactly one declared cell; blank cells stay blank, never teacher-filled.
export function emfTableGrid(bytes,observation){
 assert.equal(createHash('sha256').update(bytes).digest('hex'),observation.sourceSha256);assert.equal(observation.visuallyReviewed,true);
 const {xEdges,yEdges}=observation;for(const edges of [xEdges,yEdges])assert.ok(edges.length>=3&&edges.every((n,i)=>Number.isInteger(n)&&(!i||n>edges[i-1])));assert.ok(xEdges.length<=13&&yEdges.length<=31);
 const runs=emfTextRuns(bytes).filter(r=>r.text.trim()),cells=Array.from({length:yEdges.length-1},()=>Array.from({length:xEdges.length-1},()=>[]));
 for(const run of runs){const c=xEdges.findIndex((x,i)=>i<xEdges.length-1&&run.x>=x&&run.x<xEdges[i+1]),r=yEdges.findIndex((y,i)=>i<yEdges.length-1&&run.y>=y&&run.y<yEdges[i+1]);assert.ok(r>=0&&c>=0,'Original text outside reviewed cell grid');cells[r][c].push(run);}
 const values=cells.map(row=>row.map(rs=>rs.toSorted((a,b)=>a.y-b.y||a.x-b.x).map(r=>r.text).join('')));
 for(const override of observation.headingOverrides??[]){assert.equal(override.row,0);assert.equal(override.column,0);assert.equal(normalized(values[0][0]),normalized(override.original));const chars=s=>[...normalized(s).replace(/[／/、]/gu,'')].sort().join('');assert.equal(chars(override.original),chars(override.text));values[0][0]=override.text;}
 return {values,table:{type:'table',rows:values.map(row=>row.map(text=>text?[{type:'text',text}]:[]))},assignedOriginalRuns:runs.length,sourceSha256:observation.sourceSha256};
}
