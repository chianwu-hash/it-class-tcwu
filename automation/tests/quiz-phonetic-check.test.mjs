import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePhonetic,checkPhonetic} from '../../shared/quiz-phonetic-check.mjs';
import {moeReadings} from '../../shared/quiz-moe-readings.mjs';
const entry=(phonetic,word=null,extra={})=>({student:{phonetic,word},given:[],wordField:word===null?null:'f2',readings:[],...extra});
test('normalization preserves tone distinctions and original strings',()=>{
 for(const [raw,normalized]of [[' ㄓ ˊ ','ㄓˊ'],['ㄓˋ','ㄓˋ'],['ㄓˉ','ㄓ'],['˙ㄗ','ㄗ˙'],['ㄗ˙','ㄗ˙']])assert.equal(normalizePhonetic(raw),normalized);
 for(const raw of ['ㄓˊˋ','ㄓˊ／ㄓˋ','直','ㄓ,','ㄓ\u200b',''])assert.equal(normalizePhonetic(raw),null);
});
test('straight second tone is correct and fourth tone is incorrect, regardless of an unlisted word',()=>{
 const e=entry('ㄓˋ','直挺'),before=JSON.stringify(e);assert.equal(checkPhonetic('直',e).status,'incorrect');assert.equal(JSON.stringify(e),before);
 assert.equal(checkPhonetic('直',entry('ㄓˊ','直挺')).status,'correct');assert.equal(checkPhonetic('直',entry('ㄓˊ','直接')).status,'correct');
});
test('known polyphonic words determine the reading rather than the reference example alone',()=>{
 assert.equal(checkPhonetic('靦',entry('ㄇㄧㄢˇ','靦腆',{readings:['ㄊㄧㄢˇ']})).status,'correct');
 assert.equal(checkPhonetic('靦',entry('ㄊㄧㄢˇ','靦腆')).status,'incorrect');
 assert.equal(checkPhonetic('荷',entry('ㄏㄜˋ','負荷')).status,'correct');
 assert.equal(checkPhonetic('荷',entry('ㄏㄜˊ','負荷')).status,'incorrect');
 assert.equal(checkPhonetic('荷',entry('ㄏㄜˊ','荷田新詞')).status,'pending');
});
test('historical readings and conflicting dictionary versions are not automatically correct or wrong',()=>{
 for(const [c,p,w]of [['耶','ㄧㄝ','耶穌'],['勁','ㄐㄧㄣˋ','使勁']])assert.equal(checkPhonetic(c,entry(p,w)).status,'pending');
});
test('source-given words take priority and separate polyphonic rows retain their original requirement',()=>{
 assert.equal(checkPhonetic('荷',entry('ㄏㄜˋ',null,{given:['負荷']})).status,'correct');
 assert.equal(checkPhonetic('荷',entry('ㄏㄜˊ','荷花',{given:['負荷']})).status,'incorrect');
 assert.equal(checkPhonetic('荷',entry('ㄏㄜˊ','荷花',{readings:['ㄏㄜˋ']}),{splitReading:true}).status,'pending');
 assert.equal(checkPhonetic('荷',entry('ㄏㄜˊ','荷花',{given:['不存在荷詞']})).status,'pending');
});
test('blank, malformed, unreviewed and absent character data fail safely',()=>{
 assert.equal(checkPhonetic('直',entry('')).status,'pending');assert.equal(checkPhonetic('直',entry('直')).status,'incorrect');
 assert.equal(checkPhonetic('龘',entry('ㄉㄚˊ')).status,'pending');assert.equal(checkPhonetic('直',{student:null}),null);
});
test('all covered character and word readings are normalized syllables; modern coverage is complete for the fixed 256 targets',()=>{
 assert.equal(Object.keys(moeReadings.characters).length,256);
 let words=0;
 for(const [c,row]of Object.entries(moeReadings.characters)){
  assert(row.mini.length+row.concised.length>0,c);
  for(const readings of Object.values(row))for(const p of readings)assert(normalizePhonetic(p),c+' '+p);
 }
 for(const [c,list]of Object.entries(moeReadings.words))for(const [w,readings]of Object.entries(list)){assert(w.includes(c));assert(readings.length);for(const p of readings)assert(normalizePhonetic(p));words++;}
 assert.equal(words,6475);
});
