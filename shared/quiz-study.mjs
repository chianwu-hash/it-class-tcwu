import {createTextbookReader} from './quiz-textbook-reader.mjs';
import {initImageLightbox} from './image-lightbox.js';
import {readQuizStudy} from './quiz-study-data.mjs';
export {studySourceLabel} from './quiz-study-data.mjs';

export function createQuizStudy({root,kind,getSnapshot,resolvePage}){
 let current=readQuizStudy(null,kind),reader=null,signature='';
 const refresh=()=>{
  const next=readQuizStudy(getSnapshot(),kind),key=JSON.stringify(next);
  if(key===signature)return;signature=key;current=next;
  // Controller calls refresh before replacing question nodes. Reader rebinds afterwards.
  if(!reader&&next.pages.length){
   const lightbox=initImageLightbox({root,selector:'[data-image-lightbox]',resolveImageSource:image=>resolvePage(image.dataset.quizMediaUrl||image.src)});
   reader=createTextbookReader({root,lightbox,pages:()=>current.pages,getContext:article=>current.references[article.dataset.questionId],resolvePage:page=>resolvePage(page.url)});
  }
  if(!next.pages.length){reader?.destroy();reader=null;}
 };
 return {refresh,explanation:id=>current.explanations[id]||null,clear(){reader?.destroy();reader=null;signature='';current=readQuizStudy(null,kind);}};
}

