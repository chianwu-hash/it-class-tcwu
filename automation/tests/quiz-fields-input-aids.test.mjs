import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderFieldsInputs} from '../../shared/quiz-fields.mjs';

// Small DOM harness exercises the real controls and their input events.
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.listeners={};this.attributes={};this.value='';this.selectionStart=0;this.selectionEnd=0;}
 append(...nodes){this.children.push(...nodes);}
 setAttribute(k,v){this.attributes[k]=v;}
 addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
 dispatchEvent(e){for(const fn of this.listeners[e.type]??[])fn(e);}
 click(){this.dispatchEvent({type:'click'});}
 focus(){}
 setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b;}
 setRangeText(text,a,b){this.value=this.value.slice(0,a)+text+this.value.slice(b);this.selectionStart=this.selectionEnd=a+text.length;}
}
const descendants=n=>[n,...n.children.flatMap(descendants)];
function render({locked=false,aids=true}={}){
 const old=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};
 try{
  const host=new Element('div'),changes=[];
  const q={id:'synthetic',fields:[{id:'phonetic',label:'第1格',input:'text'}]};
  renderFieldsInputs(host,q,{locked,onChange:v=>changes.push(JSON.parse(v)),renderContent(){},textInputAids:aids?{bopomofo:true,punctuation:true}:{}});
  return {all:descendants(host),changes};
 }finally{globalThis.document=old;}
}
test('注音及標點沿完整鍵盤輸入、替換與刪除，儲存同一份欄位答案',()=>{
 const {all,changes}=render(),input=all.find(n=>n.tagName==='input');
 const key=text=>all.find(n=>n.attributes['aria-label']==='輸入'+text);
 for(const c of ['ㄆ','ㄛ','ˊ'])key(c).click();
 assert.equal(input.value,'ㄆㄛˊ');assert.deepEqual(changes.at(-1),{v:1,f:{phonetic:'ㄆㄛˊ'}});
 input.setSelectionRange(2,3);key('ˇ').click();assert.equal(input.value,'ㄆㄛˇ');
 all.find(n=>n.textContent==='刪除').click();assert.equal(input.value,'ㄆㄛ');
 key('，').click();assert.equal(changes.at(-1).f.phonetic,'ㄆㄛ，');
 const toggle=all.find(n=>n.textContent==='注音鍵盤'),panel=all.find(n=>n.attributes['aria-label']==='注音鍵盤');
 assert.equal(panel.hidden,true);toggle.click();assert.equal(panel.hidden,false);assert.equal(toggle.attributes['aria-expanded'],'true');
 assert.equal(all.filter(n=>n.className==='past-input-keyboard')[0].children.length,42);
 assert(!all.some(n=>n.textContent==='正確答案'));
});
test('已送答鎖住且無鍵盤，未選用科目也不增加鍵盤',async()=>{
 for(const opts of [{locked:true},{aids:false}])assert(!render(opts).all.some(n=>n.className==='past-input-keyboard'));
 const css=await readFile(new URL('../../shared/quiz-fields.css',import.meta.url),'utf8');
 assert.match(css,/\.quiz-field \.past-input-keyboard\[hidden\]\{display:none\}/);
});
