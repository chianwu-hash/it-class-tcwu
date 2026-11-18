// One safe text-run renderer for personal, full review and partner entrances.
// No HTML strings, answer data or media resolution are involved.
export function renderSourceText(parent,run,render){
 if(run.boxed!==true){render(parent,run.text);return;}
 const span=document.createElement('span');span.className='quiz-source-box';render(span,run.text);parent.append(span);
}
