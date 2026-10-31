// One transaction; keep existing learning records and unrelated functions intact.
export const GARDEN_LEVEL2_FILES=['quiz-past-flowers.sql','garden-reward-conversion.sql','garden-companions.sql','garden-level2.sql','garden-item-notice.sql','garden-tree-skin.sql'];
export function buildLevel2Migration(files){
 const body=GARDEN_LEVEL2_FILES.map(name=>{const s=files[name];if(typeof s!=='string'||!s.includes('begin;')||!s.trimEnd().endsWith('commit;'))throw Error('invalid_migration_'+name);return s.replace(/^([\s\S]*?)\bbegin;/,'$1').replace(/commit;\s*$/,'')}).join('\n');
 return `begin isolation level repeatable read;
set local lock_timeout='3s';set local statement_timeout='60s';
lock table public.garden_growth,public.quiz_past_leaves in share row exclusive mode;
create temporary table garden_level2_before(value jsonb) on commit drop;
create function pg_temp.garden_protected_snapshot() returns jsonb language plpgsql as $$
declare t text;v text;result jsonb:='{}';begin
 foreach t in array array['student_progress','quiz_leaf_awards','quiz_past_leaves','garden_growth','garden_test_setup','garden_tree_skins','garden_unlock_notices'] loop
  if to_regclass('public.'||t) is not null then
   execute format('select md5(coalesce(string_agg((to_jsonb(x)-''reward_kind''-''reward_version''-''leaf_floor''-''flower_floor'')::text,'''' order by (to_jsonb(x)-''reward_kind''-''reward_version''-''leaf_floor''-''flower_floor'')::text),'''')) from public.%I x',t) into v;
   result:=result||jsonb_build_object(t,v);
  end if;
 end loop;
 select result||jsonb_build_object('protected_functions',coalesce(jsonb_object_agg(p.oid::regprocedure::text,md5(pg_get_functiondef(p.oid))),'{}')) into result
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('quiz_action','quiz_answer_guard','quiz_leaf_result','quiz_compose','quiz_past_action','quiz_student_identity','typing_foundation_action','homework_action','reading_action','is_teacher');
 return result;end$$;
insert into garden_level2_before select pg_temp.garden_protected_snapshot();
${body}
do $$begin
 if (select value from pg_temp.garden_level2_before) is distinct from pg_temp.garden_protected_snapshot() then raise exception 'protected_learning_data_or_functions_changed';end if;
 if has_function_privilege('anon','public.garden_companions(text,text,jsonb)','execute') or has_function_privilege('anon','public.garden_growth(text,text)','execute') or has_function_privilege('authenticated','public.garden_unlock_items(text,integer,integer)','execute') or has_table_privilege('authenticated','public.garden_item_unlocks','select') or has_table_privilege('authenticated','public.garden_companion_choices','update') then raise exception 'garden_level2_permission_gate_failed';end if;
end$$;
drop function pg_temp.garden_protected_snapshot();
notify pgrst,'reload schema';commit;`;
}
