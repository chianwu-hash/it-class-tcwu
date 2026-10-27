-- 測驗場次與本人作答；2026-10-26 使用者授權接上真實 Supabase 保存。
begin;

create table if not exists public.quiz_banks (
 id uuid primary key,
 owner_id uuid not null references auth.users(id),
 revision integer not null default 1 check (revision > 0),
 draft jsonb not null,
 updated_at timestamptz not null default now()
);
create table if not exists public.quiz_versions (
 id uuid primary key default gen_random_uuid(),
 bank_id uuid not null references public.quiz_banks(id),
 revision integer not null,
 document jsonb not null,
 created_at timestamptz not null default now(),
 unique(bank_id,revision)
);
create table if not exists public.quiz_sessions (
 id uuid primary key,
 owner_id uuid not null references auth.users(id),
 version_id uuid not null references public.quiz_versions(id),
 school_year integer not null,
 class_codes jsonb not null,
 reveal text not null check(reveal in ('immediate','complete')),
 shuffle_questions boolean not null,
 shuffle_options boolean not null,
 access_mode text not null default 'classroom' check(access_mode in ('classroom','personal','practice','self')),
 status text not null default 'open' check(status in ('open','closed')),
 created_at timestamptz not null default now()
);
alter table public.quiz_sessions add column if not exists access_mode text not null default 'classroom'
 check(access_mode in ('classroom','personal','practice','self'));
alter table public.quiz_sessions drop constraint if exists quiz_sessions_access_mode_check;
alter table public.quiz_sessions add constraint quiz_sessions_access_mode_check
 check(access_mode in ('classroom','personal','practice','self'));
create table if not exists public.quiz_attempts (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.quiz_sessions(id),
 user_id uuid not null references auth.users(id),
 question_order jsonb not null,
 option_orders jsonb not null,
 created_at timestamptz not null default now(),
 unique(session_id,user_id)
);
create table if not exists public.quiz_answers (
 attempt_id uuid not null references public.quiz_attempts(id),
 question_id text not null,
 request_id uuid not null,
 response jsonb not null,
 correct boolean not null,
 created_at timestamptz not null default now(),
 primary key(attempt_id,question_id),
 unique(attempt_id,request_id)
);

create table if not exists public.quiz_generated_papers (
 session_id uuid primary key references public.quiz_sessions(id),
 user_id uuid not null references auth.users(id), request_id uuid not null,
 config jsonb not null, actual_distribution jsonb not null, created_at timestamptz not null default now(),
 unique(user_id,request_id)
);
alter table public.quiz_generated_papers enable row level security;
alter table public.quiz_generated_papers add column if not exists display_name text
 check(display_name is null or length(trim(display_name)) between 1 and 60);
alter table public.quiz_generated_papers add column if not exists deleted_at timestamptz;
revoke all on public.quiz_generated_papers from public,anon,authenticated;
grant all on public.quiz_generated_papers to service_role;
alter table public.quiz_banks enable row level security;
alter table public.quiz_versions enable row level security;
alter table public.quiz_sessions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_answers enable row level security;
revoke all on public.quiz_banks,public.quiz_versions,public.quiz_sessions,public.quiz_attempts,public.quiz_answers from public,anon,authenticated;
grant all on public.quiz_banks,public.quiz_versions,public.quiz_sessions,public.quiz_attempts,public.quiz_answers to service_role;

create or replace function public.quiz_valid_runs(runs jsonb, media jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare r jsonb; idx integer; w numeric;
begin
 if jsonb_typeof(runs) is distinct from 'array' then return false; end if;
 if jsonb_array_length(runs)>200 then return false; end if;
 for r in select value from jsonb_array_elements(runs) loop
  if jsonb_typeof(r) is distinct from 'object' then return false; end if;
  if r->>'type'='text' then
   if jsonb_typeof(r->'text') is distinct from 'string' or length(r->>'text')>20000
    or exists(select 1 from jsonb_object_keys(r) k where k not in ('type','text')) then return false; end if;
  elsif r->>'type'='image' then
   if jsonb_typeof(r->'media_index') is distinct from 'number' or (r->>'media_index') !~ '^[0-7]$'
    or jsonb_typeof(r->'width') is distinct from 'number'
    or exists(select 1 from jsonb_object_keys(r) k where k not in ('type','media_index','width')) then return false; end if;
   idx:=(r->>'media_index')::integer; w:=(r->>'width')::numeric;
   if media->idx->>'kind' is distinct from 'image' or w<12 or w>800 then return false; end if;
  else return false; end if;
 end loop;
 return true;
end $$;

create or replace function public.quiz_valid_content(c jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare m jsonb; part jsonb; row_value jsonb; cell jsonb; columns integer; total_text integer:=0;
begin
 if jsonb_typeof(c) is distinct from 'object' or jsonb_typeof(c->'text') is distinct from 'string'
  or length(c->>'text')>20000 or jsonb_typeof(c->'media') is distinct from 'array' then return false; end if;
 if exists(select 1 from jsonb_object_keys(c) x where x not in ('text','media','layout')) then return false; end if;
 if jsonb_array_length(c->'media')>8 then return false; end if;
 for m in select value from jsonb_array_elements(c->'media') loop
  if m->>'kind' is null or m->>'kind' not in ('image','audio') or jsonb_typeof(m->'url') is distinct from 'string'
   or (m->>'url') !~ '^https://[^[:space:]<>]+$' or length(m->>'url')>2000
   or jsonb_typeof(m->'alt') is distinct from 'string' or length(m->>'alt')>500 then return false; end if;
  if exists(select 1 from jsonb_object_keys(m) x where x not in ('kind','url','alt')) then return false; end if;
 end loop;
 if c ? 'layout' then
  if jsonb_typeof(c->'layout') is distinct from 'array' then return false; end if;
  if jsonb_array_length(c->'layout') not between 1 and 100 then return false; end if;
  for part in select value from jsonb_array_elements(c->'layout') loop
   if jsonb_typeof(part) is distinct from 'object' then return false; end if;
   if part->>'type'='paragraph' then
    if not public.quiz_valid_runs(part->'runs',c->'media') or exists(select 1 from jsonb_object_keys(part) k where k not in ('type','runs')) then return false; end if;
    select total_text+coalesce(sum(length(r->>'text')),0) into total_text from jsonb_array_elements(part->'runs') r where r->>'type'='text';
   elsif part->>'type'='table' then
    if jsonb_typeof(part->'rows') is distinct from 'array' or exists(select 1 from jsonb_object_keys(part) k where k not in ('type','rows')) then return false; end if;
    if jsonb_array_length(part->'rows') not between 1 and 30 then return false; end if;
    columns:=null;
    for row_value in select value from jsonb_array_elements(part->'rows') loop
     if jsonb_typeof(row_value) is distinct from 'array' then return false; end if;
     if jsonb_array_length(row_value) not between 1 and 12 or (columns is not null and jsonb_array_length(row_value)<>columns) then return false; end if;
     columns:=jsonb_array_length(row_value);
     for cell in select value from jsonb_array_elements(row_value) loop
      if not public.quiz_valid_runs(cell,c->'media') then return false; end if;
      select total_text+coalesce(sum(length(r->>'text')),0) into total_text from jsonb_array_elements(cell) r where r->>'type'='text';
     end loop;
    end loop;
   else return false; end if;
  end loop;
  if total_text>20000 then return false; end if;
 end if;
 return true;
end $$;

create or replace function public.quiz_validate(d jsonb) returns void
language plpgsql immutable set search_path='' as $$
declare b jsonb; q jsonb; o jsonb; a jsonb; ids text[]:='{}'; bids text[]:='{}'; opts text[]; n integer:=0; k text;
begin
 if jsonb_typeof(d) is distinct from 'object' or d->>'schema' is distinct from '1'
  or jsonb_typeof(d->'title') is distinct from 'string' or length(trim(d->>'title')) not between 1 and 200
  or jsonb_typeof(d->'catalog') is distinct from 'object' or length((d->'catalog')::text)>4000
  or jsonb_typeof(d->'blocks') is distinct from 'array' then raise exception 'invalid_document'; end if;
 if jsonb_array_length(d->'blocks') not between 1 and 100 then raise exception 'invalid_document'; end if;
 for b in select value from jsonb_array_elements(d->'blocks') loop
  if coalesce(b->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$' or b->>'id'=any(bids)
   or not public.quiz_valid_content(b->'material') or jsonb_typeof(b->'questions') is distinct from 'array' then raise exception 'invalid_block'; end if;
  bids:=array_append(bids,b->>'id');
  if jsonb_array_length(b->'questions') not between 1 and 30 then raise exception 'invalid_block'; end if;
  for q in select value from jsonb_array_elements(b->'questions') loop
   n:=n+1;
   if coalesce(q->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$' or q->>'id'=any(ids)
    or not public.quiz_valid_content(q->'prompt') or not public.quiz_valid_content(q->'explanation')
    or length(trim(q->'prompt'->>'text'))=0 or jsonb_typeof(q->'answer') is distinct from 'object' then raise exception 'invalid_question'; end if;
   ids:=array_append(ids,q->>'id');
   if q->>'type'='single' then
    if jsonb_typeof(q->'options') is distinct from 'array' then raise exception 'invalid_options'; end if;
    if jsonb_array_length(q->'options') not between 2 and 8 then raise exception 'invalid_options'; end if;
    opts:='{}';
    for o in select value from jsonb_array_elements(q->'options') loop
     if coalesce(o->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$' or o->>'id'=any(opts)
      or not public.quiz_valid_content(o->'content') then raise exception 'invalid_options'; end if;
     opts:=array_append(opts,o->>'id');
    end loop;
    if not coalesce(q->'answer'->>'option_id'=any(opts),false) then raise exception 'invalid_answer'; end if;
   elsif q->>'type'='short' then
    if q ? 'options' then raise exception 'invalid_options'; end if;
    if jsonb_typeof(q->'answer'->'accepted') is distinct from 'array' then raise exception 'invalid_answer'; end if;
    if jsonb_array_length(q->'answer'->'accepted') not between 1 and 20 then raise exception 'invalid_answer'; end if;
    for a in select value from jsonb_array_elements(q->'answer'->'accepted') loop
     if jsonb_typeof(a) is distinct from 'string' or length(trim(a#>>'{}')) not between 1 and 2000 then raise exception 'invalid_answer'; end if;
    end loop;
   else raise exception 'invalid_question_type'; end if;
   -- 白名單投影仍是學生回傳的唯一來源，不信任教師輸入的額外欄位。
   for k in select jsonb_object_keys(q) loop
    if k not in ('id','type','prompt','explanation','options','answer') then raise exception 'invalid_question_field'; end if;
   end loop;
  end loop;
 end loop;
 if n>200 or octet_length(d::text)>1000000 then raise exception 'document_too_large'; end if;
end $$;

-- 僅白名單欄位：不以移除 answer 的方式留下可能新增的秘密欄位。
create or replace function public.quiz_student_document(d jsonb, qo jsonb, oo jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare qid jsonb; q jsonb; b jsonb; opts jsonb; items jsonb:='[]';
begin
 for qid in select value from jsonb_array_elements(qo) loop
  select bx,qx into b,q from jsonb_array_elements(d->'blocks') bx,
   lateral jsonb_array_elements(bx->'questions') qx where qx->>'id'=qid#>>'{}';
  select coalesce(jsonb_agg(jsonb_build_object('id',o->>'id','content',o->'content') order by ord),'[]') into opts
   from jsonb_array_elements(coalesce(q->'options','[]')) o
   join jsonb_array_elements_text(coalesce(oo->(q->>'id'),'[]')) with ordinality r(id,ord) on o->>'id'=r.id;
  items:=items||jsonb_build_array(jsonb_build_object('id',q->>'id','type',q->>'type','prompt',q->'prompt',
   'block_id',b->>'id','material',b->'material','options',opts));
 end loop;
 return jsonb_build_object('title',d->>'title','questions',items);
end $$;

create or replace function public.quiz_action(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare
 uid uuid:=auth.uid(); teacher boolean:=coalesce(public.is_teacher(),false); v_email text;
 bank public.quiz_banks; ver public.quiz_versions; sess public.quiz_sessions; att public.quiz_attempts; ans public.quiz_answers;
 d jsonb; b jsonb; q jsonb; o jsonb; qo jsonb; oo jsonb:='{}'; result jsonb; reviews jsonb:='[]'; responses jsonb;
 target uuid; qid text; response jsonb; correct boolean; done boolean; groupdone boolean; n integer; cls text; mode text; student_grade integer;
begin
 if uid is null then raise exception 'login_required'; end if;
 if p_action in ('list','get','save','publish','versions','open','monitor','close','sessions','personal_sessions') and not teacher then raise exception 'teacher_required'; end if;
 if p_action in ('personal_sessions','library_sessions') then
  if not teacher then
   select lower(u.email) into v_email from auth.users u where u.id=uid and u.email_confirmed_at is not null;
   select left(e.class_code,1)::integer into student_grade from public.student_enrollments e
    where e.email=v_email and e.school_year=115 and e.class_code ~ '^[36][0-9]{2}$';
   if student_grade is null then raise exception 'roster_required'; end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'version_id',s.version_id,'title',v.document->>'title',
   'catalog',v.document->'catalog','status',s.status,
   'generated',s.access_mode='self','display_name',g.display_name,'saved_at',g.created_at,
   'generated_kind',g.config->>'kind','unit_ids',g.config->'units','distribution',g.actual_distribution,
   'learning_point',case when g.config->>'kind'='extension' then regexp_replace(v.document->'catalog'->>'unit','^同重點再練習[：:]\s*','') else null end,
   'total',(select count(*) from jsonb_array_elements(v.document->'blocks') b,lateral jsonb_array_elements(b->'questions') q),
   'answered',(select count(*) from public.quiz_answers x join public.quiz_attempts a on a.id=x.attempt_id where a.session_id=s.id and a.user_id=uid),
   'correct',(select count(*) from public.quiz_answers x join public.quiz_attempts a on a.id=x.attempt_id where a.session_id=s.id and a.user_id=uid and x.correct)
   ) order by v.document->'catalog'->>'volume',v.document->'catalog'->>'subject',v.document->'catalog'->>'unit'),'[]') into result
   from public.quiz_sessions s join public.quiz_versions v on v.id=s.version_id
   left join public.quiz_generated_papers g on g.session_id=s.id and g.user_id=uid
   where (teacher and s.owner_id=uid and s.access_mode='personal')
    or (not teacher and s.access_mode in ('practice','self') and (s.access_mode<>'self' or exists(select 1 from public.quiz_generated_papers g where g.session_id=s.id and g.user_id=uid and g.deleted_at is null)) and exists(select 1 from public.student_enrollments e
     where e.email=v_email and e.school_year=s.school_year and s.class_codes ? e.class_code));
  return jsonb_build_object('sessions',result,'role',case when teacher then 'teacher' else 'student' end,'grade',student_grade);
 end if;
 if p_action='sessions' then
  select coalesce(jsonb_agg(to_jsonb(s)||jsonb_build_object('title',v.document->>'title','revision',v.revision) order by s.created_at desc),'[]') into result
   from public.quiz_sessions s join public.quiz_versions v on v.id=s.version_id where s.owner_id=uid;
  return jsonb_build_object('sessions',result);
 end if;
 if p_action='list' then
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'revision',r.revision,'title',r.draft->>'title','catalog',r.draft->'catalog','updated_at',r.updated_at) order by r.updated_at desc),'[]') into result
   from public.quiz_banks r where r.owner_id=uid and (coalesce(p_data->>'search','')='' or strpos(lower(r.draft::text),lower(p_data->>'search'))>0);
  return jsonb_build_object('banks',result);
 end if;
 if p_action in ('get','save','publish','versions') then
  target:=(p_data->>'bank_id')::uuid;
  -- 同一份題庫的首次建立、修改與版本固定共用交易鎖。
  perform pg_advisory_xact_lock(hashtextextended(target::text,0));
  select * into bank from public.quiz_banks where id=target for update;
  if bank.id is not null and bank.owner_id<>uid then raise exception 'bank_unavailable'; end if;
  if p_action='save' then
   d:=p_data->'document';perform public.quiz_validate(d);
   if bank.id is null then
    if (p_data->>'expected_revision')::integer is distinct from 0 then raise exception 'revision_changed'; end if;
    insert into public.quiz_banks(id,owner_id,draft) values(target,uid,d) returning * into bank;
   elsif bank.draft=d then null; -- 遺失回應後重試，不重複增加 revision。
   else
    if bank.revision is distinct from (p_data->>'expected_revision')::integer then raise exception 'revision_changed'; end if;
    update public.quiz_banks set draft=d,revision=revision+1,updated_at=now() where id=target returning * into bank;
   end if;
  end if;
  if bank.id is null then raise exception 'bank_unavailable'; end if;
  if p_action='publish' then
   if bank.revision is distinct from (p_data->>'expected_revision')::integer then raise exception 'revision_changed'; end if;
   select * into ver from public.quiz_versions where bank_id=bank.id and revision=bank.revision;
   if ver.id is not null then return to_jsonb(ver); end if;
   if jsonb_path_exists(bank.draft,'$.blocks[*].**.media[*]') then raise exception 'media_freeze_required'; end if;
   perform public.quiz_validate(bank.draft);
   insert into public.quiz_versions(bank_id,revision,document) values(bank.id,bank.revision,bank.draft)
    on conflict(bank_id,revision) do nothing;
   select * into ver from public.quiz_versions where bank_id=bank.id and revision=bank.revision;
   return to_jsonb(ver);
  elsif p_action='versions' then
   select coalesce(jsonb_agg(to_jsonb(v) order by revision desc),'[]') into result from public.quiz_versions v where bank_id=bank.id;
   return jsonb_build_object('versions',result);
  end if;
  return to_jsonb(bank);
 end if;
 if p_action='open' then
  select v.* into ver from public.quiz_versions v join public.quiz_banks k on k.id=v.bank_id where v.id=(p_data->>'version_id')::uuid and k.owner_id=uid;
  if ver.id is null then raise exception 'version_unavailable'; end if;
  mode:=coalesce(p_data->>'access_mode','classroom');
  if mode not in ('classroom','personal','practice') or jsonb_typeof(p_data->'class_codes') is distinct from 'array' then raise exception 'invalid_session'; end if;
  if (mode in ('classroom','practice') and jsonb_array_length(p_data->'class_codes') not between 1 and 20)
   or (mode='personal' and jsonb_array_length(p_data->'class_codes')<>0) or (p_data->>'school_year')::integer not between 100 and 200
   or exists(select 1 from jsonb_array_elements_text(p_data->'class_codes') c where c !~ '^[36][0-9]{2}$')
   or coalesce(p_data->>'reveal','') not in ('immediate','complete') then raise exception 'invalid_session'; end if;
  insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode)
   values((p_data->>'session_id')::uuid,uid,ver.id,(p_data->>'school_year')::integer,p_data->'class_codes',p_data->>'reveal',
    coalesce((p_data->>'shuffle_questions')::boolean,false),coalesce((p_data->>'shuffle_options')::boolean,false),mode) on conflict(id) do nothing;
  select * into sess from public.quiz_sessions where id=(p_data->>'session_id')::uuid;
  if sess.owner_id<>uid or sess.version_id<>ver.id or sess.class_codes<>p_data->'class_codes' or sess.school_year<>(p_data->>'school_year')::integer
   or sess.reveal<>p_data->>'reveal' or sess.shuffle_questions<>coalesce((p_data->>'shuffle_questions')::boolean,false)
   or sess.shuffle_options<>coalesce((p_data->>'shuffle_options')::boolean,false) or sess.access_mode<>mode then raise exception 'session_conflict'; end if;
  return to_jsonb(sess);
 end if;
 select * into sess from public.quiz_sessions where id=(p_data->>'session_id')::uuid for update;
 if sess.id is null then raise exception 'session_unavailable'; end if;
 if sess.access_mode='self' and not exists(select 1 from public.quiz_generated_papers g where g.session_id=sess.id and g.user_id=uid) then raise exception 'session_unavailable'; end if;
 if p_action in ('monitor','close') then
  if sess.owner_id<>uid then raise exception 'session_unavailable'; end if;
  if p_action='close' then update public.quiz_sessions set status='closed' where id=sess.id;return jsonb_build_object('ok',true); end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id',a.user_id,'answered',(select count(*) from public.quiz_answers x where x.attempt_id=a.id),
   'total',jsonb_array_length(a.question_order),'class_code',e.class_code,'seat_no',e.seat_no,'display_name',e.display_name,
   'last_submitted_at',(select max(x.created_at) from public.quiz_answers x where x.attempt_id=a.id)) order by a.created_at),'[]') into result
   from public.quiz_attempts a join auth.users u on u.id=a.user_id
    left join public.student_enrollments e on e.email=lower(u.email) and e.school_year=sess.school_year
   where a.session_id=sess.id;
  return jsonb_build_object('status',sess.status,'students',result);
 end if;
 if p_action not in ('join','resume','submit') then raise exception 'invalid_action'; end if;
 if sess.access_mode='personal' then
  if not teacher or sess.owner_id<>uid then raise exception 'session_unavailable'; end if;
 else
  if teacher then raise exception 'student_required'; end if;
  select lower(u.email) into v_email from auth.users u where u.id=uid and u.email_confirmed_at is not null;
  select e.class_code into cls from public.student_enrollments e where e.email=v_email and e.school_year=sess.school_year and sess.class_codes ? e.class_code;
  if cls is null then raise exception 'roster_required'; end if;
 end if;
 select * into ver from public.quiz_versions where id=sess.version_id;d:=ver.document;
 select * into att from public.quiz_attempts where session_id=sess.id and user_id=uid;
 if att.id is null then
  if p_action<>'join' or sess.status<>'open' then raise exception 'attempt_unavailable'; end if;
  select count(*) into n from public.quiz_attempts where session_id=sess.id;
  if sess.access_mode='classroom' and n>=29 then raise exception 'session_full'; end if;
  -- 暫定：題組位置固定，只在單題區塊的既有位置間亂序。
  with blocks as (select value b, ordinality pos from jsonb_array_elements(d->'blocks') with ordinality),
   singles as (select b,row_number() over(order by case when sess.shuffle_questions then random() else pos::float end) rn from blocks where jsonb_array_length(b->'questions')=1),
   slots as (select pos,row_number() over(order by pos) rn from blocks where jsonb_array_length(b->'questions')=1),
   arranged as (select s.b,t.pos from singles s join slots t using(rn) union all select b,pos from blocks where jsonb_array_length(b->'questions')>1)
   select jsonb_agg(q->>'id' order by pos,ord) into qo from arranged,lateral jsonb_array_elements(b->'questions') with ordinality x(q,ord);
  for b in select value from jsonb_array_elements(d->'blocks') loop
   for q in select value from jsonb_array_elements(b->'questions') loop
    select coalesce(jsonb_agg(o->>'id' order by case when sess.shuffle_options then random() else ord::float end),'[]') into result
     from jsonb_array_elements(coalesce(q->'options','[]')) with ordinality x(o,ord);
    oo:=oo||jsonb_build_object(q->>'id',result);
   end loop;
  end loop;
  insert into public.quiz_attempts(session_id,user_id,question_order,option_orders) values(sess.id,uid,qo,oo) returning * into att;
 end if;
 if p_action='submit' then
  qid:=p_data->>'question_id';response:=p_data->'response';
  select bx,qx into b,q from jsonb_array_elements(d->'blocks') bx,lateral jsonb_array_elements(bx->'questions') qx where qx->>'id'=qid;
  if q is null then raise exception 'question_unavailable'; end if;
  select * into ans from public.quiz_answers where attempt_id=att.id and (question_id=qid or request_id=(p_data->>'request_id')::uuid) limit 1;
  if ans.attempt_id is not null then
   if ans.question_id<>qid or ans.request_id is distinct from (p_data->>'request_id')::uuid or ans.response is distinct from response then raise exception 'submission_conflict'; end if;
  else
   if sess.status<>'open' then raise exception 'session_closed'; end if;
   select value#>>'{}' into cls from jsonb_array_elements(att.question_order) x(value) where not exists(select 1 from public.quiz_answers a where a.attempt_id=att.id and a.question_id=x.value#>>'{}') limit 1;
   if cls is distinct from qid then raise exception 'question_order'; end if;
   if jsonb_typeof(response) is distinct from 'string' or length(response#>>'{}') not between 1 and 2000 or (p_data->>'request_id')::uuid is null then raise exception 'invalid_response'; end if;
   if q->>'type'='single' then
    if not exists(select 1 from jsonb_array_elements(q->'options') opt where opt->>'id'=response#>>'{}') then raise exception 'invalid_response'; end if;
    correct:=(response#>>'{}')=q->'answer'->>'option_id';
   else
    -- 暫定僅去頭尾空白，比對教師列出的可接受答案，保留原始 response。
    correct:=exists(select 1 from jsonb_array_elements_text(q->'answer'->'accepted') a where trim(a)=trim(response#>>'{}'));
   end if;
   insert into public.quiz_answers(attempt_id,question_id,request_id,response,correct) values(att.id,qid,(p_data->>'request_id')::uuid,response,correct);
  end if;
 end if;
 select count(*)=jsonb_array_length(att.question_order),coalesce(jsonb_object_agg(a.question_id,a.response),'{}') into done,responses from public.quiz_answers a where a.attempt_id=att.id;
 for b in select value from jsonb_array_elements(d->'blocks') loop
  select not exists(select 1 from jsonb_array_elements(b->'questions') x where not exists(select 1 from public.quiz_answers a where a.attempt_id=att.id and a.question_id=x->>'id')) into groupdone;
  if (sess.reveal='complete' and done) or (sess.reveal='immediate' and groupdone) then
   for q in select value from jsonb_array_elements(b->'questions') loop
    select * into ans from public.quiz_answers where attempt_id=att.id and question_id=q->>'id';
    reviews:=reviews||jsonb_build_array(jsonb_build_object('question_id',q->>'id','answer',q->'answer','explanation',q->'explanation','correct',ans.correct));
   end loop;
  end if;
 end loop;
 if sess.access_mode='self' then
  select display_name into cls from public.quiz_generated_papers where session_id=sess.id and user_id=uid;
  if cls is not null then d:=jsonb_set(d,'{title}',to_jsonb(cls));end if;
 end if;
 return jsonb_build_object('attempt_id',att.id,'session_id',sess.id,'version_id',sess.version_id,'status',sess.status,'complete',done,
  'document',public.quiz_student_document(d,att.question_order,att.option_orders),'responses',responses,'reviews',reviews);
end $$;
revoke all on function public.quiz_valid_runs(jsonb,jsonb),public.quiz_valid_content(jsonb),public.quiz_validate(jsonb),public.quiz_student_document(jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.quiz_action(text,jsonb) from public,anon;
grant execute on function public.quiz_action(text,jsonb) to authenticated;
commit;
