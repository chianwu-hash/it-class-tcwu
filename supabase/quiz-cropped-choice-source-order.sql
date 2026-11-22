-- Preserve source order only for the twelve approved cropped choices, in new self-composed attempts.
-- IDs below are represented by SHA-256. Existing attempt ordering and all other shuffle paths are preserved.
begin;
do $migration$
declare
  target regprocedure := 'public.quiz_action_before_learning(text,jsonb)'::regprocedure;
  current_definition text := pg_get_functiondef(target);
  old_expression constant text := $fragment$case when sess.shuffle_options then random() else ord::float end$fragment$;
  fixed_expression constant text := $fragment$case when sess.shuffle_options and not coalesce((
      sess.access_mode='self' and q->>'type'='single'
      and d#>>'{catalog,course_id}'='115-1-hanlin-g3-math'
      and encode(sha256(convert_to(q->>'id','UTF8')),'hex') in (
        '114571f75965c807475290e2635bbd8336d5fcbbb031ffd59ad608cb17c55410',
        '136c6be87a582ce3be364b480dd757286549ab61eb7953d50a7198b18e66d1b6',
        '19d43389f1fbafae5a533b81849503c64dd5fa07a3dcd3e9efb630379090fe1a',
        '60b42fad6780cf6bf3133d381b946fd28eae7208664cd93d16335aa5c2963106',
        '6aa3a87f795a65e9becbf9a707695b4d628a778f9ef0302705a99960b0c4a339',
        '6e119261ee395e3d22f7123e76098359e46553874e18d76d3c8088568c425864',
        'aae6836c78e873cae348f2877c6ac9ba51894971c9072d8c2b13414ea4425326',
        'ad5ce4eb2e3d859a9d1e3be7939ad6461e46868499165aded61503b1295f549a',
        'bb95b51ec8f71a36a0aa3c0c426580e9e4d15aaf1c2943d45be52e7ea960d4f6',
        'ccf37befa44af8de2e1fd42b474f2eb2df84655d54a1ad6f0347b0bb63e923cf',
        'ec36c24eae48edcc3fe797a281085bc464aafc9886742f0e7814e977eba953d0',
        'f77b08b52e8d3281c058206b10040f2d37d72dc50cce7628cd14ae6d6aceef5e'
      )
      and exists(select 1 from public.quiz_generated_papers g
                 where g.session_id=sess.id and g.user_id=uid and g.deleted_at is null
                 and g.config->>'kind'='self' and g.config->>'release_qa' is distinct from 'true')
    ),false) then random() else ord::float end$fragment$;
  observed text := md5(current_definition);
  before_acl aclitem[];
  before_owner oid;
begin
  if observed = '9149816f957142b1a9b194d9e2510dea' then return; end if;
  if observed is distinct from 'fcd825c196e1925d820a8f391644b7b6' then raise exception 'fixed_option_order_unexpected_baseline'; end if;
  if (length(current_definition)-length(replace(current_definition,old_expression,''))) <> length(old_expression)
    then raise exception 'fixed_option_order_fragment_not_unique'; end if;
  select p.proacl,p.proowner into before_acl,before_owner from pg_proc p where p.oid=target;
  execute replace(current_definition,old_expression,fixed_expression);
  if md5(pg_get_functiondef(target)) is distinct from '9149816f957142b1a9b194d9e2510dea' or not exists(
    select 1 from pg_proc p where p.oid=target and p.proacl is not distinct from before_acl and p.proowner=before_owner
  ) then raise exception 'fixed_option_order_postcondition'; end if;
end $migration$;
commit;
