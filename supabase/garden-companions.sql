begin;
create table if not exists public.garden_item_unlocks(
 user_id uuid not null references auth.users(id) on delete cascade,item_key text not null,
 course_id text not null,unlocked_at timestamptz not null default now(),primary key(user_id,item_key)
);
create table if not exists public.garden_item_notices(
 user_id uuid not null references auth.users(id) on delete cascade,item_key text not null,course_id text not null,
 created_at timestamptz not null default now(),seen_at timestamptz,claim_id uuid,claim_until timestamptz,
 primary key(user_id,item_key),foreign key(user_id,item_key) references public.garden_item_unlocks(user_id,item_key)
);
create table if not exists public.garden_companion_choices(
 user_id uuid primary key references auth.users(id) on delete cascade,pet text not null default 'cat',
 homes jsonb not null default '{"cat":"b","dog":"a","rabbit":"b"}',home_visible boolean not null default false,updated_at timestamptz not null default now()
);
alter table public.garden_companion_choices add column if not exists home_visible boolean not null default false;
alter table public.garden_companion_choices add column if not exists modes jsonb not null default '{"cat":"walk","dog":"walk","rabbit":"walk"}';

do $$declare t text;begin foreach t in array array['garden_item_unlocks','garden_item_notices','garden_companion_choices'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
end loop;end$$;
create or replace function public.garden_item_catalog() returns table(item_key text,label text,pet text,home text,leaves int,flowers int,portrait text)
language sql immutable set search_path='' as $$values
 ('pet:cat','橘寶與奶油貓耳陶屋','cat','b',12,3,'/garden/assets/processed/social-v10/sit-0.webp'),
 ('home:cat:a','原版綠頂木屋','cat','a',18,5,'/garden/assets/homes/cat-a-preview.webp'),
 ('home:cat:c','葉頂藤編窩','cat','c',24,6,'/garden/assets/homes/cat-c-preview.webp'),
 ('pet:dog','布丁與森林山牆木屋','dog','a',24,6,'/garden/assets/processed/pets-v3/dog/sit-1.webp'),
 ('home:dog:b','雲朵圓頂窩','dog','b',30,8,'/garden/assets/homes/dog-b-preview.webp'),
 ('home:dog:c','露營小帳篷','dog','c',36,9,'/garden/assets/homes/dog-c-preview.webp'),
 ('pet:rabbit','蹦蹦與桃色蘑菇屋','rabbit','b',36,9,'/garden/assets/processed/pets-v3/rabbit/sit-1.webp'),
 ('home:rabbit:a','樺木樹樁屋','rabbit','a',42,11,'/garden/assets/homes/rabbit-a-preview.webp'),
 ('home:rabbit:c','草丘小地窩','rabbit','c',48,12,'/garden/assets/homes/rabbit-c-preview.webp')$$;
-- Previously owned cat stays owned. Preserve old pending/seen welcome status.
insert into public.garden_item_unlocks(user_id,item_key,course_id,unlocked_at)
 select distinct on(user_id) user_id,'pet:cat',course_id,pet_unlocked_at from public.garden_growth
 where pet_unlocked_at is not null order by user_id,pet_unlocked_at on conflict do nothing;
do $$begin if to_regclass('public.garden_unlock_notices') is not null then
 insert into public.garden_item_unlocks(user_id,item_key,course_id,unlocked_at) select user_id,'pet:cat',course_id,created_at from public.garden_unlock_notices on conflict do nothing;
 insert into public.garden_item_notices(user_id,item_key,course_id,created_at,seen_at,claim_id,claim_until)
 select user_id,'pet:cat',course_id,created_at,seen_at,claim_id,claim_until from public.garden_unlock_notices
 on conflict do nothing;
end if;end$$;

create or replace function public.garden_unlock_items(course text,new_leaves int,new_flowers int) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();c record;added text;owned jsonb;
begin
 for c in select * from public.garden_item_catalog() order by leaves,item_key loop
  if new_leaves>=c.leaves or new_flowers>=c.flowers then
   added:=null;
   insert into public.garden_item_unlocks(user_id,item_key,course_id) values(uid,c.item_key,course)
    on conflict do nothing returning item_key into added;
   if added is not null then insert into public.garden_item_notices(user_id,item_key,course_id) values(uid,added,course) on conflict do nothing;end if;
  end if;
 end loop;
 select coalesce(jsonb_agg(item_key order by item_key),'[]') into owned from public.garden_item_unlocks where user_id=uid;
 return owned;
end$$;

create or replace function public.garden_companions(p_course_id text,p_action text default 'get',p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();g jsonb;chosen public.garden_companion_choices;chosen_pet text;chosen_home text;pets jsonb;homes jsonb;default_home text;show_home boolean;selected_mode text;
begin
 if p_action is null or p_action not in('get','save') or jsonb_typeof(p_data) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_data) k where k not in('pet','home','homeVisible','petMode')) or (p_data ? 'homeVisible' and jsonb_typeof(p_data->'homeVisible') is distinct from 'boolean') or (p_data ? 'petMode' and (jsonb_typeof(p_data->'petMode') is distinct from 'string' or p_data->>'petMode' not in('walk','rest'))) then raise exception 'invalid_request';end if;
 g:=public.garden_growth(p_course_id,'get'); -- validates confirmed student, course and level
 if g->>'level'<>'2' then
  if p_action='save' then raise exception 'level_two_required';end if;
  return '{"pets":[],"homes":[],"selectedPet":null,"selectedHome":null,"homeVisible":false,"petMode":"walk"}'::jsonb;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('garden-choices:'||uid::text,0));
 select * into chosen from public.garden_companion_choices where user_id=uid;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.pet,'name',split_part(c.label,'與',1),'portrait',c.portrait) order by c.leaves),'[]') into pets
 from public.garden_item_catalog() c join public.garden_item_unlocks u on u.item_key=c.item_key and u.user_id=uid where c.item_key like 'pet:%';
 if jsonb_array_length(pets)=0 then if p_action='save' then raise exception 'pet_locked';end if;return '{"pets":[],"homes":[],"selectedPet":null,"selectedHome":null,"homeVisible":false,"petMode":"walk"}'::jsonb;end if;
 chosen_pet:=coalesce(p_data->>'pet',chosen.pet,pets->0->>'id');
 if not exists(select 1 from public.garden_item_unlocks where user_id=uid and item_key='pet:'||chosen_pet) then
  if p_action='save' then raise exception 'pet_locked';end if;chosen_pet:=pets->0->>'id';
 end if;
 default_home:=case chosen_pet when 'dog' then 'a' else 'b' end;
 chosen_home:=coalesce(p_data->>'home',chosen.homes->>chosen_pet,default_home);
 if chosen_home not in('a','b','c') or (chosen_home<>default_home and not exists(select 1 from public.garden_item_unlocks where user_id=uid and item_key='home:'||chosen_pet||':'||chosen_home)) then
  if p_action='save' then raise exception 'home_locked';end if;chosen_home:=default_home;
 end if;
 show_home:=coalesce((p_data->>'homeVisible')::boolean,chosen.home_visible,false);
 selected_mode:=coalesce(p_data->>'petMode',chosen.modes->>chosen_pet,'walk');
 if p_data ? 'homeVisible' and not show_home and not(p_data ? 'petMode') then selected_mode:='walk';end if;
 if selected_mode='rest' then show_home:=true;end if;
 if p_action='save' then
  insert into public.garden_companion_choices(user_id,pet,homes,home_visible,modes) values(uid,chosen_pet,jsonb_set('{"cat":"b","dog":"a","rabbit":"b"}',array[chosen_pet],to_jsonb(chosen_home)),show_home,jsonb_set('{"cat":"walk","dog":"walk","rabbit":"walk"}',array[chosen_pet],to_jsonb(selected_mode)))
   on conflict(user_id) do update set home_visible=excluded.home_visible,pet=excluded.pet,modes=jsonb_set(garden_companion_choices.modes,array[chosen_pet],to_jsonb(selected_mode)),homes=jsonb_set(garden_companion_choices.homes,array[chosen_pet],to_jsonb(chosen_home)),updated_at=now()
   where garden_companion_choices.modes->>chosen_pet is distinct from selected_mode or garden_companion_choices.home_visible is distinct from show_home or garden_companion_choices.pet is distinct from chosen_pet or garden_companion_choices.homes->>chosen_pet is distinct from chosen_home;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('pet',c.pet,'home',c.home,'name',case when c.item_key like 'pet:%' then split_part(c.label,'與',2) else c.label end,
  'preview','/garden/assets/homes/'||c.pet||'-'||c.home||'-preview.webp') order by c.leaves),'[]') into homes
 from public.garden_item_catalog() c join public.garden_item_unlocks u on u.item_key=c.item_key and u.user_id=uid
 where c.pet=chosen_pet;
 return jsonb_build_object('pets',pets,'homes',homes,'selectedPet',chosen_pet,'selectedHome',chosen_home,'homeVisible',show_home,'petMode',selected_mode);
end$$;
revoke all on function public.garden_item_catalog(),public.garden_unlock_items(text,int,int) from public,anon,authenticated;
revoke all on function public.garden_companions(text,text,jsonb) from public,anon;
grant execute on function public.garden_companions(text,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
