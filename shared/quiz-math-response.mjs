import {attachPastInputKeyboard} from './quiz-past-input.mjs?v=20261102-math-audio';

export function mathResponseValue(value){return value&&typeof value==='object'?{answer:String(value.answer||''),working:String(value.working||'')}:{answer:typeof value==='string'?value:'',working:''};}
export function mathResponseComplete(value){return Boolean(mathResponseValue(value).answer.trim());}
export function mathResponseError(value){
 const {answer,working}=mathResponseValue(value);if(!answer.trim())return '請填入每格的最後答案；計算過程不能代替答案。';
 if(answer.length>250||working.length>5000)return '答案或計算過程過長，請縮短後再送出。';
 const source='０１２３４５６７８９（）＋－＊／，＜＞＝−–—×÷ｒＲｄＤｐＰｉＩ',target='0123456789()+-*/,<>=---*/rrddppii';
 const normalized=[...answer.toLowerCase()].map(c=>{const i=source.indexOf(c);return i<0?c:target[i]}).join('').replace(/[\s　]/g,'');
 if(!/^[a-z0-9()+*/.,<>=√π·⋅-]+$/.test(normalized))return '答案格式不符。角度只填數字，不加「°」或「度」；分數用 /、根號用 sqrt()、圓周率用 π。';
 if(/^[+-]?[0-9]{1,9}\/0+$/.test(normalized))return '分母不能是 0，請修改後再送出。';
 return '';
}

export function renderMathResponse({host,id,value,locked,onChange}){
 const model=mathResponseValue(value),input=document.createElement('input');input.id=id;input.type='text';input.maxLength=250;input.value=model.answer;input.disabled=locked;input.autocomplete='off';input.placeholder='分數用 /，根號用 sqrt(數字)，圓周率用 π';
 input.addEventListener('input',()=>{model.answer=input.value;onChange({...model});});host.append(input);
 attachPastInputKeyboard(host,input,{math:true});
 const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=model.working?'查看計算過程（自我核對）':'計算過程（可選填，保存但不自動判分）';details.append(summary);
 const label=document.createElement('label');label.htmlFor=id+'-working';label.textContent='你的計算過程';const work=document.createElement('textarea');work.id=label.htmlFor;work.rows=4;work.maxLength=5000;work.disabled=locked;work.value=model.working;work.placeholder='可在此記錄推算過程；分數只依上方最後答案核對。';work.addEventListener('input',()=>{model.working=work.value;onChange({...model});});details.append(label,work);host.append(details);
 return input;
}
