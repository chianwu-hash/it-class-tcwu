import test from 'node:test';import assert from 'node:assert/strict';
import {renderFieldsInputs,fieldsResponseError} from '../../shared/quiz-fields.mjs';
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.listeners={};this.attributes={};this.value='';this.classList={toggle(){},add(){}};}
 append(...nodes){this.children.push(...nodes);}setAttribute(k,v){this.attributes[k]=v;}addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}dispatchEvent(e){for(const fn of this.listeners[e.type]??[])fn(e);}
}
const all=n=>[n,...n.children.flatMap(all)];
function setup(raw=''){const previous=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};try{const host=new Element('div'),changes=[],q={id:'synthetic-explicit-none',type:'fields',prompt:{text:'勾選正確選項',media:[]},fields:[{id:'choice',label:'勾選',input:'set',options:[{id:'a',content:{text:'甲',media:[]}},{id:'b',content:{text:'乙',media:[]}}]}]};renderFieldsInputs(host,q,{raw,onChange:r=>changes.push(r),renderContent(){}});return {q,changes,checks:all(host).filter(n=>n.tagName==='input'&&n.type==='checkbox')};}finally{globalThis.document=previous;}}
const change=(n,checked)=>{n.checked=checked;n.dispatchEvent({type:'change'});},last=s=>JSON.parse(s.changes.at(-1)).f.choice;
test('removing the last selected option restores unanswered null, never chooses none for the student',()=>{const s=setup(),[a,,none]=s.checks;assert.equal(none.checked,false);change(a,true);assert.deepEqual(last(s),['a']);change(a,false);assert.equal(last(s),null);assert.equal(none.checked,false);assert(fieldsResponseError(s.q,s.changes.at(-1)));});
test('explicit none is valid, unchecking it is unanswered, and selecting an option clears none',()=>{const s=setup(),[a,,none]=s.checks;change(none,true);assert.deepEqual(last(s),[]);assert.equal(fieldsResponseError(s.q,s.changes.at(-1)),'');change(none,false);assert.equal(last(s),null);assert(fieldsResponseError(s.q,s.changes.at(-1)));change(none,true);change(a,true);assert.deepEqual(last(s),['a']);assert.equal(none.checked,false);});
test('removing one of multiple selections retains the other original option ID',()=>{const s=setup(),[a,b,none]=s.checks;change(a,true);change(b,true);change(a,false);assert.deepEqual(last(s),['b']);assert.equal(none.checked,false);});
test('a saved explicit empty set is preserved on initial rendering without a change event',()=>{const s=setup(JSON.stringify({v:1,f:{choice:[]}}));assert(s.checks.at(-1).checked);assert.equal(s.changes.length,0);});
