-- Deploy only the study payload change. The existing media signer calls this
-- same function and inherits its saved-answer and page restrictions.
begin;
CREATE OR REPLACE FUNCTION public.quiz_study_payload(p_kind text, p_attempt uuid, p_version uuid, p_disclosed jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare identity jsonb;d jsonb;pkg public.quiz_study_packages;link public.quiz_study_items;
 refs jsonb:='{}';explanations jsonb:='{}';pages jsonb;ref jsonb;known boolean;book_ids uuid[]:='{}';key text;teacher_guide boolean;
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
 teacher_guide:=p_kind='past' and coalesce(pkg.provenance->>'material','')='teacher-guide';
 for link in select * from public.quiz_study_items where package_id=pkg.id order by group_id,question_id loop
  if p_kind='normal' then
   known:=link.group_id='' and exists(select 1 from jsonb_array_elements(d->'blocks') b,jsonb_array_elements(b->'questions') q where q->>'id'=link.question_id);
   key:=link.question_id;
  else
   known:=exists(select 1 from jsonb_array_elements(d->'groups') g,jsonb_array_elements(g->'fields') f where g->>'id'=link.group_id and f->>'id'=link.question_id);
   key:=link.group_id;
  end if;
  if not known then continue;end if;
  -- The snapshot and media signer both call this function. Use the saved
  -- group receipt for both paths instead of trusting a client's reveal state.
  if (not teacher_guide or exists(
       select 1 from public.quiz_past_receipts r
       where r.attempt_id=p_attempt and r.group_id=link.group_id
      ))
   and link.book_id is not null and exists(select 1 from public.quiz_textbooks b where b.id=link.book_id and b.enabled and b.grade=(identity->>'grade')::integer)
   and not exists(select 1 from unnest(link.reference_pages) n where not exists(select 1 from public.quiz_textbook_pages p where p.book_id=link.book_id and n=any(p.printed_pages))) then
   if not link.book_id=any(book_ids) then book_ids:=array_append(book_ids,link.book_id);end if;
   ref:=refs->key;
   if ref is null then ref:=jsonb_build_object('bookId',link.book_id,'primary',link.primary_page,'references',to_jsonb(link.reference_pages),'fields','[]'::jsonb);
   elsif ref->>'bookId'=link.book_id::text then ref:=jsonb_set(ref,'{references}',(ref->'references')||to_jsonb(link.reference_pages));end if;
   if p_kind='past' and ref->>'bookId'=link.book_id::text then ref:=jsonb_set(ref,'{fields}',(ref->'fields')||jsonb_build_array(jsonb_build_object('questionId',link.question_id,'page',link.primary_page)));end if;
   if teacher_guide then
    ref:=ref||jsonb_build_object('material','teacher-guide',
     'related',coalesce(link.teacher_notes->>'reference_type','')='related_concept');
   end if;
   refs:=jsonb_set(refs,array[key],ref);
  end if;
  if link.student_explanation is not null and p_disclosed ? link.question_id then
   explanations:=jsonb_set(explanations,array[link.question_id],jsonb_build_object('text',link.student_explanation,'origin',link.origin));
  end if;
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'bookId',p.book_id,'printedPages',p.printed_pages,
  'sequence',p.book_id::text||':'||p.sequence,'url','https://quiz-media.invalid/'||p.book_id::text||'/'||p.sha256) order by p.book_id,p.printed_pages[1]),'[]') into pages
  from public.quiz_textbook_pages p where p.book_id=any(book_ids)
   and (not teacher_guide or exists(
    select 1 from jsonb_each(refs) ref_entry
    cross join lateral jsonb_array_elements_text(ref_entry.value->'references') page_number
    where ref_entry.value->>'bookId'=p.book_id::text and page_number::integer=any(p.printed_pages)
   ));
 return jsonb_build_object('schema',1,'kind',p_kind,'attemptId',p_attempt,'versionId',p_version,'packageId',pkg.id,'pages',pages,'references',refs,'explanations',explanations);
end$function$;
commit;
