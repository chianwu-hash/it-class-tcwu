import assert from 'node:assert/strict';
import {documentHash} from './grade9-physics-enrichment.mjs';
const lit=s=>"'"+String(s).replaceAll("'","''")+"'";
const json=v=>lit(JSON.stringify(v))+'::jsonb';
const uuid=s=>assert(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s),'UUID required');
const row=(table,value)=>`insert into ${table} select * from jsonb_populate_record(null::${table},${json(value)});`;

// Data-only, exact immutable-version registration. Never installs functions,
// changes privileges, rewrites prior versions/answers, or uploads media.
export function physicsRegistrationSql(plan,phase){
 assert.equal(plan.schema,1);assert(['stage','activate','rollback'].includes(phase));
 assert.deepEqual(plan.papers.map(p=>p.paperId).sort(),['zhongzheng-113-1-g9-exam2-science','zhongzheng-114-1-g9-exam2-science']);
 assert.equal(plan.practices.length,14);
 assert(!/\$(?:guard|allocation|practice|ready|question|topics|topic|rollback|media)\$/.test(JSON.stringify(plan)),'reserved SQL delimiter');
 for(const p of plan.papers){
  for(const id of [p.version,p.owner,p.previousVersion])uuid(id);
  assert.equal(documentHash(p.bundle.document),p.bundle.sha256);
  assert.equal(p.map.documentSha256,p.bundle.sha256);assert.equal(p.partner.source_version,p.version);
  assert.equal(p.bundle.provenance.qc.status,'content-reviewed-awaiting-flow-verification');
  assert.deepEqual(p.bundle.provenance.qc.reviewedBy,['Codex','Claude']);
  assert.equal(p.questions.length,p.bundle.document.groups.length);
  assert.equal(p.allocation.version,p.version);assert.equal(p.allocation.document_sha,p.bundle.sha256);
  assert.equal(p.previousPartnerId,'past-'+p.previousVersion);assert(p.mediaMap?.length>0);
 }
 const guard=p=>`do $guard$begin if not exists(select 1 from public.quiz_past_papers p join public.quiz_past_versions v on v.id=p.active_version where p.id=${lit(p.paperId)} and p.enabled and p.grade=9 and p.owner_id=${lit(p.owner)}::uuid and p.active_version=${lit(p.previousVersion)}::uuid and v.sha256=${lit(p.previousSha)}) then raise exception 'PHYSICS_SOURCE_CHANGED';end if;end $guard$;`;
 let sql=`begin;set local lock_timeout='3s';set local statement_timeout='90s';set transaction isolation level repeatable read;select pg_advisory_xact_lock(hashtextextended('g9-physics-enrichment-20261119',0));\n`;
 if(phase==='stage'){
  for(const p of plan.papers)sql+=guard(p)+`select public.quiz_past_validate(${json(p.bundle.document)});insert into public.quiz_past_versions(id,paper_id,sha256,document,provenance) values(${lit(p.version)},${lit(p.paperId)},${lit(p.bundle.sha256)},${json(p.bundle.document)},${json(p.bundle.provenance)});\n`;
  for(const practice of plan.practices){uuid(practice.bank);uuid(practice.version);assert.equal(documentHash(practice.document),practice.sha256);assert.equal(practice.sources.length,2);assert(practice.sources.every(s=>s.sourceFile&&/^[a-f0-9]{64}$/.test(s.sha256)));sql+=`select public.quiz_validate(${json(practice.document)});insert into public.quiz_banks(id,owner_id,draft) values(${lit(practice.bank)},${lit(plan.papers[0].owner)},${json(practice.document)});insert into public.quiz_versions(id,bank_id,revision,document) values(${lit(practice.version)},${lit(practice.bank)},1,${json(practice.document)});\n`;}
  for(const p of plan.papers){
   sql+=`insert into public.quiz_learning_maps(source_version,paper_id,source_sha,content,enabled) values(${lit(p.version)},${lit(p.paperId)},${lit(p.bundle.sha256)},${json(p.map)},false);\n`;
   for(const c of p.map.concepts){const r=plan.practices.find(r=>r.concept===c.id);if(r)sql+=`insert into public.quiz_learning_topics values(${lit(p.version)},${lit(c.id)},${lit(r.version)});\n`;}
   sql+=row('partner_pilot.papers',{...p.partner,enabled:false})+'\n';
   for(const r of p.questions)sql+=row('partner_pilot.question_bank',r.question)+row('partner_pilot.paper_items',r.item)+'\n';
   sql+=row('partner_pilot.allocation_specs',p.allocation)+'\n';
   for(const m of p.mediaMap)sql+=row('partner_pilot.media_map',{...m,paper_id:p.partner.id})+'\n';
   sql+=`do $allocation$begin if (select count(*) from partner_pilot.allocation_items(${lit(p.partner.id)}))<>${p.questions.length} then raise exception 'PHYSICS_ALLOCATION_MISMATCH';end if;end $allocation$;\n`;
  }
 }else if(phase==='activate'){
  for(const r of plan.practices)sql+=`do $practice$begin if not exists(select 1 from public.quiz_versions where id=${lit(r.version)} and bank_id=${lit(r.bank)} and document=${json(r.document)}) then raise exception 'PHYSICS_PRACTICE_CHANGED';end if;end $practice$;\n`;
  for(const p of plan.papers){sql+=guard(p)+`do $ready$begin if not exists(select 1 from public.quiz_past_versions v join public.quiz_learning_maps m on m.source_version=v.id join partner_pilot.papers pp on pp.source_version=v.id where v.id=${lit(p.version)} and v.sha256=${lit(p.bundle.sha256)} and v.document=${json(p.bundle.document)} and m.content=${json(p.map)} and m.paper_id=${lit(p.paperId)} and m.source_sha=${lit(p.bundle.sha256)} and not m.enabled and pp.id=${lit(p.partner.id)} and to_jsonb(pp)=${json({...p.partner,enabled:false})}) then raise exception 'PHYSICS_STAGE_CHANGED';end if;end $ready$;\n`;
   for(const r of p.questions)sql+=`do $question$begin if not exists(select 1 from partner_pilot.question_bank q join partner_pilot.paper_items i on i.qid=q.id where q.id=${r.question.id} and to_jsonb(q)=${json(r.question)} and i.paper_id=${lit(p.partner.id)} and i.number=${r.item.number}) then raise exception 'PHYSICS_PARTNER_CHANGED';end if;end $question$;\n`;
   const expected=p.map.concepts.map(c=>plan.practices.find(r=>r.concept===c.id)).filter(Boolean);
   sql+=`do $topics$begin if (select count(*) from public.quiz_learning_topics where source_version=${lit(p.version)})<>${expected.length} then raise exception 'PHYSICS_TOPIC_COUNT';end if;end $topics$;\n`;
   for(const r of expected)sql+=`do $topic$begin if not exists(select 1 from public.quiz_learning_topics where source_version=${lit(p.version)} and concept_id=${lit(r.concept)} and version_id=${lit(r.version)}) then raise exception 'PHYSICS_TOPIC_CHANGED';end if;end $topic$;\n`;
   sql+=`do $allocation$begin if not exists(select 1 from partner_pilot.allocation_specs a where a.version=${lit(p.version)} and to_jsonb(a)=${json(p.allocation)}) or (select count(*) from partner_pilot.paper_items where paper_id=${lit(p.partner.id)})<>${p.questions.length} or (select count(*) from partner_pilot.allocation_items(${lit(p.partner.id)}))<>${p.questions.length} then raise exception 'PHYSICS_ALLOCATION_CHANGED';end if;end $allocation$;\n`;
   sql+=`do $media$begin if (select count(*) from partner_pilot.media_map where paper_id=${lit(p.partner.id)})<>${p.mediaMap.length} then raise exception 'PHYSICS_MEDIA_COUNT';end if;end $media$;\n`;
   for(const m of p.mediaMap)sql+=`do $media$begin if not exists(select 1 from partner_pilot.media_map where paper_id=${lit(p.partner.id)} and hash=${lit(m.hash)} and source_url=${lit(m.source_url)}) then raise exception 'PHYSICS_MEDIA_CHANGED';end if;end $media$;\n`;
   sql+=`update public.quiz_learning_maps set enabled=true where source_version=${lit(p.version)};update partner_pilot.papers set enabled=true where id=${lit(p.partner.id)};update public.quiz_past_papers set active_version=${lit(p.version)} where id=${lit(p.paperId)};\n`;
  }
 }else{
  for(const p of plan.papers)sql+=`do $rollback$begin if (select active_version from public.quiz_past_papers where id=${lit(p.paperId)}) is distinct from ${lit(p.version)}::uuid then raise exception 'PHYSICS_NEWER_RELEASE';end if;end $rollback$;update public.quiz_past_papers set active_version=${lit(p.previousVersion)} where id=${lit(p.paperId)};\n`;
  // Retain new immutable data and any attempts already created; continuing rooms stay usable.
 }
 return sql+'commit;\n';
}
