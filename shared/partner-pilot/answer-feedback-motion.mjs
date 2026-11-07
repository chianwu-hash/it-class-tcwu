import {quizFeedbackMotion} from '../quiz-feedback-motion.mjs?v=20261107-partner-motion';
// Same actors as the original quiz. Never replay because a teammate synced.
export function createAnswerFeedbackMotion(){
 const fresh=new Set();
 function stop(root){root?.querySelectorAll('.qfm-actor').forEach(quizFeedbackMotion.stop);}
 function mount(root,question){
  for(const host of root.querySelectorAll('[data-feedback-motion]')){
   const qid=Number(host.dataset.feedbackMotion),q=question(qid);if(!q||host.querySelector('.qfm-actor'))continue;
   const variant=quizFeedbackMotion.order[Math.max(0,(q.number||1)-1)%quizFeedbackMotion.order.length];
   const actor=quizFeedbackMotion.create({variant,result:host.dataset.result});
   if(['painter','chef','reader','xylo','builder'].includes(variant))actor.classList.add('qfm-second');
   host.replaceChildren(actor);
   if(fresh.delete(qid))quizFeedbackMotion.play(actor);
  }
 }
 return {mount,stop,fresh:qid=>fresh.add(qid),clear(root){stop(root);fresh.clear();}};
}
