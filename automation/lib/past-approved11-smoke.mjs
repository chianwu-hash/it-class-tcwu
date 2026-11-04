import {randomUUID} from 'node:crypto';
const lit=s=>"'"+s.replaceAll("'","''")+"'",json=v=>lit(JSON.stringify(v))+'::jsonb';
const values=(g,correct)=>g.fields.map(f=>({questionId:f.id,value:g.kind==='manual'?{text:'交易內驗證，非正式學生答案',strokes:[],confirmed:true}:g.kind==='annotation'?{mediaSha256:g.assets[0].sha256,point:{x:.4,y:.3},arrow:{from:{x:.4,y:.3},to:{x:.4,y:.6}}}:g.kind==='short'?(correct?f.answer[0]:'__wrong__'):correct?f.answer:g.kind==='mark'?!f.answer:['single','code'].includes(g.kind)?g.choices.find(c=>c.id!==f.answer).id:g.kind==='sequence'?[...f.answer].reverse():[g.codes.find(c=>!f.answer.includes(c))]}));
export function smokeSql(bundles,oldBundles,registered,before,{verifyNewMedia=false}={}){
 let sql='begin;create temporary table approved11_smoke(result jsonb);';
 for(const b of bundles){const pid=b.paperId,old=oldBundles.find(x=>x.paperId===pid),oldVersion=before.find(p=>p.id===pid).active_version,newVersion=registered.versions[pid],grade=Number(pid.split('-')[3].slice(1));
  const restart=()=>`s:=public.quiz_past_action('restart',jsonb_build_object('paper_id',${lit(pid)},'request_id',${lit(randomUUID())}));aid:=(s->>'attemptId')::uuid;`;
  const send=version=>`perform public.quiz_past_action('view',jsonb_build_object('paper_id',${lit(pid)},'attempt_id',aid,'group_id',p->>'group_id'));update public.quiz_past_views set started_at=clock_timestamp()-interval '2 minutes' where attempt_id=aid and group_id=p->>'group_id';s:=public.quiz_past_action('submit',p||jsonb_build_object('paper_id',${lit(pid)},'attempt_id',aid,'version',${lit(version)}));`;
  const packets=(doc,correct)=>doc.groups.map(g=>({group_id:g.id,request_id:randomUUID(),confirmed:true,responses:values(g,correct)}));
  const max=b.document.groups.filter(g=>!['manual','annotation'].includes(g.kind)).flatMap(g=>g.fields).reduce((n,f)=>n+f.points,0);
  const newMedia=b.assets.filter(a=>!old.assets.some(x=>x.hash===a.hash));
  const mediaSql=verifyNewMedia?newMedia.map(a=>`p:=public.quiz_media_access(${lit(a.url)},aid);if p->>'object_path'<>${lit(a.object_path)} or p->>'owner_id'<>${lit(a.owner_id)} or p->>'mime'<>${lit(a.mime)} then raise exception 'new_media_scope';end if;`).join(''):'';
  sql+=`do $$declare uid uuid;aid uuid;oldaid uuid;s jsonb;p jsonb;begin
   select u.id into uid from auth.users u join public.student_enrollments e on e.email=lower(u.email) and e.school_year=115 where e.class_code like '${grade}%' and u.email_confirmed_at is not null and not exists(select 1 from public.quiz_past_attempts a where a.user_id=u.id and a.paper_id=${lit(pid)}) limit 1;
   if uid is null then raise exception 'unused_identity_required';end if;perform set_config('request.jwt.claim.sub',uid::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);if coalesce(public.is_teacher(),false) then raise exception 'student_required';end if;
   update public.quiz_past_papers set active_version=${lit(oldVersion)}::uuid where id=${lit(pid)};${restart()}oldaid:=aid;
   update public.quiz_past_papers set active_version=${lit(newVersion)}::uuid where id=${lit(pid)};s:=public.quiz_past_action('resume',jsonb_build_object('paper_id',${lit(pid)},'attempt_id',oldaid));if s->>'version'<>${lit(oldVersion)} then raise exception 'old_version_pinning';end if;`;
  for(const correct of [false,true,true])sql+=`${restart()}${correct?'':mediaSql}for p in select value from jsonb_array_elements(${json(packets(b.document,correct))}) loop ${send(newVersion)}end loop;if s#>>'{practice,complete}'<>'true' or (s#>>'{summary,score}')::numeric<>${correct?max:0} or (s#>>'{summary,max}')::numeric<>${max} or (s#>>'{practice,leafCount}')::integer<>${correct?1:0} then raise exception 'score_leaf_completion';end if;`;
  sql+=`aid:=oldaid;for p in select value from jsonb_array_elements(${json(packets(old.document,true))}) loop ${send(oldVersion)}end loop;if s->>'version'<>${lit(oldVersion)} or s#>>'{practice,complete}'<>'true' or (s#>>'{practice,leafCount}')::integer<>1 or jsonb_array_length(s#>'{practice,history}')<>4 then raise exception 'cross_version_history';end if;
   insert into approved11_smoke values(jsonb_build_object('paperId',${lit(pid)},'passed',true,'max',${max},'history',4,'leaves','0-1-1','oldAttemptPinned',true));end$$;`;
 }
 return sql+'select jsonb_agg(result) checks from approved11_smoke;rollback;';
}
