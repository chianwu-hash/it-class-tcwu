import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {loadBatch,readJson,digest,expectedResponse,practiceWriteIntent,freezeJson,recordBatchTime,practiceGrade} from './lib/quiz-batch-plan.mjs';
import {arrangementPlan} from '../shared/quiz-pattern-arrangement.mjs';
import {gridDrawingPlan} from '../shared/quiz-grid-drawing.mjs';
import {groupingDrawingPlan} from '../shared/quiz-grouping-drawing.mjs';
import {fractionPartitionPlan,fractionPartitionVariants} from '../shared/quiz-fraction-partition.mjs';
import {sourceRoutePlan,readSourceRoute} from '../shared/quiz-source-route.mjs';
import {fractionColorsPlan,fractionColorsResponse,readFractionColors} from '../shared/quiz-fraction-colors.mjs';
import {fractionComparisonPlan,fractionComparisonResponse} from '../shared/quiz-fraction-comparison.mjs';
import {fractionShadingPlan,fractionBarPlan,fractionRectPlan,fractionShadingMatchPlan,fractionShadingResponse} from '../shared/quiz-fraction-shading.mjs';
import {validateDocument} from '../shared/quiz-document.mjs';
import {setupProductionQuizDB} from './fixtures/production-quiz-db.mjs';
import {batchMediaAssets} from './lib/quiz-batch-media.mjs';
import {atomicPairCases} from './lib/quiz-batch-atomic-pairs.mjs';

const reviewedSketch = q => gridDrawingPlan(q) || arrangementPlan(q);
const shadingPlan = q => fractionShadingPlan(q) || fractionBarPlan(q) || fractionRectPlan(q) || fractionShadingMatchPlan(q);
const hasDrawingReference = q => reviewedSketch(q) || groupingDrawingPlan(q) || fractionComparisonPlan(q) || shadingPlan(q) || fractionPartitionPlan(q);
function responseWithShading(response,plan,ids){
 const shaded=fractionShadingResponse(plan,new Set(ids));
 return {...response,f:{...response.f,...shaded.f},w:shaded.w};
}
function alternateShading(plan, left, right, comparison, offset=0){
 const counts=[Number(left),Number(right)];
 const ids=new Set(plan.regions.filter((r,i)=>((i%plan.parts)-offset+plan.parts)%plan.parts<counts[r.side]).map(r=>r.id));
 return fractionComparisonResponse(plan,ids,comparison);
}
const {packet:p,counts:n,sha256:packetSha}=await loadBatch(process.argv[2]);
const {grade,qaClass}=practiceGrade(p);
for(const c of p.candidates){assert.equal(c.doc.blocks.length,1);for(const q of c.doc.blocks[0].questions){assert.ok(['fields','single','open'].includes(q.type));if(q.type==='single'){assert.ok(!q.work);continue;}if(q.type==='open'){assert.ok(!q.work && (reviewedSketch(q) ? q.explanation.media.length===1 && q.explanation.media[0].kind==='image' : q.fields.every(f=>f.input==='text') && !q.explanation.media.length), 'Open media requires an independently reviewed grid answer');expectedResponse(q,undefined,p.openResponses?.[q.id]);continue;}if(q.work){assert.ok(['expression','sketch'].includes(q.work.input));assert.ok(fractionComparisonPlan(q)||fractionShadingMatchPlan(q)||q.fields.every(f=>f.input==='math'));}else assert.ok(q.fields.every(f=>['single','math','text','set','sequence'].includes(f.input)));}}
for(const c of p.candidates)for(const block of c.doc.blocks){
 const firstArrangement=block.questions.findIndex(arrangementPlan);
 if(firstArrangement>=0)assert.ok(block.questions.slice(firstArrangement+1).every(q=>q.type==='open' || !q.fields?.some(f=>f.input==='math')),
   'Complete the numeric fields before revealing drawing references');
}
await recordBatchTime(p,packetSha,'packet-validated');
const file=s=>path.join(p.outputDir,p.prefix+'-'+s+'.private');
const save=(s,v)=>fs.writeFile(file(s)+'.json',JSON.stringify(v,null,2)+'\n');
if(p.catalogUnit!==undefined)assert.ok(typeof p.catalogUnit==='string'&&p.catalogUnit.trim()&&p.catalogUnit.length<=100);
const doc=validateDocument({...p.candidates[0].doc,title:p.title,catalog:{...p.candidates[0].doc.catalog,...(p.catalogUnit?{unit:p.catalogUnit}:{})},blocks:p.candidates.flatMap(c=>c.doc.blocks)});
const {owner,student,ownerEmail,studentEmail}=p.identities;
let ids;try{ids=await readJson(file('ids')+'.json');}catch(e){if(e.code!=='ENOENT')throw e;ids={owner,student,packetSha,...Object.fromEntries(['bank','version','session','pkg'].map(k=>[k,randomUUID()])),samples:p.samples.map(s=>({...s,...Object.fromEntries(['bank','version','session','pkg','request'].map(k=>[k,randomUUID()]))}))};await fs.writeFile(file('ids')+'.json',JSON.stringify(ids,null,2),{flag:'wx'});}
assert.equal(ids.packetSha,packetSha);
const q=s=>"'"+String(s).replaceAll("'","''")+"'",j=x=>q(JSON.stringify(x))+'::jsonb';
const book=p.book,rows=p.studyRows,assets=p.pages.map(a=>({...a,sha:a.sha??a.sha256}));
const mediaAssets=batchMediaAssets(p);
const publications=[{...ids,doc,rows,access:'practice',user:owner},...ids.samples.map(s=>{
 const c=p.candidates.find(c=>c.source===s.source),b=c.doc.blocks.find(b=>b.questions.some(q=>q.id===s.question_id));
 return {...s,doc:validateDocument({...c.doc,title:p.title,blocks:[{...b,questions:b.questions.filter(q=>q.id===s.question_id)}]}),rows:rows.filter(r=>r.question_id===s.question_id),access:'self',user:student};})];
// A reference may reveal only its own saved drawing, even when other items share a grid image.
const drawingReferences = publications[0].doc.blocks.flatMap(block => block.questions
 .filter(q => hasDrawingReference(q)).flatMap(q => {
   // A comparison may have one original teacher image containing both figures.
   const count = q.explanation.media.length;
   assert.ok(count === 1 || (count === 2 && fractionComparisonPlan(q)), 'Unexpected number of drawing references');
   return q.explanation.media.map(asset=>{
     assert.equal(asset.kind,'image');
     return [q.id,asset.url];
   });
 }));
const drawingOwners = new Map(drawingReferences.map(([id,url]) => [url,id]));
assert.equal(drawingOwners.size,drawingReferences.length,'Drawing references must be unique to a question');
for(const [url,id] of drawingOwners){
 for(const block of publications[0].doc.blocks){
  assert.ok(!JSON.stringify(block.material).includes(url),'Drawing reference overlaps common material');
  for(const question of block.questions){
   assert.ok(!JSON.stringify([question.prompt,question.options,question.fields]).includes(url),'Drawing reference appears in student content');
   if(question.id!==id)assert.ok(!JSON.stringify(question.explanation).includes(url),'Drawing reference overlaps the explanation of another question');
  }
 }
}
const guards=`if exists(select 1 from jsonb_array_elements(${j(mediaAssets)}) r where not exists(select 1 from public.quiz_media_assets m where m.url=r->>'url' and m.owner_id=${q(owner)} and m.object_path=r->>'object_path' and m.mime=r->>'mime' and m.bytes=(r->>'bytes')::integer)) then raise exception 'private_media_descriptor_mismatch';end if;
if not exists(select 1 from auth.users where id=${q(owner)} and lower(email)=${q(ownerEmail)} and email_confirmed_at is not null) then raise exception 'owner_mismatch';end if;
if not exists(select 1 from auth.users u join public.student_enrollments e on e.email=lower(u.email) and e.school_year=115 and e.class_code=${q(qaClass)} where u.id=${q(student)} and lower(u.email)=${q(studentEmail)} and u.email_confirmed_at is not null and u.raw_app_meta_data->'providers'?'google') then raise exception 'qa_identity_mismatch';end if;
if not exists(select 1 from public.quiz_textbooks where id=${q(book.id)} and grade=${grade} and school_year=115 and semester=1 and source_sha256=${q(book.sourceSha256)} and title=${q(book.title)} and enabled) then raise exception 'textbook_version_mismatch';end if;
if exists(select 1 from jsonb_array_elements(${j(assets)}) r where not exists(select 1 from public.quiz_textbook_pages a where a.book_id=${q(book.id)} and a.id=r->>'id' and to_jsonb(a.printed_pages)=r->'printedPages' and a.sha256=r->>'sha' and a.bytes=(r->>'bytes')::integer and a.sequence=r->>'sequence' and a.provenance=r->'provenance')) then raise exception 'textbook_page_mismatch';end if;`;
assert.equal(n.images,mediaAssets.length);
const exact=t=>`if not exists(select 1 from public.quiz_sessions s join public.quiz_versions v on v.id=s.version_id join public.quiz_banks b on b.id=v.bank_id join public.quiz_version_meta m on m.version_id=v.id where s.id=${q(t.session)} and s.owner_id=${q(t.user)} and s.access_mode=${q(t.access)} and s.status='open' and s.version_id=${q(t.version)} and v.bank_id=${q(t.bank)} and v.document=${j(t.doc)} and b.draft=v.document and m.total=${t.rows.length} and not s.shuffle_questions and not s.shuffle_options) then raise exception 'document_changed';end if;
if not exists(select 1 from public.quiz_study_packages where id=${q(t.pkg)} and version_id=${q(t.version)} and kind='normal' and enabled and approved) then raise exception 'package_unavailable';end if;
if (select count(*) from public.quiz_study_packages where version_id=${q(t.version)} and kind='normal')<>1 then raise exception 'unexpected_study_package';end if;
if (select count(*) from public.quiz_study_items where package_id=${q(t.pkg)})<>${t.rows.length} or exists(select 1 from jsonb_array_elements(${j(t.rows)}) r where not exists(select 1 from public.quiz_study_items i where i.package_id=${q(t.pkg)} and i.group_id='' and i.question_id=r->>'question_id' and i.book_id=${q(book.id)} and i.primary_page=(r->>'primary')::integer and to_jsonb(i.reference_pages)=r->'reference' and i.student_explanation=r->>'student_explanation' and i.teacher_notes=r->'teacher_notes')) then raise exception 'study_links_mismatch';end if;`;
const fixed=publications.map(exact).join('\n');
const select=`select encode(convert_to(jsonb_build_object('visible',s.library_visible,'classes',s.class_codes,'status',s.status,'version',s.version_id,'document_exact',v.document=${j(doc)},'groups',jsonb_array_length(v.document->'blocks'),'questions',m.total,'references',(select count(*) from public.quiz_study_items where package_id=${q(ids.pkg)}),'samples_private',(select count(*) from public.quiz_generated_papers g join public.quiz_sessions qs on qs.id=g.session_id where g.user_id=${q(student)} and qs.id in (${ids.samples.map(s=>q(s.session)).join(',')}) and qs.access_mode='self' and not qs.library_visible))::text,'utf8'),'base64') payload from public.quiz_sessions s join public.quiz_versions v on v.id=s.version_id join public.quiz_version_meta m on m.version_id=v.id where s.id=${q(ids.session)};`;
// Pin the reviewed study package before the generated-paper trigger can copy one from the pool.
const insertion=publications.map(t=>`select public.quiz_validate(${j(t.doc)});
insert into public.quiz_banks(id,owner_id,draft) values(${q(t.bank)},${q(t.user)},${j(t.doc)});
insert into public.quiz_versions(id,bank_id,revision,document) values(${q(t.version)},${q(t.bank)},1,${j(t.doc)});
insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode,status,library_visible) values(${q(t.session)},${q(t.user)},${q(t.version)},115,${j(t.access==='self'?[qaClass]:[])},'immediate',false,false,${q(t.access)},'open',false);
insert into public.quiz_study_packages(id,kind,version_id,approved,enabled,provenance) values(${q(t.pkg)},'normal',${q(t.version)},true,false,${j({method:'parameterized_verified_practice_batch',packetSha,source_records:t.doc.blocks.length,verified_references:t.rows.length})});
${t.rows.map(r=>`insert into public.quiz_study_items(package_id,question_id,book_id,primary_page,reference_pages,student_explanation,origin,teacher_notes) values(${q(t.pkg)},${q(r.question_id)},${q(book.id)},${r.primary},array[${r.reference.join(',')}]::integer[],${q(r.student_explanation)},'ai',${j(r.teacher_notes)});`).join('\n')}
update public.quiz_study_packages set enabled=true where id=${q(t.pkg)};
${t.access==='self'?`insert into public.quiz_generated_papers(session_id,user_id,request_id,config,actual_distribution,display_name) values(${q(t.session)},${q(student)},${q(t.request)},${j({kind:'self',count:t.rows.length,course_id:doc.catalog.course_id})},${j({sample_count:t.rows.length})},${q(p.title)});`:''}`).join('\n');
const classes=`coalesce((select jsonb_agg(distinct class_code order by class_code) from public.student_enrollments where school_year=115 and class_code ~ '^${grade}[0-9]{2}$'),'[]'::jsonb)`;
const sqls={
 stage:`begin;do $$begin ${guards} end$$;${insertion} do $$begin ${fixed} end$$;${select} commit;`,
 activate:`begin;select id from public.quiz_sessions where id=${q(ids.session)} for update;do $$begin ${guards} ${fixed} if jsonb_array_length(${classes})=0 then raise exception 'no_grade${grade}_classes';end if;end$$;update public.quiz_sessions set library_visible=true,class_codes=${classes} where id=${q(ids.session)};${select} commit;`,
 rollback:`begin;update public.quiz_sessions set library_visible=false,class_codes='[]',status='closed' where id=${q(ids.session)} and owner_id=${q(owner)} and version_id=${q(ids.version)} and access_mode='practice';${select} commit;`,
 readback:`begin read only;do $$begin ${guards} ${fixed} end$$;${select} commit;`,
 presence:`select encode(convert_to(jsonb_build_object('sessions',(select count(*) from public.quiz_sessions where id in (${publications.map(t=>q(t.session)).join(',')})))::text,'utf8'),'base64') payload;`,
 answers:`select encode(convert_to(jsonb_build_object('rows',coalesce(jsonb_agg(r),'[]'))::text,'utf8'),'base64') payload from (select t.session_id session,a.question_id question,a.response,a.correct,null::text assessment_status,null::text self_rating from public.quiz_answers a join public.quiz_attempts t on t.id=a.attempt_id where t.session_id in (${ids.samples.map(s=>q(s.session)).join(',')}) and t.user_id=${q(student)} union all select t.session_id,a.question_id,a.response,null::boolean,a.status,a.self_rating from public.quiz_open_responses a join public.quiz_attempts t on t.id=a.attempt_id where t.session_id in (${ids.samples.map(s=>q(s.session)).join(',')}) and t.user_id=${q(student)}) r;`,
};
for(const [k,s] of Object.entries(sqls))await fs.writeFile(file(k)+'.sql',s);
await save('document',doc);await save('plan',{packetSha,counts:n,ids,book:book.id,rows,assets,publications,sampleExpected:Object.fromEntries(ids.samples.map(s=>{const question=doc.blocks.flatMap(b=>b.questions).find(q=>q.id===s.question_id);return [s.question_id,expectedResponse(question,s.work,p.openResponses?.[question.id])];}))});
const {db,uid}=await setupProductionQuizDB({snapshot:true});
let mediaVisibilityChecks=0,foreignMediaDenialChecks=0,drawingReferenceChecks=0;
const actor=async(id,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role);};
const action=async(name,p={})=>(await db.query('select public.quiz_action($1,$2) data',[name,p])).rows[0].data;
try{
 const schema=await readJson(new URL('../supabase/production-snapshot/schema.json',import.meta.url));
 const tables=new Set(['quiz_versions','quiz_study_packages','quiz_study_items','quiz_textbooks','quiz_textbook_pages']);
 for(const t of schema.triggers.filter(t=>t.schema==='public'&&tables.has(t.table)))await db.exec(t.def);
 await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now()),($3,$4,now()),($5,'same-grade@example.invalid',now()),($6,'other-grade@example.invalid',now())",[owner,ownerEmail,student,studentEmail,uid(2),uid(3)]);
 await db.query("insert into public.student_enrollments values(115,$1,$2,30,'QA'),(115,'same-grade@example.invalid',$3,31,'QA same grade'),(115,'other-grade@example.invalid',$4,31,'QA other grade')",[studentEmail,qaClass,`${grade}01`,grade===3?'401':'301']);
 for(const a of mediaAssets)await db.query('insert into public.quiz_media_assets(url,owner_id,object_path,mime,bytes) values($1,$2,$3,$4,$5)',[a.url,owner,a.object_path,a.mime,a.bytes]);
 await db.query('insert into public.quiz_textbooks values($1,$2,$3,$4,$5,$6,false)',[book.id,book.grade,book.schoolYear,book.semester,book.title,book.sourceSha256]);
 for(const b of book.pages)await db.query('insert into public.quiz_textbook_pages(book_id,id,printed_pages,sequence,sha256,bytes,provenance) values($1,$2,$3,$4,$5,$6,$7)',[book.id,b.id,'{'+b.printedPages.join(',')+'}',b.sequence,b.sha256,b.bytes,b.provenance]);
 await db.query('update public.quiz_textbooks set enabled=true where id=$1',[book.id]);
 if(mediaAssets.length){
  const a=mediaAssets[0];
  for(const [column,value] of [['bytes',a.bytes+1],['mime',a.mime==='image/png'?'image/jpeg':'image/png'],['object_path',a.object_path+'-wrong'],['owner_id',student]]){
   await db.query(`update public.quiz_media_assets set ${column}=$2 where url=$1`,[a.url,value]);
   await assert.rejects(db.exec(sqls.stage),/private_media_descriptor_mismatch/);await db.exec('rollback');
   await db.query('update public.quiz_media_assets set owner_id=$2,object_path=$3,mime=$4,bytes=$5 where url=$1',[a.url,owner,a.object_path,a.mime,a.bytes]);
  }
 }
 await db.exec(sqls.stage);await db.exec(sqls.readback);
 await actor(uid(2));await assert.rejects(action('join',{session_id:ids.session}));for(const s of ids.samples)await assert.rejects(action('join',{session_id:s.session}));
 await actor('', 'anon');await assert.rejects(action('join',{session_id:ids.session}));
 await db.exec('reset role');await db.exec(sqls.activate);await db.exec(sqls.readback);
 await actor(uid(2));const listed=await action('library_sessions');assert.ok(listed.sessions.some(s=>s.id===ids.session&&s.total===n.questions));
 const joined=await action('join',{session_id:ids.session});
 const expected=doc.blocks.flatMap(b=>b.questions.map(q=>({q,material:b.material})));
 assert.equal(joined.document.questions.length,n.questions);
 // Exercise the actual snapshot media gate; descriptor rows alone do not prove
 // that a student can load images nested in structured answer fields.
 if(mediaAssets.length){
  const urls=value=>{const found=new Set();const visit=v=>{if(!v||typeof v!=='object')return;if(typeof v.url==='string')found.add(v.url);for(const child of Object.values(v))if(typeof child==='object')visit(child);};visit(value);return found;};
  const publicUrls=urls(doc.blocks.map(b=>({material:b.material,questions:b.questions.map(q=>({prompt:q.prompt,options:q.options,fields:q.fields}))})));
  await db.exec('reset role');
  for(const a of mediaAssets){assert.equal((await db.query('select public.quiz_media_visible($1,$2) visible',[a.url,joined.attempt_id])).rows[0].visible,publicUrls.has(a.url),'Student media visibility differs from public question content');mediaVisibilityChecks++;}
  await actor(uid(2));
 }
 for(const [i,got] of joined.document.questions.entries()){const {q,material}=expected[i];assert.equal(got.id,q.id);assert.deepEqual(got.prompt,q.prompt);assert.equal(got.type,q.type);if(q.type==='single'){assert.deepEqual(got.options,q.options);assert.ok(!got.fields?.length);}else{assert.deepEqual(got.fields,q.fields);assert.ok(!got.options?.length);}assert.deepEqual(got.work,q.work);assert.deepEqual(got.material,material);assert.ok(!('answer' in got));assert.deepEqual(joined.study.references[q.id],{bookId:book.id,primary:rows[i].primary,references:rows[i].reference,fields:[]});}
 // All fields exercise the production grading contract; work is saved, not automatically graded.
 for(const a of p.responseAliases??[])assert.ok(doc.blocks.flatMap(b=>b.questions).some(q=>q.id===a.question_id&&q.fields.some(f=>f.id===a.field_id&&f.input==='math')));
 let cases=0;const results=[];
 for(const c of p.candidates)for(const qn of c.doc.blocks[0].questions){const workFor=q=>p.works[q.id]??p.works[c.source],responseFor=q=>expectedResponse(q,workFor(q),p.openResponses?.[q.id]),response=responseFor(qn);
  const aliases=(p.responseAliases??[]).filter(a=>a.question_id===qn.id).map(a=>{assert.ok(qn.fields.some(f=>f.id===a.field_id&&f.input==='math'));assert.ok(typeof a.value==='string'&&a.value.length>0&&a.value.length<=250);assert.notEqual(a.value,response.f[a.field_id]);const value=structuredClone(response);value.f[a.field_id]=a.value;return value;});
  const tupleFieldIds=new Set((qn.answer.tuples??[]).flatMap(t=>t.fields));
  const fields=qn.fields??[],single=qn.type==='single',open=qn.type==='open';
  const acceptedAlternatives=open?[]:fields.filter(f=>['single','text'].includes(f.input)&&!tupleFieldIds.has(f.id)).flatMap(f=>qn.answer.fields[f.id].slice(1).map(value=>{const alternative=structuredClone(response);alternative.f[f.id]=value;return alternative;}));
  const tupleCases=single||open?{correct:[],incorrect:[]}:atomicPairCases(qn,response);
  const fraction=fractionComparisonPlan(qn);
  const shading=shadingPlan(qn);
  const colors=fractionColorsPlan(qn);
  const route=sourceRoutePlan(qn);
  const colorMarks=colors&&readFractionColors(colors,response);
  const wrongRoute=route&&p.routeWrong?.[qn.id];
  if(route){
   assert.equal(readSourceRoute(route,wrongRoute)?.at(-1),route.end);
   assert.ok(!qn.answer.fields.route.includes(wrongRoute));
  }
  const partition=fractionPartitionPlan(qn);
  const wrong=partition?fractionPartitionVariants().filter(({value})=>!qn.answer.fields.partition.includes(value))
   .map(({value})=>({v:1,f:{partition:value}})):route?[{v:1,f:{route:wrongRoute}}]:colors?colors.palette.map((color,index)=>{
   const changed=new Map(colorMarks);
   const id=colors.regions.find(region=>changed.get(region.id)===color.id)?.id;
   assert.ok(id,'Each required color needs an independently testable sector');
   changed.set(id,colors.palette[(index+1)%colors.palette.length].id);
   return fractionColorsResponse(colors,changed);
  }):shading?[
   responseWithShading(response,shading,shading.regions.slice(0,response.f.colored==='1'?2:1).map(r=>r.id)),
   ...fields.filter(f=>f.id!=='colored').map(f=>({...response,f:{...response.f,[f.id]:f.input==='single'?f.options.find(o=>!qn.answer.fields[f.id].includes(o.id)).id:'999999'}})),
  ]:fraction?[
    alternateShading(fraction,response.f.left==='1'?2:1,response.f.right,response.f.comparison),
    alternateShading(fraction,response.f.left,response.f.right==='1'?2:1,response.f.comparison),
    {...response,f:{...response.f,comparison:response.f.comparison==='less'?'greater':'less'}},
  ]:reviewedSketch(qn)?[]:single?qn.options.filter(o=>o.id!==response).map(o=>o.id):fields.flatMap(field=>{
   const bad=structuredClone(response);
   if(field.input==='single'){
    const wrong=field.options.find(o=>!qn.answer.fields[field.id].includes(o.id));
    if(!wrong&&tupleFieldIds.has(field.id)){
     assert.ok(tupleCases.incorrect.some(value=>value.f[field.id]!==response.f[field.id]),
      'Need a rejected cross-pair when every option is accepted in isolation');
     return [];
    }
    assert.ok(wrong,'Need an independently incorrect option');
    bad.f[field.id]=wrong.id;
   }else if(field.input==='set'){
    const ids=new Set(response.f[field.id]),toggle=field.options[0].id;
    ids.has(toggle)?ids.delete(toggle):ids.add(toggle);
    bad.f[field.id]=[...ids];
   }else if(field.input==='sequence'){
    const [first,second,...remaining]=response.f[field.id];
    const swapped=[second,first,...remaining];
    assert.ok(!qn.answer.fields[field.id].some(value=>JSON.stringify(value)===JSON.stringify(swapped)));
    bad.f[field.id]=swapped;
   }else bad.f[field.id]='999999';
   return [bad];
  });
  const variants=[response,...wrong,...aliases,...acceptedAlternatives,...tupleCases.correct];
  if(groupingDrawingPlan(qn))variants.push({...response,w:{version:1,strokes:[[[.1,.1],[.2,.1],[.2,.2],[.1,.2],[.1,.1]]]}});
  if(shading){
   const count=Number(response.f.colored);
   assert.ok(count>0&&count<=shading.regions.length);
   if(count<shading.regions.length){
    const alternate=[shading.regions.slice(0,count),shading.regions.slice(-count)]
      .map(regions=>responseWithShading(response,shading,regions.map(region=>region.id)))
      .find(value=>JSON.stringify(value.w)!==JSON.stringify(response.w));
    assert.ok(alternate,'A partial board must allow a different correct selection');
    variants.push(alternate);
   }
  }
  if(fraction){
   const {left,right,comparison}=response.f;
   const alternatives=Array.from({length:fraction.parts},(_,i)=>alternateShading(fraction,left,right,comparison,i));
   assert.equal(new Set(alternatives.map(value=>JSON.stringify(value.w))).size,fraction.parts);
   variants.push(...alternatives.filter(value=>JSON.stringify(value.w)!==JSON.stringify(response.w)));
  }
  if(colors){
   const identical=new Set([JSON.stringify(response.w)]);
   for(let offset=1;offset<colors.regions.length;offset++){
    const marks=new Map(colors.regions.map(({id},i)=>[id,colorMarks.get(colors.regions[(i+offset)%colors.regions.length].id)]));
    const rotated=fractionColorsResponse(colors,marks);
    assert.deepEqual(rotated.f,response.f);
    const key=JSON.stringify(rotated.w);
    if(!identical.has(key)){identical.add(key);variants.push(rotated);}
   }
   assert.ok(identical.size>1,'Color positions must allow equivalent placements');
  }
  const tupleIncorrectStart=variants.length;variants.push(...tupleCases.incorrect);
  for(const [i,value] of variants.entries()){const shouldPass=(i===0||i>wrong.length)&&i<tupleIncorrectStart;
   await db.exec('reset role');const bank=randomUUID(),version=randomUUID(),session=randomUUID();
   await db.query('insert into public.quiz_banks(id,owner_id,draft) values($1,$2,$3)',[bank,student,c.doc]);
   await db.query('insert into public.quiz_versions(id,bank_id,revision,document) values($1,$2,1,$3)',[version,bank,c.doc]);
   await db.query("insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode) values($1,$2,$3,115,$4::jsonb,'immediate',false,false,'self')",[session,student,version,JSON.stringify([qaClass])]);
   await db.query("insert into public.quiz_generated_papers(session_id,user_id,request_id,config,actual_distribution) values($1,$2,$3,'{}','{}')",[session,student,randomUUID()]);
   await actor(student);const before=await action('join',{session_id:session});
   const expectedResponses={};
   for(const item of c.doc.blocks[0].questions){
    await action('view_question',{session_id:session,question_id:item.id});await db.exec('reset role');
    await db.query("update public.quiz_question_timing set first_seen=clock_timestamp()-interval '10 seconds' where attempt_id=$1",[before.attempt_id]);await actor(student);
    const own=item.id===qn.id,itemValue=own?value:responseFor(item),encoded=item.type==='single'?itemValue:JSON.stringify(itemValue),args={session_id:session,question_id:item.id,response:encoded,request_id:randomUUID(),compact:true};
    if(own&&i===0&&item.work){const missing={...itemValue};delete missing.w;await assert.rejects(action('submit',{...args,response:JSON.stringify(missing)}));}
    if(item.type==='open'&&own&&i===0){await assert.rejects(action('self_check',{session_id:session,question_id:item.id,request_id:randomUUID(),self_rating:'understood',self_note:''}),/open_answer_required/);for(const f of item.fields){const missing=structuredClone(itemValue);delete missing.f[f.id];await assert.rejects(action('submit',{...args,response:JSON.stringify(missing)}));const empty=structuredClone(itemValue);empty.f[f.id]=f.input==='sketch'?{version:1,strokes:[]}:' ';await assert.rejects(action('submit',{...args,response:JSON.stringify(empty)}));const long=structuredClone(itemValue);long.f[f.id]=f.input==='sketch'?{version:1,strokes:[[[0,0],[2,1]]]}:'字'.repeat(251);await assert.rejects(action('submit',{...args,response:JSON.stringify(long)}));}}
    const drawing=hasDrawingReference(item),grouping=groupingDrawingPlan(item),shade=shadingPlan(item);
    if((grouping||shade||colors)&&own&&i===0){
     for(const strokes of [[],[[[0,0],[2,1]]]]){
      await assert.rejects(action('submit',{...args,response:JSON.stringify({...itemValue,w:{version:1,strokes}})}));
     }
    }
    async function checkDrawingReference(expected){
     await db.exec('reset role');
     for(const asset of item.explanation.media){
      const report=await db.query('select public.quiz_media_visible($1,$2) visible',[asset.url,before.attempt_id]);
      assert.equal(report.rows[0].visible,expected);drawingReferenceChecks++;
     }
     await actor(student);
    }
    if(drawing)await checkDrawingReference(false);
    await action('submit',args);if(own&&i===0)await action('submit',args);expectedResponses[item.id]=encoded;
    if(drawing)await checkDrawingReference(item.type==='open'||item===c.doc.blocks[0].questions.at(-1));
    if(shade&&item!==c.doc.blocks[0].questions.at(-1)){
     await db.exec('reset role');
     const next=c.doc.blocks[0].questions[c.doc.blocks[0].questions.indexOf(item)+1];
     for(const asset of next.explanation.media){
      const report=await db.query('select public.quiz_media_visible($1,$2) visible',[asset.url,before.attempt_id]);
      assert.equal(report.rows[0].visible,false);drawingReferenceChecks++;
     }
     await actor(student);
    }
    if(item.type==='open'){
     const pending=await action('resume',{session_id:session}),review=pending.reviews.find(r=>r.question_id===item.id);assert.equal(review.correct,null);assert.notEqual(review.assessment.status,'self_checked');assert.equal(pending.complete,false);
     if(drawing)assert.deepEqual(review.explanation.media,item.explanation.media);
     const next=c.doc.blocks[0].questions[c.doc.blocks[0].questions.indexOf(item)+1];if(next)await assert.rejects(action('view_question',{session_id:session,question_id:next.id}),/question_order/);
     const self={session_id:session,question_id:item.id,request_id:randomUUID(),self_rating:own&&i>0?'practice':'understood',self_note:'',compact:true};if(own&&i===0)await assert.rejects(action('self_check',{...self,request_id:args.request_id}),/submission_conflict/);await action('self_check',self);await action('self_check',self);
     const saved=await action('resume',{session_id:session}),checked=saved.reviews.find(r=>r.question_id===item.id);assert.equal(checked.correct,null);assert.equal(checked.assessment.status,'self_checked');assert.equal(checked.assessment.rating,self.self_rating);
    }
   }
   const after=await action('resume',{session_id:session});assert.equal(after.complete,true);assert.deepEqual(after.responses,expectedResponses);for(const review of after.reviews){const own=review.question_id===qn.id,q=c.doc.blocks[0].questions.find(q=>q.id===review.question_id);assert.equal(review.correct,q.type==='open'?null:own?shouldPass:true);if(q.type==='open')assert.equal(review.assessment.status,'self_checked');if(groupingDrawingPlan(q)||fractionComparisonPlan(q)||shadingPlan(q))assert.deepEqual(review.explanation.media,q.explanation.media);assert.deepEqual(review.answer,q.answer);}
   if(shading||fraction){
    await db.exec('reset role');
    for(const asset of c.doc.blocks[0].questions.flatMap(item=>item.explanation.media)){
     const visible=await db.query('select public.quiz_media_visible($1,$2) visible',[asset.url,before.attempt_id]);
     assert.equal(visible.rows[0].visible,true);drawingReferenceChecks++;
    }
    await actor(student);
   }
   cases++;
  }
  results.push({source:c.source,question:qn.id,type:qn.type,fields:single?1:fields.length,auto_graded:!open,self_review:open,exact:true});
 }
 await actor(student);for(const s of ids.samples){
  const joined=await action('join',{session_id:s.session});assert.equal(joined.document.questions.length,1);assert.deepEqual(joined.document.questions[0].prompt,expected.find(e=>e.q.id===s.question_id).q.prompt);
  if(mediaAssets.length){
   const own=publications.find(t=>t.session===s.session),publicOwn=JSON.stringify(own.doc.blocks.map(b=>({material:b.material,questions:b.questions.map(q=>({prompt:q.prompt,options:q.options,fields:q.fields}))})));
   await db.exec('reset role');
   for(const a of mediaAssets){const visible=publicOwn.includes(a.url);assert.equal((await db.query('select public.quiz_media_visible($1,$2) visible',[a.url,joined.attempt_id])).rows[0].visible,visible,'Private sample media visibility differs from its public content');if(visible)mediaVisibilityChecks++;else foreignMediaDenialChecks++;}
   await actor(student);
  }
 }
 await actor(uid(3));assert.ok(!(await action('library_sessions')).sessions.some(s=>s.id===ids.session));await assert.rejects(action('join',{session_id:ids.session}));
 await db.exec('reset role');await db.exec(sqls.rollback);await actor(uid(2));assert.ok(!(await action('library_sessions')).sessions.some(s=>s.id===ids.session));
 await save('isolated',{passed:true,packetSha,counts:n,cases,mediaVisibilityChecks,foreignMediaDenialChecks,drawingReferenceChecks,equivalent_responses:p.responseAliases?.length??0,results,private_samples:n.samples,anonymous_denied:true,other_grade_denied:true,rollback_verified:true,sql:Object.fromEntries(Object.entries(sqls).map(([k,v])=>[k,digest(v)]))});
 const frozenPlan=await readJson(file('plan')+'.json'),isolated=await readJson(file('isolated')+'.json');
 for(const op of ['stage','activate'])await freezeJson(file(op+'-intent')+'.json',practiceWriteIntent(frozenPlan,isolated,op));
 await recordBatchTime(p,packetSha,'isolated-finished');
 console.log(JSON.stringify({passed:true,...n,cases}));
}finally{await db.close();}
