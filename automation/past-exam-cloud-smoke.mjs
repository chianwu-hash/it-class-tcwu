import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import {randomUUID} from 'node:crypto';
const dir='automation/output/past-exam-production/cloud',project='upxgyusodibaqcrocdzj',b=JSON.parse(fs.readFileSync('automation/output/past-exam-production/bundle.private.json','utf8'));
const lit=s=>"'"+s.replaceAll("'","''")+"'",json=v=>lit(JSON.stringify(v))+'::jsonb';
const all=target=>{let left=target;return b.document.groups.map(g=>({group_id:g.id,request_id:randomUUID(),confirmed:true,responses:g.fields.map(f=>{if(g.kind==='annotation')return {questionId:f.id,value:{mediaSha256:g.assets[0].sha256,point:{x:.4,y:.3},arrow:{from:{x:.4,y:.3},to:{x:.4,y:.6}}}};const ok=left>=f.points;if(ok)left-=f.points;const wrong=g.kind==='single'||g.kind==='code'?g.choices.find(c=>c.id!==f.answer).id:g.kind==='mark'?!f.answer:g.kind==='sequence'?[...f.answer].reverse():[g.codes.find(c=>!f.answer.includes(c))];return {questionId:f.id,value:ok?f.answer:wrong};})}));};
let sql=`begin;
create temporary table past_exam_release_smoke(result jsonb);
do $$declare uid uuid;aid uuid;ver uuid;s jsonb;p jsonb;initial_count integer;begin
select u.id into uid from auth.users u join public.student_enrollments e on e.email=lower(u.email) and e.school_year=115 where e.class_code like '3%' and u.email_confirmed_at is not null limit 1;
if uid is null then raise exception 'no_grade3_identity';end if;
perform set_config('request.jwt.claim.sub',uid::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
if coalesce(public.is_teacher(),false) then raise exception 'student_identity_required';end if;
select count(*) into initial_count from public.quiz_past_leaves where user_id=uid and paper_id=${lit(b.paperId)};
if initial_count<>0 then raise exception 'unexpected_existing_award';end if;
if not has_function_privilege('authenticated','public.quiz_past_action(text,jsonb)','EXECUTE') or has_function_privilege('anon','public.quiz_past_action(text,jsonb)','EXECUTE') then raise exception 'rpc_grants';end if;
if has_table_privilege('authenticated','public.quiz_past_answers','SELECT') then raise exception 'table_grants';end if;
update public.quiz_past_papers set enabled=true where id=${lit(b.paperId)};
select active_version into ver from public.quiz_past_papers where id=${lit(b.paperId)};
`;
for(const score of [55,56,92]){
 sql+=`s:=public.quiz_past_action('restart',jsonb_build_object('paper_id',${lit(b.paperId)},'request_id',${lit(randomUUID())}));aid:=(s->>'attemptId')::uuid;
for p in select value from jsonb_array_elements(${json(all(score))}) loop
 perform public.quiz_past_action('view',jsonb_build_object('paper_id',${lit(b.paperId)},'attempt_id',aid,'group_id',p->>'group_id'));
 update public.quiz_past_views set started_at=clock_timestamp()-interval '2 minutes' where attempt_id=aid and group_id=p->>'group_id';
 s:=public.quiz_past_action('submit',p||jsonb_build_object('paper_id',${lit(b.paperId)},'attempt_id',aid,'version',ver));
end loop;
if (s#>>'{summary,score}')::numeric<>${score} or (s#>>'{practice,leafCount}')::int<>${score<56?0:1} or s#>>'{practice,complete}'<>'true' then raise exception 'score_or_award_mismatch';end if;
insert into past_exam_release_smoke values(jsonb_build_object('score',s#>'{summary,score}','leaves',s#>'{practice,leafCount}','complete',s#>'{practice,complete}'));
`;
}
sql+=`if (select count(*) from public.quiz_past_leaves where user_id=uid and paper_id=${lit(b.paperId)})<>1 then raise exception 'duplicate_leaf';end if;
end$$;
select jsonb_agg(result) checks from past_exam_release_smoke;
rollback;`;
fs.writeFileSync(dir+'/smoke-rollback.private.sql',sql);
function cli(args){try{const raw=execFileSync('pwsh',['-NoProfile','-NonInteractive','-Command','& supabase-personal '+args.map(a=>"'"+a.replaceAll("'","''")+"'").join(' ')],{encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']});return JSON.parse(raw.slice(raw.indexOf('{')));}catch(e){fs.writeFileSync(dir+'/smoke-error.private.txt',String(e.stderr||e.message));throw Error('cloud_smoke_failed');}}
const result=cli(['db','query','--linked','--project-ref',project,'--file',path.resolve(dir+'/smoke-rollback.private.sql'),'--output','json']);
const retained=cli(['db','query','--linked','--project-ref',project,"select (select count(*) from public.quiz_past_attempts) attempts,(select count(*) from public.quiz_past_answers) answers,(select count(*) from public.quiz_past_leaves) leaves,(select bool_or(enabled) from public.quiz_past_papers) enabled",'--output','json']).rows[0];
if(Number(retained.attempts)!==0||Number(retained.answers)!==0||Number(retained.leaves)!==0||retained.enabled!==false)throw Error('rollback_or_activation_mismatch');
fs.writeFileSync(dir+'/smoke.json',JSON.stringify({passed:true,checks:result.rows,retained,method:'Supabase PostgreSQL transaction rollback; no retained student work'},null,2));console.log(JSON.stringify({passed:true,retained}));
