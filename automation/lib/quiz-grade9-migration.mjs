import {createHash} from 'node:crypto';

const md5=s=>createHash('md5').update(s).digest('hex');
function once(source,before,after){
  if(source.split(before).length!==2)throw Error('grade9_source_guard_missing: '+before);
  return source.replace(before,after);
}

// Operate on current pg_get_functiondef output, including the learning wrappers.
// Legacy quiz.sql must never replace functions installed by later releases.
export function grade9FunctionChanges(definitions){
  const definitionsByName=new Map(definitions.map(r=>[r.proname,r]));
  const result=[];
  const edit=(name,fn)=>{const row=definitionsByName.get(name);if(!row)throw Error('grade9_function_missing: '+name);const after=fn(row.definition);if(after===row.definition)throw Error('grade9_no_change: '+name);result.push({name,args:row.args,before:row.definition,after,beforeHash:md5(row.definition),afterHash:md5(after)});};
  for(const name of ['quiz_student_identity','quiz_compose','quiz_action_before_learning','quiz_leaf_result_before_learning'])
    edit(name,s=>once(s,'[346]','[3469]'));
  edit('quiz_wrong_questions_before_learning',s=>once(s,"('','3','4','6')","('','3','4','6','9')"));
  edit('quiz_assign_paper_name',s=>once(once(once(s,'[346]','[3469]'),"when 4 then '四年級' else '六年級'","when 4 then '四年級' when 9 then '九年級' else '六年級'"),"('國語','英語','數學','社會','自然')","('國語','國文','英語','數學','社會','自然','地理','歷史','公民')"));
  for(const name of ['garden_pet_visit','garden_unlock_notice','garden_growth'])edit(name,s=>{
    if(!s.includes("'grade4-115-1','grade6-115-1'"))throw Error('grade9_garden_guard_missing');
    s=s.replaceAll("'grade4-115-1','grade6-115-1'","'grade4-115-1','grade6-115-1','grade9-115-1'");
    if(name==='garden_growth')s=once(s,"p_course_id<>'grade4-115-1'","p_course_id not in ('grade4-115-1','grade9-115-1')");
    return s;
  });
  return result;
}

export function buildGrade9Migration(definitions){
  const changes=grade9FunctionChanges(definitions);
  const functions=changes.map(r=>`do $grade9$ declare current_hash text; begin
    select md5(pg_get_functiondef('public.${r.name}(${r.args.replace(/\bp_\w+\s+/g,'').replace(/\b(?:aid|new_answer)\s+/g,'')})'::regprocedure)) into current_hash;
    if current_hash='${r.afterHash}' then return; end if;
    if current_hash is distinct from '${r.beforeHash}' then raise exception 'grade9_function_changed: ${r.name}'; end if;
    execute $definition$${r.after.replace(/;?\s*$/,';')}$definition$;
  end $grade9$;`).join('\n');
  return `begin;
-- Narrow grade extension: elementary grades 1-6 and the authorized grade 9.
alter table public.student_enrollments drop constraint student_enrollments_class_code_check;
alter table public.student_enrollments add constraint student_enrollments_class_code_check check(class_code ~ '^[1-69][0-9]{2}$');
alter table public.quiz_courses drop constraint quiz_courses_grade_check;
alter table public.quiz_courses add constraint quiz_courses_grade_check check(grade in(3,4,6,9));
alter table public.quiz_past_papers drop constraint quiz_past_papers_grade_check;
alter table public.quiz_past_papers add constraint quiz_past_papers_grade_check check(grade in(3,4,6,9));
${functions}
notify pgrst,'reload schema';
commit;
`;
}
