-- Additive pet-intent preference. No progress, rewards or unlock changes.
begin;
set local lock_timeout='3s';set local statement_timeout='30s';
alter table public.garden_companion_choices add column if not exists modes jsonb not null default '{"cat":"walk","dog":"walk","rabbit":"walk"}';
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
revoke all on function public.garden_companions(text,text,jsonb) from public,anon;
grant execute on function public.garden_companions(text,text,jsonb) to authenticated;
notify pgrst,'reload schema';commit;
