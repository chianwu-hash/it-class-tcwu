// Input aids contain the complete symbol sets, never a question's accepted answer.
export function attachPastInputKeyboard(host,input,{bopomofo=false,punctuation=false}={}){
 if(input.disabled||(!bopomofo&&!punctuation))return;
 const sets=[];if(bopomofo)sets.push(['注音鍵盤',[...'ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄧㄨㄩㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦˊˇˋ˙']]);
 if(punctuation)sets.push(['標點鍵盤',['，','。','、','：','；','？','！','「','」','『','』','（','）','《','》','〈','〉','——','……','‧','—','－','‧','…']]);
 for(const [title,keys] of sets){
  const toggle=document.createElement('button'),panel=document.createElement('div');toggle.type='button';toggle.className='past-input-toggle';toggle.textContent=title;toggle.setAttribute('aria-expanded','false');panel.hidden=true;panel.className='past-input-keyboard';panel.setAttribute('role','group');panel.setAttribute('aria-label',title);panel.id=input.id+'-'+(bopomofo&&title==='注音鍵盤'?'bopomofo':'punctuation');toggle.setAttribute('aria-controls',panel.id);
  const insert=text=>{const start=input.selectionStart??input.value.length,end=input.selectionEnd??start;if(input.maxLength>0&&input.value.length-(end-start)+text.length>input.maxLength)return;input.setRangeText(text,start,end,'end');input.dispatchEvent(new Event('input',{bubbles:true}));input.focus({preventScroll:true});};
  for(const key of [...new Set(keys)]){const b=document.createElement('button');b.type='button';b.textContent=key;b.setAttribute('aria-label','輸入'+key);b.addEventListener('click',()=>insert(key));panel.append(b);}
  const back=document.createElement('button');back.type='button';back.textContent='刪除';back.addEventListener('click',()=>{let start=input.selectionStart??input.value.length,end=input.selectionEnd??start;if(start===end)start=Math.max(0,start-1);input.setSelectionRange(start,end);insert('');});panel.append(back);
  toggle.addEventListener('click',()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));});host.append(toggle,panel);
 }
}
