-- Only the teacher's explicitly designated school test account can see these
-- rehearsal credits. No course completion or actual quiz award is fabricated.
begin;
create table if not exists public.garden_test_setup(
 user_id uuid not null references auth.users(id) on delete cascade,
 course_id text not null check(course_id='grade3-115-1'),
 setup_id uuid not null default gen_random_uuid(),
 leaves integer not null check(leaves between 0 and 43),
 flowers integer not null check(flowers between 0 and 10),
 created_at timestamptz not null default now(),
 primary key(user_id,course_id)
);
alter table public.garden_test_setup enable row level security;
revoke all on public.garden_test_setup from public,anon,authenticated;
grant all on public.garden_test_setup to service_role;
create or replace function public.garden_test_rewards(p_course_id text) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',t.course_id||':test-setup:'||t.setup_id::text||':'||x.kind||':'||x.i,
  'kind',x.kind,'earned',true,'courseId',t.course_id,'weekCode','test',
  'activityKey','garden-upgrade-rehearsal','label',U&'\6210\9577\9AD4\9A57\6E96\5099',
  'title',U&'\6210\9577\9AD4\9A57\6E96\5099\30FB'||case when x.kind='flower' then U&'\82B1\6735' else U&'\8449\7247' end||' '||x.i,
  'reason',U&'\8001\5E2B\6E2C\8A66\5E33\865F\7684\5347\7D1A\9AD4\9A57\6E96\5099\3002',
  'detail',U&'\7368\7ACB\6E2C\8A66\8CC7\6599\FF0C\4E0D\4EE3\8868\5B8C\6210\8AB2\7A0B\6216\6E2C\9A57\3002',
  'href',''
 ) order by x.kind,x.i),'[]'::jsonb)
 from public.garden_test_setup t join auth.users u on u.id=t.user_id
 cross join lateral (
  select 'typing-leaf'::text kind,i from generate_series(1,t.leaves)i
  union all select 'flower',i from generate_series(1,t.flowers)i
 ) x
 where t.user_id=auth.uid() and t.course_id=p_course_id and u.email_confirmed_at is not null
 and lower(u.email)='chianwu@apps.ntpc.edu.tw'
 and exists(select 1 from public.student_enrollments e where e.school_year=115 and e.email=lower(u.email) and e.class_code='307' and e.seat_no=30)
$$;
revoke all on function public.garden_test_rewards(text) from public,anon;
grant execute on function public.garden_test_rewards(text) to authenticated;
-- Modify only the growth collector, preserving its currently deployed logic.
do $patch$
declare d text; needle constant text := ' select count(*) filter(where value->>''kind''<>''flower''),count(*) filter(where value->>''kind''=''flower'') into leaves,flowers from jsonb_array_elements(result);';
begin
 select pg_get_functiondef('public.garden_growth(text,text)'::regprocedure) into d;
 if position('public.garden_test_rewards(p_course_id)' in d)=0 then
  if position(needle in d)=0 then raise exception 'growth_collector_changed_review_required';end if;
  execute replace(d,needle,' result := result || public.garden_test_rewards(p_course_id);'||chr(10)||needle);
 end if;
end $patch$;
notify pgrst,'reload schema';
commit;
