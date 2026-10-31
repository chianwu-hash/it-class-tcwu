begin;
-- A single claim batches all currently pending items from one course. Serialize
-- by student so simultaneous tabs cannot each display the same surprise.
create or replace function public.garden_unlock_notice(p_course_id text default null,p_action text default 'pending',p_claim uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();course text;claim uuid;items jsonb;g jsonb;
begin
 if uid is null then raise exception 'authentication_required';end if;
 if coalesce(public.is_teacher(),false) or not exists(select 1 from auth.users u join public.student_enrollments e on e.email=lower(u.email)
  where u.id=uid and u.email_confirmed_at is not null and e.school_year=115 and left(e.class_code,1) in('3','6')) then raise exception 'student_required';end if;
 if p_action is null or p_action not in('check','pending','claim','ack') then raise exception 'invalid_action';end if;
 if p_action in('check','ack') and (p_course_id is null or p_course_id not in('grade3-114-2','grade3-115-1','grade6-115-1')) then raise exception 'invalid_course';end if;
 perform pg_advisory_xact_lock(hashtextextended('garden-notices:'||uid::text,0));
 if p_action='check' then
  -- Existing grown records only: never take a surprise baseline before the
  -- student's first visit to their newly grown tree.
  if exists(select 1 from public.garden_growth where user_id=uid and course_id=p_course_id) then g:=public.garden_growth(p_course_id,'get');end if;
 elsif p_action='ack' then
  update public.garden_item_notices set seen_at=now(),claim_until=null
   where user_id=uid and course_id=p_course_id and seen_at is null and claim_id=p_claim;
  return null;
 end if;
 if p_action='claim' and exists(select 1 from public.garden_item_notices where user_id=uid and seen_at is null and claim_until>now()) then return null;end if;
 select course_id into course from public.garden_item_notices where user_id=uid and seen_at is null order by created_at,item_key limit 1;
 if course is null then return null;end if;
 if p_action='claim' then
  claim:=gen_random_uuid();
  update public.garden_item_notices set claim_id=claim,claim_until=now()+interval '2 minutes' where user_id=uid and course_id=course and seen_at is null;
 end if;
 select jsonb_agg(jsonb_build_object('key',c.item_key,'label',c.label,'portrait',c.portrait) order by c.leaves,c.item_key) into items
 from public.garden_item_notices n join public.garden_item_catalog() c on c.item_key=n.item_key where n.user_id=uid and n.course_id=course and n.seen_at is null
 and (p_action<>'claim' or n.claim_id=claim);
 return jsonb_build_object('courseId',course,'claim',claim,'items',items);
end$$;
revoke all on function public.garden_unlock_notice(text,text,uuid) from public,anon;
grant execute on function public.garden_unlock_notice(text,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
