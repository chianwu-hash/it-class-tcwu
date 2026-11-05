// Build an additive teacher-only migration from the audited production definitions.
import fs from 'node:fs/promises';
import {splitSnapshot} from './lib/db-snapshot.mjs';
const blocks=splitSnapshot(await fs.readFile('supabase/production-snapshot/functions.sql','utf8'));
const get=name=>{const b=blocks.find(b=>b.signature.startsWith(name+'('));if(!b)throw Error(name);return b;};
const replace=(s,a,b)=>{if(!s.includes(a))throw Error('missing migration anchor: '+a);return s.replaceAll(a,b);};
const scope=s=>s.replaceAll("'grade3-115-1','grade6-115-1'","'grade3-115-1','grade4-115-1','grade6-115-1','grade9-115-1'").replaceAll('^[36][0-9]{2}$','^[3469][0-9]{2}$');
let rows=get('admin_learning_paper_rows').definition;
rows=replace(rows," and not exists(select 1 from public.quiz_learning_sessions learning_private where learning_private.session_id=s.id)",'');
rows=replace(rows,'s.access_mode,v.revision',"case when ls.session_id is not null then 'extension' else s.access_mode end,v.revision");
rows=replace(rows,"g.config->>'attempt_id',g.config->>'question_id'","coalesce(ls.source_attempt::text,g.config->>'attempt_id'),coalesce(ls.question_id,g.config->>'question_id')");
rows=replace(rows,' from own o join public.quiz_sessions s on s.id=o.session_id',' from own o join public.quiz_sessions s on s.id=o.session_id\n left join public.quiz_learning_sessions ls on ls.session_id=s.id and ls.user_id=p_user');
rows=replace(rows,"s.access_mode in ('classroom','practice','self');",`s.access_mode in ('classroom','practice','self')
 union all
 select a.id,a.id,v.document->>'title',coalesce(v.document->'catalog'->>'subject',''),v.document->>'title','past_exam',
  (select count(*)::integer from public.quiz_past_versions prior where prior.paper_id=a.paper_id and (prior.created_at,prior.id)<=(v.created_at,v.id)),
  a.created_at,a.created_at,x.last_at,x.answered,x.correct,
  (select count(*)::integer from jsonb_array_elements(v.document->'groups') g cross join lateral jsonb_array_elements(g->'fields') f),
  false,null::text,null::text
 from public.quiz_past_attempts a join public.quiz_past_versions v on v.id=a.version_id and v.paper_id=a.paper_id
 join public.quiz_past_papers p on p.id=a.paper_id
 cross join lateral(select count(*) filter(where r.attempt_id is not null) as answered,count(*) filter(where z.correct) as correct,null::timestamptz as last_at
  from jsonb_array_elements(v.document->'groups') fg cross join lateral jsonb_array_elements(fg->'fields') ff
  left join public.quiz_past_receipts r on r.attempt_id=a.id and r.group_id=fg->>'id'
  left join public.quiz_past_answers z on z.attempt_id=a.id and z.group_id=fg->>'id' and z.question_id=ff->>'id') x
 where a.user_id=p_user and a.school_year=p_year and a.semester=1 and p.grade=left(p_class,1)::integer;`);
let core=scope(get('admin_learning_action').definition);
core=replace(core,'selected_subject text; selected_state text;','selected_subject text; selected_state text; selected_activity text;');
core=replace(core,"'filter','subject','state'","'filter','subject','state','activity_type'");
core=replace(core," selected_subject:=",` selected_activity:=coalesce(p_payload->>'activity_type','all');
 if selected_activity not in ('all','classroom','practice','self','past_exam','extension') then raise exception 'invalid_request';end if;
 selected_subject:=`);
core=replace(core,"(selected_subject='' or r.subject=selected_subject)","(selected_subject='' or r.subject=selected_subject) and (selected_activity='all' or r.access_mode=selected_activity)");
core=replace(core," elsif p_action='paper' then",` elsif p_action='paper' then
  if exists(select 1 from public.admin_learning_paper_rows(uid,yr,cls) r where r.session_id=(p_payload->>'session_id')::uuid and r.access_mode='past_exam') then
   result:=public.admin_learning_past_detail((p_payload->>'session_id')::uuid,lim,offst,coalesce(p_payload->>'filter','all'));
   return result||jsonb_build_object('identity',identity,'offset',offst,'limit',lim,'as_of',statement_timestamp());
  end if;`);
core=replace(core," and not exists(select 1 from public.quiz_learning_sessions learning_private where learning_private.session_id=s.id)",'');
let media=scope(get('admin_learning_media_access').definition);
media=replace(media,' if not exists(select 1 from jsonb_path_query',` if checked->>'activity_type'='past_exam' then
  select v.document into doc from public.quiz_past_attempts a join public.quiz_past_versions v on v.id=a.version_id where a.id=p_session;
 end if;
 if not exists(select 1 from jsonb_path_query`);
// assets[] as well as content.media[] are used in immutable past-exam documents.
media=replace(media,"jsonb_path_query(doc,'$.**.media[*].url')","(select * from jsonb_path_query(doc,'$.**.url') union select * from jsonb_path_query(doc,'$.**.referenceUrl'))");
media=replace(media,"u where u#>>'{}'=p_url","u(value) where u.value#>>'{}'=p_url");
let rewards=scope(get('admin_learning_rewards').definition);
const detail=await fs.readFile('supabase/admin-learning-past-detail.fragment.sql','utf8');
const functions=[get('admin_learning_paper_rows'),get('admin_learning_action'),get('admin_learning_media_access'),get('admin_learning_rewards')];
const guard=`do $guard$ begin\n${functions.map(b=>` if md5(pg_get_functiondef('public.${b.signature}'::regprocedure))<>'${b.md5}' then raise exception 'production_function_changed: ${b.signature}';end if;`).join('\n')}\nend $guard$;`;
await fs.writeFile('supabase/admin-learning-activities.sql',`-- Teacher read-only activity expansion. No learner writes or grading changes.\nbegin;\n${guard}\n${detail}\n${rows};\n${core};\n${media};\n${rewards};\ncommit;\n`.replace(/[ \t]+$/gm,''));
console.log('Prepared four existing teacher functions and one private detail helper.');
