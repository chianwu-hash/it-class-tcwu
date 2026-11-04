-- Public deployment metadata only; no learner data or write privileges.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';
create or replace function public.garden_catalog_manifest() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('version',1,'project','upxgyusodibaqcrocdzj','asOf',statement_timestamp(),
  'catalog',coalesce((select jsonb_agg(jsonb_build_object(
   'course_id',course_id,'week_code',week_code,'activity_key',activity_key,
   'kind',kind,'total_levels',total_levels,'reward_mode',reward_mode)
   order by course_id,week_code,activity_key) from public.garden_reward_catalog),'[]'::jsonb));
$$;
revoke all on function public.garden_catalog_manifest() from public;
grant execute on function public.garden_catalog_manifest() to anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
