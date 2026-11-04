import {createAuthenticatedTransport} from './quiz-transport.mjs?v=20261029-batch4';
export async function createPastCatalogReader(getSession){
 const auth=await import('./auth.js'),transport=createAuthenticatedTransport({auth,getSession});
 return async()=>{const data=await transport('/rest/v1/rpc/quiz_past_action',{p_action:'list',p_data:{}});return data.papers;};
}
export function pastPaperDisplay(p){
 const fallback=p.id==='dingxi-114-1-g3-exam1-science'?{subject:'自然',sourceYear:'114-1',exam:1,edition:'康軒',range:'第1–2單元'}:{};
 const c={...fallback,...p.catalog};
 return {...c,id:p.id,title:p.title,grade:p.grade,enabled:p.enabled!==false,shortTitle:`${(c.sourceYear||'').replace('-1','上')}${p.grade===3?'三':'六'}年級${c.exam===1?'期中':c.exam===2?'期末':''}${c.subject||''}`};
}
