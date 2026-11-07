-- Add a typed past-exam reference only to questions already revealed by the
-- existing snapshot. No grading, attempt, membership or award data is changed.
begin;
create or replace function partner_pilot.learning_snapshot(rid uuid)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare result jsonb;items jsonb;part text;
begin
 result:=partner_pilot.learning_snapshot_pre_message_media(rid);
 if result#>'{exercise,notes}' is null then return result;end if;
 foreach part in array array['mine','shared'] loop
  select coalesce(jsonb_agg(n.value || case
   when n.value ? 'explanation' and q.past_meta->>'kind'='single'
    and coalesce(q.past_meta->>'selfCheck','false')<>'true'
    and q.past_answer is not null and q.past_answer<>'null'::jsonb
   then jsonb_build_object('pastReference',q.past_answer) else '{}'::jsonb end
   order by n.ordinality),'[]'::jsonb) into items
  from jsonb_array_elements(result#>array['exercise',part]) with ordinality n(value,ordinality)
  left join partner_pilot.question_bank q on q.id=(n.value->>'id')::integer;
  result:=jsonb_set(result,array['exercise',part],items);
 end loop;
 select coalesce(jsonb_agg(n.value||jsonb_build_object('attachments',coalesce(a.media,'[]'::jsonb)) order by n.ordinality),'[]'::jsonb) into items
 from jsonb_array_elements(result#>'{exercise,notes}') with ordinality n(value,ordinality)
 left join (select x.note_id,jsonb_agg(partner_pilot.message_meta(x) order by x.created_at,x.id) media
  from partner_pilot.message_attachments x where x.room_id=rid and x.state='linked' group by x.note_id)a
 on a.note_id=(n.value->>'id')::bigint;
 return jsonb_set(result,'{exercise,notes}',items);
end $function$;
revoke all on function partner_pilot.learning_snapshot(uuid) from public,anon,authenticated,service_role;
grant execute on function partner_pilot.learning_snapshot(uuid) to postgres;
commit;
