// Local SVG marks keep subject recognition available without an icon font/CDN.
const marks={
 '國語':'<path d="M12 6C8 3 4 4 3 5v14c3-2 6-2 9 0 3-2 6-2 9 0V5c-3-2-6-2-9 1Zm0 0v13"/>',
 '英語':'<rect x="2.5" y="4" width="19" height="16" rx="3"/><path d="m5 16 3-8 3 8m-5-3h4m4-5v8h3a2 2 0 0 0 0-4h-3m0-4h2a2 2 0 0 1 0 4"/>',
 '數學':'<rect x="4" y="2" width="16" height="20" rx="3"/><path d="M7 6h10M8 10v4m-2-2h4m4 0h4m-11 5h3m4 0h4m-4 3h4"/>',
 '自然':'<path d="M9 3h6m-5 0v7l-6 9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2l-6-9V3M7 15h10"/><circle cx="10" cy="18" r=".7"/>',
 '社會':'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/>',
 '地理':'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
 '歷史':'<path d="m3 7 9-4 9 4H3m1 14h16M6 10v8m6-8v8m6-8v8"/>',
 '公民':'<path d="M12 3v18m-5 0h10M4 7h16M6 7l-3 7h6L6 7Zm12 0-3 7h6l-3-7Z"/>'
};
marks['國文']=marks['國語'];
export function subjectMark(subject){
 const span=document.createElement('span');span.className='home-subject-icon';span.setAttribute('aria-hidden','true');
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.65');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.innerHTML=marks[subject]||marks['國語'];span.append(svg);return span;
}
export function decorateSubjectCards(root){
 for(const card of root.querySelectorAll('.paper-card[data-subject]')){
  const icon=card.querySelector('.subject-icon');if(icon)icon.replaceChildren(subjectMark(card.dataset.subject));
 }
}
