-- 2026-11-04 夥伴練功穩定性：只減少重算與全表掃描，不改任何作答、計分、半葉配對、獎勵 ID 或組隊政策。
-- 提案檔：由 Codex 複核、經使用者同意後才套用到正式庫；套用後依 CLAUDE.md 重匯出 production-snapshot。
--
-- 1. 每次作答（answer）都多算一次完整 learning_snapshot。
--    action_core 已在最後算出 learning_snapshot 當回傳值；外層 quiz_partner_pilot_action 在 answer／finish
--    時又呼叫 claim_award 再重算一次。claim_award 在房間尚未 finished 時，除重複檢查成員（action_core 已檢查）
--    外直接 return、不寫任何資料，所以未完成小隊的這次重算結果必定相同。改為只有房間已 finished 時才呼叫
--    claim_award 並重算；finished 之後的行為與原本完全相同。
-- 2. learning_snapshot 對每一題、每位成員以 room_id 查 partner_pilot.notes 數十次，但 notes 只有主鍵索引，
--    每次都掃全表；notes 隨全校所有小隊累積，重算成本跟著無上限成長。me 與 Realtime 授權
--    （quiz_partner_pilot_can_subscribe）以 user_id 查 partner_pilot.members，也只有 (room_id,user_id) 索引。
--    notes.thread_id 外鍵（ON DELETE CASCADE）沒有索引。以下補上索引，只增不減。
-- 3. quiz_partner_rewards（努力樹、獎勵頁每次載入都呼叫）以 auth.uid()=any(members) 篩選，用不到既有的
--    GIN 索引 partner_awards_members，awards 越多越慢。改用等價的 members @> array[auth.uid()]
--    （auth.uid() 前一行已確認非 null，members 不含 null），回傳內容與排序完全不變。
begin;
set local lock_timeout='3s';
set local statement_timeout='90s';

create index if not exists partner_notes_room_qid on partner_pilot.notes(room_id,qid,kind);
create index if not exists partner_notes_room_user on partner_pilot.notes(room_id,user_id,kind);
create index if not exists partner_notes_thread on partner_pilot.notes(thread_id);
create index if not exists partner_members_user on partner_pilot.members(user_id,room_id);

-- Production definition (production-snapshot/functions.sql, md5 2773f879cf269306622847b018a0ec59) with one change:
-- claim_award and the second learning_snapshot run only after the room is finished.
CREATE OR REPLACE FUNCTION public.quiz_partner_pilot_action(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare act text:=p->>'action';rid uuid;r partner_pilot.rooms;result jsonb;pid text;aid uuid;
begin
 perform partner_pilot.register_self();
 -- Remember newly published class sessions before a room starts; their normal version updates do not orphan it.
 if act in ('catalog','create','join','lookup') then perform partner_pilot.sync_source_links();end if;
 if act='me' then return jsonb_build_object('id',auth.uid(),'name',(select display_name from partner_pilot.allowed_users where user_id=auth.uid()),'rooms',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'team',t.team,'started',t.started,'paused',not partner_pilot.source_allowed(t.paper,t.started)) order by t.created_at desc) from partner_pilot.rooms t join partner_pilot.members m on m.room_id=t.id where m.user_id=auth.uid()),'[]'));end if;
 if act='record' then
  aid:=(p->>'awardId')::uuid;select room_id into rid from partner_pilot.awards where id=aid and auth.uid()=any(members);if rid is null then raise exception 'NOT_MEMBER';end if;
  select * into r from partner_pilot.rooms where id=rid;
  if partner_pilot.source_allowed(r.paper,true) then return partner_pilot.learning_snapshot(rid);end if;
  return partner_pilot.paused_snapshot(rid)||jsonb_build_object('recordOnly',true);
 end if;
 if act='create' and not partner_pilot.source_allowed(p->>'paper',false) then raise exception 'SOURCE_CHANGED';end if;
 if act='lookup' then select paper into pid from partner_pilot.rooms where code=p->>'code';if not partner_pilot.source_allowed(pid,false) then raise exception 'ROOM_NOT_FOUND';end if;end if;
 if p ? 'roomId' then
  rid:=(p->>'roomId')::uuid;
  if act='start' then select * into r from partner_pilot.rooms where id=rid for update;else select * into r from partner_pilot.rooms where id=rid;end if;
  if act='join' then if not partner_pilot.source_allowed(r.paper,false) then raise exception 'SOURCE_CHANGED';end if;
  else
   if not exists(select 1 from partner_pilot.members where room_id=rid and user_id=auth.uid()) then raise exception 'NOT_MEMBER';end if;
   if not partner_pilot.source_allowed(r.paper,r.started) then
    if act='snapshot' then return partner_pilot.paused_snapshot(rid);end if;
    if act<>'save_draft' and not(act='leave' and not r.started) then raise exception 'SOURCE_CHANGED';end if;
   end if;
  end if;
 end if;
 if act='start' and r.started then return partner_pilot.learning_snapshot(rid);end if;
 if act='settle' then perform partner_pilot.claim_award(rid);return partner_pilot.learning_snapshot(rid);end if;
 result:=partner_pilot.action_core(p);
 if rid is not null and not partner_pilot.source_allowed(r.paper,r.started) and act='save_draft' then return partner_pilot.paused_snapshot(rid);end if;
 -- claim_award returns without writing while the room is unfinished; action_core already returned that snapshot.
 if act in ('finish','answer') and exists(select 1 from partner_pilot.rooms where id=rid and finished) then perform partner_pilot.claim_award(rid);result:=partner_pilot.learning_snapshot(rid);end if;
 return result;
end $function$;

-- Production definition (md5 104f9b99760930c13dc1620ace2a34ec); only the member predicate changes so the GIN index applies.
CREATE OR REPLACE FUNCTION public.quiz_partner_rewards(p_course text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null then raise exception 'authentication_required';end if;
 if p_course!~'^grade[3469]-[0-9]{3}-[12]$' then raise exception 'invalid_course';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'room',room_id,'course',course_id,'leaves',leaves,'flowers',flowers,'record',record,'at',created_at) order by created_at,id) from partner_pilot.awards where members @> array[auth.uid()] and course_id=p_course),'[]');
end $function$;

commit;
