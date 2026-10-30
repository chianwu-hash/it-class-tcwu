select jsonb_build_object('project',current_database(),'reports_exists',to_regclass('public.quiz_question_reports') is not null,
 'visibility',position('library_visible' in pg_get_functiondef('public.quiz_library_sessions(jsonb)'::regprocedure))>0,
 'media_definition',pg_get_functiondef('public.quiz_media_access(text,uuid)'::regprocedure),
 'school_uid',(select id from auth.users where email='chianwu@apps.ntpc.edu.tw'),
 'teacher_uid',(select id from auth.users where email='chianwu@gmail.com')) snapshot;
