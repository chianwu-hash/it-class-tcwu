-- Read-only snapshot. Export contains private questions; keep the output under automation/output/.
begin;
set local statement_timeout='30s';
select jsonb_build_object('at',now(),
 'courses',(select jsonb_agg(to_jsonb(c)) from public.quiz_courses c where c.id in ('115-1-kang-g6-ch','115-1-kang-g6-en','115-1-nani-g6-science','115-1-nani-g6-social')),
 'pool',(select jsonb_agg(to_jsonb(p)||jsonb_build_object('course_id',m.course_id,'knowledge_reliable',m.knowledge_reliable,'row_db_md5',md5(to_jsonb(p)::text)) order by m.course_id,p.source_item_id)
 from public.quiz_question_pool p join public.quiz_pool_membership m using(question_id)
 where m.course_id in ('115-1-kang-g6-ch','115-1-kang-g6-en','115-1-nani-g6-science','115-1-nani-g6-social')),
 'functions',(select jsonb_object_agg(p.proname,pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('quiz_extension_source','quiz_compose','quiz_wrong_questions'))) snapshot;
rollback;
