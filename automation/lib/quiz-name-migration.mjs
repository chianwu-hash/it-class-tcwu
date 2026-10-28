// Verify naming-only changes inside one stable database snapshot, including concurrent classroom use.
export function buildNamingMigration(source){
 const digest=table=>`(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by to_jsonb(x)::text),'')) from public.${table} x)`;
 const unchanged=`select jsonb_build_object('versions',${digest('quiz_versions')},'banks',${digest('quiz_banks')},'sessions',${digest('quiz_sessions')},'attempts',${digest('quiz_attempts')},'answers',${digest('quiz_answers')},'leaves',${digest('quiz_leaf_awards')},'progress',${digest('student_progress')},'generated',
 (select md5(coalesce(string_agg(jsonb_build_array(g.session_id,g.user_id,g.request_id,g.config,g.actual_distribution,g.created_at,g.deleted_at)::text,'' order by g.session_id),'')) from public.quiz_generated_papers g))`;
 let sql=source.replace('begin;','begin isolation level repeatable read;\nlock table public.quiz_generated_papers in access exclusive mode;\ncreate temporary table quiz_name_deploy_before(value jsonb) on commit drop;\ninsert into quiz_name_deploy_before '+unchanged+';');
 const end=sql.lastIndexOf('commit;');if(end<0||!sql.includes('create temporary table quiz_name_deploy_before'))throw Error('migration_transaction_missing');
 return sql.slice(0,end)+`do $$begin if (select value from pg_temp.quiz_name_deploy_before) is distinct from (${unchanged}) then raise exception 'naming_changed_protected_data';end if;end$$;\nnotify pgrst,'reload schema';\n`+sql.slice(end);
}
