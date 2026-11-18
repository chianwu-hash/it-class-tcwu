import {readingSignature} from './quiz-reading-signature.mjs';
// Presentation compatibility only, never media authorization. The partner
// adapter changes the ticket namespace while retaining the same content hash.
const canonical=url=>{
 const normal=/^https:\/\/quiz-media\.invalid\/[0-9a-f-]{36}\/([0-9a-f]{64})$/u.exec(url||'');
 const partner=/^https:\/\/partner-media\.invalid\/([0-9a-f]{64})$/u.exec(url||'');
 return normal||partner?'https://source-media.invalid/'+(normal||partner)[1]:url;
};
export function presentationSignature(q){return readingSignature({...q,prompt:{...q.prompt,media:q.prompt?.media?.map(m=>({...m,url:canonical(m.url)}))}});}
