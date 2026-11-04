-- Incremental learning adapter. Existing answers/progress/awards are never rewritten.
begin;
create table if not exists public.quiz_learning_settings(id boolean primary key default true check(id),school_year integer not null,semester integer not null check(semester in(1,2)),enabled boolean not null default false,enabled_at timestamptz not null default clock_timestamp());
insert into public.quiz_learning_settings values(true,115,1,false,clock_timestamp()) on conflict do nothing;
create table if not exists public.quiz_learning_maps(source_version uuid primary key references public.quiz_past_versions(id),paper_id text not null references public.quiz_past_papers(id),source_sha text not null,content jsonb not null,enabled boolean not null default false);
create table if not exists public.quiz_learning_topics(source_version uuid not null references public.quiz_learning_maps(source_version),concept_id text not null,version_id uuid not null references public.quiz_versions(id),primary key(source_version,concept_id));
create table if not exists public.quiz_learning_sessions(session_id uuid primary key references public.quiz_sessions(id),user_id uuid not null references auth.users(id),source_attempt uuid not null references public.quiz_past_attempts(id),source_version uuid not null,group_id text not null,question_id text not null,concept_id text not null,mode text not null check(mode in('wrong','review')),request_id uuid not null,school_year integer not null,semester integer not null,unique(user_id,request_id));
create table if not exists public.quiz_learning_credits(user_id uuid not null references auth.users(id),school_year integer not null,semester integer not null,question_key text not null,attempt_id uuid not null references public.quiz_attempts(id),question_id text not null,origin text not null,created_at timestamptz not null default clock_timestamp(),primary key(user_id,school_year,semester,question_key));
create table if not exists public.quiz_learning_leaves(user_id uuid not null references auth.users(id),school_year integer not null,semester integer not null,ordinal integer not null,created_at timestamptz not null default clock_timestamp(),primary key(user_id,school_year,semester,ordinal));
do $$declare t text;begin foreach t in array array['quiz_learning_settings','quiz_learning_maps','quiz_learning_topics','quiz_learning_sessions','quiz_learning_credits','quiz_learning_leaves'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end$$;

create or replace function public.quiz_learning_key(d jsonb,q jsonb,b jsonb default '{}') returns text language sql immutable set search_path='' as $$
 select md5(jsonb_build_object('grade',left(d->'catalog'->>'volume',1),'subject',d->'catalog'->>'subject','publisher',d->'catalog'->>'publisher','type',q->>'type',
 'material',trim(regexp_replace(coalesce(b->'material'->>'text',''),'\s+',' ','g')),'material_media',coalesce(b->'material'->'media','[]'),'prompt',trim(regexp_replace(coalesce(q->'prompt'->>'text',''),'\s+',' ','g')),
 'prompt_runs',case when length(trim(coalesce(q->'prompt'->>'text','')))=0 then q->'prompt'->'runs' else null end,
 'media',coalesce(q->'prompt'->'media','[]'), 'options',(select coalesce(jsonb_agg(x order by x::text),'[]') from(select jsonb_build_object('text',trim(regexp_replace(coalesce(o->'content'->>'text',''),'\s+',' ','g')),'media',coalesce(o->'content'->'media','[]'),'runs',case when length(trim(coalesce(o->'content'->>'text','')))=0 then o->'content'->'runs' else null end) x from jsonb_array_elements(coalesce(q->'options','[]')) o) z))::text)
$$;

create or replace function public.quiz_learning_summary() returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.quiz_learning_settings;n integer;l integer;identity jsonb;begin
 identity:=public.quiz_student_identity();if identity->>'role' is distinct from 'student' then raise exception 'student_required';end if;
 select * into s from public.quiz_learning_settings where id;
 select count(*) into n from public.quiz_learning_credits where user_id=auth.uid() and school_year=s.school_year and semester=s.semester;
 select count(*) into l from public.quiz_learning_leaves where user_id=auth.uid() and school_year=s.school_year and semester=s.semester;
 return jsonb_build_object('enabled',s.enabled,'count',n,'leaves',l,'remainder',n%10,'schoolYear',s.school_year,'semester',s.semester);
end$$;

create or replace function public.quiz_learning_credit(aid uuid,new_answer boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.quiz_attempts;s public.quiz_sessions;v public.quiz_versions;cfg public.quiz_learning_settings;identity jsonb;x record;n integer;added integer:=0;awarded integer:=0;origin text;kind text;
begin
 select * into a from public.quiz_attempts where id=aid and user_id=auth.uid();if a.id is null then raise exception 'attempt_unavailable';end if;
 select * into cfg from public.quiz_learning_settings where id;if not cfg.enabled then return null;end if;
 if coalesce(public.is_teacher(),false) then return null;end if;
 identity:=public.quiz_student_identity();if identity->>'role' is distinct from 'student' then return null;end if;
 select * into s from public.quiz_sessions where id=a.session_id;select * into v from public.quiz_versions where id=s.version_id;
 if s.school_year is distinct from cfg.school_year or left(v.document->'catalog'->>'volume',1) is distinct from (identity->>'grade') then return null;end if;
 if exists(select 1 from public.quiz_learning_sessions ls join public.quiz_learning_maps m on m.source_version=ls.source_version where ls.session_id=s.id and ls.user_id=auth.uid() and ls.school_year=cfg.school_year and ls.semester=cfg.semester and m.enabled) then origin:='past_extension';
 elsif s.access_mode='self' and jsonb_array_length(a.question_order)=5 and exists(select 1 from public.quiz_generated_papers where session_id=s.id and user_id=auth.uid() and deleted_at is null) then origin:='self_five';
 else return null;end if;
 -- Same lock order after quiz_action's own attempt lock; stable per-user credit lock.
 perform pg_advisory_xact_lock(1364542035,hashtext(auth.uid()::text||':'||cfg.school_year||':'||cfg.semester));
 for x in select an.question_id,public.quiz_learning_key(v.document,q,b) key from public.quiz_answers an join public.quiz_question_timing t on t.attempt_id=an.attempt_id and t.question_id=an.question_id cross join lateral jsonb_array_elements(v.document->'blocks') b cross join lateral jsonb_array_elements(b->'questions') q
 where an.attempt_id=aid and q->>'id'=an.question_id and an.created_at>=cfg.enabled_at and t.accepted_seconds>=greatest(2,(select min_seconds from public.quiz_integrity_settings where id)) loop
  insert into public.quiz_learning_credits(user_id,school_year,semester,question_key,attempt_id,question_id,origin) values(auth.uid(),cfg.school_year,cfg.semester,x.key,aid,x.question_id,origin) on conflict do nothing;
  if found then added:=added+1;end if;
 end loop;
 select count(*) into n from public.quiz_learning_credits where user_id=auth.uid() and school_year=cfg.school_year and semester=cfg.semester;
 insert into public.quiz_learning_leaves(user_id,school_year,semester,ordinal) select auth.uid(),cfg.school_year,cfg.semester,i from generate_series(1,n/10) i on conflict do nothing;get diagnostics awarded=row_count;
 return public.quiz_learning_summary()||jsonb_build_object('added',added,'earned_now',case when new_answer then awarded else 0 end,'origin',origin);
end$$;

do $$begin
 if to_regprocedure('public.quiz_leaf_result_before_learning(uuid,boolean)') is null then alter function public.quiz_leaf_result(uuid,boolean) rename to quiz_leaf_result_before_learning;end if;
 if to_regprocedure('public.quiz_rewards_before_learning(jsonb)') is null then alter function public.quiz_rewards(jsonb) rename to quiz_rewards_before_learning;end if;
 if to_regprocedure('public.quiz_wrong_questions_before_learning(jsonb)') is null then alter function public.quiz_wrong_questions(jsonb) rename to quiz_wrong_questions_before_learning;end if;
 if to_regprocedure('public.quiz_past_snapshot_before_learning(uuid)') is null then alter function public.quiz_past_snapshot(uuid) rename to quiz_past_snapshot_before_learning;end if;
 if to_regprocedure('public.quiz_action_before_learning(text,jsonb)') is null then alter function public.quiz_action(text,jsonb) rename to quiz_action_before_learning;end if;
 if to_regprocedure('public.quiz_entry_context_before_learning(jsonb)') is null then alter function public.quiz_entry_context(jsonb) rename to quiz_entry_context_before_learning;end if;
 if to_regprocedure('public.quiz_monitor_before_learning(jsonb)') is null then alter function public.quiz_monitor(jsonb) rename to quiz_monitor_before_learning;end if;
end$$;
create or replace function public.quiz_action(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare data jsonb;begin
 if p_data ? 'session_id' and exists(select 1 from public.quiz_learning_sessions where session_id=(p_data->>'session_id')::uuid and user_id is distinct from auth.uid()) then raise exception 'attempt_unavailable';end if;
 data:=public.quiz_action_before_learning(p_action,p_data);
 if p_action='sessions' then
  data:=jsonb_set(data,'{sessions}',coalesce((select jsonb_agg(x order by ord) from jsonb_array_elements(data->'sessions') with ordinality e(x,ord) where not exists(select 1 from public.quiz_learning_sessions ls where ls.session_id=(x->>'id')::uuid)),'[]'));
 elsif p_action='list' then
  data:=jsonb_set(data,'{banks}',coalesce((select jsonb_agg(x order by ord) from jsonb_array_elements(data->'banks') with ordinality e(x,ord) where not exists(select 1 from public.quiz_learning_topics lt join public.quiz_versions v on v.id=lt.version_id where v.bank_id=(x->>'id')::uuid)),'[]'));
 end if;
 return data;
end$$;
create or replace function public.quiz_entry_context(p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_data ? 'session_id' and exists(select 1 from public.quiz_learning_sessions where session_id=(p_data->>'session_id')::uuid and user_id is distinct from auth.uid()) then raise exception 'attempt_unavailable';end if;
 return public.quiz_entry_context_before_learning(p_data);
end$$;
create or replace function public.quiz_monitor(p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.quiz_learning_sessions where session_id=(p_data->>'session_id')::uuid) then raise exception 'session_unavailable';end if;
 return public.quiz_monitor_before_learning(p_data);
end$$;
create or replace function public.quiz_leaf_result(aid uuid,new_answer boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare data jsonb;learning jsonb;begin
 learning:=public.quiz_learning_credit(aid,new_answer);
 if learning is not null then return jsonb_build_object('earned',false,'earned_now',false,'reason','learning_credit','learning',learning);end if;
 return public.quiz_leaf_result_before_learning(aid,new_answer);
end$$;

create or replace function public.quiz_rewards(p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare data jsonb;cfg public.quiz_learning_settings;awards jsonb;identity jsonb;begin
 data:=public.quiz_rewards_before_learning(p_data);if coalesce(public.is_teacher(),false) then return data;end if;
 select * into cfg from public.quiz_learning_settings where id;if not cfg.enabled then return data;end if;
 begin identity:=public.quiz_student_identity();exception when raise_exception then if sqlerrm in ('roster_required','student_required') then return data;else raise;end if;end;
 if identity->>'role' is distinct from 'student' then return data;end if;
 if p_data ? 'course_id' and p_data->>'course_id'<>'grade'||(identity->>'grade')||'-'||cfg.school_year||'-'||cfg.semester then return data;end if;
 select coalesce(jsonb_agg(jsonb_build_object('id','learning:'||l.school_year||':'||l.semester||':'||l.ordinal,'source_type','learning','title','練習累積・第'||l.ordinal||'片延伸葉','grade',(identity->>'grade')::integer,'half_units',2,'total',10,'correct',null,'awarded_at',l.created_at,'ordinal',l.ordinal) order by l.ordinal),'[]') into awards from public.quiz_learning_leaves l where l.user_id=auth.uid() and l.school_year=cfg.school_year and l.semester=cfg.semester;
 -- Full two-unit learning awards go first: they cannot consume/relabel an older pending half.
 -- Existing garden_growth already reads awards and therefore receives the same stable IDs.
 return data||jsonb_build_object('awards',awards||coalesce(data->'awards','[]'),'learning',public.quiz_learning_summary(),'learningAwards',awards);
end$$;

-- Content is attached only to already disclosed own records, never pre-sent answers.
create or replace function public.quiz_past_snapshot(p_attempt uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare data jsonb;m public.quiz_learning_maps;e jsonb;r jsonb;g jsonb;items jsonb;href text;begin
 data:=public.quiz_past_snapshot_before_learning(p_attempt);
 select * into m from public.quiz_learning_maps where source_version=(data->>'version')::uuid and enabled;
 if m.source_version is null then return data;end if;
 for g in select value from jsonb_array_elements(data->'groups') loop
  r:=data->'records'->(g->>'id');if r is null then continue;end if;items:='[]';
  for e in select value from jsonb_array_elements(m.content->'questions') where value->>'groupId'=g->>'id' loop
   if not exists(select 1 from jsonb_array_elements(coalesce(r->'results','[]')) x where x->>'questionId'=e->>'questionId' and jsonb_typeof(x->'correct')='boolean') and not(coalesce((e->>'selfCheck')::boolean,false) and r->>'status'='self_checked') then continue;end if;
   href:=null;
   if exists(select 1 from jsonb_array_elements(r->'results') x where x->>'questionId'=e->>'questionId' and x->>'correct'='false') then
    href:='/grade3/115-1/quiz-library.html?wrong_source=past_exam&wrong_attempt='||p_attempt||'&wrong_paper='||m.paper_id||'&wrong_version='||m.source_version||'&wrong_group='||(e->>'groupId')||'&wrong_question='||(e->>'questionId')||'#wrong';
   end if;
   items:=items||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('questionId',e->>'questionId','text',e->>'explanation','selfCheck',coalesce((e->>'selfCheck')::boolean,false),'wrongReviewHref',href)));
  end loop;
  if jsonb_array_length(items)>0 then data:=jsonb_set(data,array['records',g->>'id','learningExplanations'],items);end if;
 end loop;
 return data;
end$$;

-- Remaining RPC/list projections below are installed in the same transaction.
create or replace function public.quiz_learning_review(aid uuid,gid text,qid text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.quiz_past_attempts;m public.quiz_learning_maps;data jsonb;r jsonb;e jsonb;cs jsonb;begin
 select * into a from public.quiz_past_attempts where id=aid and user_id=auth.uid();if a.id is null then raise exception 'attempt_unavailable';end if;
 select * into m from public.quiz_learning_maps where source_version=a.version_id and paper_id=a.paper_id and enabled;if m.source_version is null then raise exception 'learning_unavailable';end if;
 data:=public.quiz_past_action('resume',jsonb_build_object('paper_id',a.paper_id,'attempt_id',aid));r:=data->'records'->gid;
 select value into e from jsonb_array_elements(m.content->'questions') where value->>'groupId'=gid and value->>'questionId'=qid and not coalesce((value->>'selfCheck')::boolean,false);
 if e is null or not exists(select 1 from jsonb_array_elements(coalesce(r->'results','[]')) x where x->>'questionId'=qid and jsonb_typeof(x->'correct')='boolean') then raise exception 'learning_unavailable';end if;
 select coalesce(jsonb_agg(c||jsonb_build_object('practice',jsonb_build_object('available',t.version_id is not null,'count',case when t.version_id is null then 0 else 2 end,
 'publisher',v.document->'catalog'->>'publisher','schoolYear',v.document->'catalog'->>'school_year','subject',v.document->'catalog'->>'subject','chapter',v.document->'catalog'->>'unit',
 'coverage',c->'practiceCoverage','unavailableReason',c->>'practiceUnavailableReason')) order by ord),'[]') into cs
 from jsonb_array_elements(m.content->'concepts') with ordinality concepts(c,ord)
 left join public.quiz_learning_topics t on t.source_version=a.version_id and t.concept_id=c->>'id'
 left join public.quiz_versions v on v.id=t.version_id where e->'conceptIds' ? (c->>'id');
 return jsonb_build_object('schema',1,'source',jsonb_build_object('versionId',a.version_id,'groupId',gid,'questionId',qid),'explanation',e->>'explanation','concepts',cs);
end$$;

create or replace function public.quiz_learning_wrong_items(p_grade integer) returns setof jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('source_type','past_exam','attempt_id',a.id,'paper_id',a.paper_id,'version_id',a.version_id,'group_id',an.group_id,'question_id',an.question_id,'answered_at',a.created_at,'title',v.document->>'title','catalog',(v.document->'catalog')||jsonb_build_object('unit',v.document->>'title'),'number',ord,'source_label',g->>'sourceLabel','field_label',case when f->>'label' ~ '^\d{1,2}$' then f->>'label' else ford::text end,'preview',left(coalesce(g->'promptContent'->>'text',g->>'prompt','')||' '||coalesce(f->>'text',''),160))
 from public.quiz_past_attempts a join public.quiz_past_versions v on v.id=a.version_id join public.quiz_past_papers p on p.id=a.paper_id join public.quiz_learning_maps m on m.source_version=a.version_id and m.enabled
 join public.quiz_past_answers an on an.attempt_id=a.id and an.correct=false join public.quiz_past_receipts r on r.attempt_id=a.id and r.group_id=an.group_id
 cross join lateral jsonb_array_elements(v.document->'groups') with ordinality groups(g,ord) cross join lateral jsonb_array_elements(g->'fields') with ordinality fields(f,ford)
 where a.user_id=auth.uid() and p.enabled and p.grade=p_grade and a.school_year=(select school_year from public.quiz_learning_settings where id) and a.semester=(select semester from public.quiz_learning_settings where id)
 and g->>'id'=an.group_id and f->>'id'=an.question_id and g->>'kind' not in('annotation','manual')
 and exists(select 1 from jsonb_array_elements(m.content->'questions') e where e->>'groupId'=an.group_id and e->>'questionId'=an.question_id and not coalesce((e->>'selfCheck')::boolean,false))
 and exists(select 1 from jsonb_array_elements(r.results) x where x->>'questionId'=an.question_id and x->>'correct'='false')
$$;

create or replace function public.quiz_learning_wrong_detail(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare item jsonb;g jsonb;f jsonb;r public.quiz_past_receipts;review jsonb;response jsonb;official jsonb;material jsonb;prompt jsonb;choices jsonb;asset jsonb;response_text text;answer_text text;begin
 select x into item from public.quiz_learning_wrong_items((public.quiz_student_identity()->>'grade')::integer) x where x->>'attempt_id'=p_data->>'attempt_id' and x->>'version_id'=p_data->>'version_id' and x->>'paper_id'=p_data->>'paper_id' and x->>'group_id'=p_data->>'group_id' and x->>'question_id'=p_data->>'question_id';
 if item is null then raise exception 'wrong_question_unavailable';end if;
 review:=public.quiz_learning_review((item->>'attempt_id')::uuid,item->>'group_id',item->>'question_id');
 select x into g from public.quiz_past_versions v cross join lateral jsonb_array_elements(v.document->'groups') x where v.id=(item->>'version_id')::uuid and x->>'id'=item->>'group_id';
 select x into f from jsonb_array_elements(g->'fields') x where x->>'id'=item->>'question_id';
 select * into r from public.quiz_past_receipts where attempt_id=(item->>'attempt_id')::uuid and group_id=item->>'group_id';
 select x->'value' into response from jsonb_array_elements(r.responses) x where x->>'questionId'=item->>'question_id';
 select x->'official' into official from jsonb_array_elements(r.results) x where x->>'questionId'=item->>'question_id';
 material:=coalesce(g->'materialContent',jsonb_build_object('text',coalesce(g->>'material',''),'media','[]'::jsonb));
 for asset in select value from jsonb_array_elements(coalesce(g->'assets','[]')) loop
  if not exists(select 1 from jsonb_array_elements(coalesce(material->'media','[]')) x where x->>'url'=asset->>'url') then material:=jsonb_set(material,'{media}',coalesce(material->'media','[]')||jsonb_build_array(jsonb_build_object('kind','image','url',asset->>'url','alt',asset->>'alt')));end if;
 end loop;
 prompt:=coalesce(g->'promptContent',jsonb_build_object('text',coalesce(g->>'prompt',''),'media','[]'::jsonb));
 if g->>'kind'<>'single' then prompt:=jsonb_set(prompt,'{text}',to_jsonb(concat_ws(E'\n',prompt->>'text',f->>'text',(select string_agg(x->>'id'||'：'||(x->>'text'),'；') from jsonb_array_elements(coalesce(g->'choices','[]')) x))));end if;
 choices:=case when g->>'kind'='single' then (select coalesce(jsonb_agg(jsonb_build_object('id',x->>'id','content',coalesce(x->'content',jsonb_build_object('text',x->>'text','media','[]'::jsonb)))),'[]') from jsonb_array_elements(g->'choices') x) else '[]'::jsonb end;
 response_text:=case when g->>'kind'='mark' then case when response='true'::jsonb then '勾選' else '不勾選' end when jsonb_typeof(response)='array' then (select string_agg(x,case when g->>'kind'='sequence' then ' → ' else '、' end) from jsonb_array_elements_text(response) x) else response#>>'{}' end;
 answer_text:=case when g->>'kind'='mark' then case when official='true'::jsonb then '勾選' else '不勾選' end when jsonb_typeof(official)='array' then (select string_agg(x,case when g->>'kind'='sequence' then ' → ' when g->>'kind'='short' then ' 或 ' else '、' end) from jsonb_array_elements_text(official) x) else official#>>'{}' end;
 return item||jsonb_build_object('can_extend',false,'question',jsonb_build_object('id',f->>'id','type',case when g->>'kind'='single' then 'single' else 'past' end,'past_kind',g->>'kind','prompt',prompt,'material',material,'options',choices),'response',response,'response_text',response_text,'answer_text',answer_text,
 'review',jsonb_build_object('correct',false,'answer',jsonb_build_object('option_id',official),'explanation',jsonb_build_object('text',review->>'explanation','media','[]'::jsonb)),
 'past_review',jsonb_build_object('version',item->>'version_id','group',jsonb_build_object('id',g->>'id','fields',jsonb_build_array(jsonb_build_object('id',f->>'id'))),'record',jsonb_build_object('results',r.results,'learningReview',review)));
end$$;

create or replace function public.quiz_wrong_questions(p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare identity jsonb;old jsonb;items jsonb;facets jsonb;n integer;page integer:=coalesce((p_data->>'page')::integer,0);include_past boolean:=p_data->>'learning_client'='1';begin
 p_data:=p_data-'learning_client';
 identity:=public.quiz_student_identity();if identity->>'role' is distinct from 'student' then raise exception 'student_required';end if;
 if coalesce((p_data->>'grade')::integer,(identity->>'grade')::integer) is distinct from (identity->>'grade')::integer then raise exception 'course_unavailable';end if;
 if coalesce(p_data->>'action','list')='detail' then
  if p_data->>'source_type'='past_exam' then if include_past then return public.quiz_learning_wrong_detail(p_data);else raise exception 'wrong_question_unavailable';end if;end if;
  if exists(select 1 from public.quiz_attempts a join public.quiz_learning_sessions ls on ls.session_id=a.session_id where a.id=(p_data->>'attempt_id')::uuid) then raise exception 'wrong_question_unavailable';end if;
  return public.quiz_wrong_questions_before_learning(p_data);
 end if;
 old:=public.quiz_wrong_questions_before_learning(p_data);if not exists(select 1 from public.quiz_learning_maps where enabled) and not exists(select 1 from public.quiz_learning_sessions) then return old;end if;
 with all_items as materialized(
  select jsonb_build_object('source_type','quiz','attempt_id',r.attempt_id,'session_id',r.session_id,'version_id',r.version_id,'question_id',r.question_id,'answered_at',r.answered_at,'title',r.title,'catalog',r.catalog,'number',array_position(r.ordered_ids,r.question_id),'preview',m.question_index->r.question_id->>'preview') item
  from public.quiz_wrong_refs((identity->>'grade')::integer) r join public.quiz_version_meta m on m.version_id=r.version_id where not exists(select 1 from public.quiz_learning_sessions ls where ls.session_id=r.session_id)
  union all select x from public.quiz_learning_wrong_items((identity->>'grade')::integer) x where include_past
 ),filtered as materialized(select item from all_items where (coalesce(p_data->>'subject','')='' or item->'catalog'->>'subject'=p_data->>'subject') and (coalesce(p_data->>'unit','')='' or coalesce(item->'catalog'->>'unit',item->>'title')=p_data->>'unit'))
 select (select count(*) from filtered),(select coalesce(jsonb_agg(item order by item->>'answered_at' desc,item->>'attempt_id',item->>'question_id'),'[]') from(select item from filtered order by item->>'answered_at' desc,item->>'attempt_id',item->>'question_id' limit 20 offset page*20) z),
 (select coalesce(jsonb_agg(f),'[]') from(select distinct jsonb_build_object('subject',coalesce(item->'catalog'->>'subject','未分類'),'unit',coalesce(item->'catalog'->>'unit',item->>'title')) f from all_items) x) into n,items,facets;
 return old||jsonb_build_object('items',items,'total',n,'facets',facets);
end$$;

create or replace function public.quiz_learning(p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare identity jsonb;cfg public.quiz_learning_settings;action text:=coalesce(p_data->>'action','summary');a public.quiz_past_attempts;m public.quiz_learning_maps;snap jsonb;review jsonb;topic jsonb;e jsonb;t public.quiz_learning_topics;ls public.quiz_learning_sessions;sid uuid;rid uuid;result jsonb;existing public.quiz_learning_sessions;
begin
 identity:=public.quiz_student_identity();if identity->>'role' is distinct from 'student' then raise exception 'student_required';end if;
 select * into cfg from public.quiz_learning_settings where id;
 if action='summary' then return public.quiz_learning_summary();end if;
 if not cfg.enabled then raise exception 'learning_unavailable';end if;
 if action='context' then
  select * into ls from public.quiz_learning_sessions where session_id=(p_data->>'session_id')::uuid and user_id=auth.uid();
  if ls.session_id is null then return '{}'::jsonb;end if;
  return jsonb_build_object('mode',ls.mode,'attempt_id',ls.source_attempt,'paper_id',(select paper_id from public.quiz_past_attempts where id=ls.source_attempt),'version_id',ls.source_version,'group_id',ls.group_id,'question_id',ls.question_id,'concept_id',ls.concept_id);
 end if;
 if action='reviews' then
  select coalesce(jsonb_agg(jsonb_build_object('id',pa.id,'title',p.title,'score',pa.score,'max_score',pa.max_score,'paper_id',pa.paper_id,'created_at',pa.created_at) order by pa.created_at desc),'[]') into result
  from public.quiz_past_attempts pa join public.quiz_past_papers p on p.id=pa.paper_id join public.quiz_learning_maps lm on lm.source_version=pa.version_id and lm.enabled where pa.user_id=auth.uid() and p.enabled and p.grade=(identity->>'grade')::integer and pa.completed_at is not null and pa.school_year=cfg.school_year and pa.semester=cfg.semester;
  return jsonb_build_object('attempts',result);
 end if;
 select * into a from public.quiz_past_attempts where id=(p_data->>'attempt_id')::uuid and user_id=auth.uid();if a.id is null then raise exception 'attempt_unavailable';end if;
 if a.school_year is distinct from cfg.school_year or a.semester is distinct from cfg.semester or not exists(select 1 from public.quiz_past_papers p where p.id=a.paper_id and p.enabled and p.grade=(identity->>'grade')::integer) then raise exception 'course_unavailable';end if;
 select * into m from public.quiz_learning_maps where source_version=a.version_id and paper_id=a.paper_id and enabled;if m.source_version is null then raise exception 'learning_unavailable';end if;
 snap:=public.quiz_past_action('resume',jsonb_build_object('paper_id',a.paper_id,'attempt_id',a.id));
 if action='topics' then
  if a.completed_at is null then raise exception 'learning_incomplete';end if;
  select coalesce(jsonb_agg(c||jsonb_build_object('count',2)),'[]') into result from jsonb_array_elements(m.content->'concepts') c join public.quiz_learning_topics lt on lt.source_version=a.version_id and lt.concept_id=c->>'id';
  return jsonb_build_object('title',snap->>'title','attempt_id',a.id,'version',a.version_id,'concepts',result);
 end if;
 if action<>'start' then raise exception 'invalid_action';end if;
 if p_data->>'version' is distinct from a.version_id::text then raise exception 'version_unavailable';end if;
 if coalesce(p_data->>'mode','wrong') not in ('review','wrong') then raise exception 'invalid_request';end if;
 if p_data->>'mode'='review' then
  if a.completed_at is null then raise exception 'learning_incomplete';end if;
  -- A completed original permits proactive practice, including concepts occurring
  -- only on self-check fields. Self-check fields still never become wrong items.
  select value into e from jsonb_array_elements(m.content->'questions') where value->'conceptIds' ? (p_data->>'concept_id') order by coalesce((value->>'selfCheck')::boolean,false) limit 1;
 else select value into e from jsonb_array_elements(m.content->'questions') where value->>'questionId'=p_data->>'question_id' and value->>'groupId'=p_data->>'group_id' and value->'conceptIds' ? (p_data->>'concept_id') and not coalesce((value->>'selfCheck')::boolean,false);end if;
 if e is null then raise exception 'learning_unavailable';end if;
 if coalesce(p_data->>'mode','wrong')='wrong' then review:=public.quiz_learning_review(a.id,e->>'groupId',e->>'questionId');end if;
 if coalesce(p_data->>'mode','wrong')='wrong' and not exists(select 1 from jsonb_array_elements(snap->'records'->(e->>'groupId')->'results') x where x->>'questionId'=e->>'questionId' and x->>'correct'='false') then raise exception 'wrong_question_unavailable';end if;
 select * into t from public.quiz_learning_topics where source_version=a.version_id and concept_id=p_data->>'concept_id';if t.version_id is null then raise exception 'learning_unavailable';end if;
 rid:=(p_data->>'request_id')::uuid;if rid is null then raise exception 'invalid_request';end if;
 perform pg_advisory_xact_lock(1364542036,hashtext(auth.uid()::text||rid));
 select * into existing from public.quiz_learning_sessions where user_id=auth.uid() and request_id=rid;
 if existing.session_id is not null then
  if existing.source_attempt<>a.id or existing.source_version<>a.version_id or existing.concept_id<>t.concept_id or existing.mode<>coalesce(p_data->>'mode','wrong') or existing.group_id<>e->>'groupId' or existing.question_id<>e->>'questionId' then raise exception 'submission_conflict';end if;sid:=existing.session_id;
 else
  sid:=gen_random_uuid();
  insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode) values(sid,(select owner_id from public.quiz_past_papers where id=a.paper_id),t.version_id,cfg.school_year,jsonb_build_array(identity->>'class_code'),'immediate',false,false,'classroom');
  insert into public.quiz_learning_sessions values(sid,auth.uid(),a.id,a.version_id,e->>'groupId',e->>'questionId',t.concept_id,coalesce(p_data->>'mode','wrong'),rid,cfg.school_year,cfg.semester);
 end if;
 return jsonb_build_object('sessionId',sid,'url','/grade'||(identity->>'grade')||'/115-1/quiz.html?cloud=1&learning=1&session='||sid,'count',2,'extensionEligible',true);
end$$;

-- Entry points only. No direct access to content or internal award/backup functions.
-- Keep the existing teacher projections intact; only omit the new private sessions.
-- Match the audited live clauses exactly and fail closed if upstream SQL changes.
do $isolation$ declare r record;definition text;needle text;replacement text;hits integer;begin
 for r in select * from (values
  ('public.admin_learning_paper_rows(uuid,integer,text)',1,false),
  ('public.admin_learning_action(text,text,jsonb)',1,false),
  ('public.admin_learning_rewards(text,text,jsonb)',3,true)
 ) v(signature,expected,dynamic_sql) loop
  if to_regprocedure(r.signature) is null then continue;end if;
  definition:=pg_get_functiondef(to_regprocedure(r.signature));
  if strpos(definition,'quiz_learning_sessions')>0 then continue;end if;
  needle:=case when r.dynamic_sql then $needle$s.access_mode in (''classroom'',''practice'',''self'')$needle$ else $needle$s.access_mode in ('classroom','practice','self')$needle$ end;
  replacement:=needle||' and not exists(select 1 from public.quiz_learning_sessions learning_private where learning_private.session_id=s.id)';
  hits:=(length(definition)-length(replace(definition,needle,'')))/length(needle);
  if hits<>r.expected then raise exception 'learning_teacher_projection_changed: %',r.signature;end if;
  execute replace(definition,needle,replacement);
 end loop;
end$isolation$;

do $$declare r record;begin
 for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'quiz_learning%' or p.proname in('quiz_leaf_result_before_learning','quiz_rewards_before_learning','quiz_wrong_questions_before_learning','quiz_past_snapshot_before_learning','quiz_action_before_learning','quiz_entry_context_before_learning','quiz_monitor_before_learning')) loop execute format('revoke all on function %s from public,anon,authenticated',r.sig);end loop;
end$$;
revoke all on function public.quiz_leaf_result(uuid,boolean),public.quiz_past_snapshot(uuid) from public,anon,authenticated;
revoke all on function public.quiz_learning(jsonb),public.quiz_rewards(jsonb),public.quiz_wrong_questions(jsonb),public.quiz_action(text,jsonb),public.quiz_entry_context(jsonb),public.quiz_monitor(jsonb) from public,anon;
grant execute on function public.quiz_learning(jsonb),public.quiz_rewards(jsonb),public.quiz_wrong_questions(jsonb),public.quiz_action(text,jsonb),public.quiz_entry_context(jsonb),public.quiz_monitor(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
