-- Operator rollback: stop new matching, clear only pre-start presence, preserve all ordinary rooms/learning records.
begin;
do $disable$
declare g int;
begin
 for g in select unnest(array[3,4,6,9]) loop
  perform pg_advisory_xact_lock(hashtextextended('partner-match-grade:'||g,0));
 end loop;
 update partner_pilot.match_settings set enabled=false;
 update partner_pilot.match_teams set phase='closed',reason='release_rollback',revision=revision+1 where phase='selecting';
 delete from partner_pilot.match_presence;
 update partner_pilot.match_batches set closed=true where not closed;
end $disable$;
commit;
