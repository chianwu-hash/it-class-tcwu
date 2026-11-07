import {booleanChoicePresentation} from '../quiz-boolean-choice.mjs?v=20261107-boolean-choice';
// Presentation only. pastReference is supplied by the server after its reveal gate.
export function revealedPastChoice(q){
 if(q.past?.kind!=='single'||q.past.selfCheck||!Object.hasOwn(q,'pastReference'))return null;
 const index=q.past.choices.findIndex(c=>c.id===q.pastReference);
 return index<0?null:{index,id:q.past.choices[index].id};
}
export function feedbackExplanation(q){
 const content=q.rich?.explanation||{text:q.explanation||'',media:[]};
 const choice=revealedPastChoice(q);
 // Older imports prepend an encoded answer ID. Remove only that exact generated
 // prefix when the independently revealed, typed reference replaces it.
 const prefix=choice?'參考：'+JSON.stringify(q.pastReference):null;
 const text=content.text||'';
 return prefix&&!content.layout&&!content.underlines?.length&&(text===prefix||text.startsWith(prefix+'\n'))?{...content,text:text.slice(prefix.length).replace(/^\n/,'')}:content;
}
export function answerFeedback(q,{fragment,esc}){
 const last=q.attempts?.at(-1);if(!last)return '';
 const state=last.correct===true?'correct':last.correct===false?'incorrect':'self-check',choice=revealedPastChoice(q);
 const heading=state==='correct'?'這題答對了！':state==='incorrect'?'這題還沒答對，一起看看解題想法。':'已留下作答，請和參考內容自我核對。';
 const display=choice?booleanChoicePresentation(q.past.choices,q.rich?.options)?.[choice.index]:null;
 const correct=choice?`<p class="feedback-reference"><b>正確答案：</b><span>${display?esc(display.badge+' '+display.text):esc(choice.id)+'・'+fragment(q,'option',choice.index)}</span></p>`:!q.past&&Number.isInteger(q.correct)?`<p class="feedback-reference"><b>正確答案：</b><span>${esc(String.fromCharCode(65+q.correct))}・${fragment(q,'option',q.correct)}</span></p>`:'';
 const explanation=feedbackExplanation(q),hasExplanation=Boolean(explanation.text?.trim()||explanation.media?.length||explanation.layout?.length);
 return `<section class="feedback partner-answer-feedback" data-feedback-state="${state}" role="status"><div class="feedback-intro"><span class="feedback-character ${state==='self-check'?'':'qfm-character'}" ${state==='self-check'?'':`data-feedback-motion="${q.id}" data-result="${state}"`} aria-hidden="true"><span class="feedback-symbol">${state==='correct'?'✓':state==='incorrect'?'↻':'◎'}</span></span><div><strong>${heading}</strong><p>${state==='correct'?'你的想法對上了，繼續保持。':state==='incorrect'?(!q.past||q.past.kind==='single'?'你的答案和正確答案已標在選項上；看懂後可以自己再試一次。':'先核對這次的作答與參考內容，看懂後可以自己再試一次。'):'這題不自動判分，也不會標示答對或答錯。'}</p></div></div>${q.past&&q.past.kind!=='single'?`<div data-past-result="${q.id}"></div>`:''}${correct}<div class="feedback-explanation">${hasExplanation?fragment(q,'feedbackExplanation'):'這一題目前沒有詳細解析，可以先核對正確答案。'}</div><p class="muted">${q.attempts.length>1?'初次作答仍保留，這次是訂正後再試。':'這是第一次作答的紀錄。'}</p>${last.correct===false?`<button type="button" data-edit="${q.id}">我想自己再試一次</button>`:''}</section>`;
}
