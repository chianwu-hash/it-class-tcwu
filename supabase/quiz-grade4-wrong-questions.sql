-- Extend the installed optimized function without reinstalling legacy quiz SQL.
begin;
set local lock_timeout='5s';
do $migration$
declare
 definition text;
 old_guard constant text := 'coalesce(p_data->>''grade'','''') not in ('''',''3'',''6'')';
 new_guard constant text := 'coalesce(p_data->>''grade'','''') not in ('''',''3'',''4'',''6'')';
begin
 definition:=pg_get_functiondef('public.quiz_wrong_questions(jsonb)'::regprocedure);
 if array_length(string_to_array(definition,old_guard),1)=2 then
  execute replace(definition,old_guard,new_guard);
 elsif array_length(string_to_array(definition,new_guard),1)<>2 then
  raise exception 'expected_wrong_questions_grade_guard_missing';
 end if;
end $migration$;
notify pgrst,'reload schema';
commit;
