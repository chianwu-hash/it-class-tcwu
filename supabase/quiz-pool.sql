-- Candidate schema: local validation first; no production migration is performed by this file.
begin;
create table if not exists public.quiz_question_pool (
 question_id text primary key, source_item_id text not null, group_key text not null,
 unit_ids jsonb not null, knowledge_code text not null, knowledge_name text not null,
 difficulty integer not null check(difficulty in (-3,0,3)),
 source_version text not null, publisher_explanation boolean not null,
 question jsonb not null, checks jsonb not null, usable boolean not null default false
);
alter table public.quiz_question_pool enable row level security;
revoke all on public.quiz_question_pool from public,anon,authenticated;
grant all on public.quiz_question_pool to service_role;

create or replace function public.quiz_compose(p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); cls text; v_email text; kind text:=coalesce(p_data->>'kind','self');
 amount integer; units jsonb; seed text; conf jsonb; old public.quiz_generated_papers;
 selected text[]:='{}'; chosen public.quiz_question_pool; source public.quiz_question_pool;
 reviewed jsonb; blocks jsonb:='[]'; distribution jsonb; doc jsonb; b_id uuid; v_id uuid; s_id uuid;
 request uuid; d integer; quota integer; count_now integer; result jsonb; paper_name text;
begin
 if uid is null then raise exception 'login_required'; end if;
 if coalesce(public.is_teacher(),false) then raise exception 'student_required'; end if;
 select lower(u.email) into v_email from auth.users u where u.id=uid and u.email_confirmed_at is not null;
 select e.class_code into cls from public.student_enrollments e where e.email=v_email and e.school_year=115 and e.class_code ~ '^3[0-9]{2}$';
 if cls is null then raise exception 'roster_required'; end if;
 if jsonb_typeof(p_data) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_data) k where k not in ('kind','count','units','request_id','attempt_id','question_id','name')) then raise exception 'invalid_request'; end if;
 if p_data ? 'name' and (jsonb_typeof(p_data->'name') is distinct from 'string' or length(trim(p_data->>'name'))>60 or (p_data->>'name') ~ '[[:cntrl:]]') then raise exception 'invalid_request';end if;
 paper_name:=nullif(trim(p_data->>'name'),'');
 if kind not in ('self','extension') or coalesce(p_data->>'count','') !~ '^[0-9]{1,2}$' then raise exception 'invalid_request'; end if;
 amount:=(p_data->>'count')::integer;
 if (kind='self' and amount not in (5,10)) or (kind='extension' and amount not in (3,5)) then raise exception 'invalid_request'; end if;
 request:=(p_data->>'request_id')::uuid;if request is null then raise exception 'invalid_request'; end if;
 units:=coalesce(p_data->'units','[]');
 if jsonb_typeof(units) is distinct from 'array' or jsonb_array_length(units)>9 or exists(select 1 from jsonb_array_elements(units) u where u::text !~ '^[1-9]$') then raise exception 'invalid_request'; end if;
 select coalesce(jsonb_agg(n order by n),'[]') into units from (select distinct value n from jsonb_array_elements(units)) t;
 if kind='self' and (jsonb_array_length(units)=0 or p_data ? 'question_id' or p_data ? 'attempt_id') then raise exception 'invalid_request'; end if;
 conf:=jsonb_build_object('kind',kind,'count',amount,'units',units,'attempt_id',p_data->>'attempt_id','question_id',p_data->>'question_id');
 if paper_name is not null then conf:=conf||jsonb_build_object('name',paper_name);end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||request::text,0));
 select * into old from public.quiz_generated_papers g where g.user_id=uid and g.request_id=request;
 if old.session_id is not null then
  if old.config<>conf then raise exception 'submission_conflict'; end if;
  return jsonb_build_object('session_id',old.session_id,'distribution',old.actual_distribution,'reused',true);
 end if;
 if kind='extension' then
  reviewed:=public.quiz_wrong_questions(jsonb_build_object('action','detail','attempt_id',p_data->>'attempt_id','question_id',p_data->>'question_id'));
  select * into source from public.quiz_question_pool p where p.question_id=reviewed->'question'->>'id' or 'midterm_'||p.source_item_id=reviewed->'question'->>'id';
  if source.question_id is null then raise exception 'extension_unavailable'; end if;
 end if;
 seed:=request::text;
 -- Three passes use the target mix; an honest fill pass handles scarce difficulty buckets.
 for d in select unnest(array[-3,0,3,99]) loop
  quota:=case when kind='extension' then amount when d=-3 then case amount when 10 then 2 else 1 end when d=0 then case amount when 10 then 6 else 3 end when d=3 then case amount when 10 then 2 else 1 end else amount-cardinality(selected) end;
  for count_now in 1..greatest(quota,0) loop
   exit when cardinality(selected)>=amount;
   select p.* into chosen from public.quiz_question_pool p where p.usable and not(p.question_id=any(selected))
    and (d=99 or kind='extension' or p.difficulty=d)
    and not exists(select 1 from public.quiz_question_pool x where x.question_id=any(selected) and x.group_key=p.group_key)
    and ((kind='self' and exists(select 1 from jsonb_array_elements(units) u where p.unit_ids @> jsonb_build_array(u)))
     or (kind='extension' and p.publisher_explanation and p.knowledge_code=source.knowledge_code and p.group_key<>source.group_key and p.difficulty<=source.difficulty))
    order by
     case when kind='extension' and p.publisher_explanation then 0 when kind='extension' then 1 else 0 end,
     (select count(*) from public.quiz_answers a join public.quiz_attempts at on at.id=a.attempt_id where at.user_id=uid and a.question_id=p.question_id),
     (select count(*) from public.quiz_question_pool x where x.question_id=any(selected) and x.knowledge_code=p.knowledge_code),
     (select count(*) from public.quiz_question_pool x where x.question_id=any(selected) and x.unit_ids=p.unit_ids),
     case when kind='extension' then abs(p.difficulty-source.difficulty) else 0 end,md5(p.question_id||seed) limit 1;
   if chosen.question_id is null then exit; end if;
   selected:=array_append(selected,chosen.question_id);
  end loop;
  exit when kind='extension';
 end loop;
 if cardinality(selected)=0 then raise exception 'pool_empty'; end if;
 for chosen in select p.* from unnest(selected) with ordinality r(id,n) join public.quiz_question_pool p on p.question_id=r.id order by n loop
  blocks:=blocks||jsonb_build_array(jsonb_build_object('id','b_'||chosen.source_item_id,'material',jsonb_build_object('text','','media','[]'::jsonb),'questions',jsonb_build_array(chosen.question)));
 end loop;
 select jsonb_build_object('requested',amount,'actual',cardinality(selected),'easy',count(*) filter(where p.difficulty=-3),'medium',count(*) filter(where p.difficulty=0),'hard',count(*) filter(where p.difficulty=3)) into distribution from public.quiz_question_pool p where p.question_id=any(selected);
 doc:=jsonb_build_object('schema',1,'title',case when kind='extension' then '數學同重點延伸練習' else '我的數學自組卷' end,
  'catalog',jsonb_build_object('school_year','115','volume','3年級上學期','subject','數學','publisher','翰林','unit',case when kind='extension' then '同重點再練習：'||source.knowledge_name else '自選單元：'||units::text end),'blocks',blocks);
 perform public.quiz_validate(doc);
 b_id:=gen_random_uuid();v_id:=gen_random_uuid();s_id:=gen_random_uuid();
 insert into public.quiz_banks(id,owner_id,draft) values(b_id,uid,doc);
 insert into public.quiz_versions(id,bank_id,revision,document) values(v_id,b_id,1,doc);
 insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode) values(s_id,uid,v_id,115,jsonb_build_array(cls),'immediate',false,true,'self');
 insert into public.quiz_generated_papers(session_id,user_id,request_id,config,actual_distribution,display_name) values(s_id,uid,request,conf,distribution,paper_name);
 return jsonb_build_object('session_id',s_id,'distribution',distribution,'reused',false);
end $$;
revoke all on function public.quiz_compose(jsonb) from public,anon;
grant execute on function public.quiz_compose(jsonb) to authenticated;
-- Mutable personal label; never overwrite the frozen document or answers.
create or replace function public.quiz_rename_paper(p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); identity jsonb; paper uuid; label text;
begin
 if uid is null then raise exception 'login_required';end if;
 identity:=public.quiz_action('library_sessions');
 if identity->>'role'<>'student' then raise exception 'student_required';end if;
 if jsonb_typeof(p_data) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_data) k where k not in ('session_id','name'))
  or jsonb_typeof(p_data->'name') is distinct from 'string' then raise exception 'invalid_request';end if;
 label:=trim(p_data->>'name');
 if length(label) not between 1 and 60 or label ~ '[[:cntrl:]]' then raise exception 'invalid_request';end if;
 paper:=(p_data->>'session_id')::uuid;
 if not exists(select 1 from jsonb_array_elements(identity->'sessions') s where s->>'id'=paper::text and s->>'generated'='true') then raise exception 'session_unavailable';end if;
 update public.quiz_generated_papers set display_name=label where session_id=paper and user_id=uid;
 if not found then raise exception 'session_unavailable';end if;
 return jsonb_build_object('session_id',paper,'display_name',label,'saved',true);
end $$;
revoke all on function public.quiz_rename_paper(jsonb) from public,anon;
grant execute on function public.quiz_rename_paper(jsonb) to authenticated;
create or replace function public.quiz_pool_catalog() returns jsonb
language plpgsql security definer set search_path='' as $$
declare identity jsonb; result jsonb;
begin
 identity:=public.quiz_action('library_sessions');
 if identity->>'role'<>'student' or identity->>'grade'<>'3' then return jsonb_build_object('available',false,'units','[]'::jsonb);end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',n,'count',total) order by n),'[]') into result from (
 select n::integer,count(*) total from public.quiz_question_pool p,jsonb_array_elements_text(p.unit_ids) u(n) where p.usable group by n) t;
 return jsonb_build_object('available',true,'units',result,'total',(select count(*) from public.quiz_question_pool where usable));
end $$;
revoke all on function public.quiz_pool_catalog() from public,anon;
grant execute on function public.quiz_pool_catalog() to authenticated;
commit;
