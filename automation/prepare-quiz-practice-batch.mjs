import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {loadBatch,readJson,digest,expectedResponse,practiceWriteIntent,freezeJson,recordBatchTime} from './lib/quiz-batch-plan.mjs';
import {validateDocument} from '../shared/quiz-document.mjs';
import {setupProductionQuizDB} from './fixtures/production-quiz-db.mjs';
import {batchMediaAssets} from './lib/quiz-batch-media.mjs';

const {packet:p,counts:n,sha256:packetSha}=await loadBatch(process.argv[2]);
for(const c of p.candidates){assert.equal(c.doc.blocks.length,1);for(const q of c.doc.blocks[0].questions){assert.equal(q.type,'fields');if(q.work){assert.ok(['expression','sketch'].includes(q.work.input));assert.ok(q.fields.every(f=>f.input==='math'));}else assert.ok(q.fields.every(f=>['single','math','text','set'].includes(f.input)));assert.ok(!q.answer.tuples);}}
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
const guards=`if exists(select 1 from jsonb_array_elements(${j(mediaAssets)}) r where not exists(select 1 from public.quiz_media_assets m where m.url=r->>'url' and m.owner_id=${q(owner)} and m.object_path=r->>'object_path' and m.mime=r->>'mime' and m.bytes=(r->>'bytes')::integer)) then raise exception 'private_media_descriptor_mismatch';end if;
if not exists(select 1 from auth.users where id=${q(owner)} and lower(email)=${q(ownerEmail)} and email_confirmed_at is not null) then raise exception 'owner_mismatch';end if;
if not exists(select 1 from auth.users u join public.student_enrollments e on e.email=lower(u.email) and e.school_year=115 and e.class_code='307' where u.id=${q(student)} and lower(u.email)=${q(studentEmail)} and u.email_confirmed_at is not null and u.raw_app_meta_data->'providers'?'google') then raise exception 'qa_identity_mismatch';end if;
if not exists(select 1 from public.quiz_textbooks where id=${q(book.id)} and grade=3 and school_year=115 and semester=1 and source_sha256=${q(book.sourceSha256)} and title=${q(book.title)} and enabled) then raise exception 'textbook_version_mismatch';end if;
if exists(select 1 from jsonb_array_elements(${j(assets)}) r where not exists(select 1 from public.quiz_textbook_pages a where a.book_id=${q(book.id)} and a.id=r->>'id' and to_jsonb(a.printed_pages)=r->'printedPages' and a.sha256=r->>'sha' and a.bytes=(r->>'bytes')::integer and a.sequence=r->>'sequence' and a.provenance=r->'provenance')) then raise exception 'textbook_page_mismatch';end if;`;
assert.equal(n.images,mediaAssets.length);
const exact=t=>`if not exists(select 1 from public.quiz_sessions s join public.quiz_versions v on v.id=s.version_id join public.quiz_banks b on b.id=v.bank_id join public.quiz_version_meta m on m.version_id=v.id where s.id=${q(t.session)} and s.owner_id=${q(t.user)} and s.access_mode=${q(t.access)} and s.status='open' and s.version_id=${q(t.version)} and v.bank_id=${q(t.bank)} and v.document=${j(t.doc)} and b.draft=v.document and m.total=${t.rows.length} and not s.shuffle_questions and not s.shuffle_options) then raise exception 'document_changed';end if;
if not exists(select 1 from public.quiz_study_packages where id=${q(t.pkg)} and version_id=${q(t.version)} and kind='normal' and enabled and approved) then raise exception 'package_unavailable';end if;
if (select count(*) from public.quiz_study_items where package_id=${q(t.pkg)})<>${t.rows.length} or exists(select 1 from jsonb_array_elements(${j(t.rows)}) r where not exists(select 1 from public.quiz_study_items i where i.package_id=${q(t.pkg)} and i.group_id='' and i.question_id=r->>'question_id' and i.book_id=${q(book.id)} and i.primary_page=(r->>'primary')::integer and to_jsonb(i.reference_pages)=r->'reference' and i.student_explanation=r->>'student_explanation' and i.teacher_notes=r->'teacher_notes')) then raise exception 'study_links_mismatch';end if;`;
const fixed=publications.map(exact).join('\n');
const select=`select encode(convert_to(jsonb_build_object('visible',s.library_visible,'classes',s.class_codes,'status',s.status,'version',s.version_id,'document_exact',v.document=${j(doc)},'groups',jsonb_array_length(v.document->'blocks'),'questions',m.total,'references',(select count(*) from public.quiz_study_items where package_id=${q(ids.pkg)}),'samples_private',(select count(*) from public.quiz_generated_papers g join public.quiz_sessions qs on qs.id=g.session_id where g.user_id=${q(student)} and qs.id in (${ids.samples.map(s=>q(s.session)).join(',')}) and qs.access_mode='self' and not qs.library_visible))::text,'utf8'),'base64') payload from public.quiz_sessions s join public.quiz_versions v on v.id=s.version_id join public.quiz_version_meta m on m.version_id=v.id where s.id=${q(ids.session)};`;
const insertion=publications.map(t=>`select public.quiz_validate(${j(t.doc)});
insert into public.quiz_banks(id,owner_id,draft) values(${q(t.bank)},${q(t.user)},${j(t.doc)});
insert into public.quiz_versions(id,bank_id,revision,document) values(${q(t.version)},${q(t.bank)},1,${j(t.doc)});
insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode,status,library_visible) values(${q(t.session)},${q(t.user)},${q(t.version)},115,${j(t.access==='self'?['307']:[])},'immediate',false,false,${q(t.access)},'open',false);
${t.access==='self'?`insert into public.quiz_generated_papers(session_id,user_id,request_id,config,actual_distribution,display_name) values(${q(t.session)},${q(student)},${q(t.request)},${j({kind:'self',count:t.rows.length,course_id:doc.catalog.course_id})},${j({sample_count:t.rows.length})},${q(p.title)});`:''}
insert into public.quiz_study_packages(id,kind,version_id,approved,enabled,provenance) values(${q(t.pkg)},'normal',${q(t.version)},true,false,${j({method:'parameterized_verified_practice_batch',packetSha,source_records:t.doc.blocks.length,verified_references:t.rows.length})});
${t.rows.map(r=>`insert into public.quiz_study_items(package_id,question_id,book_id,primary_page,reference_pages,student_explanation,origin,teacher_notes) values(${q(t.pkg)},${q(r.question_id)},${q(book.id)},${r.primary},array[${r.reference.join(',')}]::integer[],${q(r.student_explanation)},'ai',${j(r.teacher_notes)});`).join('\n')}
update public.quiz_study_packages set enabled=true where id=${q(t.pkg)};`).join('\n');
const classes=`coalesce((select jsonb_agg(distinct class_code order by class_code) from public.student_enrollments where school_year=115 and class_code ~ '^3[0-9]{2}$'),'[]'::jsonb)`;
const sqls={
 stage:`begin;do $$begin ${guards} end$$;${insertion} do $$begin ${fixed} end$$;${select} commit;`,
 activate:`begin;select id from public.quiz_sessions where id=${q(ids.session)} for update;do $$begin ${guards} ${fixed} if jsonb_array_length(${classes})=0 then raise exception 'no_grade3_classes';end if;end$$;update public.quiz_sessions set library_visible=true,class_codes=${classes} where id=${q(ids.session)};${select} commit;`,
 rollback:`begin;update public.quiz_sessions set library_visible=false,class_codes='[]',status='closed' where id=${q(ids.session)} and owner_id=${q(owner)} and version_id=${q(ids.version)} and access_mode='practice';${select} commit;`,
 readback:`begin read only;do $$begin ${guards} ${fixed} end$$;${select} commit;`,
 presence:`select encode(convert_to(jsonb_build_object('sessions',(select count(*) from public.quiz_sessions where id in (${publications.map(t=>q(t.session)).join(',')})))::text,'utf8'),'base64') payload;`,
 answers:`select encode(convert_to(jsonb_build_object('rows',coalesce(jsonb_agg(jsonb_build_object('session',t.session_id,'question',a.question_id,'response',a.response,'correct',a.correct)),'[]'))::text,'utf8'),'base64') payload from public.quiz_answers a join public.quiz_attempts t on t.id=a.attempt_id where t.session_id in (${ids.samples.map(s=>q(s.session)).join(',')}) and t.user_id=${q(student)};`,
};
for(const [k,s] of Object.entries(sqls))await fs.writeFile(file(k)+'.sql',s);
await save('document',doc);await save('plan',{packetSha,counts:n,ids,book:book.id,rows,assets,publications,sampleExpected:Object.fromEntries(ids.samples.map(s=>{const question=doc.blocks.flatMap(b=>b.questions).find(q=>q.id===s.question_id);return [s.question_id,expectedResponse(question,s.work)];}))});
const {db,uid}=await setupProductionQuizDB({snapshot:true});
let mediaVisibilityChecks=0,foreignMediaDenialChecks=0;
const actor=async(id,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role);};
const action=async(name,p={})=>(await db.query('select public.quiz_action($1,$2) data',[name,p])).rows[0].data;
try{
 const schema=await readJson(new URL('../supabase/production-snapshot/schema.json',import.meta.url));
 const tables=new Set(['quiz_versions','quiz_study_packages','quiz_study_items','quiz_textbooks','quiz_textbook_pages']);
 for(const t of schema.triggers.filter(t=>t.schema==='public'&&tables.has(t.table)))await db.exec(t.def);
 await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now()),($3,$4,now()),($5,'g3@example.invalid',now()),($6,'g4@example.invalid',now())",[owner,ownerEmail,student,studentEmail,uid(2),uid(3)]);
 await db.query("insert into public.student_enrollments values(115,$1,'307',30,'QA'),(115,'g3@example.invalid','301',31,'G3'),(115,'g4@example.invalid','401',31,'G4')",[studentEmail]);
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
 for(const [i,got] of joined.document.questions.entries()){const {q,material}=expected[i];assert.equal(got.id,q.id);assert.deepEqual(got.prompt,q.prompt);assert.deepEqual(got.fields,q.fields);assert.deepEqual(got.work,q.work);assert.deepEqual(got.material,material);assert.ok(!('answer' in got));assert.deepEqual(joined.study.references[q.id],{bookId:book.id,primary:rows[i].primary,references:rows[i].reference,fields:[]});}
 // All fields exercise the production grading contract; work is saved, not automatically graded.
 for(const a of p.responseAliases??[])assert.ok(doc.blocks.flatMap(b=>b.questions).some(q=>q.id===a.question_id&&q.fields.some(f=>f.id===a.field_id&&f.input==='math')));
 let cases=0;const results=[];
 for(const c of p.candidates)for(const qn of c.doc.blocks[0].questions){const workFor=q=>p.works[q.id]??p.works[c.source],response=expectedResponse(qn,workFor(qn));
  const aliases=(p.responseAliases??[]).filter(a=>a.question_id===qn.id).map(a=>{assert.ok(qn.fields.some(f=>f.id===a.field_id&&f.input==='math'));assert.ok(typeof a.value==='string'&&a.value.length>0&&a.value.length<=250);assert.notEqual(a.value,response.f[a.field_id]);const value=structuredClone(response);value.f[a.field_id]=a.value;return value;});
  const acceptedAlternatives=qn.fields.filter(f=>f.input==='single').flatMap(f=>qn.answer.fields[f.id].slice(1).map(value=>{const alternative=structuredClone(response);alternative.f[f.id]=value;return alternative;}));
  const variants=[response,...qn.fields.map(field=>{const bad=structuredClone(response);if(field.input==='single'){const wrong=field.options.find(o=>!qn.answer.fields[field.id].includes(o.id));assert.ok(wrong,'Need an independently incorrect option');bad.f[field.id]=wrong.id;}else if(field.input==='set'){const ids=new Set(response.f[field.id]),toggle=field.options[0].id;ids.has(toggle)?ids.delete(toggle):ids.add(toggle);bad.f[field.id]=[...ids];}else bad.f[field.id]='999999';return bad;}),...aliases,...acceptedAlternatives];
  for(const [i,value] of variants.entries()){const shouldPass=i===0||i>qn.fields.length;
   await db.exec('reset role');const bank=randomUUID(),version=randomUUID(),session=randomUUID();
   await db.query('insert into public.quiz_banks(id,owner_id,draft) values($1,$2,$3)',[bank,student,c.doc]);
   await db.query('insert into public.quiz_versions(id,bank_id,revision,document) values($1,$2,1,$3)',[version,bank,c.doc]);
   await db.query("insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode) values($1,$2,$3,115,'[\"307\"]','immediate',false,false,'self')",[session,student,version]);
   await db.query("insert into public.quiz_generated_papers(session_id,user_id,request_id,config,actual_distribution) values($1,$2,$3,'{}','{}')",[session,student,randomUUID()]);
   await actor(student);const before=await action('join',{session_id:session});
   const expectedResponses={};
   for(const item of c.doc.blocks[0].questions){
    await action('view_question',{session_id:session,question_id:item.id});await db.exec('reset role');
    await db.query("update public.quiz_question_timing set first_seen=clock_timestamp()-interval '10 seconds' where attempt_id=$1",[before.attempt_id]);await actor(student);
    const own=item.id===qn.id,itemValue=own?value:expectedResponse(item,workFor(item)),encoded=JSON.stringify(itemValue),args={session_id:session,question_id:item.id,response:encoded,request_id:randomUUID(),compact:true};
    if(own&&i===0&&item.work){const missing={...itemValue};delete missing.w;await assert.rejects(action('submit',{...args,response:JSON.stringify(missing)}));}
    await action('submit',args);if(own&&i===0)await action('submit',args);expectedResponses[item.id]=encoded;
   }
   const after=await action('resume',{session_id:session});assert.equal(after.complete,true);assert.deepEqual(after.responses,expectedResponses);for(const review of after.reviews){const own=review.question_id===qn.id;assert.equal(review.correct,own?shouldPass:true);assert.deepEqual(review.answer,c.doc.blocks[0].questions.find(q=>q.id===review.question_id).answer);}cases++;
  }
  results.push({source:c.source,question:qn.id,fields:qn.fields.length,exact:true});
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
 await save('isolated',{passed:true,packetSha,counts:n,cases,mediaVisibilityChecks,foreignMediaDenialChecks,equivalent_responses:p.responseAliases?.length??0,results,private_samples:n.samples,anonymous_denied:true,other_grade_denied:true,rollback_verified:true,sql:Object.fromEntries(Object.entries(sqls).map(([k,v])=>[k,digest(v)]))});
 const frozenPlan=await readJson(file('plan')+'.json'),isolated=await readJson(file('isolated')+'.json');
 for(const op of ['stage','activate'])await freezeJson(file(op+'-intent')+'.json',practiceWriteIntent(frozenPlan,isolated,op));
 await recordBatchTime(p,packetSha,'isolated-finished');
 console.log(JSON.stringify({passed:true,...n,cases}));
}finally{await db.close();}
