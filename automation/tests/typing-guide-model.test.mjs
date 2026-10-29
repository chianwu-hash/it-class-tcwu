import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKeyboardGuideModel as build, englishKeyInfo } from '../../shared/typing-guide-model.mjs';

test('long Chinese is bounded and lossless through punctuation/newlines/repeated characters', () => {
    const text = '心的小船上，還是讓我載著你，\n讓你變成您，一起去看美麗新世界！';
    const zhuyin = 'ㄒㄧㄣ ㄉㄜ˙ ㄒㄧㄠˇ ㄔㄨㄢˊ ㄕㄤˋ ㄏㄞˊ ㄕˋ ㄖㄤˋ ㄨㄛˇ ㄗㄞˋ ㄓㄜ˙ ㄋㄧˇ ㄖㄤˋ ㄋㄧˇ ㄅㄧㄢˋ ㄔㄥˊ ㄋㄧㄣˊ ㄧ ㄑㄧˇ ㄑㄩˋ ㄎㄢˋ ㄇㄟˇ ㄌㄧˋ ㄒㄧㄣ ㄕˋ ㄐㄧㄝˋ';
    const model = build({ lang:'zh',text,zhuyin });
    assert.equal(model.warning,'');
    assert.equal(model.segments.flat().map(i=>i.char).join(''),text);
    assert.ok(model.segments.every(s=>s.filter(i=>i.kind==='han').length<=8));
    const ni=model.items.filter(i=>i.char==='你');
    assert.equal(ni.length,2);assert.notEqual(ni[0].id,ni[1].id);assert.equal(ni[0].syllable,'ㄋㄧˇ');assert.equal(ni[1].syllable,'ㄋㄧˇ');
    assert.ok(model.items.find(i=>i.char==='心').keys.includes('space'));
    assert.deepEqual(model.items.find(i=>i.char==='，').keys,[]);
    assert.equal(model.items.find(i=>i.kind==='newline').keys[0],'enter');
});
test('50 Chinese characters without punctuation never exceed the segment limit',()=>{
    const m=build({lang:'zh',text:'心'.repeat(50),zhuyin:Array(50).fill('ㄒㄧㄣ').join(' ')});
    assert.equal(m.items.length,50);assert.equal(m.segments.length,7);assert.ok(m.segments.every(s=>s.length<=8));
});
test('mismatched or invalid pronunciation does not silently shift character hints',()=>{
    for(const zhuyin of ['ㄒㄧㄣ','ㄒㄧㄣ abc']){
        const m=build({lang:'zh',text:'心情',zhuyin});assert.ok(m.warning);assert.ok(m.items.every(i=>i.keys.length===0));
    }
});
test('English retains exact capitalization, punctuation, spaces and line breaks',()=>{
    const text="How old are you?\nI'm eight years old.";
    const m=build({text});assert.equal(m.segments.flat().map(i=>i.char).join(''),text);
    assert.deepEqual(m.items[0].keys,['shift','h']);
    assert.deepEqual(m.items.find(i=>i.char==='?').keys,['shift','/']);
    assert.deepEqual(m.items.find(i=>i.char==="'").keys,["'"]);
    assert.deepEqual(m.items.find(i=>i.kind==='space').keys,['space']);
});
test('long English wraps at word boundaries, leaving a single long word intact',()=>{
    const word='pneumonoultramicroscopicsilicovolcanoconiosis';
    const text=`One small step ${word} for a long sentence with several more words.`;
    const m=build({text,enLimit:20});
    assert.equal(m.segments.flat().map(i=>i.char).join(''),text);
    assert.ok(m.segments.some(s=>s.map(i=>i.char).join('').includes(word)));
    assert.ok(m.segments.every((s,i)=>i===0||/\s$/.test(m.segments[i-1].at(-1).char)));
});
test('empty and HTML-like input is data, not markup or a progress record',()=>{
    assert.deepEqual(build().segments,[]);
    assert.equal(build({text:'<script>'}).items.map(i=>i.char).join(''),'<script>');
    assert.deepEqual(englishKeyInfo('\t').keys,['space']);
});
