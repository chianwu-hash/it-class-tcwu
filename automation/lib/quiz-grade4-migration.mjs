// Extend the currently installed functions; never reinstall legacy quiz SQL.
export function extendWrongQuestionsToGrade4(definition) {
  const before="coalesce(p_data->>'grade','') not in ('','3','6')";
  if(typeof definition!=='string'||definition.split(before).length!==2)
    throw Error('expected_wrong_questions_grade_guard_missing');
  return definition.replace(before,"coalesce(p_data->>'grade','') not in ('','3','4','6')");
}

export function buildGrade4Migration(definitions) {
  const byName=new Map(definitions.map(row=>[row.signature,row.definition]));
  const changed=[];
  function edit(name,transform){
    const before=byName.get(name);
    if(!before)throw Error('missing_function_'+name);
    const after=transform(before);
    if(before===after)throw Error('expected_grade_guard_missing_'+name);
    changed.push(after.trim().replace(/;$/,'')+';');
  }
  for(const name of ['quiz_student_identity()','quiz_compose(jsonb)','quiz_action(text,jsonb)','quiz_leaf_result(uuid,boolean)'])
    edit(name,s=>s.replaceAll('[36]','[346]'));
  edit('quiz_wrong_questions(jsonb)',extendWrongQuestionsToGrade4);
  edit('quiz_assign_paper_name()',s=>s.replaceAll('[36]','[346]').replace("when 3 then '三年級' else '六年級'", "when 3 then '三年級' when 4 then '四年級' else '六年級'"));
  for(const name of ['garden_unlock_notice(text,text,uuid)','garden_pet_visit(text)'])
    edit(name,s=>s.replaceAll("'grade3-115-1','grade6-115-1'", "'grade3-115-1','grade4-115-1','grade6-115-1'"));
  edit('garden_growth(text,text)',s=>{
    s=s.replaceAll("'grade3-115-1','grade6-115-1'", "'grade3-115-1','grade4-115-1','grade6-115-1'");
    // Grade 4 contributes practice leaves; foundation lessons remain grade 3/6 only.
    const start=s.indexOf("  j:=public.typing_foundation_action(");
    const end=s.indexOf("  j:=public.quiz_rewards(",start);
    if(start<0||end<0)throw Error('foundation_bridge_changed');
    return s.slice(0,start)+"  if p_course_id<>'grade4-115-1' then\n"+s.slice(start,end)+"  end if;\n"+s.slice(end);
  });
  return "begin;\nalter table public.quiz_courses drop constraint quiz_courses_grade_check;\nalter table public.quiz_courses add constraint quiz_courses_grade_check check(grade in(3,4,6));\n"+changed.join('\n')+"\nnotify pgrst,'reload schema';\ncommit;\n";
}
