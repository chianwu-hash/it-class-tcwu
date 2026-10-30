// Real PostgreSQL, all test writes roll back. Does not retain synthetic auth or answers.
import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import {randomUUID} from 'node:crypto';
const root='automation/output/past-exams-audio',out=root+'/cloud',read=f=>JSON.parse(fs.readFileSync(f,'utf8')),bundles=read(root+'/candidates.private.json').map(c=>read(root+'/'+c.paperId+'/bundle.private.json')),versions=read(out+'/registered.private.json').versions,project='upxgyusodibaqcrocdzj';
const lit=s=>"'"+s.replaceAll("'","''")+"'",json=v=>lit(JSON.stringify(v))+'::jsonb';
function query(sql,name){const args=['db','query','--linked','--project-ref',project];if(name){const file=path.resolve(out,name);fs.writeFileSync(file,sql);args.push('--file',file);}else args.push(sql);args.push('--output','json');try{const raw=execFileSync('pwsh',['-NoProfile','-NonInteractive','-Command','& supabase-personal '+args.map(lit).join(' ')],{encoding:'utf8',windowsHide:true,timeout:240000,maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});return JSON.parse(raw.slice(raw.indexOf('{'))).rows;}catch(e){fs.writeFileSync(out+'/smoke-error.private.txt',String(e.stderr||e.message));throw Error('audio_rollback_failed');}}
const digestSql="select name,count,digest from ("+['quiz_answers','quiz_versions','quiz_leaf_awards','student_progress','quiz_past_attempts','quiz_past_answers','quiz_past_receipts','quiz_past_leaves','quiz_past_views'].map(t=>`select ${lit(t)} name,count(*)::integer count,md5(coalesce(string_agg(row_to_json(t)::text,'' order by row_to_json(t)::text),'')) digest from public.${t} t`).join(' union all ')+') s order by name';
const before=query(digestSql);let sql='begin;create temporary table audio_smoke(result jsonb);';
for(const b of bundles){
 const old=read(root+'/'+b.paperId+'/before-bundle.private.json'),oldVersion=read(out+'/before-papers.private.json').find(p=>p.id===b.paperId).active_version,newVersion=versions[b.paperId];
 const packets=(doc,correct)=>doc.groups.map(g=>({group_id:g.id,request_id:randomUUID(),confirmed:true,responses:g.fields.map(f=>({questionId:f.id,value:g.kind==='manual'?{text:'交易回滾驗證，非學生實際作答',strokes:[],confirmed:true}:g.kind==='annotation'?{mediaSha256:g.assets[0].sha256,point:{x:.4,y:.3},arrow:{from:{x:.4,y:.3},to:{x:.4,y:.6}}}:g.kind==='short'?(correct?f.answer[0]:'__wrong__'):correct?f.answer:g.kind==='mark'?!f.answer:['single','code'].includes(g.kind)?g.choices.find(c=>c.id!==f.answer).id:g.kind==='sequence'?[...f.answer].reverse():[g.codes.find(c=>!f.answer.includes(c))]}))}));
 const max=b.document.groups.filter(g=>!['manual','annotation'].includes(g.kind)).flatMap(g=>g.fields).reduce((n,f)=>n+f.points,0),audio=b.document.groups[0].materialContent.media[0].url;
 sql+=`do $$declare uid uuid;aid uuid;oldaid uuid;s jsonb;p jsonb;begin
 select u.id into uid from auth.users u join public.student_enrollments e on e.email=lower(u.email) and e.school_year=115 where e.class_code like '${b.document.catalog.grade}%' and u.email_confirmed_at is not null and not exists(select 1 from public.quiz_past_attempts a where a.user_id=u.id and a.paper_id=${lit(b.paperId)}) limit 1;
 if uid is null then raise exception 'missing_unused_identity';end if;
 perform set_config('request.jwt.claim.sub',uid::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);if coalesce(public.is_teacher(),false) then raise exception 'student_required';end if;
 update public.quiz_past_papers set active_version=${lit(oldVersion)}::uuid where id=${lit(b.paperId)};
 s:=public.quiz_past_action('restart',jsonb_build_object('paper_id',${lit(b.paperId)},'request_id',${lit(randomUUID())}));oldaid:=(s->>'attemptId')::uuid;
 update public.quiz_past_papers set active_version=${lit(newVersion)}::uuid where id=${lit(b.paperId)};
 s:=public.quiz_past_action('resume',jsonb_build_object('paper_id',${lit(b.paperId)},'attempt_id',oldaid));if s->>'version'<>${lit(oldVersion)} then raise exception 'old_attempt_changed';end if;
 begin perform public.quiz_media_access(${lit(audio)},oldaid);raise exception 'unexpected_old_audio_access';exception when raise_exception then if sqlerrm<>'media_unavailable' then raise;end if;end;
 `;
 for(const correct of [false,true,true])sql+=`s:=public.quiz_past_action('restart',jsonb_build_object('paper_id',${lit(b.paperId)},'request_id',${lit(randomUUID())}));aid:=(s->>'attemptId')::uuid;
 if s->>'version'<>${lit(newVersion)} or (s::text like '%合成語音練習版%' is false) then raise exception 'new_version_required';end if;
 if public.quiz_media_access(${lit(audio)},aid)->>'mime'<>'audio/mpeg' then raise exception 'audio_permission';end if;
 for p in select value from jsonb_array_elements(${json(packets(b.document,correct))}) loop
 perform public.quiz_past_action('view',jsonb_build_object('paper_id',${lit(b.paperId)},'attempt_id',aid,'group_id',p->>'group_id'));update public.quiz_past_views set started_at=clock_timestamp()-interval '2 minutes' where attempt_id=aid and group_id=p->>'group_id';
 s:=public.quiz_past_action('submit',p||jsonb_build_object('paper_id',${lit(b.paperId)},'attempt_id',aid,'version',${lit(newVersion)}));end loop;
 if s#>>'{practice,complete}'<>'true' or (s#>>'{summary,score}')::numeric<>${correct?max:0} or (s#>>'{summary,max}')::numeric<>${max} or (s#>>'{practice,leafCount}')::integer<>${correct?1:0} then raise exception 'score_leaf_completion';end if;
 `;
 sql+=`aid:=oldaid;for p in select value from jsonb_array_elements(${json(packets(old.document,true))}) loop
 perform public.quiz_past_action('view',jsonb_build_object('paper_id',${lit(b.paperId)},'attempt_id',aid,'group_id',p->>'group_id'));update public.quiz_past_views set started_at=clock_timestamp()-interval '2 minutes' where attempt_id=aid and group_id=p->>'group_id';s:=public.quiz_past_action('submit',p||jsonb_build_object('paper_id',${lit(b.paperId)},'attempt_id',aid,'version',${lit(oldVersion)}));end loop;
 if (s#>>'{practice,leafCount}')::integer<>1 or jsonb_array_length(s#>'{practice,history}')<>4 or s->>'version'<>${lit(oldVersion)} then raise exception 'cross_version_leaf_or_history';end if;
 insert into audio_smoke values(jsonb_build_object('paper',${lit(b.paperId)},'passed',true,'max',${max},'leaves','0-1-1','history',4,'oldAttemptPinned',true,'crossVersionAwardOnce',true,'audioAuth',true));end$$;`;
}
sql+='select jsonb_agg(result) checks from audio_smoke;rollback;';const checks=query(sql,'smoke-rollback.private.sql');const after=query(digestSql);if(JSON.stringify(before)!==JSON.stringify(after))throw Error('student_rows_changed');fs.writeFileSync(out+'/smoke.private.json',JSON.stringify({passed:true,papers:4,checks,studentRowsUnchanged:true,rollback:true,at:new Date().toISOString()},null,2));console.log(JSON.stringify({passed:true,papers:4,rollback:true,studentRowsUnchanged:true}));
