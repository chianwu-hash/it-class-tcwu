-- Supplemental original media only: the immutable version, fields, answers and
-- every saved response remain unchanged. Frozen bank copies are not updated.
-- Original PDF SHA-256:
-- f7448d7dd54fd59b9d5bbc13f7b26d9671e8130dba772f8d5dd19a10c8aaa645
-- Three existing immutable crops were re-read and SHA-256 checked against the
-- version's source provenance. Apply only after the user's explicit SQL approval.
begin;
do $guard$
begin
 if md5(pg_get_functiondef('partner_pilot.learning_snapshot(uuid)'::regprocedure))<>'36981e39eb1249040232951476079d99' then raise exception 'matching_snapshot_function_changed';end if;
 if md5(pg_get_functiondef('public.quiz_past_has_media(jsonb,text)'::regprocedure))<>'54b7cdff29b1ce4203592c7f63d0fbf8' then raise exception 'matching_media_function_changed';end if;
 if not exists(select 1 from public.quiz_past_versions where id='6a366ece-815d-496e-aa41-91f69582bd68' and md5(document::text)='30f6d35047540fc488ee387066f42e61') then raise exception 'matching_media_source_changed';end if;
 if not exists(select 1 from partner_pilot.question_bank where id=657772880 and md5(rich::text)='0798d13238fecfb3fa2c2dfd7480d321') then raise exception 'matching_media_bank_changed';end if;
 if not exists(select 1 from partner_pilot.question_bank where id=717570551 and md5(rich::text)='d423375ecd56d45f23efb772f0c6e898') then raise exception 'matching_media_bank_changed';end if;
 if not exists(select 1 from partner_pilot.question_bank where id=664978118 and md5(rich::text)='c8a4fc27a17160763940ea7364416c47') then raise exception 'matching_media_bank_changed';end if;
 if not exists(select 1 from public.quiz_media_assets where url='https://quiz-media.invalid/82dfc4ec-8c68-47d9-aa25-8918080ca577/009146ed4b4eea6cf0d8e1e8d03313b6f1c80a8812290002fb215a6a674bb3ad' and mime='image/png' and bytes=208738) then raise exception 'matching_original_crop_missing';end if;
 if not exists(select 1 from public.quiz_media_assets where url='https://quiz-media.invalid/82dfc4ec-8c68-47d9-aa25-8918080ca577/8425314fafb48eec6aee9eec51d69d993992a81f0fb724ac7c01c47351e89dfd' and mime='image/png' and bytes=22301) then raise exception 'matching_original_crop_missing';end if;
 if not exists(select 1 from public.quiz_media_assets where url='https://quiz-media.invalid/82dfc4ec-8c68-47d9-aa25-8918080ca577/2179540fb5b48d812a3877cb99885e435235edf1bdaebb87040654dbcc22f290' and mime='image/png' and bytes=131190) then raise exception 'matching_original_crop_missing';end if;
end $guard$;
CREATE OR REPLACE FUNCTION public.quiz_past_has_media(d jsonb, u text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select exists(select 1 from (
  select jsonb_path_query(d,'$.groups[*].assets[*].url') value
  union all select jsonb_path_query(d,'$.groups[*].choices[*].content.media[*].url')
  union all select jsonb_path_query(d,'$.groups[*].promptContent.media[*].url')
  union all select jsonb_path_query(d,'$.groups[*].materialContent.media[*].url')
 ) media where media.value#>>'{}'=u)
 or (md5(d::text)='30f6d35047540fc488ee387066f42e61' and u=any(array['https://quiz-media.invalid/82dfc4ec-8c68-47d9-aa25-8918080ca577/009146ed4b4eea6cf0d8e1e8d03313b6f1c80a8812290002fb215a6a674bb3ad','https://quiz-media.invalid/82dfc4ec-8c68-47d9-aa25-8918080ca577/8425314fafb48eec6aee9eec51d69d993992a81f0fb724ac7c01c47351e89dfd','https://quiz-media.invalid/82dfc4ec-8c68-47d9-aa25-8918080ca577/2179540fb5b48d812a3877cb99885e435235edf1bdaebb87040654dbcc22f290']::text[]))
$function$;

insert into partner_pilot.media_map(paper_id,hash,source_url) select distinct i.paper_id,'8425314fafb48eec6aee9eec51d69d993992a81f0fb724ac7c01c47351e89dfd','https://quiz-media.invalid/82dfc4ec-8c68-47d9-aa25-8918080ca577/8425314fafb48eec6aee9eec51d69d993992a81f0fb724ac7c01c47351e89dfd' from partner_pilot.paper_items i where i.qid=657772880 on conflict(paper_id,hash) do nothing;
insert into partner_pilot.media_map(paper_id,hash,source_url) select distinct i.paper_id,'2179540fb5b48d812a3877cb99885e435235edf1bdaebb87040654dbcc22f290','https://quiz-media.invalid/82dfc4ec-8c68-47d9-aa25-8918080ca577/2179540fb5b48d812a3877cb99885e435235edf1bdaebb87040654dbcc22f290' from partner_pilot.paper_items i where i.qid=717570551 on conflict(paper_id,hash) do nothing;
insert into partner_pilot.media_map(paper_id,hash,source_url) select distinct i.paper_id,'009146ed4b4eea6cf0d8e1e8d03313b6f1c80a8812290002fb215a6a674bb3ad','https://quiz-media.invalid/82dfc4ec-8c68-47d9-aa25-8918080ca577/009146ed4b4eea6cf0d8e1e8d03313b6f1c80a8812290002fb215a6a674bb3ad' from partner_pilot.paper_items i where i.qid=664978118 on conflict(paper_id,hash) do nothing;
-- Project supplemental original media only in the existing authorized snapshot.
-- Never update frozen question-bank copies or disable allocation guards.
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
 select coalesce(jsonb_agg(n.value||jsonb_build_object('attachments',coalesce(a.media,'[]'::jsonb)) order by n.ordinality),'[]'::jsonb) into items
 from jsonb_array_elements(result#>'{exercise,notes}') with ordinality n(value,ordinality)
 left join (select x.note_id,jsonb_agg(partner_pilot.message_meta(x) order by x.created_at,x.id) media
  from partner_pilot.message_attachments x where x.room_id=rid and x.state='linked' group by x.note_id)a
 on a.note_id=(n.value->>'id')::bigint;
 return jsonb_set(result,'{exercise,notes}',items);
end $function$;
commit;
