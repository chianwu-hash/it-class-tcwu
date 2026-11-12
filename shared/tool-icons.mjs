const paths={
 keyboard:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M5 9h1m3 0h1m3 0h1m3 0h1M5 12h1m3 0h1m3 0h1m3 0h1M7 16h10"/>',
 mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0m-7 7v5m-4 0h8"/>',
 pen:'<path d="m15 3 6 6-12 12H3v-6Zm-9 9 6 6M14 4l6 6"/>',
 undo:'<path d="m8 4-5 5 5 5M3 9h11a7 7 0 0 1 0 14"/>',
 trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
 save:'<path d="M4 3h14l3 3v15H3V3Zm3 0v6h10V3M7 21v-8h10v8"/>',
 restore:'<path d="M3 10a9 9 0 1 1 1 9M3 3v7h7M12 7v5l3 2"/>',
 play:'<path d="m8 4 12 8-12 8Z"/>',
 stop:'<rect x="5" y="5" width="14" height="14" rx="1"/>',
 close:'<path d="m5 5 14 14M5 19 19 5"/>'
};
// Static local SVG only; accessible names and native hover hints stay on the button.
export function setToolIcon(button,name,label){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.8');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.classList.add('sketch-tool-icon');svg.innerHTML=paths[name]||paths.pen;
 button.replaceChildren(svg);button.classList.add('media-icon-button');button.title=label;button.setAttribute('aria-label',label);
}
