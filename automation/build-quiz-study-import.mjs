// Offline candidate generator. Never connects to Supabase/Drive or executes SQL.
import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
const args=process.argv.slice(2),arg=n=>args[args.indexOf(n)+1];
if(!args.includes('--packet')||!args.includes('--out'))throw Error('請指定 --packet 私有資料包.json --out 私有輸出資料夾');
const packet=JSON.parse(await fs.readFile(arg('--packet'),'utf8')),folder=path.resolve(arg('--out'));
if(!folder.split(path.sep).some(s=>s==='.chat-mode'||s==='ai-now'))throw Error('輸出必須位於 .chat-mode 或 ai-now 私有資料夾');
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v),hash=v=>/^[a-f0-9]{64}$/.test(v||''),quoted=v=>"'"+String(v).replaceAll("'","''")+"'",json=v=>quoted(JSON.stringify(v))+'::jsonb';
const fail=m=>{throw Error(m);},sql=['begin;'],assets={},pending=[];
if(packet.schema!==1||!Array.isArray(packet.books)||!Array.isArray(packet.packages))fail('資料包格式不符');
const bookIds=new Set();
for(const b of packet.books){
 if(!uuid(b.id)||bookIds.has(b.id)||!hash(b.sourceSha256)||![3,4,6,9].includes(b.grade)||!Number.isInteger(b.schoolYear)||![1,2].includes(b.semester)||!b.title||!Array.isArray(b.pages))fail('課本版本資料不完整');bookIds.add(b.id);
 sql.push(`insert into public.quiz_textbooks(id,grade,school_year,semester,title,source_sha256) values(${quoted(b.id)},${b.grade},${b.schoolYear},${b.semester},${quoted(b.title)},${quoted(b.sourceSha256)});`);
 const pageIds=new Set(),numbers=new Set();
 for(const p of b.pages){
  if(!p.id||pageIds.has(p.id)||!hash(p.sha256)||!Number.isInteger(p.bytes)||p.bytes<1||p.bytes>8388608||!p.sequence||!Array.isArray(p.printedPages)||!p.printedPages.length||p.printedPages.some(n=>!Number.isInteger(n)||n<1||numbers.has(n)))fail('課本頁碼或完整拉頁重疊');pageIds.add(p.id);p.printedPages.forEach(n=>numbers.add(n));
  sql.push(`insert into public.quiz_textbook_pages(book_id,id,printed_pages,sequence,sha256,bytes,provenance) values(${quoted(b.id)},${quoted(p.id)},array[${p.printedPages.join(',')}],${quoted(p.sequence)},${quoted(p.sha256)},${p.bytes},${json(p.provenance||{})});`);
  if(typeof p.driveFileId==='string'&&/^[A-Za-z0-9_-]{10,}$/.test(p.driveFileId)&&p.driveVerified===true)assets[p.sha256]={fileId:p.driveFileId,mime:'image/webp',bytes:p.bytes,roles:['material']};else pending.push({bookId:b.id,pageId:p.id,reason:'待核對私有Drive檔案與Worker白名單'});
 }
}
for(const p of packet.packages){
 if(!uuid(p.id)||!uuid(p.versionId)||!['normal','past'].includes(p.kind)||!hash(p.sourceDocumentSha256)||p.reviewed!==true||!p.provenance||!Array.isArray(p.items))fail('解析包未固定來源版本或未複核');
 const table=p.kind==='normal'?'quiz_versions':'quiz_past_versions';
 sql.push(`do $$begin if not exists(select 1 from public.${table} where id=${quoted(p.versionId)} and encode(sha256(convert_to(document::text,'UTF8')),'hex')=${quoted(p.sourceDocumentSha256)}) then raise exception 'study_source_changed';end if;end$$;`);
 sql.push(`insert into public.quiz_study_packages(id,kind,version_id,approved,provenance) values(${quoted(p.id)},${quoted(p.kind)},${quoted(p.versionId)},true,${json(p.provenance)});`);
 const keys=new Set();
 for(const i of p.items){
  const group=i.groupId||'',key=group+':'+i.questionId,b=packet.books.find(b=>b.id===i.bookId),refs=i.referencePages||[];
  if(typeof i.questionId!=='string'||!/^[A-Za-z0-9_-]{1,120}$/.test(i.questionId)||group&&!/^[A-Za-z0-9_-]{1,120}$/.test(group)||keys.has(key)||!['ai','official','publisher'].includes(i.origin)||typeof i.studentExplanation!=='string'||!i.studentExplanation.trim()||i.studentExplanation.length>12000||p.kind==='past'&&!group||p.kind==='normal'&&group||!Array.isArray(refs)||refs.some(n=>!Number.isInteger(n)||n<1)||!i.bookId&&refs.length)fail('題目與學生解析格式不符');keys.add(key);
  if(i.bookId&&(!b||!refs.includes(i.primaryPage)||refs.some(n=>!b.pages.some(p=>p.printedPages.includes(n)))))fail('課本對照頁碼缺件');
  // Check the real fixed source document, never silently attach an old sample to a new question.
  const existence=p.kind==='normal'?`select 1 from public.quiz_versions v,jsonb_array_elements(v.document->'blocks') b,jsonb_array_elements(b->'questions') q where v.id=${quoted(p.versionId)} and q->>'id'=${quoted(i.questionId)}`:`select 1 from public.quiz_past_versions v,jsonb_array_elements(v.document->'groups') g,jsonb_array_elements(g->'fields') f where v.id=${quoted(p.versionId)} and g->>'id'=${quoted(group)} and f->>'id'=${quoted(i.questionId)}`;
  sql.push(`do $$begin if not exists(${existence}) then raise exception 'study_question_missing';end if;end$$;`);
  sql.push(`insert into public.quiz_study_items(package_id,group_id,question_id,book_id,primary_page,reference_pages,student_explanation,origin,teacher_notes) values(${quoted(p.id)},${quoted(group)},${quoted(i.questionId)},${i.bookId?quoted(i.bookId):'null'},${i.bookId?i.primaryPage:'null'},array[${refs.join(',')}]::integer[],${quoted(i.studentExplanation)},${quoted(i.origin)},${json(i.teacherNotes||{})});`);
 }
}
// Keep activation separate and explicit; candidate import never makes unverified media available.
sql.push('commit;');await fs.mkdir(folder,{recursive:true});
await fs.writeFile(path.join(folder,'study-import.private.sql'),sql.join('\n')+'\n');
await fs.writeFile(path.join(folder,'worker-assets.private.json'),JSON.stringify(assets,null,2));
await fs.writeFile(path.join(folder,'study-import-report.private.json'),JSON.stringify({enabled:false,books:packet.books.length,packages:packet.packages.length,items:packet.packages.reduce((n,p)=>n+p.items.length,0),verifiedWorkerAssets:Object.keys(assets).length,pending,packetSha256:createHash('sha256').update(JSON.stringify(packet)).digest('hex')},null,2));
console.log(JSON.stringify({prepared:true,enabled:false,pendingMedia:pending.length}));
