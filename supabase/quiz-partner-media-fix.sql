-- Read-only media metadata; membership/reveal policy and ACL remain unchanged.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
CREATE OR REPLACE FUNCTION public.quiz_partner_pilot_media_descriptor(p_room uuid, p_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare snap jsonb;pid text;result jsonb;
begin
 perform partner_pilot.register_self();
 if p_hash is null or p_hash!~'^[0-9a-f]{64}$' then raise exception 'MEDIA_DENIED';end if;
 select paper into pid from partner_pilot.rooms where id=p_room;
 perform partner_pilot.assert_source(pid);snap:=partner_pilot.learning_snapshot(p_room);
 -- Inspect only source-owned rich media URLs. Answers, notes and drafts are never authorization input.
 if not exists(select 1 from jsonb_array_elements(coalesce(snap#>'{exercise,mine}','[]')||coalesce(snap#>'{exercise,shared}','[]')) q cross join lateral jsonb_path_query(q->'rich','$.**.url') media where media=to_jsonb('https://partner-media.invalid/'||p_hash)) then raise exception 'MEDIA_DENIED';end if;
 select jsonb_build_object('path',a.object_path,'mime',a.mime,'bytes',a.bytes,
 'url',a.url,'sha256',substring(a.url from '/([a-f0-9]{64})$'),
 'backend',case when exists(select 1 from partner_pilot.papers p where p.id=pid and p.past_meta is not null) then 'supabase' else 'auto' end) into result from partner_pilot.media_map m join public.quiz_media_assets a on a.url=m.source_url where m.paper_id=pid and m.hash=p_hash;
 if result is null then raise exception 'MEDIA_UNAVAILABLE';end if;return result;
end $function$;
revoke all on function public.quiz_partner_pilot_media_descriptor(uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.quiz_partner_pilot_media_descriptor(uuid,text) to postgres;
grant execute on function public.quiz_partner_pilot_media_descriptor(uuid,text) to authenticated;
grant execute on function public.quiz_partner_pilot_media_descriptor(uuid,text) to service_role;

commit;
