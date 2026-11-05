// Pure option presentation shared by personal and partner quizzes. No auth, grading or persistence.
export function appendSingleChoiceOptions(host,{name,options,selected,locked=false,onSelect,renderBody,decorateInput,badgeForOption,result=null}){
 host.classList.add('quiz-single-choice');
 for(const [index,option] of options.entries()){
  const label=document.createElement('label');label.className='student-option';
  const input=document.createElement('input');input.type='radio';input.name=name;input.value=option.value;
  input.disabled=locked;input.checked=selected===option.value;
  input.addEventListener('change',()=>onSelect(option.value));decorateInput?.(input,option,index);
  const body=document.createElement('div');body.className='option-body';renderBody(body,option,index);
  const badge=document.createElement('strong');badge.className='option-badge';badge.textContent=badgeForOption?.(option,index)??String.fromCharCode(65+index);
  label.append(input,badge,body);
  if(result){
   const correct=option.value===result.correct,chosen=option.value===result.chosen;
   label.dataset.result=correct?'correct':chosen?(result.chosenCorrect===true?'correct':'incorrect'):'other';
   if(correct||chosen){const note=document.createElement('span');note.className='option-result';note.textContent=correct?(chosen?'✓ 你的答案・答對了':'✓ 正確答案'):result.chosenCorrect===true?'✓ 你的答案・答對了':'× 你的答案';label.append(note);}
  }
  host.append(label);
 }
 return host;
}
