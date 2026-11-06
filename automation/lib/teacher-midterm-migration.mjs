const literal=s=>"'"+s.replaceAll("'","''")+"'";
// The manifest carries only source IDs, fingerprints and curriculum metadata, never textbook question text.
export function buildTeacherMidtermMigration(plans){
 if(plans.length!==10||new Set(plans.map(p=>p.course)).size!==10)throw Error('expected_ten_midterm_papers');
 for(const p of plans)if(p.selected.length!==20||new Set(p.selected.map(q=>q.id)).size!==20||p.selected.some(q=>!p.units.includes(q.unit)))throw Error('invalid_midterm_selection');
 return `-- Fixed 115-1 midterm teacher papers; existing versions, answers and rewards are never rewritten.
begin;
set local lock_timeout='3s';set local statement_timeout='90s';
do $midterm$
declare plan jsonb;item jsonb;source public.quiz_question_pool;course public.quiz_courses;owner uuid;
 d jsonb;blocks jsonb;question jsonb;registered jsonb;expected text;actual text;sid uuid;vid uuid;bid uuid;recorded int;
begin
 for plan in select value from jsonb_array_elements(${literal(JSON.stringify(plans))}::jsonb) loop
  select * into course from public.quiz_courses where id=plan->>'course' and enabled;
  if course.id is null or course.definition is distinct from plan->'definition' then raise exception 'MIDTERM_SCOPE_CHANGED';end if;
  select s.owner_id into owner from public.quiz_sessions s where s.id=(plan->>'seedSession')::uuid and s.status='open' and s.library_visible and s.access_mode='practice' and s.school_year=115;
  if owner is null then raise exception 'MIDTERM_TEACHER_SOURCE_CHANGED';end if;
  blocks:='[]';
  for item in select value from jsonb_array_elements(plan->'selected') loop
   select * into source from public.quiz_question_pool where question_id=item->>'id';
   select md5(jsonb_build_object('question',source.question,'units',source.unit_ids,'usable',source.usable,'difficulty',source.difficulty,'course',coalesce((select course_id from public.quiz_pool_membership where question_id=source.question_id),'115-1-hanlin-g3-math'))::text) into actual;
   if source.question_id is null or not source.usable or actual is distinct from item->>'fingerprint'
    or exists(select 1 from jsonb_array_elements_text(source.unit_ids) u where not(plan->'units' @> to_jsonb(u.value::int))) then raise exception 'MIDTERM_QUESTION_CHANGED';end if;
   question:=jsonb_set(source.question,'{id}',item->'newQuestion');
   blocks:=blocks||jsonb_build_array(jsonb_build_object('id','midterm-block-'||(jsonb_array_length(blocks)+1),'material',jsonb_build_object('text','','media','[]'::jsonb),'questions',jsonb_build_array(question)));
  end loop;
  d:=plan->'template'||jsonb_build_object('title',plan->>'title','catalog',plan->'catalog','blocks',blocks);
  perform public.quiz_validate(d);
  if exists(select 1 from jsonb_path_query(d,'$.blocks[*].**.media[*].url') a(url) where not exists(select 1 from public.quiz_media_assets m where m.url=a.url#>>'{}' and m.owner_id=owner)) then raise exception 'MIDTERM_MEDIA_UNAVAILABLE';end if;
  bid:=(plan->>'bank')::uuid;vid:=(plan->>'version')::uuid;sid:=(plan->>'session')::uuid;
  insert into public.quiz_banks(id,owner_id,draft) values(bid,owner,d) on conflict(id) do nothing;
  insert into public.quiz_versions(id,bank_id,revision,document) values(vid,bid,1,d) on conflict(id) do nothing;
  if not exists(select 1 from public.quiz_versions v join public.quiz_banks b on b.id=v.bank_id where v.id=vid and v.bank_id=bid and b.owner_id=owner and v.document=d) then raise exception 'MIDTERM_VERSION_CONFLICT';end if;
  insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode,status,library_visible)
   values(sid,owner,vid,115,'[]','immediate',false,true,'practice','open',true) on conflict(id) do nothing;
  if not exists(select 1 from public.quiz_sessions where id=sid and owner_id=owner and version_id=vid and access_mode='practice' and school_year=115 and status='open' and library_visible) then raise exception 'MIDTERM_SESSION_CONFLICT';end if;
  for item in select value from jsonb_array_elements(plan->'selected') loop
   insert into public.quiz_pool_aliases values(vid,item->>'newQuestion',item->>'id') on conflict(version_id,legacy_question_id) do nothing;
   if not exists(select 1 from public.quiz_pool_aliases where version_id=vid and legacy_question_id=item->>'newQuestion' and question_id=item->>'id') then raise exception 'MIDTERM_ALIAS_CONFLICT';end if;
  end loop;
  perform partner_pilot.import_teacher_library_session(sid);
 end loop;
end $midterm$;
notify pgrst,'reload schema';
commit;
`;
}
