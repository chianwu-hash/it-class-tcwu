import {compileLearningReads,compileGardenCatalog} from './admin-learning-readonly-reader.mjs';

export function buildLearningRewardsRpc(source,catalogDefinition){
  const build=compileLearningReads(source),catalog=compileGardenCatalog(catalogDefinition);
  const branches=['rewards','garden_status','class_rewards'].map(action=>{
    const query=build(action,catalog).replaceAll(`as (${catalog})`,'as (select * from public.garden_item_catalog())').replaceAll("'cloud-readonly'","'production-rpc'");
    if(query.includes('$learning$'))throw new Error('invalid_sql_literal');
    return `when '${action}' then execute '${query.replaceAll("'","''")}' into result using p_course_id,cls,seat,p_payload;`;
  }).join('\n');
  return `-- Teacher-only SELECT projections. No learner, reward, or unlock writes.
create or replace function public.admin_learning_rewards(p_action text,p_course_id text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $learning$
declare cls text;seat integer;result jsonb;
begin
 if auth.uid() is null or not coalesce(public.is_teacher(),false) then raise exception 'teacher_required';end if;
 if p_course_id is null or p_course_id not in ('grade3-115-1','grade6-115-1') then raise exception 'invalid_course';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('class_code','seat_no')) then raise exception 'invalid_request';end if;
 cls:=p_payload->>'class_code';
 if cls is null or cls !~ '^[36][0-9]{2}$' or left(cls,1)<>substring(p_course_id from 6 for 1) then raise exception 'invalid_class';end if;
 if p_action='class_rewards' then
  if p_payload ? 'seat_no' then raise exception 'invalid_request';end if;
 else
  if coalesce(p_payload->>'seat_no','') !~ '^[0-9]{1,2}$' then raise exception 'student_required';end if;
  seat:=(p_payload->>'seat_no')::integer;if seat not between 1 and 99 then raise exception 'student_required';end if;
 end if;
 case p_action
 ${branches}
 else raise exception 'invalid_action';end case;
 if result ? '__error' then raise exception '%',result->>'__error';end if;
 return result;
end $learning$;
revoke all on function public.admin_learning_rewards(text,text,jsonb) from public,anon;
grant execute on function public.admin_learning_rewards(text,text,jsonb) to authenticated;
`;
}
