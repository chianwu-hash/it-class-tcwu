import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url)),lit=s=>"'"+String(s).replaceAll("'","''")+"'";
export async function migration(before,bundle,{commit=false}={}){
 if(bundle.pool.length!==77||before.pool.length!==154||Object.keys(bundle.scope.units).join(',')!=='1,3'||bundle.pool.some(p=>p.unit_ids.join(',')!=='3'||p.checks.publisher_chapter!=='04'||!p.knowledge_reliable))throw Error('scope_not_verified');
 const old=before.presets.find(p=>p.session.id===bundle.preset.retire_session_id),unit1=before.presets.find(p=>p.document.catalog.unit===bundle.scope.units[1]);
 if(!old||old.document.catalog.unit!=='Unit 2 Having a Cold'||old.session.owner_id!==before.owner||!unit1||unit1.session.owner_id!==before.owner)throw Error('preset_owner_or_unit_mismatch');
 const json=v=>lit(JSON.stringify(v))+'::jsonb',newIds=bundle.pool.map(p=>p.question_id),newUrls=Object.values(bundle.assets).filter(a=>!a.registered).map(a=>a.url),preset=bundle.preset;
 const sql=`begin isolation level repeatable read;
set local lock_timeout='5s';set local statement_timeout='60s';
select pg_advisory_xact_lock(hashtextextended('quiz_catalog_cache',0));
create temp table english_old_pool(id text primary key,hash text,unit_ids jsonb) on commit drop;
create temp table english_scope_config(config jsonb) on commit drop;
insert into english_scope_config values(${json({new_session:preset.session_id,old_session:preset.retire_session_id,course_id:bundle.scope.course_id})});
insert into english_old_pool select value->>0,value->>1,value->2 from jsonb_array_elements(${json(before.pool.map(p=>[p.question_id,p.row_md5,p.unit_ids]))});
do $guard$begin
 if (select count(*) from public.quiz_pool_membership where course_id='115-1-kang-g6-en')<>154 or exists(select 1 from english_old_pool e left join public.quiz_question_pool p on p.question_id=e.id where p.question_id is null or md5(to_jsonb(p)::text)<>e.hash) then raise exception 'english_pool_changed';end if;
 if replace(pg_get_functiondef('public.quiz_library_sessions(jsonb)'::regprocedure),chr(13),'')<>replace(${lit(before.library_definition)},chr(13),'') then raise exception 'library_definition_changed';end if;
 if not exists(select 1 from public.quiz_courses c where to_jsonb(c)=${json(before.course)}) then raise exception 'course_changed';end if;
 if not exists(select 1 from public.quiz_sessions s where s.id=${lit(old.session.id)} and to_jsonb(s)=${json(old.session)}) or not exists(select 1 from public.quiz_sessions s where s.id=${lit(unit1.session.id)} and to_jsonb(s)=${json(unit1.session)}) then raise exception 'preset_changed';end if;
end $guard$;
create or replace function pg_temp.english_guard() returns jsonb language plpgsql as $body$
declare t text;h text;result jsonb:='{}';begin
 for t in select tablename from pg_tables where schemaname='public' and tablename like 'quiz\\_%' escape '\\' and tablename not in ('quiz_question_pool','quiz_pool_membership','quiz_catalog_cache','quiz_courses','quiz_media_assets') order by tablename loop
  execute format('select md5(coalesce(string_agg((to_jsonb(r)-''library_visible'')::text,'''' order by (to_jsonb(r)-''library_visible'')::text),'''')) from public.%I r where coalesce(to_jsonb(r)->>''id'','''') not in (%L,%L,%L) and coalesce(to_jsonb(r)->>''version_id'','''')<>%L',t,${lit(preset.bank_id)},${lit(preset.version_id)},${lit(preset.session_id)},${lit(preset.version_id)}) into h;result:=result||jsonb_build_object(t,h);
 end loop;
 select md5(coalesce(string_agg((to_jsonb(p)-case when e.unit_ids='[2]'::jsonb then 'usable' else 'no_such_field' end)::text,'' order by p.question_id),'')) into h from public.quiz_question_pool p left join english_old_pool e on e.id=p.question_id where not(p.question_id=any(array(select jsonb_array_elements_text(${json(newIds)}))));result:=result||jsonb_build_object('old_pool',h);
 select md5(coalesce(string_agg(to_jsonb(m)::text,'' order by m.question_id),'')) into h from public.quiz_pool_membership m where not(m.question_id=any(array(select jsonb_array_elements_text(${json(newIds)}))));result:=result||jsonb_build_object('old_membership',h);
 select md5(coalesce(string_agg(to_jsonb(c)::text,'' order by c.id),'')) into h from public.quiz_courses c where c.id<>'115-1-kang-g6-en';result:=result||jsonb_build_object('other_courses',h);
 select md5(coalesce(string_agg(to_jsonb(a)::text,'' order by a.url),'')) into h from public.quiz_media_assets a where not(a.url=any(array(select jsonb_array_elements_text(${json(newUrls)}))));return result||jsonb_build_object('old_media',h);
end $body$;
create temp table english_before on commit drop as select pg_temp.english_guard() state;
${await fs.readFile(path.join(dir,'../../supabase/quiz-practice-visibility.sql'),'utf8')}
insert into public.quiz_media_assets(url,owner_id,object_path,mime,bytes) select url,owner_id::uuid,object_path,mime,bytes from jsonb_to_recordset(${json(Object.values(bundle.assets).filter(a=>!a.registered))}) as a(url text,owner_id text,object_path text,mime text,bytes int);
insert into public.quiz_question_pool select question_id,source_item_id,group_key,unit_ids,knowledge_code,knowledge_name,difficulty,source_version,publisher_explanation,question,checks,usable from jsonb_to_recordset(${json(bundle.pool)}) as p(question_id text,source_item_id text,group_key text,unit_ids jsonb,knowledge_code text,knowledge_name text,difficulty int,source_version text,publisher_explanation boolean,question jsonb,checks jsonb,usable boolean);
insert into public.quiz_pool_membership select question_id,course_id,knowledge_reliable from jsonb_to_recordset(${json(bundle.pool.map(p=>({question_id:p.question_id,course_id:p.course_id,knowledge_reliable:true})))}) as m(question_id text,course_id text,knowledge_reliable boolean);
update public.quiz_question_pool p set usable=false from english_old_pool e where p.question_id=e.id and e.unit_ids='[2]'::jsonb;
update public.quiz_courses set definition=jsonb_set(definition,'{units}',${json(bundle.scope.units)}) where id='115-1-kang-g6-en';
insert into public.quiz_banks(id,owner_id,draft) values(${lit(preset.bank_id)},${lit(preset.owner_id)},${json(preset.document)});
insert into public.quiz_versions(id,bank_id,revision,document) values(${lit(preset.version_id)},${lit(preset.bank_id)},1,${json(preset.document)});
insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode) values(${lit(preset.session_id)},${lit(preset.owner_id)},${lit(preset.version_id)},115,${json(preset.class_codes)},'immediate',false,true,'practice');
update public.quiz_sessions set library_visible=false where id=${lit(preset.retire_session_id)};
do $guard$begin
 if pg_temp.english_guard() is distinct from (select state from english_before) then raise exception 'existing_records_changed';end if;
 if (select count(*) from public.quiz_sessions where library_visible=false)<>1 then raise exception 'unexpected_library_visibility';end if;
 if exists(select 1 from public.quiz_question_pool p join public.quiz_pool_membership m using(question_id) where m.course_id='115-1-kang-g6-en' and p.usable and not(p.unit_ids <@ '[1,3]'::jsonb)) then raise exception 'outside_exam_pool';end if;
end $guard$;
insert into public.quiz_catalog_cache(grade,payload) select g,public.quiz_catalog_build(g) from unnest(array[3,6]) g on conflict(grade) do update set payload=excluded.payload,built_at=now();
select jsonb_build_object('passed',true,'unit1_preserved',true,'unit2_preset_hidden_but_preserved',true,'unit3_pool',77,'teacher_questions',10,'existing_records_preserved',true,'committed',${commit}) result;
${commit?'commit':'rollback'};
`;
 if(Buffer.byteLength(sql)>450000)throw Error('migration_too_large');return sql;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [out,mode]=process.argv.slice(2),before=JSON.parse(await fs.readFile(path.join(out,'before.private.json'),'utf8')),bundle=JSON.parse(await fs.readFile(path.join(out,'bundle.private.json'),'utf8'));
 if(mode==='apply'){
  const bundleTime=(await fs.stat(path.join(out,'bundle.private.json'))).mtimeMs;
  for(const name of ['media-upload-verified.json','worker-updated-verified.json','worker-media-verified.json','local-verified.json','cloud-smoke-verified.json']){const file=path.join(out,name),r=JSON.parse(await fs.readFile(file,'utf8'));if(r.passed!==true||(await fs.stat(file)).mtimeMs<bundleTime)throw Error('current_verification_required '+name);}
 }
 const sql=await migration(before,bundle,{commit:mode==='apply'});await fs.writeFile(path.join(out,mode==='apply'?'apply.private.sql':'rollback.private.sql'),sql);console.log(JSON.stringify({bytes:Buffer.byteLength(sql),commit:mode==='apply'}));
}
