import {createHash} from 'node:crypto';
const quote=s=>"'"+s.replaceAll("'","''")+"'";
export const GRADE_SHARING_FUNCTIONS=[
 'public.quiz_action_before_learning(text,jsonb)','public.quiz_entry_context_before_learning(jsonb)',
 'public.quiz_leaf_result_before_learning(uuid,boolean)','public.quiz_library_sessions(jsonb)',
 'public.quiz_media_visible(text,uuid)','public.quiz_question_report(jsonb)','public.quiz_wrong_refs(integer,text,text)',
 'partner_pilot.source_allowed(text,boolean)',
 'public.admin_learning_action(text,text,jsonb)','public.admin_learning_paper_rows(uuid,integer,text)',
 'public.admin_learning_rewards(text,text,jsonb)'
];
const replacements=[
 ['sess.class_codes ? e.class_code','public.quiz_session_class_allowed(sess.id,e.class_code)'],
 ['s.class_codes ? e.class_code','public.quiz_session_class_allowed(s.id,e.class_code)'],
 ["s.class_codes ? (identity->>'class_code')","public.quiz_session_class_allowed(s.id,identity->>'class_code')"],
 ['s.class_codes ? (select class_code from input)','public.quiz_session_class_allowed(s.id,(select class_code from input))'],
 ['s.class_codes ? p_class','public.quiz_session_class_allowed(s.id,p_class)'],
 ['s.class_codes ? cls','public.quiz_session_class_allowed(s.id,cls)']
];
export function buildGradeSharingMigration(definitions){
 const rows=[];
 for(const signature of GRADE_SHARING_FUNCTIONS){
  const definition=definitions.get(signature);if(!definition)throw Error('missing_grade_sharing_definition:'+signature);
  let after=definition,edits=0;
  for(const [before,replacement] of replacements){const n=after.split(before).length-1;if(n){after=after.replaceAll(before,replacement);edits+=n;}}
  if(signature==='public.quiz_action_before_learning(text,jsonb)'){
   const needle=" if p_action in ('personal_sessions','library_sessions') then";if(after.split(needle).length!==2)throw Error('legacy_library_entry_changed');
   after=after.replace(needle," if p_action='library_sessions' then return public.quiz_library_sessions(p_data);end if;\n"+needle);
  }
  if(!edits||after.includes('class_codes ?'))throw Error('unhandled_class_guard:'+signature);
  rows.push({signature,hash:createHash('md5').update(definition).digest('hex'),after});
 }
 return `-- Grade-shared teacher practice only. Private self/classroom sessions keep their original class checks.
begin;
set local lock_timeout='3s';
set local statement_timeout='90s';
do $guard$declare r record;begin
 for r in select * from (values ${rows.map(r=>`(${quote(r.signature)},${quote(r.hash)})`).join(',\n')}) x(signature,hash) loop
  if md5(pg_get_functiondef(r.signature::regprocedure))<>r.hash then raise exception 'GRADE_SHARING_BASE_CHANGED: %',r.signature;end if;
 end loop;
end $guard$;
create function public.quiz_session_class_allowed(p_session uuid,p_class text) returns boolean
language sql stable security definer set search_path='' as $function$
 select coalesce((select case
  when s.access_mode='practice' and m.catalog->>'volume' ~ '^[3469]年級'
   and not exists(select 1 from public.quiz_generated_papers g where g.session_id=s.id)
   and not exists(select 1 from public.quiz_learning_sessions l where l.session_id=s.id)
  then p_class ~ '^[3469][0-9]{2}$' and left(p_class,1)=left(m.catalog->>'volume',1)
  else s.class_codes ? p_class end
 from public.quiz_sessions s left join public.quiz_version_meta m on m.version_id=s.version_id where s.id=p_session),false)
$function$;
revoke all on function public.quiz_session_class_allowed(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.quiz_session_class_allowed(uuid,text) to postgres;
${rows.map(r=>r.after.trim().replace(/;$/,'')+';').join('\n')}
notify pgrst,'reload schema';
commit;
`;
}
