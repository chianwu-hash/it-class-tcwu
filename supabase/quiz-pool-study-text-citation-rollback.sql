-- Candidate only; no production application or source activation in this PR.
begin;
set local lock_timeout='3s';
set local statement_timeout='60s';
lock table public.quiz_pool_study_sources in share row exclusive mode;
do $guard$declare f text; c text; h text;begin
 select md5(pg_get_functiondef('public.quiz_bind_composed_study()'::regprocedure)) into f;
 select md5(pg_get_constraintdef(oid)) into c from pg_constraint where conrelid='public.quiz_pool_study_sources'::regclass and conname='quiz_pool_study_sources_reference_shape';
 if to_regprocedure('public.quiz_text_citation_valid(jsonb,text,jsonb,jsonb)') is not null then
  select md5(pg_get_functiondef('public.quiz_text_citation_valid(jsonb,text,jsonb,jsonb)'::regprocedure)) into h;
 end if;
 if ((f='76fc3552b43d5989c17c8832938a3833' and c='fc94f18029f09b8ff0cdd3e56bcd0eff' and h is null)
  or (f='78d18e6366e891fd4a91ea53b322ced2' and c='435a724e9e48805057337bf23ea34bb0' and h='b96ca30c9b45c4641ac5fd6c23191a53')) is not true then
  raise exception 'text_citation_contract_changed';
 end if;
end $guard$;
do $rows$begin
 if exists(select 1 from public.quiz_pool_study_sources where (((((book_id IS NULL) AND (primary_page IS NULL) AND (cardinality(reference_pages) = 0) AND ((teacher_notes ->> 'book_match_status'::text) = 'no_reliable_match'::text) AND (length(btrim((teacher_notes ->> 'unmatched_explanation'::text))) > 0)) OR ((book_id IS NOT NULL) AND (primary_page IS NOT NULL) AND (primary_page > 0) AND (cardinality(reference_pages) > 0) AND (primary_page = ANY (reference_pages)) AND (0 < ALL (reference_pages)) AND (array_position(reference_pages, NULL::integer) IS NULL))) IS TRUE)) is not true) then raise exception 'text_citation_sources_require_rollback_plan';end if;
end $rows$;
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
end$function$;
revoke all on function public.quiz_bind_composed_study() from public,anon,authenticated;
grant execute on function public.quiz_bind_composed_study() to service_role;

alter table public.quiz_pool_study_sources drop constraint quiz_pool_study_sources_reference_shape;
alter table public.quiz_pool_study_sources add constraint quiz_pool_study_sources_reference_shape CHECK (((((book_id IS NULL) AND (primary_page IS NULL) AND (cardinality(reference_pages) = 0) AND ((teacher_notes ->> 'book_match_status'::text) = 'no_reliable_match'::text) AND (length(btrim((teacher_notes ->> 'unmatched_explanation'::text))) > 0)) OR ((book_id IS NOT NULL) AND (primary_page IS NOT NULL) AND (primary_page > 0) AND (cardinality(reference_pages) > 0) AND (primary_page = ANY (reference_pages)) AND (0 < ALL (reference_pages)) AND (array_position(reference_pages, NULL::integer) IS NULL))) IS TRUE));
drop function if exists public.quiz_text_citation_valid(jsonb,text,jsonb,jsonb);
commit;
