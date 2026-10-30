-- Hide a retired teacher preset in the library while preserving direct resume/review access.
alter table public.quiz_sessions add column if not exists library_visible boolean not null default true;
do $visibility$
declare definition text; needle text:='where s.access_mode in (''practice'',''self'')';
begin
 definition:=pg_get_functiondef('public.quiz_library_sessions(jsonb)'::regprocedure);
 if strpos(definition,'s.library_visible')=0 then
  if strpos(definition,needle)=0 then raise exception 'library_definition_requires_review';end if;
  execute replace(definition,needle,'where (s.access_mode<>''practice'' or s.library_visible) and s.access_mode in (''practice'',''self'')');
 end if;
end $visibility$;
