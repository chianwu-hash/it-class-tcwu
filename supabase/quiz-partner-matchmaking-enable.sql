-- Separate rollout gate: run only after review, main, snapshots and compatible runtime verification.
begin;
do $enable$
declare g int;
begin
 for g in select unnest(array[3,4,6,9]) loop
  perform pg_advisory_xact_lock(hashtextextended('partner-match-grade:'||g,0));
 end loop;
 perform partner_pilot.sync_source_links();
 for g in select unnest(array[3,4,6,9]) loop
  if not partner_pilot.match_available(g) then raise exception 'MATCH_GRADE_HAS_NO_COMMON_PAPER: %',g;end if;
 end loop;
 update partner_pilot.match_settings set enabled=true where grade in(3,4,6,9);
end $enable$;
commit;
