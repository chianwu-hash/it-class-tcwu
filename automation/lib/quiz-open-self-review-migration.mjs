import {createHash} from 'node:crypto';
const md5=s=>createHash('md5').update(s).digest('hex');
const signatures={quiz_validate:'jsonb',quiz_student_document:'jsonb,jsonb,jsonb',quiz_action_before_learning:'text,jsonb',quiz_leaf_result_before_learning:'uuid,boolean',quiz_library_sessions:'jsonb',quiz_monitor_before_learning:'jsonb',quiz_paper_card:'uuid',quiz_media_visible:'text,uuid',quiz_wrong_questions_before_learning:'jsonb',quiz_wrong_refs:'integer,text,text',quiz_compose:'jsonb'};
const change=(s,a,b,n=1)=>{if(s.split(a).length!==n+1)throw Error('open_review_source_changed: '+a.slice(0,90));return s.split(a).join(b);};

export function openSelfReviewChanges(definitions){
 return Object.entries(signatures).map(([name,args])=>{
  const matches=definitions.filter(d=>d.proname===name);if(matches.length!==1)throw Error('open_review_definition_missing: '+name);
  const before=matches[0].definition;let after=before.replaceAll('\r\n','\n');
  if(name==='quiz_validate'){
   after=change(after,"elsif q->>'type'='fields' then perform public.quiz_fields_validate(q);","elsif q->>'type'='fields' then perform public.quiz_fields_validate(q);\n   elsif q->>'type'='open' then perform public.quiz_open_validate(q);");
   after=change(after,"not(k='fields' and q->>'type'='fields')","not(k='fields' and q->>'type' in('fields','open'))");
  }else if(name==='quiz_student_document'){
   after=change(after,"case when q->>'type'='fields' then jsonb_build_object('fields'","case when q->>'type' in('fields','open') then jsonb_build_object('fields'");
  }else if(name==='quiz_action_before_learning'){
   after=change(after,'correct_map jsonb; prior_lock_timeout','correct_map jsonb; completed_map jsonb; open_state jsonb; open_row public.quiz_open_responses; prior_lock_timeout');
   after=change(after,"compact boolean:=p_action='submit' and","compact boolean:=p_action in('submit','self_check') and");
   after=change(after,"('library_sessions','join','resume','submit','view_question')","('library_sessions','join','resume','submit','self_check','view_question')");
   after=change(after,"('join','resume','submit','view_question')","('join','resume','submit','self_check','view_question')");
   after=change(after,"p_action in ('join','submit')","p_action in ('join','submit','self_check')",2);
   after=change(after,'left join public.quiz_answers x on x.attempt_id=a.id','left join lateral public.quiz_response_rows(a.id) x on x.completed');
   after=change(after,'from public.quiz_answers x where x.attempt_id=a.id','from public.quiz_response_rows(a.id) x where x.completed',2);
   const next="not exists(select 1 from public.quiz_answers a where a.attempt_id=att.id and a.question_id=x.value#>>'{}')";
   const nextCompleted="not exists(select 1 from public.quiz_response_rows(att.id) a where a.completed and a.question_id=x.value#>>'{}')";
   after=change(after,next,nextCompleted,2);
   after=change(after,"if p_action='submit' then\n  qid:=","if p_action in('submit','self_check') then\n  qid:=");
   const anchor="  select * into ans from public.quiz_answers where attempt_id=att.id and (question_id=qid or request_id=(p_data->>'request_id')::uuid) limit 1;";
   after=change(after,anchor,`  if q->>'type'='open' then
   select * into open_row from public.quiz_open_responses where attempt_id=att.id and question_id=qid;
   if open_row.attempt_id is null or(p_action='self_check' and open_row.status<>'self_checked') then
    if sess.status<>'open' then raise exception 'session_closed';end if;
    select value#>>'{}' into cls from jsonb_array_elements(att.question_order) with ordinality x(value,ord) where ${nextCompleted} order by ord limit 1;
    if cls is distinct from qid then raise exception 'question_order';end if;
    if p_action='submit' and to_regprocedure('public.quiz_answer_guard(uuid,text,boolean)') is not null then
     result:=public.quiz_answer_guard(att.id,qid,true);if result ? 'warning' then return result;end if;
    end if;
   end if;
   new_answer:=public.quiz_open_submit(att.id,q,p_data,p_action='self_check');
  elsif p_action='self_check' then raise exception 'invalid_question_type';
  else
   if exists(select 1 from public.quiz_open_responses where attempt_id=att.id and(request_id=(p_data->>'request_id')::uuid or self_check_request_id=(p_data->>'request_id')::uuid)) then raise exception 'submission_conflict';end if;
${anchor}`);
   after=change(after,"   new_answer:=true;\n  end if;\n end if;","   new_answer:=true;\n  end if;\n  end if;\n end if;");
   const summary=" select count(*)=jsonb_array_length(att.question_order),coalesce(jsonb_object_agg(a.question_id,a.response),'{}'),coalesce(jsonb_object_agg(a.question_id,a.correct),'{}') into done,responses,correct_map from public.quiz_answers a where a.attempt_id=att.id;";
   after=change(after,summary,` select count(*)filter(where a.completed)=jsonb_array_length(att.question_order),coalesce(jsonb_object_agg(a.question_id,a.response),'{}'),coalesce(jsonb_object_agg(a.question_id,a.correct),'{}'),coalesce(jsonb_object_agg(a.question_id,a.completed),'{}') into done,responses,correct_map,completed_map from public.quiz_response_rows(att.id) a;
 select coalesce(jsonb_object_agg(question_id,jsonb_build_object('status',status,'rating',self_rating,'note',self_note)),'{}') into open_state from public.quiz_open_responses where attempt_id=att.id;`);
   const oldReview=` for b in select value from jsonb_array_elements(d->'blocks') loop
  select not exists(select 1 from jsonb_array_elements(b->'questions') x where not(responses ? (x->>'id'))) into groupdone;
  if (sess.reveal='complete' and done) or (sess.reveal='immediate' and groupdone) then
   for q in select value from jsonb_array_elements(b->'questions') loop
    reviews:=reviews||jsonb_build_array(jsonb_build_object('question_id',q->>'id','answer',q->'answer','explanation',q->'explanation','correct',correct_map->(q->>'id')));
   end loop;
  end if;
 end loop;`;
   after=change(after,oldReview,` for b in select value from jsonb_array_elements(d->'blocks') loop
  select not exists(select 1 from jsonb_array_elements(b->'questions') x where not coalesce((completed_map->>(x->>'id'))::boolean,false)) into groupdone;
  for q in select value from jsonb_array_elements(b->'questions') loop
   if q->>'type'='open' and responses ? (q->>'id') then
    reviews:=reviews||jsonb_build_array(jsonb_build_object('question_id',q->>'id','answer',q->'answer','explanation',q->'explanation','correct',null,'assessment',open_state->(q->>'id')));
   elsif q->>'type'<>'open' and((sess.reveal='complete' and done) or(sess.reveal='immediate' and groupdone)) then
    reviews:=reviews||jsonb_build_array(jsonb_build_object('question_id',q->>'id','answer',q->'answer','explanation',q->'explanation','correct',correct_map->(q->>'id')));
   end if;
  end loop;
 end loop;`);
   after=change(after," if compact then return result||jsonb_build_object('compact',true);end if;"," if exists(select 1 from jsonb_array_elements(d->'blocks') bx,lateral jsonb_array_elements(bx->'questions') qx where qx->>'type'='open') then result:=result||jsonb_build_object('open_responses',open_state);end if;\n if compact then return result||jsonb_build_object('compact',true);end if;");
  }else if(name==='quiz_leaf_result_before_learning'){
   after=change(after,' n:=jsonb_array_length(a.question_order);'," select count(*) into n from jsonb_array_elements(v.document->'blocks') bx,lateral jsonb_array_elements(bx->'questions') qx where qx->>'type'<>'open';");
   after=change(after,' if (select count(*) from public.quiz_answers where attempt_id=aid)<>n then'," if (select count(*) from public.quiz_response_rows(aid) where completed)<>jsonb_array_length(a.question_order) then");
   after=change(after,'t.accepted_seconds>=settings.min_seconds;',"t.accepted_seconds>=settings.min_seconds and exists(select 1 from jsonb_array_elements(v.document->'blocks') bx,lateral jsonb_array_elements(bx->'questions') qx where qx->>'id'=t.question_id and qx->>'type'<>'open');");
   after=change(after,"lateral jsonb_array_elements(b->'questions') q) x;","lateral jsonb_array_elements(b->'questions') q where q->>'type'<>'open') x;");
  }else if(name==='quiz_library_sessions'){
   after=change(after,'left join public.quiz_answers x on x.attempt_id=a.id','left join lateral public.quiz_response_rows(a.id) x on x.completed');
  }else if(name==='quiz_monitor_before_learning'){
   after=change(after,'select x.attempt_id,count(*) answered,max(x.created_at) last_submitted_at\n  from public.quiz_answers x join attempts a on a.id=x.attempt_id group by x.attempt_id','select a.id attempt_id,count(*) answered,max(x.created_at) last_submitted_at\n  from attempts a cross join lateral public.quiz_response_rows(a.id) x where x.completed group by a.id');
  }else if(name==='quiz_paper_card'){
   after=change(after,'join public.quiz_answers x on x.attempt_id=a.id','join lateral public.quiz_response_rows(a.id) x on x.completed',2);
  }else if(name==='quiz_media_visible'){
   after=change(after,'select count(*)=jsonb_array_length(att.question_order) into done from public.quiz_answers where attempt_id=att.id;','select count(*)=jsonb_array_length(att.question_order) into done from public.quiz_response_rows(att.id) where completed;');
   after=change(after,"not exists(select 1 from public.quiz_answers a where a.attempt_id=att.id and a.question_id=x->>'id')","not exists(select 1 from public.quiz_response_rows(att.id) a where a.completed and a.question_id=x->>'id')");
   after=change(after," for b in select value from jsonb_array_elements(d->'blocks') loop",` if exists(select 1 from jsonb_array_elements(d->'blocks') bx,lateral jsonb_array_elements(bx->'questions') qx
  where qx->>'type'='open' and exists(select 1 from public.quiz_open_responses r where r.attempt_id=att.id and r.question_id=qx->>'id')
  and exists(select 1 from jsonb_path_query(qx->'explanation','$.**.media[*].url') u where u#>>'{}'=p_url)) then return true;end if;
 for b in select value from jsonb_array_elements(d->'blocks') loop`);
  }else if(name==='quiz_wrong_questions_before_learning'){
   after=change(after,'(select count(*) from public.quiz_answers where attempt_id=att.id)','(select count(*) from public.quiz_response_rows(att.id) where completed)');
  }else if(name==='quiz_wrong_refs'){
   after=change(after,'select x.attempt_id,jsonb_object_agg(x.question_id,true) answered from public.quiz_answers x join owned a on a.id=x.attempt_id group by x.attempt_id','select a.id attempt_id,jsonb_object_agg(x.question_id,true) answered from owned a cross join lateral public.quiz_response_rows(a.id) x where x.completed group by a.id');
  }else if(name==='quiz_compose'){
   after=change(after,'from public.quiz_answers a join public.quiz_attempts at on at.id=a.attempt_id','from public.quiz_attempts at cross join lateral public.quiz_response_rows(at.id) a');
   after=change(after,'where at.user_id=uid and a.question_id is not null group by a.question_id','where at.user_id=uid and a.completed and a.question_id is not null group by a.question_id');
  }
  return {name,args,before,after,beforeHash:md5(before),afterHash:md5(after)};
 });
}

export function buildOpenSelfReviewMigration(definitions,helpers){
 const changes=openSelfReviewChanges(definitions);
 const helperGuards=[...helpers.matchAll(/create or replace function public\.(quiz_\w+)\(([^)]*)\)[\s\S]*?as \$(open_\w+)\$([\s\S]*?)\$\3\$;/g)].map(m=>({signature:m[1]+'('+m[2].split(',').map(a=>a.trim().split(/\s+/).at(-1)).join(',')+')',hash:md5(m[4])}));
 if(helperGuards.length!==3)throw Error('open_review_helpers_incomplete');
 const old=changes.map(c=>`md5(pg_get_functiondef('public.${c.name}(${c.args})'::regprocedure))='${c.beforeHash}'`).join(' and\n ');
 const current=changes.map(c=>`md5(pg_get_functiondef('public.${c.name}(${c.args})'::regprocedure))='${c.afterHash}'`).join(' and\n ');
 return `-- Generated from the reviewed production baseline; never replace another migration's wrappers.
begin;
set local lock_timeout='5s';
lock table public.quiz_versions,public.quiz_banks,public.quiz_question_pool in share row exclusive mode;
do $open_guard$
begin
 if not((${old})or(${current}))then raise exception 'open_review_baseline_changed';end if;
 if to_regclass('public.quiz_open_responses')is not null and not(${current})then raise exception 'open_review_partial_install';end if;
 if (${current})and to_regclass('public.quiz_open_responses')is null then raise exception 'open_review_table_missing';end if;
 if (${old})and(
  exists(select 1 from public.quiz_versions v where jsonb_path_exists(v.document,'$.blocks[*].questions[*] ? (@.type == "open")'))or
  exists(select 1 from public.quiz_banks b where jsonb_path_exists(b.draft,'$.blocks[*].questions[*] ? (@.type == "open")'))or
  exists(select 1 from public.quiz_question_pool p where p.question->>'type'='open')
 )then raise exception 'open_review_historical_type_present';end if;
 ${helperGuards.map(h=>`if to_regprocedure('public.${h.signature}')is not null then
  if(select md5(prosrc)from pg_proc where oid='public.${h.signature}'::regprocedure)<>'${h.hash}'then raise exception 'open_review_helper_changed';end if;
 elsif (${current})then raise exception 'open_review_helper_missing';end if;`).join('\n ')}
end $open_guard$;
${helpers}
${changes.map(c=>c.after+';').join('\n')}
notify pgrst,'reload schema';
commit;
`;
}
