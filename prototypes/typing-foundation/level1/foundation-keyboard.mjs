// The foundation course needs a fixed physical keyboard, not the segmented
// text-lookup tool used by weekly exercises. Keep one element per physical key.
const rows=[
 [...'`1234567890-=',{key:'Backspace',label:'退格',units:4}],
 [{key:'Tab',label:'Tab',units:3},...'qwertyuiop[]',{key:'\\',label:'\\',units:3}],
 [{key:'CapsLock',label:'Caps',units:4},..."asdfghjkl;'",{key:'Enter',label:'Enter',units:4}],
 [{key:'ShiftLeft',label:'左 Shift',units:5},...'zxcvbnm,./',{key:'ShiftRight',label:'右 Shift',units:5}],
 [{key:' ',label:'空白鍵',units:16,space:true}]
];
export function createFoundationKeyboard(container){
 const styleId='foundation-keyboard-css';
 if(!document.getElementById(styleId)){const link=document.createElement('link');link.id=styleId;link.rel='stylesheet';link.href=new URL('./foundation-keyboard.css?v=20261102-layout',import.meta.url).href;document.head.append(link);}
 const root=document.createElement('div');root.className='foundation-keyboard';root.setAttribute('role','img');root.setAttribute('aria-label','標準英文鍵盤：數字列、上排、基準列、下排與空白鍵；左右 Shift 各一鍵。');
 for(const row of rows){const line=document.createElement('div');line.className='typing-letter-row';
  for(const value of row){const item=typeof value==='string'?{key:value,label:/^[a-z]$/.test(value)?value.toUpperCase():value}:value;
   const key=document.createElement('kbd');key.className='typing-letter-key';key.dataset.key=item.key;key.style.setProperty('--key-units',item.units||2);
   if(item.space){key.classList.add('foundation-space');key.style.gridColumn='8 / span 16';}
   const label=document.createElement('span');label.textContent=item.label;key.append(label);
   if(/^[a-z]$/.test(item.key)){const lower=document.createElement('small');lower.textContent=item.key;key.append(lower);}
   key.classList.toggle('is-target',['f','j'].includes(item.key));line.append(key);
  }root.append(line);
 }container.replaceChildren(root);return root;
}
