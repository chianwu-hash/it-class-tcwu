-- Teacher-only persisted snapshot. No student RPC, impersonation, reward grant,
-- growth migration, unlock synchronization, seen flag, or visit counter is invoked.
begin;
set local lock_timeout='3s';
set local statement_timeout='60s';
-- A new function must not silently replace another agent's implementation.
create function public.admin_learning_tree(p_action text,p_course_id text,p_payload jsonb default '{}')
returns jsonb language plpgsql stable security definer set search_path='' as $function$
declare base jsonb; target uuid; normal jsonb; learning jsonb:='[]'; flowers jsonb; partner jsonb;
 growth jsonb; choices jsonb; rehearsal jsonb; cfg public.quiz_learning_settings; grade_no integer;
begin
 if auth.uid() is null or not coalesce(public.is_teacher(),false) then raise exception 'teacher_required';end if;
 if p_action is distinct from 'tree_snapshot' then raise exception 'invalid_action';end if;
 -- Existing reader validates exact payload whitelist, course, class, seat, and mapping.
 base:=public.admin_learning_rewards('garden_status',p_course_id,p_payload);
 if base->'identity'->>'mapping' is distinct from 'linked' then raise exception 'student_unavailable';end if;
 select u.id into strict target from public.student_enrollments e join auth.users u
 on lower(u.email)=e.email and u.email_confirmed_at is not null
 where e.school_year=115 and e.class_code=p_payload->>'class_code' and e.seat_no=(p_payload->>'seat_no')::integer;
 grade_no:=substring(p_course_id from 6 for 1)::integer;
 -- Follow quiz_rewards_before_past projection, including historical stable IDs.
 select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'session_id',a.session_id,
  'title',coalesce(p.display_name,v.document->>'title'),'grade',w.grade,'total',w.total,'correct',w.correct,'awarded_at',w.awarded_at)
  order by w.awarded_at),'[]') into normal
 from public.quiz_leaf_awards w join public.quiz_attempts a on a.id=w.attempt_id
 join public.quiz_sessions s on s.id=a.session_id join public.quiz_versions v on v.id=s.version_id
 left join public.quiz_generated_papers p on p.session_id=s.id where w.user_id=target and w.grade=grade_no;
 select * into cfg from public.quiz_learning_settings where id;
 if coalesce(cfg.enabled,false) and p_course_id='grade'||grade_no||'-'||cfg.school_year||'-'||cfg.semester then
  select coalesce(jsonb_agg(jsonb_build_object('id','learning:'||l.school_year||':'||l.semester||':'||l.ordinal,
   'source_type','learning','title','練習累積・第'||l.ordinal||'片延伸葉','grade',grade_no,'half_units',2,
   'total',10,'correct',null,'awarded_at',l.created_at,'ordinal',l.ordinal) order by l.ordinal),'[]') into learning
  from public.quiz_learning_leaves l where l.user_id=target and l.school_year=cfg.school_year and l.semester=cfg.semester;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id','past:'||l.id,'source_type','past_exam','paper_id',p.id,
  'attempt_id',a.id,'title',p.title,'grade',p.grade,'total',a.max_score,'correct',a.score,
  'awarded_at',l.awarded_at,'reward_kind','past-exam-flower','flower_style','forest') order by l.awarded_at,l.id),'[]') into flowers
 from public.quiz_past_leaves l join public.quiz_past_attempts a on a.id=l.attempt_id
 join public.quiz_past_papers p on p.id=l.paper_id where l.user_id=target and l.school_year=115 and l.semester=1 and p.grade=grade_no;
 -- Only the selected student's earned keepsakes; no other members' private records.
 select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'course',w.course_id,'leaves',w.leaves,'flowers',w.flowers,
  'record',jsonb_build_object('title',w.record->>'title'),'at',w.created_at) order by w.created_at,w.id),'[]') into partner
 from partner_pilot.awards w where w.members @> array[target] and w.course_id=p_course_id;
 select jsonb_build_object('grown_at',grown_at,'seen_at',seen_at,'baseline',baseline,'order',reward_order,
  'reward_version',reward_version,'foundation_reward_version',foundation_reward_version,
  'leaf_floor',leaf_floor,'flower_floor',flower_floor) into growth
 from public.garden_growth where user_id=target and course_id=p_course_id;
 select jsonb_build_object('pet',pet,'homes',homes,'homeVisible',home_visible,'modes',modes) into choices
 from public.garden_companion_choices where user_id=target;
 -- Same test-credit projection as garden_test_rewards, scoped to its existing account and seat.
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',t.course_id||':test-setup:'||t.setup_id||':'||x.kind||':'||x.i,'kind',x.kind,'earned',true,
  'courseId',t.course_id,'weekCode','test','activityKey','garden-upgrade-rehearsal','label','成長體驗準備',
  'title','成長體驗準備・'||case when x.kind='flower' then '花朵' else '葉片' end||' '||x.i,
  'reason','老師測試帳號的升級體驗準備。','detail','獨立測試資料，不代表完成課程或測驗。','href','') order by x.kind,x.i),'[]') into rehearsal
 from public.garden_test_setup t join auth.users u on u.id=t.user_id
 cross join lateral (select 'typing-leaf'::text kind,i from generate_series(1,t.leaves)i union all select 'flower',i from generate_series(1,t.flowers)i) x
 where t.user_id=target and t.course_id=p_course_id and p_course_id='grade3-115-1'
 and lower(u.email)='chianwu@apps.ntpc.edu.tw' and u.email_confirmed_at is not null
 and exists(select 1 from public.student_enrollments e where e.school_year=115 and e.email=lower(u.email) and e.class_code='307' and e.seat_no=30);
 return jsonb_build_object('identity',base->'identity','as_of',base->'as_of',
  'weekly_rows',base->'weekly_rows','foundation',base->'foundation','assignments',base->'assignments','periods',base->'periods',
  'quiz',jsonb_build_object('awards',learning||normal,'flowers',flowers,'partner',partner),'rehearsal',rehearsal,
  'growth',growth,'choices',choices,'catalog',base->'garden'->'catalog',
  'unlocks',coalesce((select jsonb_agg(item_key) from public.garden_item_unlocks where user_id=target),'[]'),
  'skin',coalesce((select skin from public.garden_tree_skins where user_id=target),'a'));
end $function$;
revoke all on function public.admin_learning_tree(text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.admin_learning_tree(text,text,jsonb) to authenticated;
commit;
