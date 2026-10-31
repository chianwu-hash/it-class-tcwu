// Export only garden collector inputs, anonymized in the READ ONLY SQL itself.
// No OAuth tokens, student names/emails, answers, uploads or reading content.
import fs from 'node:fs/promises';import path from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const out=path.resolve('D:/projects/it-class-tcwu/automation/output/effort-prerelease-audit-20261031');await fs.mkdir(out,{recursive:true});
const sql=`begin isolation level repeatable read read only;
set local statement_timeout='20s';set local lock_timeout='2s';
with ids as(select user_id id from public.student_progress union select user_id from public.garden_growth),
u as(select a.id real_id,md5('garden-audit-20261031:'||a.id::text)::uuid id,coalesce((select left(e.class_code,1) from public.student_enrollments e where e.email=lower(a.email) and e.school_year=115 limit 1),'0') grade,a.email_confirmed_at confirmed_at from auth.users a join ids on ids.id=a.id),
aw as(
 select w.user_id, jsonb_build_object('id',w.id,'grade',w.grade,'half_units',2) a,w.awarded_at t from public.quiz_leaf_awards w
 union all select l.user_id,jsonb_build_object('id','past:'||l.id,'grade',p.grade,'source_type','past_exam','half_units',2),l.awarded_at from public.quiz_past_leaves l join public.quiz_past_papers p on p.id=l.paper_id
)
select jsonb_build_object(
 'at',clock_timestamp(),
 'users',(select jsonb_agg(jsonb_build_object('id',id,'grade',grade,'confirmed_at',confirmed_at)) from u),
 'progress',(select jsonb_agg((to_jsonb(s)-'user_id')||jsonb_build_object('user_id',u.id)) from public.student_progress s join u on s.user_id=u.real_id),
 'catalog',(select jsonb_agg(to_jsonb(c)) from public.garden_reward_catalog c),
 'growth',(select jsonb_agg((to_jsonb(g)-'user_id')||jsonb_build_object('user_id',u.id)) from public.garden_growth g join u on g.user_id=u.real_id),
 'skins',(select jsonb_agg((to_jsonb(g)-'user_id')||jsonb_build_object('user_id',u.id)) from public.garden_tree_skins g join u on g.user_id=u.real_id),
 'notices',(select jsonb_agg((to_jsonb(g)-'user_id')||jsonb_build_object('user_id',u.id)) from public.garden_unlock_notices g join u on g.user_id=u.real_id),
 'test_setup',(select jsonb_agg((to_jsonb(g)-'user_id')||jsonb_build_object('user_id',u.id)) from public.garden_test_setup g join u on g.user_id=u.real_id),
 'rewards',(select jsonb_agg(jsonb_build_object('user_id',u.id,'awards',(select coalesce(jsonb_agg(a order by t,a->>'id'),'[]') from aw where aw.user_id=u.real_id))) from u),
 'foundation',(select jsonb_agg(jsonb_build_object('user_id',u.id,'course_id',c,'data',(select coalesce(jsonb_agg(jsonb_build_object('lesson_key',p.lesson_key,'completed',p.completed)),'[]') from public.typing_foundation_progress p where p.learner_key='google:'||u.real_id::text and p.course_id=c))) from u cross join unnest(array['grade3-115-1','grade6-115-1']) c),
 'homework',(select jsonb_agg(jsonb_build_object('user_id',u.id,'data',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'course_id',a.course_id,'week_code',a.week_code,'submission',case when s.user_id is not null then jsonb_build_object('status',s.status) else null end)),'[]') from public.homework_assignments a left join public.homework_submissions s on s.assignment_id=a.id and s.user_id=u.real_id where a.state<>'draft' and (a.class_code='*' or a.class_code=(select e.class_code from public.student_enrollments e join auth.users au on lower(au.email)=e.email where au.id=u.real_id and e.school_year=115 limit 1))))) from u where grade='6'),
 'reading',(select jsonb_agg(jsonb_build_object('user_id',u.id,'data',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'course_id',r.course_id,'week_code',r.week_code,'submission',case when v.id is not null then jsonb_build_object('status',v.status) else null end)),'[]') from public.reading_periods r left join public.reading_submissions s on s.period_id=r.id and s.user_id=u.real_id left join public.reading_versions v on v.id=s.version_id where r.starts_on<=(now() at time zone 'Asia/Taipei')::date and (r.enabled or s.user_id is not null)))) from u where grade='6')
) snapshot;
commit;`;
await fs.writeFile(out+'/read-only-anonymous.sql',sql);
const {stdout}=await promisify(execFile)('pwsh',['-NoProfile','-NonInteractive','-File','D:/local-bin/supabase-personal.ps1','db','query','--linked','--project-ref','upxgyusodibaqcrocdzj','--file',out+'/read-only-anonymous.sql','--output','json'],{windowsHide:true,timeout:45000,maxBuffer:8e6});
const r=JSON.parse(stdout.slice(stdout.indexOf('{'))),data=r.rows?.find(x=>x.snapshot)?.snapshot;if(!data?.users)throw Error('missing_snapshot');
// Fail closed if a source starts exporting a personal-information field.
if(/"(?:email|display_name|file_name|feedback|access_token|refresh_token)"\s*:/i.test(JSON.stringify(data)))throw Error('unexpected_personal_field');
await fs.writeFile(out+'/collector-inputs.anonymous.private.json',JSON.stringify(data));console.log(JSON.stringify({readOnly:true,anonymous:true,counts:Object.fromEntries(Object.entries(data).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,v.length]))}));
