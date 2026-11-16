import test from 'node:test';
import assert from 'node:assert/strict';
import {readingPresentation} from '../../shared/quiz-reading-presentation.mjs';
const c=text=>({text,media:[]});
const make=()=>({type:'fields',prompt:c('閱讀理解題\n'+ '這是共用文章，保留閱讀材料。'.repeat(12)+'\n(１)第一個問題？\n(２)第二個問題？'),fields:[{id:'a',label:'(1)',input:'set'},{id:'b',label:'(2)',input:'single'}]});
test('move complete subquestions beside controls without mutating source',()=>{const q=make(),before=JSON.stringify(q),p=readingPresentation(q);assert.equal(p.questions.length,2);assert.match(p.questions[0].text,/第一個問題/);assert.doesNotMatch(p.passage.text,/第一個問題|閱讀理解題/);assert.equal(JSON.stringify(q),before);});
test('ambiguous numbering, labels, trailing text and unsupported fields remain intact',()=>{for(const edit of [q=>q.prompt.text=q.prompt.text.replace('(２)','(３)'),q=>q.fields[0].label='另一題',q=>q.prompt.text+='\n其他材料',q=>q.fields[0].input='text',q=>q.prompt.media=[{kind:'image'}],q=>q.prompt.layout=[{type:'table',rows:[]}]]){const q=make();edit(q);assert.equal(readingPresentation(q),null);}});
test('paragraph slice preserves styled question and passage images',()=>{const q=make();q.prompt.layout=[{type:'paragraph',runs:[{type:'text',text:'閱讀理解題\n'+'共用文章'.repeat(40)},{type:'image',media_index:0,width:100}]},{type:'paragraph',runs:[{type:'text',text:'(１)第一個問題？',bold:true}]},{type:'paragraph',runs:[{type:'text',text:'(２)第二個問題？'}]}];q.prompt.media=[{kind:'image',url:'https://example.org/diagram.webp'}];const p=readingPresentation(q);assert.equal(p.passage.media.length,1);assert.equal(p.questions[0].layout[0].runs[0].bold,true);});
test('unrelated question remains untouched',()=>{const q=make();q.prompt.text=q.prompt.text.replace('閱讀理解題','選擇題');assert.equal(readingPresentation(q),null);});
