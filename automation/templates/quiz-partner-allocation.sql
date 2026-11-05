-- Whole-source-unit assignment for NEW past-paper rooms only.
-- Source template; build-partner-allocation.py emits the complete single-transaction migration.
begin;
set local lock_timeout='3s';
set local statement_timeout='90s';
alter table partner_pilot.rooms add column allocation_version integer not null default 0 check(allocation_version in (0,1));
create table partner_pilot.allocation_specs(
 version uuid primary key references public.quiz_past_versions(id),
 source_paper text not null, document_sha text not null,
 plan jsonb not null check(jsonb_typeof(plan)='object'));
create table partner_pilot.allocations(
 room_id uuid not null references partner_pilot.rooms(id) on delete cascade,
 qid integer not null references partner_pilot.question_bank(id),
 user_id uuid not null references partner_pilot.allowed_users(user_id),
 unit_id text not null, primary key(room_id,qid));
alter table partner_pilot.allocation_specs enable row level security;
alter table partner_pilot.allocations enable row level security;
revoke all on partner_pilot.allocation_specs,partner_pilot.allocations from public,anon,authenticated,service_role;

-- Resolve source FIELD ID via exact original order + group + label + points, not a guessed title.
create function partner_pilot.allocation_items(pid text)
returns table(qid integer,unit_id text,weight integer)
language plpgsql stable security definer set search_path='' as $$
declare p partner_pilot.papers; spec partner_pilot.allocation_specs; doc jsonb; total integer; result jsonb;
begin
 select * into strict p from partner_pilot.papers where id=pid;
 select * into spec from partner_pilot.allocation_specs where version=p.source_version;
 select v.document into doc from public.quiz_past_versions v
 where v.id=spec.version and v.paper_id=spec.source_paper and v.sha256=spec.document_sha;
 if doc is null or p.past_meta->>'sourcePaper' is distinct from spec.source_paper
 or spec.plan->>'version' is distinct from spec.version::text
 or spec.plan->>'paper' is distinct from spec.source_paper
 or spec.plan->>'sha256' is distinct from spec.document_sha then raise exception 'ALLOCATION_UNAVAILABLE';end if;
 select count(*) into total from jsonb_array_elements(doc->'groups') g cross join lateral jsonb_array_elements(g->'fields') f;
 if total<>p.total or total<>(select count(*) from partner_pilot.paper_items where paper_id=pid) then raise exception 'ALLOCATION_UNAVAILABLE';end if;
 if total<>(select count(distinct f->>'id') from jsonb_array_elements(doc->'groups') g cross join lateral jsonb_array_elements(g->'fields') f)
 or jsonb_array_length(doc->'groups')<>(select count(distinct g->>'id') from jsonb_array_elements(doc->'groups') g)
 then raise exception 'ALLOCATION_UNAVAILABLE';end if;
 if jsonb_array_length(spec.plan->'packs')<>(select count(distinct u->>'id') from jsonb_array_elements(spec.plan->'packs') u)
 or total<>(select count(*) from jsonb_array_elements(spec.plan->'packs') u cross join lateral jsonb_array_elements(u->'fields') f)
 or total<>(select count(distinct f->>'id') from jsonb_array_elements(spec.plan->'packs') u cross join lateral jsonb_array_elements(u->'fields') f)
 then raise exception 'ALLOCATION_UNAVAILABLE';end if;
 with source as (
  select g->>'id' gid,f->>'id' fid,coalesce(f->>'label',f->>'id') label,f->>'points' points,
   row_number() over(order by gn,fn)::int number
  from jsonb_array_elements(doc->'groups') with ordinality a(g,gn)
  cross join lateral jsonb_array_elements(g->'fields') with ordinality b(f,fn)
 ), mapping as (
  select u->>'id' unit,(u->>'weight')::int w,f->>'id' fid,f->>'group' gid
  from jsonb_array_elements(spec.plan->'packs') u cross join lateral jsonb_array_elements(u->'fields') f
 )
 select jsonb_agg(jsonb_build_object('qid',i.qid,'unit',m.unit,'weight',m.w)) into result from source s join mapping m on m.fid=s.fid and m.gid=s.gid
 join partner_pilot.paper_items i on i.paper_id=pid and i.number=s.number
 join partner_pilot.question_bank b on b.id=i.qid
 where b.past_meta->>'group'=s.gid and b.past_meta->>'points'=s.points
 and right(b.past_meta->>'label',length(s.label)+1)=chr(12539)||s.label and m.w>0;
 if coalesce(jsonb_array_length(result),0)<>total
 or total<>(select count(distinct v->>'qid') from jsonb_array_elements(result) v) then raise exception 'ALLOCATION_UNAVAILABLE';end if;
 return query select (v->>'qid')::integer,v->>'unit',(v->>'weight')::integer from jsonb_array_elements(result) v;
end $$;

create function partner_pilot.freeze_allocation() returns trigger
language plpgsql security definer set search_path='' as $$
declare roster uuid[]; loads integer[]; pack record; pos integer; n integer;
begin
 if TG_OP='INSERT' then
  if new.started then raise exception 'ALLOCATION_INVALID_STATE';end if;
  new.allocation_version:=case when (select past_meta is not null from partner_pilot.papers where id=new.paper) then 1 else 0 end;
  if new.allocation_version=1 then perform * from partner_pilot.allocation_items(new.paper);end if;
  return new;
 end if;
 if new.allocation_version is distinct from old.allocation_version or
  (old.started and (not new.started or new.paper<>old.paper or new.capacity<>old.capacity)) then raise exception 'ALLOCATION_FROZEN';end if;
 if not old.started and new.started and new.allocation_version=1 then
  select array_agg(user_id order by joined_at,user_id) into roster from partner_pilot.members where room_id=new.id;
  if cardinality(roster) is distinct from new.capacity or exists(select 1 from partner_pilot.members where room_id=new.id and not ready) then raise exception 'NOT_READY';end if;
  if exists(select 1 from partner_pilot.allocations where room_id=new.id) then raise exception 'ALLOCATION_FROZEN';end if;
  select count(distinct unit_id) into n from partner_pilot.allocation_items(new.paper);
  if n<new.capacity then raise exception 'ALLOCATION_TOO_FEW_UNITS';end if;
  loads:=array_fill(0,array[new.capacity]);
  -- Deterministic largest-pack-first scheduling. Bounded O(items * members), no search explosion.
  for pack in select unit_id,max(weight) weight,array_agg(qid order by qid) qids
    from partner_pilot.allocation_items(new.paper) group by unit_id order by max(weight) desc,unit_id collate "C" loop
   select i into pos from generate_subscripts(loads,1) i order by loads[i],i limit 1;
   insert into partner_pilot.allocations(room_id,qid,user_id,unit_id)
    select new.id,q,roster[pos],pack.unit_id from unnest(pack.qids) q;
   loads[pos]:=loads[pos]+pack.weight;
  end loop;
  if exists(select 1 from unnest(loads) v where v=0) then raise exception 'ALLOCATION_TOO_FEW_UNITS';end if;
 end if;
 return new;
end $$;
create trigger partner_freeze_allocation before insert or update on partner_pilot.rooms
for each row execute function partner_pilot.freeze_allocation();

create or replace function partner_pilot.owner_of(rid uuid,n integer) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare r partner_pilot.rooms; owner uuid;
begin
 select * into strict r from partner_pilot.rooms where id=rid;
 if r.allocation_version=1 then
  if not r.started then return null;end if;
  select user_id into owner from partner_pilot.allocations where room_id=rid and qid=n;
  if owner is null then raise exception 'ALLOCATION_UNAVAILABLE';end if;
  return owner;
 end if;
 select m.user_id into owner from
 (select user_id,row_number() over(order by joined_at,user_id)-1 pos from partner_pilot.members where room_id=rid) m
 where pos=(select (i.number-1)%r.capacity from partner_pilot.paper_items i where i.paper_id=r.paper and i.qid=n);
 return owner;
end $$;
revoke all on function partner_pilot.allocation_items(text),partner_pilot.freeze_allocation(),partner_pilot.owner_of(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function partner_pilot.allocation_items(text),partner_pilot.freeze_allocation(),partner_pilot.owner_of(uuid,integer) to postgres;

-- A source copy with a v1 room is immutable, including pending rooms. Publish a NEW version/copy for edits.
create function partner_pilot.guard_allocation_source() returns trigger
language plpgsql security definer set search_path='' as $$
declare pid text; frozen boolean;
begin
 if TG_TABLE_NAME='papers' then
  if TG_OP='UPDATE' and (new.source_version,new.source_sha,new.total,new.past_meta,new.content_key)
   is not distinct from (old.source_version,old.source_sha,old.total,old.past_meta,old.content_key) then return new;end if;
  pid:=old.id;
 elsif TG_TABLE_NAME='paper_items' then
  if TG_OP<>'INSERT' and exists(select 1 from partner_pilot.rooms where paper=old.paper_id and allocation_version=1) then raise exception 'ALLOCATION_SOURCE_FROZEN';end if;
  if TG_OP<>'DELETE' then pid:=new.paper_id;end if;
 else
  select exists(select 1 from partner_pilot.paper_items i join partner_pilot.rooms r on r.paper=i.paper_id
   where i.qid=old.id and r.allocation_version=1) into frozen;
  if frozen then raise exception 'ALLOCATION_SOURCE_FROZEN';end if;
 end if;
 if pid is not null and exists(select 1 from partner_pilot.rooms where paper=pid and allocation_version=1) then raise exception 'ALLOCATION_SOURCE_FROZEN';end if;
 if TG_OP='DELETE' then return old;else return new;end if;
end $$;
create trigger partner_allocation_paper_guard before update or delete on partner_pilot.papers for each row execute function partner_pilot.guard_allocation_source();
create trigger partner_allocation_item_guard before insert or update or delete on partner_pilot.paper_items for each row execute function partner_pilot.guard_allocation_source();
create trigger partner_allocation_question_guard before update or delete on partner_pilot.question_bank for each row execute function partner_pilot.guard_allocation_source();
revoke all on function partner_pilot.guard_allocation_source() from public,anon,authenticated,service_role;
grant execute on function partner_pilot.guard_allocation_source() to postgres;

CREATE OR REPLACE FUNCTION partner_pilot.snapshot(rid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'partner_pilot'
AS $function$
declare r partner_pilot.rooms; answer jsonb;
begin
 if not exists(select 1 from partner_pilot.members where room_id=rid and user_id=auth.uid()) then raise exception 'NOT_MEMBER'; end if;
 select * into strict r from partner_pilot.rooms where id=rid;
 select jsonb_build_object('id',r.id,'code',r.code,'team',r.team,'theme',r.theme,'paper',r.paper,'capacity',r.capacity,'host',r.host,'revision',r.revision,'started',r.started,'allocationVersion',r.allocation_version,'topic','partner-pilot:'||r.id||':'||r.epoch,'members',coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',u.display_name,'ready',m.ready,'character',(case r.theme when 'space' then array['星星','月亮','彗星','太陽'] when 'dora' then array['大雄','哆啦A夢','靜香','小夫'] else array['小鹿','松鼠','狐狸','貓頭鷹'] end)[((m.position::int+r.character_offset-1)%4)+1])),'[]'::jsonb),'questions',case when r.started then (select coalesce(jsonb_agg(i.number order by i.number),'[]'::jsonb) from partner_pilot.paper_items i where i.paper_id=r.paper and partner_pilot.owner_of(rid,i.qid)=auth.uid()) else '[]'::jsonb end) into answer
 from (select *,row_number() over(order by joined_at,user_id) position from partner_pilot.members where room_id=rid) m join partner_pilot.allowed_users u using(user_id);
 return answer;
end $function$;

CREATE OR REPLACE FUNCTION partner_pilot.source_allowed(pid text, continuing boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from partner_pilot.papers p join auth.users u on u.id=auth.uid() join public.student_enrollments e on e.email=lower(u.email) and e.school_year=115 where p.id=pid and p.enabled and p.is_real and left(e.class_code,1)=p.grade::text and case when p.origin='self' then p.total in (10,20) and exists(select 1 from partner_pilot.rooms r join partner_pilot.members m on m.room_id=r.id where r.paper=p.id and m.user_id=auth.uid()) when p.past_meta is not null then exists(select 1 from public.quiz_past_papers s where s.id=p.past_meta->>'sourcePaper' and s.enabled and s.grade=p.grade and (continuing or exists(select 1 from partner_pilot.allocation_specs a where a.version=p.source_version)) and (continuing or s.active_version=p.source_version)) else p.total in (10,20) and exists(select 1 from partner_pilot.paper_sources ps join public.quiz_sessions s on s.id=ps.session_id where ps.paper_id=p.id and s.status='open' and s.library_visible and s.access_mode='practice' and s.school_year=115 and s.class_codes ? e.class_code and (continuing or s.version_id=p.source_version)) end)
$function$;

-- INSERT REVIEWED PLANS HERE

do $guard$
declare p record;
begin
 if not exists(select 1 from partner_pilot.allocation_specs) then raise exception 'ALLOCATION_PLAN_NOT_INSTALLED';end if;
 for p in select id from partner_pilot.papers where enabled and past_meta is not null loop
  perform * from partner_pilot.allocation_items(p.id);
 end loop;
end $guard$;
commit;
