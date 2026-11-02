-- Grade 9 entry resumes only an unfinished attempt of the active version.
-- Exact request retries and explicit old-attempt resumes retain their versions.
begin;
do $migration$
declare src text;needle text;replacement text;
begin
 select pg_get_functiondef('public.quiz_past_action(text,jsonb)'::regprocedure) into src;
 needle := 'and semester=paper.semester and completed_at is null order by created_at desc limit 1;end if;';
 replacement := 'and semester=paper.semester and (paper.grade<>9 or version_id=paper.active_version) and completed_at is null order by created_at desc limit 1;end if;';
 if position(replacement in src)=0 then
  if position(needle in src)=0 then raise exception 'past_action_start_source_changed';end if;
  execute replace(src,needle,replacement);
 end if;
 select pg_get_functiondef('public.quiz_past_snapshot(uuid)'::regprocedure) into src;
 needle := 'data:=public.quiz_past_snapshot_before_learning(p_attempt);';
 replacement := needle || $notice$
 -- Old attempts remain readable, with a clear way to open the revised paper.
 if exists(select 1 from public.quiz_past_attempts a join public.quiz_past_papers p on p.id=a.paper_id where a.id=p_attempt and p.grade=9 and p.active_version::text is distinct from data->>'version') then
  data:=jsonb_set(data,'{groups}',(select jsonb_agg(jsonb_set(x,'{notice}',to_jsonb('這是更新前的舊版作答，原紀錄已保留。要練習新版，請展開「成績紀錄與重新作答」，按「另開一次作答」或「重新作答」。 '||coalesce(x->>'notice',''))) order by ord) from jsonb_array_elements(data->'groups') with ordinality q(x,ord)));
 end if;
$notice$;
 if position('這是更新前的舊版作答' in src)=0 then
  if position(needle in src)=0 then raise exception 'past_snapshot_base_source_changed';end if;
  execute replace(src,needle,replacement);
 end if;
end $migration$;
notify pgrst,'reload schema';
commit;
