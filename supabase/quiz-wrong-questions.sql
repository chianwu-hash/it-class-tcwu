-- Additive, read-only projection of the signed-in user's revealed wrong answers.
begin;
create or replace function public.quiz_wrong_questions(p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); identity jsonb; teacher boolean; student_grade integer; requested_grade integer;
 items jsonb; row jsonb; projected jsonb; question jsonb; review jsonb;
 page integer:=0; subject text:=coalesce(p_data->>'subject',''); unit text:=coalesce(p_data->>'unit','');
begin
 if uid is null then raise exception 'login_required'; end if;
 identity:=public.quiz_action('library_sessions');
 teacher:=identity->>'role'='teacher'; student_grade:=(identity->>'grade')::integer;
 if coalesce(p_data->>'grade','') not in ('','3','6') then raise exception 'invalid_request'; end if;
 requested_grade:=case when teacher then nullif(p_data->>'grade','')::integer else student_grade end;
 if coalesce(p_data->>'page','0') !~ '^[0-9]{1,5}$' then raise exception 'invalid_request'; end if;
 page:=coalesce((p_data->>'page')::integer,0);
 if length(subject)>30 or length(unit)>200 then raise exception 'invalid_request'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'attempt_id',a.id,'session_id',s.id,'question_id',x.question_id,'answered_at',x.created_at,
  'title',v.document->>'title','catalog',v.document->'catalog',
  'number',(select ord from jsonb_array_elements_text(a.question_order) with ordinality r(id,ord) where r.id=x.question_id),
  'preview',left(q->'prompt'->>'text',160)) order by x.created_at desc,a.id,x.question_id),'[]') into items
 from public.quiz_attempts a join public.quiz_answers x on x.attempt_id=a.id
 join public.quiz_sessions s on s.id=a.session_id join public.quiz_versions v on v.id=s.version_id,
 lateral jsonb_array_elements(v.document->'blocks') b,lateral jsonb_array_elements(b->'questions') q
 where a.user_id=uid and not x.correct and q->>'id'=x.question_id
 and (requested_grade is null or coalesce(nullif(left(v.document->'catalog'->>'volume',1),''),requested_grade::text)=requested_grade::text)
 and ((teacher and s.access_mode='personal' and s.owner_id=uid) or (not teacher and s.access_mode<>'personal' and exists(
  select 1 from public.student_enrollments e join auth.users u on lower(u.email)=e.email
   where u.id=uid and u.email_confirmed_at is not null and e.school_year=s.school_year and s.class_codes ? e.class_code)))
 and ((s.reveal='complete' and not exists(select 1 from jsonb_array_elements_text(a.question_order) r(id)
  where not exists(select 1 from public.quiz_answers y where y.attempt_id=a.id and y.question_id=r.id)))
 or (s.reveal='immediate' and not exists(select 1 from jsonb_array_elements(b->'questions') r
  where not exists(select 1 from public.quiz_answers y where y.attempt_id=a.id and y.question_id=r->>'id'))));
 if coalesce(p_data->>'action','list')='detail' then
  select value into row from jsonb_array_elements(items) where value->>'attempt_id'=p_data->>'attempt_id' and value->>'question_id'=p_data->>'question_id';
  if row is null then raise exception 'wrong_question_unavailable'; end if;
  projected:=public.quiz_action('resume',jsonb_build_object('session_id',row->>'session_id'));
  select value into question from jsonb_array_elements(projected->'document'->'questions') where value->>'id'=row->>'question_id';
  select value into review from jsonb_array_elements(projected->'reviews') where value->>'question_id'=row->>'question_id' and value->>'correct'='false';
  if question is null or review is null then raise exception 'wrong_question_unavailable'; end if;
  return row||jsonb_build_object('question',question,'review',review,'response',projected->'responses'->(row->>'question_id'));
 end if;
 if coalesce(p_data->>'action','list')<>'list' then raise exception 'invalid_request'; end if;
 return jsonb_build_object('role',identity->>'role','grade',student_grade,
  'facets',(select coalesce(jsonb_agg(f order by f->>'subject',f->>'unit'),'[]') from (
   select distinct jsonb_build_object('subject',coalesce(value->'catalog'->>'subject','未分類'),'unit',coalesce(value->'catalog'->>'unit',value->>'title')) f from jsonb_array_elements(items)) t),
  'total',(select count(*) from jsonb_array_elements(items) where (subject='' or coalesce(value->'catalog'->>'subject','未分類')=subject) and (unit='' or coalesce(value->'catalog'->>'unit',value->>'title')=unit)),
  'items',(select coalesce(jsonb_agg(value order by ord),'[]') from (select value,ord from jsonb_array_elements(items) with ordinality r(value,ord)
   where (subject='' or coalesce(value->'catalog'->>'subject','未分類')=subject) and (unit='' or coalesce(value->'catalog'->>'unit',value->>'title')=unit)
   order by ord limit 20 offset page*20) t));
end $$;
revoke all on function public.quiz_wrong_questions(jsonb) from public,anon;
grant execute on function public.quiz_wrong_questions(jsonb) to authenticated;
commit;
