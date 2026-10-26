// 一次性授權匯入：固定 32 份期中卷。只以 Management API 寫入指定專案，不讀學生資料。
// --prepare 產生可檢查 SQL；--apply 依序套用已驗證 migration 與此 SQL，不刪舊資料。
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { validateDocument } from '../shared/quiz-document.mjs';
import { mediaEntries } from '../supabase/functions/quiz-media/handler.mjs';
const project='upxgyusodibaqcrocdzj';
const root=new URL('../',import.meta.url), output=new URL('automation/output/quiz/cloud-practice/',root);
await mkdir(output,{recursive:true});
const json=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
function cli(args){
  // 所有參數由固定專案／已解析檔案路徑組成，無 shell 插值；敏感結果只留記憶體。
  const command=['&','supabase-personal',...args.map(x=>"'"+x.replaceAll("'","''")+"'")].join(' ');
  const raw=execFileSync('pwsh',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,timeout:90000,stdio:['ignore','pipe','pipe']});
  const start=raw.indexOf('{'), array=raw.indexOf('[');
  return JSON.parse(raw.slice(array>=0&&(start<0||array<start)?array:start));
}
const projects=cli(['projects','list','--output','json']);
if(!projects.some(p=>p.id===project&&p.name==="chianwu-hash's Project"))throw Error('project_mismatch');
function query(sql){return cli(['db','query','--linked','--project-ref',project,sql,'--output','json']).rows;}
const users=query("select id from auth.users where lower(email)='chianwu@gmail.com' and email_confirmed_at is not null;");
if(users.length!==1)throw Error('confirmed_owner_required');
const owner=users[0].id;
const all=await json('automation/output/quiz/all-midterm-local/runtime/all-papers.json');
if(all.length!==32)throw Error('expected_32_papers');
const newer=await json('automation/output/quiz/all-midterm-local/runtime/assets.json');
const older=await json('automation/output/quiz/hanlin-midterm-local/catalog/cloud-assets.json');
const metadata=new Map([...older,...newer].map(a=>[a.hash,a]));
const uuid=seed=>{const h=createHash('sha256').update(owner+'|'+seed).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
const literal=s=>"'"+s.replaceAll("'","''")+"'";
const value=x=>literal(JSON.stringify(x))+'::jsonb';
let sql='begin;\n';const records=[],assets=new Map();
for(const paper of all){
 const folder=paper.existing?`automation/output/quiz/hanlin-midterm-local/runtime/unit-papers/unit${paper.unit}/trial-frozen.json`:`automation/output/quiz/all-midterm-local/runtime/papers/${paper.key}/frozen.json`;
 const document=await json(folder);
 document.catalog.volume=`${paper.grade}年級上學期`;
 document.catalog.difficulty=`容易 ${paper.difficulty['-3']||0}・中等 ${paper.difficulty['0']||0}・困難 ${paper.difficulty['3']||0}`;
 for(const m of mediaEntries(document)){
  const hash=new URL(m.url).pathname.split('/').at(-1);
  const a=metadata.get(hash);if(!a||!/^[a-f0-9]{64}$/.test(hash))throw Error('asset_metadata_missing');
  m.url=`https://quiz-media.invalid/${owner}/${hash}`;
  // 原來已上傳的私有物件直接引用，不重傳、不公開。
  const asset={url:m.url,owner_id:owner,object_path:(paper.existing?'hanlin-midterm-20261025-':'publisher-midterm-20261026-')+hash,mime:a.mime,bytes:a.bytes};
  const previous=assets.get(m.url);if(previous&&previous.object_path!==asset.object_path)throw Error('asset_namespace_conflict');assets.set(m.url,asset);
 }
 validateDocument(document);
 const bank=uuid('bank|'+paper.key),version=uuid('version|'+paper.key),session=uuid('session|'+paper.key);
 const encoded=value(document);
 sql+=`select public.quiz_validate(${encoded});\n`;
 sql+=`insert into public.quiz_banks(id,owner_id,draft) values('${bank}','${owner}',${encoded}) on conflict(id) do nothing;\n`;
 sql+=`insert into public.quiz_versions(id,bank_id,revision,document) values('${version}','${bank}',1,${encoded}) on conflict(id) do nothing;\n`;
 sql+=`insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode) values('${session}','${owner}','${version}',115,'[]','immediate',false,true,'personal') on conflict(id) do nothing;\n`;
 // 不容許相同識別被更動的內容悄悄覆蓋原場次。
 sql+=`do $$begin if not exists(select 1 from public.quiz_versions where id='${version}' and document=${encoded}) then raise exception 'cloud_version_conflict'; end if; end$$;\n`;
 records.push({key:paper.key,session_id:session,version_id:version,title:paper.title});
}
for(const a of assets.values())sql+=`insert into public.quiz_media_assets(url,owner_id,object_path,mime,bytes) values(${literal(a.url)},'${owner}',${literal(a.object_path)},${literal(a.mime)},${a.bytes}) on conflict(url) do nothing;\n`;
sql+="notify pgrst,'reload schema';\ncommit;\nselect count(*) as imported_personal_papers from public.quiz_sessions where access_mode='personal';\n";
await writeFile(new URL('import.sql',output),sql,'utf8');
await writeFile(new URL('papers.json',output),JSON.stringify(records,null,2),'utf8');
console.log(JSON.stringify({prepared_papers:records.length,media_assets:assets.size,sql_bytes:Buffer.byteLength(sql)}));
if(process.argv.includes('--apply')){
 for(const name of ['supabase/quiz.sql','supabase/quiz-media.sql','automation/output/quiz/cloud-practice/import.sql','supabase/quiz-student-library-seed.sql']){
  cli(['db','query','--linked','--project-ref',project,'--file',new URL(name,root).pathname.replace(/^\//,''),'--output','json']);
  console.log(JSON.stringify({applied:name}));
 }
}
