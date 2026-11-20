-- Pending explicit production SQL approval. Isolated verification first.
-- Extends the approved ordinary-fields snapshot with legacy single choices.
-- No question, allocation or answer writes. Apply only after the approved fields-only migration.
begin;
do $guard$
begin
 if md5(pg_get_functiondef('partner_pilot.learning_snapshot(uuid)'::regprocedure)) <> '2a8634c909aa6331fc3824213a6aee8e' then
  raise exception 'partner_learning_snapshot_baseline_changed';
 end if;
 if md5(pg_get_functiondef('partner_pilot.learning_snapshot_pre_message_media(uuid)'::regprocedure)) <> '1064d2e6dece7ae4d027182dc2b42530'
  or md5(pg_get_functiondef('partner_pilot.owner_of(uuid,integer)'::regprocedure)) <> 'c82e32f88cea2dbbdb5e838bf6684551' then
  raise exception 'partner_learning_snapshot_dependency_changed';
 end if;
end $guard$;
CREATE OR REPLACE FUNCTION partner_pilot.learning_snapshot(rid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;items jsonb;part text;
begin
 result:=partner_pilot.learning_snapshot_pre_message_media(rid);
 if result#>'{exercise,notes}' is null then return result;end if;
 foreach part in array array['mine','shared'] loop
  select coalesce(jsonb_agg(n.value || case
   when q.id=657772880 and md5(q.rich::text)='0798d13238fecfb3fa2c2dfd7480d321' then jsonb_build_object('rich',jsonb_set(n.value->'rich','{prompt,media}',jsonb_build_array(jsonb_build_object('kind','image','alt','原卷第2頁・上排第2張圖卡','url','https://partner-media.invalid/8425314fafb48eec6aee9eec51d69d993992a81f0fb724ac7c01c47351e89dfd'))))
   when q.id=717570551 and md5(q.rich::text)='d423375ecd56d45f23efb772f0c6e898' then jsonb_build_object('rich',jsonb_set(n.value->'rich','{prompt,media}',jsonb_build_array(jsonb_build_object('kind','image','alt','原卷第2頁・上排第3張圖卡','url','https://partner-media.invalid/2179540fb5b48d812a3877cb99885e435235edf1bdaebb87040654dbcc22f290'))))
   when q.id=664978118 and md5(q.rich::text)='c8a4fc27a17160763940ea7364416c47' then jsonb_build_object('rich',jsonb_set(n.value->'rich','{prompt,media}',jsonb_build_array(jsonb_build_object('kind','image','alt','原卷第2頁・上排第1張圖卡','url','https://partner-media.invalid/009146ed4b4eea6cf0d8e1e8d03313b6f1c80a8812290002fb215a6a674bb3ad'))))
   else '{}'::jsonb end || case
   when n.value ? 'explanation' and q.past_meta->>'kind'='single'
    and coalesce(q.past_meta->>'selfCheck','false')<>'true'
    and q.past_answer is not null and q.past_answer<>'null'::jsonb
   then jsonb_build_object('pastReference',q.past_answer) else '{}'::jsonb end
   order by n.ordinality),'[]'::jsonb) into items
  from jsonb_array_elements(result#>array['exercise',part]) with ordinality n(value,ordinality)
  left join partner_pilot.question_bank q on q.id=(n.value->>'id')::integer;
  result:=jsonb_set(result,array['exercise',part],items);
 end loop;
 -- A shared field response is visible only after every allocated question has
 -- been submitted. Retain only its owner's latest original response.
 if coalesce((result#>>'{exercise,reviewOpen}')::boolean,false) then
  select coalesce(jsonb_agg(n.value||case when q.normal_question->>'type'='fields'
   or (q.normal_question is null and q.past_meta is null and q.past_config is null
    and case when jsonb_typeof(q.options)='array'
     then jsonb_array_length(q.options) between 2 and 8 else false end)
   then jsonb_build_object('attempts',coalesce((
    select jsonb_build_array(jsonb_build_object('choice',a.choice,'value',a.response,'correct',a.correct,'at',a.created_at))
    from partner_pilot.answers a where a.room_id=rid and a.qid=q.id
     and a.user_id=partner_pilot.owner_of(rid,q.id)
    order by a.attempt desc limit 1),'[]'::jsonb)) else '{}'::jsonb end
   order by n.ordinality),'[]'::jsonb) into items
  from jsonb_array_elements(result#>'{exercise,shared}') with ordinality n(value,ordinality)
  left join partner_pilot.question_bank q on q.id=(n.value->>'id')::integer;
  result:=jsonb_set(result,'{exercise,shared}',items);
 end if;
 select coalesce(jsonb_agg(n.value||jsonb_build_object('attachments',coalesce(a.media,'[]'::jsonb)) order by n.ordinality),'[]'::jsonb) into items
 from jsonb_array_elements(result#>'{exercise,notes}') with ordinality n(value,ordinality)
 left join (select x.note_id,jsonb_agg(partner_pilot.message_meta(x) order by x.created_at,x.id) media
  from partner_pilot.message_attachments x where x.room_id=rid and x.state='linked' group by x.note_id)a
 on a.note_id=(n.value->>'id')::bigint;
 return jsonb_set(result,'{exercise,notes}',items);
end $function$;
revoke all on function partner_pilot.learning_snapshot(uuid) from public, anon, authenticated, service_role;
grant execute on function partner_pilot.learning_snapshot(uuid) to postgres;

commit;
