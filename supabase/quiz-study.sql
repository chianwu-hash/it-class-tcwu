-- Candidate only. Do not apply to production without separate authorization.
-- Install after the current quiz_action / past snapshot wrappers. No grading changes.
begin;
create table if not exists public.quiz_textbooks(
 id uuid primary key,grade integer not null,school_year integer not null,semester integer not null,
 title text not null,source_sha256 text not null check(source_sha256~'^[a-f0-9]{64}$'),enabled boolean not null default false);
create table if not exists public.quiz_textbook_pages(
 book_id uuid not null references public.quiz_textbooks(id),id text not null,
 printed_pages integer[] not null check(cardinality(printed_pages)>0 and 0<all(printed_pages)),
 sequence text not null,sha256 text not null check(sha256~'^[a-f0-9]{64}$'),
 bytes integer not null check(bytes between 1 and 8388608),provenance jsonb not null default '{}',
 primary key(book_id,id),unique(book_id,sha256));
create table if not exists public.quiz_study_packages(
 id uuid primary key,kind text not null check(kind in('normal','past')),version_id uuid not null,
 approved boolean not null default false,enabled boolean not null default false,
 provenance jsonb not null,created_at timestamptz not null default now(),unique(id,kind,version_id));
create table if not exists public.quiz_study_items(
 package_id uuid not null references public.quiz_study_packages(id),group_id text not null default '',question_id text not null,
 book_id uuid references public.quiz_textbooks(id),primary_page integer,reference_pages integer[] not null default '{}',
 student_explanation text check(length(student_explanation) between 1 and 12000),
 origin text not null check(origin in('ai','publisher','official')),teacher_notes jsonb not null default '{}',
 primary key(package_id,group_id,question_id),
 check((book_id is null and primary_page is null and cardinality(reference_pages)=0) or
 (book_id is not null and primary_page>0 and primary_page=any(reference_pages))));
create table if not exists public.quiz_study_attempts(
 kind text not null,attempt_id uuid not null,version_id uuid not null,package_id uuid not null,
 primary key(kind,attempt_id),foreign key(package_id,kind,version_id) references public.quiz_study_packages(id,kind,version_id));
create index if not exists quiz_study_version on public.quiz_study_packages(kind,version_id,created_at desc) where enabled and approved;
create index if not exists quiz_study_package_pins on public.quiz_study_attempts(package_id);
do $$declare t text;begin foreach t in array array['quiz_textbooks','quiz_textbook_pages','quiz_study_packages','quiz_study_items','quiz_study_attempts'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
end loop;end$$;

create or replace function public.quiz_study_insert_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_table_name='quiz_study_items' then
  if exists(select 1 from public.quiz_study_packages p where p.id=new.package_id and p.enabled) or exists(select 1 from public.quiz_study_attempts a where a.package_id=new.package_id) then raise exception 'study_fixed_version';end if;
 elsif exists(select 1 from public.quiz_textbooks b where b.id=new.book_id and b.enabled) or exists(select 1 from public.quiz_study_items i join public.quiz_study_attempts a on a.package_id=i.package_id where i.book_id=new.book_id) then raise exception 'study_fixed_version';end if;
 return new;
end$$;
drop trigger if exists study_insert_guard on public.quiz_study_items;
create trigger study_insert_guard before insert on public.quiz_study_items for each row execute function public.quiz_study_insert_guard();
drop trigger if exists study_insert_guard on public.quiz_textbook_pages;
create trigger study_insert_guard before insert on public.quiz_textbook_pages for each row execute function public.quiz_study_insert_guard();

create or replace function public.quiz_study_immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'study_fixed_version';end if;
 if tg_table_name in('quiz_textbooks','quiz_study_packages') and (to_jsonb(new)-'enabled')=(to_jsonb(old)-'enabled') then return new;end if;
 raise exception 'study_fixed_version';
end$$;
do $$declare t text;begin foreach t in array array['quiz_textbooks','quiz_textbook_pages','quiz_study_packages','quiz_study_items','quiz_study_attempts'] loop
 execute format('drop trigger if exists study_immutable on public.%I',t);
 execute format('create trigger study_immutable before update or delete on public.%I for each row execute function public.quiz_study_immutable()',t);
end loop;end$$;

-- Only called by the authenticated snapshot wrappers / media authorization below.
create or replace function public.quiz_study_payload(p_kind text,p_attempt uuid,p_version uuid,p_disclosed jsonb default '[]')
returns jsonb language plpgsql security definer set search_path='' as $$
declare identity jsonb;d jsonb;pkg public.quiz_study_packages;link public.quiz_study_items;
 refs jsonb:='{}';explanations jsonb:='{}';pages jsonb;ref jsonb;known boolean;book_ids uuid[]:='{}';key text;field jsonb;
begin
 if not exists(select 1 from public.quiz_study_attempts where kind=p_kind and attempt_id=p_attempt and version_id=p_version)
  and not exists(select 1 from public.quiz_study_packages where kind=p_kind and version_id=p_version and enabled and approved) then return '{}'::jsonb;end if;
 if p_kind='normal' and coalesce(public.is_teacher(),false) then
  -- The existing teacher trial joins only an owned session. Derive this book's
  -- grade from that fixed version, never from a browser-provided identity.
  select jsonb_build_object('grade',substring(v.document->'catalog'->>'volume' from '^([3469])')::integer) into identity
   from public.quiz_attempts a join public.quiz_sessions s on s.id=a.session_id join public.quiz_versions v on v.id=s.version_id
   where a.id=p_attempt and a.user_id=auth.uid() and s.owner_id=auth.uid() and v.id=p_version;
  if identity is null then raise exception 'attempt_unavailable';end if;
 else identity:=public.quiz_student_identity();end if;
 if p_kind='normal' then
  select v.document into d from public.quiz_attempts a join public.quiz_sessions s on s.id=a.session_id
   join public.quiz_versions v on v.id=s.version_id where a.id=p_attempt and a.user_id=auth.uid() and v.id=p_version;
 elsif p_kind='past' then
  select v.document into d from public.quiz_past_attempts a join public.quiz_past_versions v on v.id=a.version_id
   join public.quiz_past_papers p on p.id=a.paper_id where a.id=p_attempt and a.user_id=auth.uid() and v.id=p_version and p.grade=(identity->>'grade')::integer;
 else raise exception 'study_unavailable';end if;
 if d is null then raise exception 'attempt_unavailable';end if;
 select p.* into pkg from public.quiz_study_attempts a join public.quiz_study_packages p on p.id=a.package_id
  where a.kind=p_kind and a.attempt_id=p_attempt and a.version_id=p_version;
 if pkg.id is null then
  select * into pkg from public.quiz_study_packages p where p.kind=p_kind and p.version_id=p_version and p.enabled and p.approved order by p.created_at desc,p.id desc limit 1;
  if pkg.id is null then return '{}'::jsonb;end if;
  insert into public.quiz_study_attempts values(p_kind,p_attempt,p_version,pkg.id) on conflict do nothing;
  select p.* into pkg from public.quiz_study_attempts a join public.quiz_study_packages p on p.id=a.package_id where a.kind=p_kind and a.attempt_id=p_attempt and a.version_id=p_version;
 end if;
 if not pkg.enabled or not pkg.approved then return '{}'::jsonb;end if;
 for link in select * from public.quiz_study_items where package_id=pkg.id order by group_id,question_id loop
  if p_kind='normal' then
   known:=link.group_id='' and exists(select 1 from jsonb_array_elements(d->'blocks') b,jsonb_array_elements(b->'questions') q where q->>'id'=link.question_id);
   key:=link.question_id;
  else
   known:=exists(select 1 from jsonb_array_elements(d->'groups') g,jsonb_array_elements(g->'fields') f where g->>'id'=link.group_id and f->>'id'=link.question_id);
   key:=link.group_id;
  end if;
  if not known then continue;end if;
  if link.book_id is not null and exists(select 1 from public.quiz_textbooks b where b.id=link.book_id and b.enabled and b.grade=(identity->>'grade')::integer)
   and not exists(select 1 from unnest(link.reference_pages) n where not exists(select 1 from public.quiz_textbook_pages p where p.book_id=link.book_id and n=any(p.printed_pages))) then
   if not link.book_id=any(book_ids) then book_ids:=array_append(book_ids,link.book_id);end if;
   ref:=refs->key;
   if ref is null then ref:=jsonb_build_object('bookId',link.book_id,'primary',link.primary_page,'references',to_jsonb(link.reference_pages),'fields','[]'::jsonb);
   elsif ref->>'bookId'=link.book_id::text then ref:=jsonb_set(ref,'{references}',(ref->'references')||to_jsonb(link.reference_pages));end if;
   if p_kind='past' and ref->>'bookId'=link.book_id::text then ref:=jsonb_set(ref,'{fields}',(ref->'fields')||jsonb_build_array(jsonb_build_object('questionId',link.question_id,'page',link.primary_page)));end if;
   refs:=jsonb_set(refs,array[key],ref);
  end if;
  if link.student_explanation is not null and p_disclosed ? link.question_id then
   explanations:=jsonb_set(explanations,array[link.question_id],jsonb_build_object('text',link.student_explanation,'origin',link.origin));
  end if;
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'bookId',p.book_id,'printedPages',p.printed_pages,
  'sequence',p.book_id::text||':'||p.sequence,'url','https://quiz-media.invalid/'||p.book_id::text||'/'||p.sha256) order by p.book_id,p.printed_pages[1]),'[]') into pages
  from public.quiz_textbook_pages p where p.book_id=any(book_ids);
 return jsonb_build_object('schema',1,'kind',p_kind,'attemptId',p_attempt,'versionId',p_version,'packageId',pkg.id,'pages',pages,'references',refs,'explanations',explanations);
end$$;
revoke all on function public.quiz_study_payload(text,uuid,uuid,jsonb) from public,anon,authenticated;

-- Preserve the current learning / awards / order wrappers. Never install an old quiz_action.
do $$begin
 if to_regprocedure('public.quiz_action_before_study(text,jsonb)') is null then alter function public.quiz_action(text,jsonb) rename to quiz_action_before_study;
 elsif position('quiz_action_before_study' in pg_get_functiondef('public.quiz_action(text,jsonb)'::regprocedure))=0 then raise exception 'study_wrapper_changed';end if;
 if to_regprocedure('public.quiz_past_snapshot_before_study(uuid)') is null then alter function public.quiz_past_snapshot(uuid) rename to quiz_past_snapshot_before_study;
 elsif position('quiz_past_snapshot_before_study' in pg_get_functiondef('public.quiz_past_snapshot(uuid)'::regprocedure))=0 then raise exception 'study_wrapper_changed';end if;
end$$;
revoke all on function public.quiz_action_before_study(text,jsonb),public.quiz_past_snapshot_before_study(uuid) from public,anon,authenticated;
create or replace function public.quiz_action(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;study jsonb;disclosed jsonb;
begin
 result:=public.quiz_action_before_study(p_action,p_data);
 if result ? 'attempt_id' and result ? 'version_id' and result ? 'reviews' then
  select coalesce(jsonb_agg(r->>'question_id'),'[]') into disclosed from jsonb_array_elements(result->'reviews') r;
  study:=public.quiz_study_payload('normal',(result->>'attempt_id')::uuid,(result->>'version_id')::uuid,disclosed);
  if study<>'{}'::jsonb then result:=result||jsonb_build_object('study',study);end if;
 end if;
 return result;
end$$;
create or replace function public.quiz_past_snapshot(p_attempt uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;study jsonb;disclosed jsonb;
begin
 result:=public.quiz_past_snapshot_before_study(p_attempt);
 select coalesce(jsonb_agg(a.question_id),'[]') into disclosed from public.quiz_past_answers a where a.attempt_id=p_attempt;
 study:=public.quiz_study_payload('past',p_attempt,(result->>'version')::uuid,disclosed);
 if study<>'{}'::jsonb then result:=result||jsonb_build_object('study',study);end if;
 return result;
end$$;
revoke all on function public.quiz_action(text,jsonb),public.quiz_past_snapshot(uuid) from public,anon;
grant execute on function public.quiz_action(text,jsonb) to authenticated;
-- Snapshot remains internal, same as the existing past adapter.
revoke all on function public.quiz_past_snapshot(uuid) from authenticated;

create or replace function public.quiz_textbook_media_access(p_kind text,p_attempt uuid,p_version uuid,p_url text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare study jsonb;page jsonb;asset public.quiz_textbook_pages;
begin
 study:=public.quiz_study_payload(p_kind,p_attempt,p_version);
 select value into page from jsonb_array_elements(coalesce(study->'pages','[]')) where value->>'url'=p_url;
 if page is null then raise exception 'media_unavailable';end if;
 select * into asset from public.quiz_textbook_pages p where p.book_id=(page->>'bookId')::uuid and p.id=page->>'id';
 if asset.id is null then raise exception 'media_unavailable';end if;
 return jsonb_build_object('url',p_url,'mime','image/webp','bytes',asset.bytes,'backend','drive');
end$$;
revoke all on function public.quiz_textbook_media_access(text,uuid,uuid,text) from public,anon;
grant execute on function public.quiz_textbook_media_access(text,uuid,uuid,text) to authenticated;
commit;
