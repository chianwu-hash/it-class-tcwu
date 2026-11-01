import {readFile} from 'node:fs/promises';
import {managementRead} from './admin-learning-live-query.mjs';

export function compileGardenCatalog(definition){
  if(typeof definition!=='string'||!(/LANGUAGE sql/i.test(definition)&&/IMMUTABLE/i.test(definition)))throw new Error('readonly_contract_changed');
  const body=definition.match(/AS \$([^$]*)\$([\s\S]*?)\$\1\$/i)?.[2].trim();
  if(!body?.match(/^values\b/i))throw new Error('readonly_contract_changed');
  const literal="'(?:''|[^'])*'",row=new RegExp(`\\(\\s*${literal}\\s*,\\s*${literal}\\s*,\\s*${literal}\\s*,\\s*${literal}\\s*,\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*${literal}\\s*\\)`,'g');
  const rest=body.replace(/^values\b/i,'').replace(row,'').replace(/[\s,]/g,'');
  if(rest||!body.match(row)?.length)throw new Error('readonly_contract_changed');
  return body;
}

// Compile the SELECT projections from the candidate SQL; do not deploy its DDL.
// All request values are bound parameters. The transport uses the provider's
// dedicated supabase_read_only_user endpoint, never CLI login-role initialization.
export function compileLearningReads(source){
  const helper=source.match(/language sql stable set search_path='' as \$\$([\s\S]*?)\$\$/)?.[1].trim().replace(/;$/,'');
  const columns=source.match(/returns table\(([\s\S]*?)\)\s*language sql stable/)?.[1].split(',').map(c=>c.trim().split(/\s+/)[0]);
  if(!helper||!columns?.length||columns.some(c=>!/^[a-z_]+$/.test(c)))throw new Error('readonly_contract_changed');
  const projections={};
  for(const action of ['roster','weekly','typing','typing_events','papers','paper']){
    const marker=`p_action='${action}' then`,start=source.indexOf(marker);
    const end=source.indexOf(' into result;',start);if(start<0||end<0)throw new Error('readonly_contract_changed');
    const part=source.slice(start,end),withAt=part.indexOf(action==='paper'?'with definitions as':'with rows as');
    if(withAt<0)throw new Error('readonly_contract_changed');projections[action]=part.slice(withAt);
  }
  const profile=source.match(/if p_action='profile' then\s*return ([\s\S]*?);\s*end if;/)?.[1];
  if(!profile)throw new Error('readonly_contract_changed');projections.profile='select '+profile;
  projections.media=`select jsonb_build_object('available',exists(select 1 from public.quiz_media_assets a
    where a.url=p_payload->>'url' and exists(select 1 from jsonb_path_query(doc,'$.**.media[*].url') u where u#>>'{}'=a.url)))`;
  projections.rewards=`select jsonb_build_object(
    'weekly_rows',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select s.course_id,s.week_code,s.activity_key,s.current_level,s.completed,s.score,s.updated_at
       from public.student_progress s where s.user_id=uid and s.course_id=p_course_id) r),'[]'::jsonb),
    'foundation',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select p.lesson_key,p.completed,p.checkpoint,p.completed_at,p.updated_at
       from public.typing_foundation_progress p where p.course_id=p_course_id and p.learner_key='google:'||uid::text) r),'[]'::jsonb),
    'awards',coalesce((select jsonb_agg(to_jsonb(r) order by r.awarded_at,r.id) from
      (select w.id,a.session_id,coalesce(g.display_name,v.document->>'title') as title,w."grade",w.total,w.correct,
       coalesce((to_jsonb(w)->>'half_units')::integer,2) as half_units,w.awarded_at
       from public.quiz_leaf_awards w join public.quiz_attempts a on a.id=w.attempt_id
       join public.quiz_sessions s on s.id=a.session_id join public.quiz_versions v on v.id=s.version_id
       left join public.quiz_generated_papers g on g.session_id=s.id
       where w.user_id=uid and w."grade"=substring(p_course_id from 6 for 1)::integer and s.school_year=115) r),'[]'::jsonb),
    'past_flowers',coalesce((select jsonb_agg(to_jsonb(r) order by r.awarded_at,r.id) from
      (select 'past:'||l.id::text as id,p.title,l.awarded_at
       from public.quiz_past_leaves l join public.quiz_past_attempts a on a.id=l.attempt_id
       join public.quiz_past_papers p on p.id=l.paper_id
       where l.user_id=uid and l.school_year=115 and l.semester=1
       and p."grade"=substring(p_course_id from 6 for 1)::integer) r),'[]'::jsonb),
    'assignments',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select a.id,a.course_id,a.week_code,a.title,
        (select jsonb_build_object('status',s.status,'submitted_at',s.submitted_at,'reviewed_at',s.reviewed_at)
         from public.homework_submissions s join public.homework_uploads u on u.id=s.upload_id
         where s.assignment_id=a.id and s.user_id=uid) as submission
       from public.homework_assignments a where p_course_id='grade6-115-1' and a.course_id=p_course_id
       and a.state<>'draft' and a.class_code in ('*',cls)) r),'[]'::jsonb),
    'periods',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select p.id,p.course_id,p.week_code,
        (select jsonb_build_object('status',v.status,'submitted_at',v.submitted_at,'reviewed_at',v.reviewed_at)
         from public.reading_submissions s join public.reading_versions v on v.id=s.version_id
         where s.period_id=p.id and s.user_id=uid) as submission
       from public.reading_periods p where p_course_id='grade6-115-1' and p.course_id=p_course_id
       and p.starts_on<=(statement_timestamp() at time zone 'Asia/Taipei')::date
       and (p.enabled or exists(select 1 from public.reading_submissions s where s.period_id=p.id and s.user_id=uid))) r),'[]'::jsonb),
    'rehearsal',coalesce((select jsonb_build_object('leaves',t.leaves,'flowers',t.flowers,'setup_id',to_jsonb(t)->>'setup_id')
      from public.garden_test_setup t join auth.users u on u.id=t.user_id
      where t.user_id=uid and t.course_id=p_course_id and p_course_id='grade3-115-1'
      and lower(u.email)='chianwu@apps.ntpc.edu.tw' and u.email_confirmed_at is not null),'null'::jsonb))`;
  const vars={
    p_course_id:'(select course from input)',p_payload:'(select payload from input)',
    grade:'substring((select course from input) from 6 for 1)',yr:'115',cls:'(select class_code from input)',
    seat:'(select seat_no from input)',uid:'(select uid from learner)',identity:'(select identity from learner)',
    lim:"coalesce(((select payload from input)->>'limit')::integer,20)",offst:"coalesce(((select payload from input)->>'offset')::integer,0)",
    search:"coalesce((select payload from input)->>'search','')",selected_subject:"coalesce((select payload from input)->>'subject','')",
    selected_state:"coalesce((select payload from input)->>'state','all')",p_user:'(select uid from learner)',p_year:'115',p_class:'(select class_code from input)',
    doc:'(select document from selected_version)',version_no:'(select revision from selected_version)',
  };
  const rewrite=sql=>sql.replace(/public\.admin_learning_paper_rows\(uid,yr,cls\)/g,'paper_rows')
    .replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\b(?:prog|att|sess)\.[a-z_]+\b|\b[a-z_][a-z_0-9]*\b/gi,word=>{
      if(word.startsWith("'")||word.startsWith('"'))return word;
      if(word.startsWith('prog.'))return `(select ${word.slice(5)} from selected_progress)`;
      if(word.startsWith('att.'))return `(select ${word.slice(4)} from selected_attempt)`;
      if(word.startsWith('sess.'))return `(select ${word.slice(5)} from selected_session)`;
      return vars[word]||word;
    });
  return function build(action,catalogSql){
    if(action==='garden_status'){
      // Only SELECTs; never call growth/companions, whose "get" also writes.
      // Inline only validated VALUES from the canonical catalog definition.
      // The dedicated read-only role cannot execute the private catalog function.
      if(!catalogSql)throw new Error('readonly_contract_changed');
      return `with reward_snapshot as (${build('rewards')}), garden_catalog(item_key,label,pet,home,leaves,flowers,portrait) as (${catalogSql}), principal as (
        select min(u.id::text)::uuid as uid from public.student_enrollments e join auth.users u
          on lower(u.email)=e.email and u.email_confirmed_at is not null
        where e.school_year=115 and e.class_code=$2 and e.seat_no=$3 having count(*)=1
      ) select result||case when result->'identity'->>'mapping'='linked' then jsonb_build_object('garden',jsonb_build_object(
        'growth',(select jsonb_build_object('grown_at',g.grown_at,'seen_at',g.seen_at,'baseline',g.baseline,
          'reward_version',coalesce((to_jsonb(g)->>'reward_version')::integer,1),
          'leaf_floor',coalesce((to_jsonb(g)->>'leaf_floor')::integer,44),
          'flower_floor',coalesce((to_jsonb(g)->>'flower_floor')::integer,10))
          from public.garden_growth g where g.user_id=(select uid from principal) and g.course_id=$1),
        'has_growth',exists(select 1 from public.garden_growth g where g.user_id=(select uid from principal)),
        'legacy_pet',exists(select 1 from public.garden_growth g where g.user_id=(select uid from principal) and g.pet_unlocked_at is not null),
        'catalog',coalesce((select jsonb_agg(jsonb_build_object('key',c.item_key,'label',c.label,'pet',c.pet,'home',c.home,
          'leaves',c.leaves,'flowers',c.flowers) order by c.leaves,c.item_key) from garden_catalog c),'[]'::jsonb),
        'unlocks',coalesce((select jsonb_agg(jsonb_build_object('key',u.item_key,'course_id',u.course_id,'unlocked_at',u.unlocked_at))
          from public.garden_item_unlocks u where u.user_id=(select uid from principal)),'[]'::jsonb)))
        else '{}'::jsonb end as result from reward_snapshot`;
    }
    if(action==='class_rewards'){
      // One statement and one snapshot for the entire roster. Reuse the exact
      // individual projection for each seat, without one cloud request per pupil.
      const individual=build('garden_status',catalogSql).replaceAll('$3','roster_students.seat_no');
      return `with roster_students as (
        select e.class_code,e.seat_no,e.display_name,e.class_code||lpad(e.seat_no::text,2,'0') as student_code,
          (select count(*) from auth.users u where lower(u.email)=e.email and u.email_confirmed_at is not null) as mappings
        from public.student_enrollments e where e.school_year=115 and e.class_code=$2::text
          and left(e.class_code,1)=substring($1::text from 6 for 1) and $3::integer is null
      ) select jsonb_build_object('class_code',$2::text,'total',count(*),'as_of',statement_timestamp(),
        'read_source','cloud-readonly','items',coalesce(jsonb_agg(jsonb_build_object(
          'class_code',roster_students.class_code,'seat_no',roster_students.seat_no,
          'display_name',roster_students.display_name,'student_code',roster_students.student_code,
          'mappings',roster_students.mappings,'rewards',reward_data.result) order by roster_students.seat_no),'[]'::jsonb)) as result
        from roster_students cross join lateral (${individual}) reward_data`;
    }
    if(!projections[action])throw new Error('invalid_action');
    const ctes=`with input as (select $1::text as course,$2::text as class_code,$3::integer as seat_no,$4::jsonb as payload),
      binding as (select e.class_code,e.seat_no,e.display_name,count(u.id)::integer as mappings,min(u.id::text)::uuid as uid
       from public.student_enrollments e left join auth.users u on lower(u.email)=e.email and u.email_confirmed_at is not null
       where e.school_year=115 and e.class_code=$2 and e.seat_no=$3 group by e.class_code,e.seat_no,e.display_name),
      learner as (select uid,jsonb_build_object('school_year',115,'class_code',class_code,'seat_no',seat_no,'display_name',display_name,
       'mapping',case when mappings=1 then 'linked' when mappings=0 then 'unlinked' else 'conflict' end) as identity from binding),
      paper_rows(${columns.join(',')}) as materialized (${rewrite(helper)}),
      selected_progress as (select p.* from public.typing_foundation_progress p where p.course_id=$1
       and p.learner_key='google:'||(select uid::text from learner) and p.id=nullif($4::jsonb->>'progress_id','')::uuid),
      selected_session as (select s.* from public.quiz_sessions s join paper_rows r on r.session_id=s.id where s.id=nullif($4::jsonb->>'session_id','')::uuid),
      selected_attempt as (select a.* from public.quiz_attempts a where a.session_id=(select id from selected_session) and a.user_id=(select uid from learner)),
      selected_version as (select v.document,v.revision from public.quiz_versions v where v.id=(select version_id from selected_session))`;
    const query=`(select result from (${rewrite(projections[action])}) selected_result(result))`;
    const guarded=action==='roster'?query:`case
      when not exists(select 1 from learner) then jsonb_build_object('__error','student_unavailable')
      when (select identity->>'mapping' from learner)<>'linked' then jsonb_build_object('identity',(select identity from learner),'items','[]'::jsonb,'total',0)
      ${action==='typing_events'?"when not exists(select 1 from selected_progress) then jsonb_build_object('__error','progress_unavailable')":''}
      ${['paper','media'].includes(action)?"when not exists(select 1 from selected_session) then jsonb_build_object('__error','paper_unavailable') when (select document->>'schema' from selected_version)<>'1' then jsonb_build_object('__error','unsupported_document')":''}
      else ${query} end`;
    const pageMeta=action==='profile'?'':",'offset',coalesce(($4::jsonb->>'offset')::integer,0),'limit',coalesce(($4::jsonb->>'limit')::integer,20)";
    const sql=`${ctes} select (${guarded})||jsonb_build_object('as_of',statement_timestamp(),'read_source','cloud-readonly'${pageMeta}${action==='roster'?'':",'identity',(select identity from learner)"}) as result`;
    // Fail closed if future candidate edits add a mutating statement or a public
    // function call to a projection. Quoted strings are data, not SQL keywords.
    const code=sql.replace(/'(?:''|[^'])*'/g,"''");
    if(/\b(insert|update|delete|create|alter|drop|truncate|grant|revoke|call|do|set)\b/i.test(code)||/public\.[a-z_]+\s*\(/i.test(code))throw new Error('readonly_contract_changed');
    return sql;
  };
}

export async function createLearningReadOnlyReader({query=managementRead}={}){
  const build=compileLearningReads(await readFile(new URL('../../supabase/admin_learning.sql',import.meta.url),'utf8'));
  let catalogPromise=null;
  const catalog=()=>catalogPromise??=(query("select pg_get_functiondef('public.garden_item_catalog()'::regprocedure) as definition",[])
    .then(rows=>compileGardenCatalog(rows?.[0]?.definition)).catch(error=>{catalogPromise=null;throw error;}));
  return async body=>{
    const {p_action:action,p_course_id:course,p_payload:payload}=body;
    if(!['grade3-115-1','grade6-115-1'].includes(course)||!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('invalid_request');
    const keys=['class_code','seat_no','search','limit','offset','progress_id','session_id','revision','filter','subject','state',...(action==='media'?['url']:[])];
    if(Object.keys(payload).some(k=>!keys.includes(k)))throw new Error('invalid_request');
    const cls=payload.class_code||null,seat=payload.seat_no==null?null:Number(payload.seat_no),grade=course[5];
    if(cls&&(!/^[36]\d{2}$/.test(cls)||cls[0]!==grade))throw new Error('invalid_class');
    if(action==='class_rewards'&&(!cls||Object.keys(payload).some(k=>k!=='class_code')))throw new Error('invalid_class');
    if(!['roster','class_rewards'].includes(action)&&(!cls||!Number.isInteger(seat)||seat<1||seat>99))throw new Error('student_required');
    if(!Number.isInteger(payload.limit??20)||(payload.limit??20)<1||(payload.limit??20)>50||!Number.isInteger(payload.offset??0)||(payload.offset??0)<0||(payload.offset??0)>100000)throw new Error('invalid_page');
    if(typeof(payload.search??'')!=='string'||(payload.search?.length??0)>80||typeof(payload.subject??'')!=='string'||(payload.subject?.length??0)>80)throw new Error('invalid_request');
    if(!['all','wrong'].includes(payload.filter??'all')||!['all','unstarted','in_progress','completed','hidden'].includes(payload.state??'all'))throw new Error('invalid_request');
    for(const key of ['progress_id','session_id'])if(payload[key]&&!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(payload[key]))throw new Error('invalid_request');
    if(payload.revision!=null&&(!Number.isInteger(payload.revision)||payload.revision<1))throw new Error('invalid_revision');
    if(action==='media'&&!/^https:\/\/quiz-media\.invalid\/[0-9a-f-]{36}\/[0-9a-f]{64}$/.test(payload.url||''))throw new Error('invalid_request');
    const rows=await query(build(action,['garden_status','class_rewards'].includes(action)?await catalog():undefined),[course,cls,seat,JSON.stringify(payload)]);const result=rows?.[0]?.result;
    if(!result||typeof result!=='object')throw new Error('live_reader_unavailable');
    if(result.__error)throw new Error(result.__error);return result;
  };
}
