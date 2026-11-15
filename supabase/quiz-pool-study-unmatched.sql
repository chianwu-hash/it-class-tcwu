-- Approved pool explanations may explicitly have no reliable textbook match.
-- No source rows, existing packages, attempts, RLS policies or grants are changed.
begin;
set local lock_timeout='3s';
set local statement_timeout='60s';
do $$begin
 if md5(pg_get_functiondef('public.quiz_bind_composed_study()'::regprocedure))<>
 '95d092bdb45f2b697379869d432db5b7' then
  raise exception 'unmatched_study_function_changed';
 end if;
 if not exists(select 1 from pg_constraint where conrelid='public.quiz_pool_study_sources'::regclass
  and conname='quiz_pool_study_sources_check'
  and pg_get_constraintdef(oid)='CHECK (((cardinality(reference_pages) > 0) AND (primary_page = ANY (reference_pages))))')
  or exists(select 1 from pg_constraint where conrelid='public.quiz_pool_study_sources'::regclass
   and conname='quiz_pool_study_sources_reference_shape') then
  raise exception 'unmatched_study_constraint_changed';
 end if;
end$$;
alter table public.quiz_pool_study_sources alter column book_id drop not null;
alter table public.quiz_pool_study_sources alter column primary_page drop not null;
alter table public.quiz_pool_study_sources drop constraint if exists quiz_pool_study_sources_check;
-- A missing match must be explicit; malformed partial links remain rejected.
do $$begin
 if not exists(select 1 from pg_constraint where conrelid='public.quiz_pool_study_sources'::regclass
  and conname='quiz_pool_study_sources_reference_shape') then
  alter table public.quiz_pool_study_sources add constraint quiz_pool_study_sources_reference_shape check((
   (book_id is null and primary_page is null and cardinality(reference_pages)=0
    and teacher_notes->>'book_match_status'='no_reliable_match'
    and length(btrim(teacher_notes->>'unmatched_explanation'))>0)
   or
   (book_id is not null and primary_page is not null and primary_page>0
    and cardinality(reference_pages)>0 and primary_page=any(reference_pages)
    and 0<all(reference_pages) and array_position(reference_pages,null) is null)
  ) is true);
 end if;
end$$;
CREATE OR REPLACE FUNCTION public.quiz_bind_composed_study()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  left join public.quiz_textbooks book on book.id=src.book_id and book.enabled and book.grade=course.grade
  where d->'catalog'->>'course_id'=src.course_id
   and (src.book_id is null or book.id is not null)
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
end$function$
;
commit;
