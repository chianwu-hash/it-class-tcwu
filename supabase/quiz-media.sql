-- 先 quiz.sql，再本檔；2026-10-26 已依使用者授權套用於本人雲端試答。
begin;
create table if not exists public.quiz_media_assets (
 url text primary key, owner_id uuid not null references auth.users(id),
 object_path text unique not null, mime text not null, bytes integer not null check(bytes between 1 and 8388608)
);
alter table public.quiz_media_assets enable row level security;
revoke all on public.quiz_media_assets from public,anon,authenticated;
grant all on public.quiz_media_assets to service_role;

-- 僅驗證過 Auth 身分的 Edge Function 可呼叫；assets 與版本同一交易，草稿不被替換。
create or replace function public.quiz_freeze_publish(p_uid uuid,p_bank uuid,p_revision integer,p_original jsonb,p_document jsonb,p_assets jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare bank public.quiz_banks; ver public.quiz_versions; a jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_bank::text,0));
 select * into bank from public.quiz_banks where id=p_bank for update;
 if bank.id is null or bank.owner_id<>p_uid then raise exception 'bank_unavailable'; end if;
 if bank.revision<>p_revision then raise exception 'revision_changed'; end if;
 select * into ver from public.quiz_versions where bank_id=p_bank and revision=p_revision;
 if ver.id is not null then return to_jsonb(ver); end if;
 if bank.draft<>p_original then raise exception 'revision_changed'; end if;
 perform public.quiz_validate(p_document);
 for a in select value from jsonb_array_elements(p_assets) loop
  if a->>'url' is distinct from 'https://quiz-media.invalid/'||p_uid::text||'/'||split_part(a->>'object_path','/',2)
    or a->>'object_path' !~ ('^'||p_uid::text||'/[0-9a-f]{64}$') then raise exception 'media_invalid'; end if;
  insert into public.quiz_media_assets values(a->>'url',p_uid,a->>'object_path',a->>'mime',(a->>'bytes')::integer) on conflict(url) do nothing;
 end loop;
 if exists(select 1 from jsonb_path_query(p_document,'$.blocks[*].**.media[*].url') u
   where not exists(select 1 from public.quiz_media_assets m where m.url=u#>>'{}' and m.owner_id=p_uid)) then raise exception 'media_invalid'; end if;
 insert into public.quiz_versions(bank_id,revision,document) values(p_bank,p_revision,p_document) returning * into ver;
 return to_jsonb(ver);
end $$;
revoke all on function public.quiz_freeze_publish(uuid,uuid,integer,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.quiz_freeze_publish(uuid,uuid,integer,jsonb,jsonb,jsonb) to service_role;

create or replace function public.quiz_media_access(p_url text,p_attempt uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare asset public.quiz_media_assets; sid uuid; visible jsonb;
begin
 if auth.uid() is null then raise exception 'login_required'; end if;
 select * into asset from public.quiz_media_assets where url=p_url;
 if asset.url is null then raise exception 'media_unavailable'; end if;
 if coalesce(public.is_teacher(),false) and asset.owner_id=auth.uid() then return to_jsonb(asset); end if;
 select session_id into sid from public.quiz_attempts where id=p_attempt and user_id=auth.uid();
 if sid is null then raise exception 'media_unavailable'; end if;
 -- 重用接回時的名冊／本人／揭答投影，解析未揭露就不能取得其媒體。
 visible:=public.quiz_action('resume',jsonb_build_object('session_id',sid));
 if not exists(select 1 from jsonb_path_query(visible,'$.**.media[*].url') u where u#>>'{}'=p_url) then raise exception 'media_unavailable'; end if;
 return to_jsonb(asset);
end $$;
revoke all on function public.quiz_media_access(text,uuid) from public,anon;
grant execute on function public.quiz_media_access(text,uuid) to authenticated;
commit;
