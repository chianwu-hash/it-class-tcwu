-- 使用既有固定版本，為學生另建單元自學場次；不複製或覆蓋教師作答。
begin;
insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode)
select md5('student-library-v1:'||s.id::text)::uuid,s.owner_id,s.version_id,s.school_year,
 (select jsonb_agg(c.class_code order by c.class_code) from
  (select distinct e.class_code from public.student_enrollments e
   where e.school_year=s.school_year and e.class_code ~ '^[36][0-9]{2}$'
    and left(e.class_code,1)=left(v.document->'catalog'->>'volume',1)) c),
 s.reveal,s.shuffle_questions,s.shuffle_options,'practice'
from public.quiz_sessions s join public.quiz_versions v on v.id=s.version_id
where s.access_mode='personal' and s.school_year=115
 and exists(select 1 from public.student_enrollments e where e.school_year=s.school_year
  and left(e.class_code,1)=left(v.document->'catalog'->>'volume',1) and e.class_code ~ '^[36][0-9]{2}$')
on conflict(id) do nothing;
notify pgrst,'reload schema';
commit;
select count(*) as student_papers from public.quiz_sessions where access_mode='practice';
