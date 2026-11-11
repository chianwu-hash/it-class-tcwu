-- Approved, immutable source metadata for newly composed papers only.
-- Existing attempts, versions, grading, identity and option shuffling are untouched.
begin;
create table if not exists public.quiz_pool_study_sources(
 question_id text primary key references public.quiz_question_pool(question_id),
 course_id text not null references public.quiz_courses(id),
 question jsonb not null check(jsonb_typeof(question)='object'),
 book_id uuid not null references public.quiz_textbooks(id),
 primary_page integer not null check(primary_page>0),
 reference_pages integer[] not null check(cardinality(reference_pages)>0 and primary_page=any(reference_pages)),
 student_explanation text not null check(length(student_explanation) between 1 and 12000),
 teacher_notes jsonb not null,
 provenance jsonb not null,
 enabled boolean not null default false
);
alter table public.quiz_pool_study_sources enable row level security;
revoke all on public.quiz_pool_study_sources from public,anon,authenticated;
grant all on public.quiz_pool_study_sources to service_role;

create or replace function public.quiz_pool_study_source_guard() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and (to_jsonb(new)-'enabled')=(to_jsonb(old)-'enabled') then return new;end if;
 raise exception 'study_fixed_version';
end$$;
revoke all on function public.quiz_pool_study_source_guard() from public,anon,authenticated;
drop trigger if exists pool_study_source_immutable on public.quiz_pool_study_sources;
create trigger pool_study_source_immutable before update or delete on public.quiz_pool_study_sources
 for each row execute function public.quiz_pool_study_source_guard();

create or replace function public.quiz_bind_composed_study() returns trigger
language plpgsql security definer set search_path='' as $$
declare v uuid;d jsonb;pkg uuid;item record;items integer:=0;
begin
 select s.version_id,x.document into v,d from public.quiz_sessions s
 join public.quiz_versions x on x.id=s.version_id
 where s.id=new.session_id and s.owner_id=new.user_id and s.access_mode='self';
 -- Never attach new material to an earlier attempt or an already pinned version.
 if v is null or exists(select 1 from public.quiz_attempts where session_id=new.session_id)
  or exists(select 1 from public.quiz_study_packages where kind='normal' and version_id=v) then return new;end if;
 for item in
  select src.* from jsonb_array_elements(d->'blocks') block,
   lateral jsonb_array_elements(block->'questions') q
  join public.quiz_pool_study_sources src on src.question_id=q->>'id' and src.question=q and src.enabled
  join public.quiz_question_pool pool on pool.question_id=src.question_id and pool.usable and pool.question=q
  join public.quiz_pool_membership member on member.question_id=pool.question_id and member.course_id=src.course_id
  join public.quiz_courses course on course.id=src.course_id and course.enabled
  join public.quiz_textbooks book on book.id=src.book_id and book.enabled and book.grade=course.grade
  where d->'catalog'->>'course_id'=src.course_id
   and not exists(select 1 from unnest(src.reference_pages) page_number
    where not exists(select 1 from public.quiz_textbook_pages page
     where page.book_id=src.book_id and page_number=any(page.printed_pages)))
 loop
  if pkg is null then
   pkg:=gen_random_uuid();
   insert into public.quiz_study_packages(id,kind,version_id,approved,enabled,provenance)
   values(pkg,'normal',v,true,false,jsonb_build_object('method','approved_pool_source_exact_jsonb_match','schema',1));
  end if;
  insert into public.quiz_study_items(package_id,question_id,book_id,primary_page,reference_pages,student_explanation,origin,teacher_notes)
   values(pkg,item.question_id,item.book_id,item.primary_page,item.reference_pages,item.student_explanation,'ai',
    item.teacher_notes||jsonb_build_object('source_provenance',item.provenance));
  items:=items+1;
 end loop;
 if items>0 then update public.quiz_study_packages set enabled=true where id=pkg;end if;
 return new;
end$$;
revoke all on function public.quiz_bind_composed_study() from public,anon,authenticated;
drop trigger if exists bind_composed_study on public.quiz_generated_papers;
create trigger bind_composed_study after insert on public.quiz_generated_papers
 for each row execute function public.quiz_bind_composed_study();
commit;
