import {shortAnswerSources} from './quiz-answer-template-sources.mjs';
import {presentationSignature} from './quiz-presentation-signature.mjs';

// Source opt-in describes the writing space, never the accepted answer.
export function shortAnswerPresentation(q, registry=shortAnswerSources){
 const source=registry[q?.id];
 if(q?.type!=='short'||!source||!Number.isInteger(source.initialChars)||source.initialChars<2||source.initialChars>12)return null;
 const signature=presentationSignature(q);
 return [source.guard,source.partnerGuard].includes(signature)?{initialChars:source.initialChars}:null;
}

export function mountShortAnswerInput(input,q){
 const model=shortAnswerPresentation(q);if(!model)return false;
 input.classList.add('quiz-short-answer');input.rows=1;input.wrap='off';
 const resize=()=>{const lines=input.value.split(/\r?\n/u),chars=Math.max(model.initialChars,...lines.map(line=>Array.from(line).length));input.style.setProperty('--quiz-short-answer-chars',String(Math.min(2000,chars)));input.style.setProperty('--quiz-short-answer-lines',String(lines.length));};
 input.addEventListener('input',resize);input.addEventListener('compositionend',resize);resize();return true;
}
