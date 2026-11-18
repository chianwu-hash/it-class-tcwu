// Fixed, teacher-reviewed errata for an immutable question/book edition.
// This projects already-authorized pages; it cannot disclose new media.
const correction={
 questionId:'kxg3ch_ECH1505002429_vd4986cfede1d',
 bookId:'c26493b9-ec9f-5f17-91af-99dc2d88a508',
 previous:[95,96],primary:94,pageId:'G3CH_P094',
 pageSha256:'1cafd0720d1f5a18b596d9a4a7c130d3c4e2e7eae8b5737877a90e679fd02749'
};
export function reviewedStudyReference(kind,questionId,reference,pages){
 if(kind!=='normal'||questionId!==correction.questionId||reference?.bookId!==correction.bookId||reference.primary!==95||JSON.stringify(reference.references)!==JSON.stringify(correction.previous))return reference;
 const page=pages.find(p=>p.bookId===correction.bookId&&p.id===correction.pageId&&p.printedPages.length===1&&p.printedPages[0]===correction.primary&&p.url.endsWith('/'+correction.pageSha256));
 // Never keep an acknowledged wrong link or fabricate a media URL.
 if(!page)return null;
 return {...reference,primary:correction.primary,references:[correction.primary]};
}
