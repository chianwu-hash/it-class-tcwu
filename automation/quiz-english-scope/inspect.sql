begin;set local statement_timeout='30s';
select jsonb_build_object(
 'course',(select to_jsonb(c) from public.quiz_courses c where id='115-1-kang-g6-en'),
 'pool',(select jsonb_agg(to_jsonb(p)||jsonb_build_object('course_id',m.course_id,'knowledge_reliable',m.knowledge_reliable,'row_md5',md5(to_jsonb(p)::text)) order by p.question_id) from public.quiz_question_pool p join public.quiz_pool_membership m using(question_id) where m.course_id='115-1-kang-g6-en'),
 'presets',(select jsonb_agg(jsonb_build_object('session',to_jsonb(s),'document',v.document,'bank_id',v.bank_id,'version_id',v.id,'attempts',(select count(*) from public.quiz_attempts a where a.session_id=s.id)))
 from public.quiz_sessions s join public.quiz_versions v on v.id=s.version_id where s.school_year=115 and s.access_mode='practice' and v.document->'catalog'->>'subject'='英語' and v.document->'catalog'->>'volume' like '6%'),
 'library_definition',pg_get_functiondef('public.quiz_library_sessions(jsonb)'::regprocedure),
 'media',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.quiz_media_assets a),
 'owner',(select id from auth.users where lower(email)='chianwu@gmail.com' and email_confirmed_at is not null)) snapshot;
rollback;
