-- User-approved 20-second matchmaking collection. Existing batch deadlines and all tasks stay intact.
begin;
do $$
begin
 if exists(select 1 from partner_pilot.match_settings where batch_seconds not in (20,30)) then
  raise exception 'Unexpected matchmaking duration; review before applying';
 end if;
 if not exists(select 1 from pg_constraint where conrelid='partner_pilot.match_settings'::regclass and conname='match_settings_batch_seconds_check') then
  raise exception 'Expected matchmaking duration constraint missing';
 end if;
end $$;
alter table partner_pilot.match_settings drop constraint match_settings_batch_seconds_check;
alter table partner_pilot.match_settings alter column batch_seconds set default 20;
update partner_pilot.match_settings set batch_seconds=20 where batch_seconds=30;
alter table partner_pilot.match_settings add constraint match_settings_batch_seconds_check check(batch_seconds=20);
commit;
