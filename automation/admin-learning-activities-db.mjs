// Apply only the reviewed teacher-read migration; exercise it in a rollback first.
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const apply=process.argv.includes('--apply');
if(!apply&&!process.argv.includes('--rollback'))throw Error('Use --rollback or explicitly authorized --apply');
const out=path.resolve('automation/output/admin-learning-activities-20261105');await fs.mkdir(out,{recursive:true});
const migration=await fs.readFile('supabase/admin-learning-activities.sql','utf8');
const audit=`
 create temp table learning_before(t text primary key,digest text) on commit drop;
 create temp table learning_checks(grade text,roster integer,past integer,extensions integer,detail_checks integer,garden boolean) on commit drop;
 do $audit$ declare t text;u uuid;g text;course text;roster jsonb;who jsonb;papers jsonb;p jsonb;detail jsonb;wrong jsonb;r record;one jsonb;past_n integer;ext_n integer;checked integer;asset_url text;begin
  foreach t in array array['student_enrollments','student_progress','typing_foundation_progress','typing_foundation_events','typing_foundation_resets','quiz_attempts','quiz_answers','quiz_past_attempts','quiz_past_answers','quiz_past_receipts','quiz_generated_papers','quiz_learning_sessions','quiz_learning_credits','quiz_learning_leaves','quiz_leaf_awards','garden_growth','garden_item_unlocks'] loop
   execute format($digest$insert into learning_before select %L,md5(coalesce(string_agg(md5(to_jsonb(x)::text),'' order by md5(to_jsonb(x)::text)),'')) from public.%I x$digest$,t,t);
  end loop;
  select id into strict u from auth.users where lower(email)='chianwu@gmail.com';
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'email','chianwu@gmail.com','role','authenticated')::text,true);
  if not coalesce(public.is_teacher(),false) then raise exception 'teacher_identity_failed';end if;
  foreach g in array array['3','4','6','9'] loop
   course:='grade'||g||'-115-1';roster:=public.admin_learning_action('roster',course,'{}');
   past_n:=0;ext_n:=0;checked:=0;
   for one in select value from jsonb_array_elements(roster->'items') loop
    who:=jsonb_build_object('class_code',one->'class_code','seat_no',one->'seat_no');
    papers:=public.admin_learning_action('papers',course,who||'{"activity_type":"past_exam"}');past_n:=past_n+coalesce((papers->>'total')::integer,0);
    for p in select value from jsonb_array_elements(papers->'items') limit 2 loop
     detail:=public.admin_learning_action('paper',course,who||jsonb_build_object('session_id',p->'session_id'));
     if detail->>'activity_type'<>'past_exam' or detail->>'version_id' is null then raise exception 'past_detail_failed';end if;
     select asset.url into asset_url from public.quiz_past_attempts a join public.quiz_past_versions v on v.id=a.version_id
      cross join lateral jsonb_path_query(v.document,'$.**.url') j(value) join public.quiz_media_assets asset on asset.url=j.value#>>'{}'
      where a.id=(p->>'session_id')::uuid limit 1;
     if asset_url is not null then perform public.admin_learning_media_access(course,who,(p->>'session_id')::uuid,asset_url);end if;
     wrong:=public.admin_learning_action('paper',course,who||jsonb_build_object('session_id',p->'session_id','filter','wrong'));
     if exists(select 1 from jsonb_array_elements(wrong->'items') x where x->>'correct' is distinct from 'false') then raise exception 'wrong_filter_failed';end if;
     checked:=checked+1;
    end loop;
    papers:=public.admin_learning_action('papers',course,who||'{"activity_type":"extension"}');ext_n:=ext_n+coalesce((papers->>'total')::integer,0);
    for p in select value from jsonb_array_elements(papers->'items') limit 1 loop
     detail:=public.admin_learning_action('paper',course,who||jsonb_build_object('session_id',p->'session_id'));checked:=checked+1;
    end loop;
    if one->>'mappings'='1' then
     detail:=public.admin_learning_rewards('garden_status',course,who);
     if detail->'garden' is null then raise exception 'garden_failed';end if;
    end if;
   end loop;
   if jsonb_array_length(roster->'classes')>0 then perform public.admin_learning_rewards('class_rewards',course,jsonb_build_object('class_code',roster->'classes'->0));end if;
   insert into learning_checks values(g,(roster->>'total')::integer,past_n,ext_n,checked,true);
  end loop;
  for r in select * from learning_before loop
   execute format($digest$select md5(coalesce(string_agg(md5(to_jsonb(x)::text),'' order by md5(to_jsonb(x)::text)),'')) from public.%I x$digest$,r.t) into t;
   if t is distinct from r.digest then raise exception 'learner_data_changed';end if;
  end loop;
 end $audit$;
 select jsonb_build_object('passed',true,'learnerDataUnchanged',true,'mode','${apply?'apply':'rollback'}','courses',(select jsonb_agg(to_jsonb(c) order by grade) from learning_checks c)) as result;
`;
const file=path.join(out,apply?'apply.sql':'rollback.sql');
await fs.writeFile(file,migration.replace('begin;','begin isolation level repeatable read;').replace(/commit;\s*$/,audit+(apply?'commit;':'rollback;')));
try{
 const raw=execFileSync('cmd.exe',['/d','/c','D:/local-bin/supabase-personal.cmd','db','query','--linked','-o','json','-f',file],{cwd:'D:/projects/it-class-tcwu',encoding:'utf8',maxBuffer:12e6,timeout:180000,stdio:['ignore','pipe','pipe']});
 const data=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1));await fs.writeFile(path.join(out,apply?'apply-report.json':'rollback-report.json'),JSON.stringify(data,null,2));console.log(JSON.stringify(data));
}catch(e){await fs.writeFile(path.join(out,'database-error.private.txt'),String(e.stderr||e.message));throw Error('Database operation failed; see ignored private error log.');}
