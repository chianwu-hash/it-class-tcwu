-- Private question pool and course-scoped composition; validate locally before authorized deployment.
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

create table if not exists public.quiz_courses (
 id text primary key, grade integer not null check(grade in (3,6)), definition jsonb not null, enabled boolean not null default false
);
create table if not exists public.quiz_pool_membership (
 question_id text primary key references public.quiz_question_pool(question_id) on delete cascade,
 course_id text not null references public.quiz_courses(id), knowledge_reliable boolean not null default false
);
create table if not exists public.quiz_pool_aliases (
 version_id uuid not null references public.quiz_versions(id), legacy_question_id text not null,
 question_id text not null references public.quiz_question_pool(question_id), primary key(version_id,legacy_question_id)
);
alter table public.quiz_courses enable row level security;
alter table public.quiz_pool_membership enable row level security;
alter table public.quiz_pool_aliases enable row level security;
revoke all on public.quiz_courses,public.quiz_pool_membership,public.quiz_pool_aliases from public,anon,authenticated;
grant all on public.quiz_courses,public.quiz_pool_membership,public.quiz_pool_aliases to service_role;
insert into public.quiz_courses values('115-1-hanlin-g3-math',3,'{"school_year":"115","volume":"3年級上學期","subject":"數學","publisher":"翰林","units":{"1":"10000以內的數","2":"10000以內的加減","3":"毫米與數線","4":"乘法","5":"角與形狀","6":"除法","7":"公斤與公克","8":"分數","9":"列表與規律"}}',true) on conflict(id) do nothing;
create index if not exists quiz_pool_course_idx on public.quiz_pool_membership(course_id,question_id);

-- Student titles are assigned once from reviewed work/character pairs. Never accept client text.
create table if not exists public.quiz_name_characters(id text primary key,work text not null,character text not null,enabled boolean not null default true);
create table if not exists public.quiz_name_counters(user_id uuid not null references auth.users(id),school_year smallint not null,last_number bigint not null check(last_number>0),primary key(user_id,school_year));
alter table public.quiz_name_characters enable row level security;
alter table public.quiz_name_counters enable row level security;
revoke all on public.quiz_name_characters,public.quiz_name_counters from public,anon,authenticated;
grant all on public.quiz_name_characters,public.quiz_name_counters to service_role;
insert into public.quiz_name_characters(id,work,character) values
 ('pokemon-pikachu','寶可夢','皮卡丘'),('pokemon-eevee','寶可夢','伊布'),('pokemon-snorlax','寶可夢','卡比獸'),
 ('chiikawa-chiikawa','吉伊卡哇','吉伊卡哇'),('chiikawa-hachiware','吉伊卡哇','小八'),('chiikawa-usagi','吉伊卡哇','兔兔'),
 ('sanrio-kuromi','三麗鷗','酷洛米'),('sanrio-pochacco','三麗鷗','帕恰狗'),('sanrio-cinnamoroll','三麗鷗','大耳狗喜拿'),('sanrio-pompompurin','三麗鷗','布丁狗'),
 ('conan-conan','名偵探柯南','柯南'),('conan-haibara','名偵探柯南','灰原哀'),('conan-kid','名偵探柯南','怪盜基德'),
 ('mario-mario','超級瑪利歐','瑪利歐'),('mario-luigi','超級瑪利歐','路易吉'),('mario-yoshi','超級瑪利歐','耀西'),
 ('doraemon-doraemon','哆啦A夢','哆啦A夢'),('doraemon-dorami','哆啦A夢','哆啦美'),('doraemon-nobita','哆啦A夢','大雄'),
 ('kirby-kirby','星之卡比','卡比'),('capoo-capoo','貓貓蟲咖波','咖波'),('rabbit-rabbit','好想兔','好想兔') on conflict(id) do nothing;
alter table public.quiz_generated_papers add column if not exists name_year smallint;
alter table public.quiz_generated_papers add column if not exists name_grade smallint;
alter table public.quiz_generated_papers add column if not exists name_subject text;
alter table public.quiz_generated_papers add column if not exists name_character_id text references public.quiz_name_characters(id);
alter table public.quiz_generated_papers add column if not exists name_number bigint;
create unique index if not exists quiz_generated_name_number_idx on public.quiz_generated_papers(user_id,name_year,name_number) where name_number is not null;
create or replace function public.quiz_assign_paper_name() returns trigger language plpgsql security definer set search_path='' as $$
declare cat jsonb;yr smallint;g smallint;sub text;person public.quiz_name_characters;n bigint;
begin
 if tg_op='UPDATE' and old.name_number is not null then
  if row(new.session_id,new.user_id,new.request_id,new.name_year,new.name_grade,new.name_subject,new.name_character_id,new.name_number,new.display_name)
   is distinct from row(old.session_id,old.user_id,old.request_id,old.name_year,old.name_grade,old.name_subject,old.name_character_id,old.name_number,old.display_name) then raise exception 'paper_name_locked';end if;
  return new;
 end if;
 select v.document->'catalog',s.school_year into cat,yr from public.quiz_sessions s join public.quiz_versions v on v.id=s.version_id where s.id=new.session_id and s.owner_id=new.user_id and s.access_mode='self';
 g:=substring(cat->>'volume' from '^([36])')::smallint;sub:=cat->>'subject';
 if yr is null or g is null or sub is null or sub not in ('國語','英語','數學','社會','自然') then raise exception 'paper_name_metadata_invalid';end if;
 select * into person from public.quiz_name_characters where enabled order by random() limit 1;
 if person.id is null then raise exception 'paper_name_pool_empty';end if;
 insert into public.quiz_name_counters as counter(user_id,school_year,last_number) values(new.user_id,yr,1)
  on conflict(user_id,school_year) do update set last_number=counter.last_number+1 returning last_number into n;
 new.name_year:=yr;new.name_grade:=g;new.name_subject:=sub;new.name_character_id:=person.id;new.name_number:=n;
 new.display_name:=(case g when 3 then '三年級' else '六年級' end)||sub||'｜'||person.work||'・'||person.character||'｜'||lpad(n::text,greatest(3,length(n::text)),'0');
 return new;
end $$;
revoke all on function public.quiz_assign_paper_name() from public,anon,authenticated;
drop trigger if exists quiz_assign_paper_name on public.quiz_generated_papers;
create trigger quiz_assign_paper_name before insert or update on public.quiz_generated_papers for each row execute function public.quiz_assign_paper_name();
-- Includes removed papers because their already-earned leaves remain valid. Preserve all frozen versions and answers.
do $$declare paper record;begin
 for paper in select session_id from public.quiz_generated_papers where name_number is null order by user_id,created_at,session_id loop
  update public.quiz_generated_papers set display_name=display_name where session_id=paper.session_id;
 end loop;
end $$;

create or replace function public.quiz_compose(p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); cls text; v_email text; kind text:=coalesce(p_data->>'kind','self');
 amount integer; units jsonb; seed text; conf jsonb; old public.quiz_generated_papers;
 selected text[]:='{}'; chosen public.quiz_question_pool; source public.quiz_question_pool;
 reviewed jsonb; blocks jsonb:='[]'; distribution jsonb; doc jsonb; b_id uuid; v_id uuid; s_id uuid;
 request uuid; d integer; quota integer; count_now integer; result jsonb; paper_name text;
 mode text:=coalesce(p_data->>'difficulty','medium'); passes integer[]; pass integer;
 target_easy integer; target_medium integer; target_hard integer; shortages jsonb;
 selected_course text:=coalesce(p_data->>'course_id','115-1-hanlin-g3-math'); course public.quiz_courses; source_version_id uuid;
begin
 if uid is null then raise exception 'login_required'; end if;
 if coalesce(public.is_teacher(),false) then raise exception 'student_required'; end if;
 select lower(u.email) into v_email from auth.users u where u.id=uid and u.email_confirmed_at is not null;
 select e.class_code into cls from public.student_enrollments e where e.email=v_email and e.school_year=115 and e.class_code ~ '^[36][0-9]{2}$';
 if cls is null then raise exception 'roster_required'; end if;
 if kind='self' then
  select * into course from public.quiz_courses c where c.id=selected_course and c.enabled and c.grade=left(cls,1)::integer;
  if course.id is null then raise exception '%',case when not(p_data ? 'course_id') then 'roster_required' else 'course_unavailable' end;end if;
 end if;
 if jsonb_typeof(p_data) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_data) k where k not in ('kind','count','units','request_id','attempt_id','question_id','name','difficulty','course_id')) then raise exception 'invalid_request'; end if;
 if p_data ? 'course_id' and (kind<>'self' or jsonb_typeof(p_data->'course_id') is distinct from 'string') then raise exception 'invalid_request';end if;
 if p_data ? 'difficulty' and (kind<>'self' or jsonb_typeof(p_data->'difficulty') is distinct from 'string' or mode not in ('easy','medium','hard')) then raise exception 'invalid_request';end if;
 -- Ignore legacy client names; the insert trigger is the sole naming authority.
 if kind not in ('self','extension') or coalesce(p_data->>'count','') !~ '^[0-9]{1,2}$' then raise exception 'invalid_request'; end if;
 amount:=(p_data->>'count')::integer;
 if (kind='self' and amount not in (5,10,15,20)) or (kind='extension' and amount not in (3,5)) then raise exception 'invalid_request'; end if;
 request:=(p_data->>'request_id')::uuid;if request is null then raise exception 'invalid_request'; end if;
 units:=coalesce(p_data->'units','[]');
 if jsonb_typeof(units) is distinct from 'array' or jsonb_array_length(units)>30 or exists(select 1 from jsonb_array_elements(units) u where u::text !~ '^[1-9][0-9]?$' or (kind='self' and not(course.definition->'units' ? (u#>>'{}')))) then raise exception 'invalid_request'; end if;
 select coalesce(jsonb_agg(n order by n),'[]') into units from (select distinct value n from jsonb_array_elements(units)) t;
 if kind='self' and (jsonb_array_length(units)=0 or p_data ? 'question_id' or p_data ? 'attempt_id') then raise exception 'invalid_request'; end if;
 conf:=jsonb_build_object('kind',kind,'count',amount,'units',units,'attempt_id',p_data->>'attempt_id','question_id',p_data->>'question_id');
 -- Keep omitted difficulty compatible with already-saved legacy request IDs.
 if p_data ? 'difficulty' then conf:=conf||jsonb_build_object('difficulty',mode);end if;
 if p_data ? 'course_id' then conf:=conf||jsonb_build_object('course_id',selected_course);end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||request::text,0));
 select * into old from public.quiz_generated_papers g where g.user_id=uid and g.request_id=request;
 if old.session_id is not null then
  if old.deleted_at is not null then raise exception 'paper_removed';end if;
  if (old.config-'name')<>(conf-'name') then raise exception 'submission_conflict'; end if;
  return jsonb_build_object('session_id',old.session_id,'display_name',old.display_name,'distribution',old.actual_distribution,'reused',true);
 end if;
 if kind='extension' then
  reviewed:=public.quiz_wrong_questions(jsonb_build_object('action','detail','attempt_id',p_data->>'attempt_id','question_id',p_data->>'question_id'));
  select s.version_id into source_version_id from public.quiz_sessions s where s.id=(reviewed->>'session_id')::uuid;
  select p.* into source from public.quiz_question_pool p where p.question_id=reviewed->'question'->>'id';
  if source.question_id is null then select p.* into source from public.quiz_pool_aliases a join public.quiz_question_pool p on p.question_id=a.question_id where a.version_id=source_version_id and a.legacy_question_id=reviewed->'question'->>'id';end if;
  -- Legacy source alias is restricted to the already-existing three-up math pool.
  if source.question_id is null and reviewed->'catalog'->>'subject'='數學' and left(reviewed->'catalog'->>'volume',1)='3' then
   select p.* into source from public.quiz_question_pool p where 'midterm_'||p.source_item_id=reviewed->'question'->>'id' and not exists(select 1 from public.quiz_pool_membership m where m.question_id=p.question_id);
  end if;
  if source.question_id is null then raise exception 'extension_unavailable'; end if;
  select coalesce(m.course_id,'115-1-hanlin-g3-math') into selected_course from public.quiz_question_pool p left join public.quiz_pool_membership m on m.question_id=p.question_id where p.question_id=source.question_id and coalesce(m.knowledge_reliable,true);
  select * into course from public.quiz_courses c where c.id=selected_course and c.enabled and c.grade=left(cls,1)::integer;
  if course.id is null then raise exception 'extension_unavailable';end if;
 end if;
 seed:=request::text;
 -- Reserve all target buckets before filling shortages in the agreed order.
 target_easy:=case mode when 'easy' then amount*3/5 when 'medium' then amount/5 else 0 end;
 target_medium:=case mode when 'medium' then amount*3/5 else amount*2/5 end;
 target_hard:=case mode when 'hard' then amount*3/5 when 'medium' then amount/5 else 0 end;
 passes:=case when kind='extension' then array[99] when mode='easy' then array[-3,0,3,0,-3] when mode='hard' then array[-3,0,3,0,3] else array[-3,0,3,0,-3,3] end;
 for pass in 1..cardinality(passes) loop
  d:=passes[pass];
  quota:=case when kind='extension' then amount when pass>3 then amount-cardinality(selected) when d=-3 then target_easy when d=0 then target_medium else target_hard end;
  for count_now in 1..greatest(quota,0) loop
   exit when cardinality(selected)>=amount;
   select p.* into chosen from public.quiz_question_pool p where p.usable and not(p.question_id=any(selected))
    and coalesce((select m.course_id from public.quiz_pool_membership m where m.question_id=p.question_id),'115-1-hanlin-g3-math')=selected_course
    and (kind='extension' or p.difficulty=d)
    and not exists(select 1 from public.quiz_question_pool x where x.question_id=any(selected) and x.group_key=p.group_key)
    and ((kind='self' and exists(select 1 from jsonb_array_elements(units) u where p.unit_ids @> jsonb_build_array(u)))
     or (kind='extension' and p.publisher_explanation and coalesce((select m.knowledge_reliable from public.quiz_pool_membership m where m.question_id=p.question_id),true) and p.knowledge_code=source.knowledge_code and p.group_key<>source.group_key and p.difficulty<=source.difficulty))
    order by
     case when kind='extension' and p.publisher_explanation then 0 when kind='extension' then 1 else 0 end,
     (select count(*) from public.quiz_answers a join public.quiz_attempts at on at.id=a.attempt_id where at.user_id=uid and a.question_id=p.question_id),
     (select count(*) from public.quiz_question_pool x where x.question_id=any(selected) and x.knowledge_code=p.knowledge_code),
     (select count(*) from public.quiz_question_pool x where x.question_id=any(selected) and x.unit_ids=p.unit_ids),
     case when kind='extension' then abs(p.difficulty-source.difficulty) else 0 end,md5(p.question_id||seed) limit 1;
   if chosen.question_id is null then exit; end if;
   selected:=array_append(selected,chosen.question_id);
  end loop;
  if kind='self' and pass=3 then
   select jsonb_build_object('easy',greatest(0,target_easy-count(*) filter(where p.difficulty=-3)),
    'medium',greatest(0,target_medium-count(*) filter(where p.difficulty=0)),
    'hard',greatest(0,target_hard-count(*) filter(where p.difficulty=3))) into shortages
   from public.quiz_question_pool p where p.question_id=any(selected);
  end if;
 end loop;
 if cardinality(selected)=0 then raise exception '%',case when kind='self' then 'self_pool_empty' else 'pool_empty' end; end if;
 for chosen in select p.* from unnest(selected) with ordinality r(id,n) join public.quiz_question_pool p on p.question_id=r.id order by n loop
  blocks:=blocks||jsonb_build_array(jsonb_build_object('id','b_'||chosen.source_item_id,'material',jsonb_build_object('text','','media','[]'::jsonb),'questions',jsonb_build_array(chosen.question)));
 end loop;
 select jsonb_build_object('requested',amount,'actual',cardinality(selected),'easy',count(*) filter(where p.difficulty=-3),'medium',count(*) filter(where p.difficulty=0),'hard',count(*) filter(where p.difficulty=3)) into distribution from public.quiz_question_pool p where p.question_id=any(selected);
 if kind='self' then distribution:=distribution||jsonb_build_object('difficulty',mode,'target',jsonb_build_object('easy',target_easy,'medium',target_medium,'hard',target_hard),'shortages',shortages);end if;
 doc:=jsonb_build_object('schema',1,'title',case when kind='extension' then (course.definition->>'subject')||'同重點延伸練習' else '我的'||(course.definition->>'subject')||'自組卷' end,
  'catalog',jsonb_build_object('school_year','115','volume',course.definition->>'volume','subject',course.definition->>'subject','publisher',course.definition->>'publisher','course_id',selected_course,
   'unit',case when kind='extension' then '同重點再練習：'||source.knowledge_name else (select string_agg((case when course.definition->>'subject' in ('國語','英語') then '' else '第'||(u#>>'{}')||'單元：' end)||(course.definition->'units'->>(u#>>'{}')),'、' order by (u#>>'{}')::integer) from jsonb_array_elements(units) u) end),'blocks',blocks);
 perform public.quiz_validate(doc);
 b_id:=gen_random_uuid();v_id:=gen_random_uuid();s_id:=gen_random_uuid();
 insert into public.quiz_banks(id,owner_id,draft) values(b_id,uid,doc);
 insert into public.quiz_versions(id,bank_id,revision,document) values(v_id,b_id,1,doc);
 insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode) values(s_id,uid,v_id,115,jsonb_build_array(cls),'immediate',false,true,'self');
 insert into public.quiz_generated_papers(session_id,user_id,request_id,config,actual_distribution) values(s_id,uid,request,conf,distribution) returning display_name into paper_name;
 return jsonb_build_object('session_id',s_id,'display_name',paper_name,'distribution',distribution,'reused',false);
end $$;
revoke all on function public.quiz_compose(jsonb) from public,anon;
grant execute on function public.quiz_compose(jsonb) to authenticated;
-- Compatibility endpoint: old clients cannot restore free-text names.
create or replace function public.quiz_rename_paper(p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'login_required';end if;
 if coalesce(public.is_teacher(),false) then raise exception 'student_required';end if;
 raise exception 'paper_name_locked';
end $$;
revoke all on function public.quiz_rename_paper(jsonb) from public,anon;
grant execute on function public.quiz_rename_paper(jsonb) to authenticated;
-- Remove only from the student's list. Preserve versions, attempts and wrong-answer review.
create or replace function public.quiz_delete_paper(p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); identity jsonb; paper uuid;
begin
 if uid is null then raise exception 'login_required';end if;
 identity:=public.quiz_action('library_sessions');
 if identity->>'role'<>'student' then raise exception 'student_required';end if;
 if jsonb_typeof(p_data) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_data) k where k<>'session_id') then raise exception 'invalid_request';end if;
 paper:=(p_data->>'session_id')::uuid;
 update public.quiz_generated_papers g set deleted_at=coalesce(g.deleted_at,now())
  where g.session_id=paper and g.user_id=uid and exists(select 1 from public.quiz_sessions s where s.id=g.session_id and s.owner_id=uid and s.access_mode='self');
 if not found then raise exception 'session_unavailable';end if;
 return jsonb_build_object('session_id',paper,'removed',true);
end $$;
revoke all on function public.quiz_delete_paper(jsonb) from public,anon;
grant execute on function public.quiz_delete_paper(jsonb) to authenticated;
create or replace function public.quiz_pool_catalog() returns jsonb
language plpgsql security definer set search_path='' as $$
declare identity jsonb; result jsonb; courses jsonb; c public.quiz_courses; units jsonb; total integer;
begin
 identity:=public.quiz_action('library_sessions');
 if identity->>'role'<>'student' then return jsonb_build_object('available',false,'units','[]'::jsonb,'courses','[]'::jsonb);end if;
 courses:='[]';
 for c in select * from public.quiz_courses where enabled and grade=(identity->>'grade')::integer order by id loop
  select coalesce(jsonb_agg(jsonb_build_object('id',u.n::integer,'title',c.definition->'units'->>u.n,'count',u.num) order by u.n::integer),'[]') into units from (
   select value n,count(*) num from public.quiz_question_pool p left join public.quiz_pool_membership m on m.question_id=p.question_id,lateral jsonb_array_elements_text(p.unit_ids)
   where p.usable and coalesce(m.course_id,'115-1-hanlin-g3-math')=c.id group by value) u;
  select count(*) into total from public.quiz_question_pool p left join public.quiz_pool_membership m on m.question_id=p.question_id where p.usable and coalesce(m.course_id,'115-1-hanlin-g3-math')=c.id;
  if total>0 then courses:=courses||jsonb_build_array(jsonb_build_object('id',c.id,'subject',c.definition->>'subject','grade',c.grade,'volume',c.definition->>'volume','units',units,'total',total,'extension_available',exists(select 1 from public.quiz_question_pool p left join public.quiz_pool_membership m on m.question_id=p.question_id where p.usable and coalesce(m.course_id,'115-1-hanlin-g3-math')=c.id and coalesce(m.knowledge_reliable,true))));end if;
 end loop;
 result:=coalesce((select value from jsonb_array_elements(courses) where value->>'id'='115-1-hanlin-g3-math'),courses->0,'{}');
 return result||jsonb_build_object('available',jsonb_array_length(courses)>0,'courses',courses,'units',coalesce(result->'units','[]'));
end $$;
revoke all on function public.quiz_pool_catalog() from public,anon;
grant execute on function public.quiz_pool_catalog() to authenticated;
commit;
