// Synthetic local fixture values only. Never use these to write real student answers.
export function demoWrongResponses(group){
 return group.fields.map(field=>{
  let value;
  if(group.kind==='single'||group.kind==='code')value=group.choices.find(c=>c.id!==field.answer).id;
  else if(group.kind==='mark')value=!field.answer;
  else if(group.kind==='short')value='合成測試錯答';
  else if(group.kind==='sequence')value=[...field.answer].reverse();
  else if(group.kind==='set')value=[group.codes.find(c=>!field.answer.includes(c))||field.answer[0]];
  else if(group.kind==='annotation')value={point:{x:.4,y:.2},arrow:{from:{x:.4,y:.2},to:{x:.4,y:.55}},mediaSha256:group.assets[0].sha256};
  else if(group.kind==='manual')value={confirmed:true,strokes:[],text:'合成自核示範'};
  else throw Error('unsupported_demo_kind');
  return {questionId:field.id,value};
 });
}
