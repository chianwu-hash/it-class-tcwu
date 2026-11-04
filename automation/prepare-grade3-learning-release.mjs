import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {validateLearningMap} from './lib/past-learning-map.mjs';import {validateDocument} from '../shared/quiz-document.mjs';
const source=path.resolve(process.env.PAST_SOURCE_ROOT||process.cwd()),input=path.join(source,'automation/output/past-grade3-learning-20261102'),out=path.join(source,'automation/output/past-grade3-release-20261102');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2));
const manifest=read(input+'/content-manifest.private.json'),live=read(out+'/papers-before.private.json').rows,rows=[];
// These two reviewed extraction catalogs are from the verified Kangxuan ISO;
// do not infer an unknown publisher solely from a filename prefix.
const kangSources=new Map([...read(input+'/native-candidates.private.json'),...read(path.join(source,'automation/output/past-full-learning-20261101/publisher-text.private.json'))].map(r=>[r.id,r]));
assert.equal(manifest.papers.length,10);assert.equal(live.length,10);fs.mkdirSync(out+'/papers',{recursive:true});
for(const r of manifest.papers){
 const dir=input+'/'+r.paper,bundle=read(dir+'/source-bundle.private.json'),map=read(dir+'/learning-map.private.json'),packet=read(dir+'/publisher-practice.private.json');
 assert.equal(sha(fs.readFileSync(dir+'/learning-map.private.json')),r.mapSha256);assert.equal(sha(fs.readFileSync(dir+'/publisher-practice.private.json')),r.practiceSha256);validateLearningMap({bundle,map});
 const cloud=live.find(p=>p.id===r.paper);assert(cloud.enabled&&cloud.grade===3);assert.equal(cloud.active_version,bundle.activeVersion);assert.equal(cloud.sha256,bundle.sha256);
 const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
 assert.equal(canonical(cloud.document),canonical(bundle.document));assert.equal(canonical(cloud.provenance),canonical(bundle.provenance));
 for(const [cid,rec] of Object.entries(packet.documents)){
  assert.equal(sha(JSON.stringify(rec.document)),rec.sha256);assert.equal(rec.sources.length,2);assert.equal(rec.document.blocks.flatMap(b=>b.questions).length,2);
  for(const s of rec.sources){assert.equal(sha(fs.readFileSync(s.sourceFile)),s.sha256);for(const f of s.sourceFiles||[])assert.equal(sha(fs.readFileSync(f.file)),f.sha256);}
  // Publisher is part of the shared effort fingerprint. Keep the real publisher
  // so an identical pool question is not credited again through a new wrapper.
  rec.document.catalog.publisher=[...new Set(rec.sources.map(s=>{if(s.publisher)return s.publisher;if(kangSources.get(s.id)?.sha256===s.sha256)return '康軒';return rec.document.catalog.publisher;}))].join('／');
  assert(!rec.document.catalog.publisher.includes('來源逐題'));assert(!rec.document.catalog.publisher.includes('／'),'A practice pair must use one verified publisher for shared credit identity');rec.sha256=sha(JSON.stringify(rec.document));validateDocument(rec.document);
  const concept=map.concepts.find(c=>c.id===cid);if(rec.coverage)concept.practiceCoverage=rec.coverage;
 }
 const dest=out+'/papers/'+r.paper;fs.mkdirSync(dest,{recursive:true});save(dest+'/source-bundle.private.json',bundle);save(dest+'/learning-map.private.json',map);save(dest+'/publisher-practice.private.json',packet);validateLearningMap({bundle,map});
 rows.push({paper:r.paper,sourceVersion:cloud.active_version,sourceSha256:cloud.sha256,ownerId:cloud.owner_id,fields:map.questions.length,concepts:map.concepts.length,pairedConcepts:Object.keys(packet.documents).length,mapSha256:sha(fs.readFileSync(dest+'/learning-map.private.json')),practiceSha256:sha(fs.readFileSync(dest+'/publisher-practice.private.json'))});
}
save(out+'/release-content.private.json',{at:new Date().toISOString(),inputManifestSha256:sha(fs.readFileSync(input+'/content-manifest.private.json')),papers:rows});console.log(JSON.stringify({papers:rows.length,fields:rows.reduce((n,r)=>n+r.fields,0),paired:rows.reduce((n,r)=>n+r.pairedConcepts,0),sourceVersionsUnchanged:true}));
