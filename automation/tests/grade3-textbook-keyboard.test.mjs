import test from 'node:test';
import assert from 'node:assert/strict';
import { getTextbookKeyboardTarget as target } from '../../grade3/115-1/textbook-keyboard-target.mjs';
import { buildKeyboardGuideModel as model } from '../../shared/typing-guide-model.mjs';
import { WEEK10_LEVELS } from '../../grade3/115-1/week10-content.mjs';
import { WEEK11_LEVELS } from '../../grade3/115-1/week11-content.mjs';
import { WEEK12_LEVELS } from '../../grade3/115-1/week12-content.mjs';

test('all Week10–12 original and replay Chinese lines have complete usable readings', () => {
    for (const levels of [WEEK10_LEVELS, WEEK11_LEVELS, WEEK12_LEVELS]) for (const level of levels) for (const answer of [level.ans, level.replay]) {
        for (const line of answer.split('\n')) {
            const t = target(line);
            if (typeof t === 'string') { assert.equal(t,line); continue; }
            const m = model(t);
            assert.equal(m.warning,'',line);
            assert.ok(m.items.filter(i=>i.kind==='han').every(i=>i.keys.length>0),line);
            assert.equal(m.items.map(i=>i.char).join(''),line);
        }
    }
});
test('紅毛城 highlights correct tone/phonetic keys; context determines polyphones', () => {
    const m=model(target('紅毛城'));
    assert.deepEqual(m.items.map(i=>i.syllable),['ㄏㄨㄥˊ','ㄇㄠˊ','ㄔㄥˊ']);
    assert.deepEqual(m.items.map(i=>i.keys),[['c','j','/','6'],['a','l','6'],['t','/','6']]);
    assert.equal(model(target('百年商行')).items.at(-1).syllable,'ㄏㄤˊ');
    assert.equal(model(target('快還來！')).items[1].syllable,'ㄏㄨㄢˊ');
    const sentence=model(target('蒼老的紅毛城，站在山坡上。'));
    assert.deepEqual(sentence.items[0].keys,['h',';','space']);
    assert.equal(sentence.items[2].keys.at(-1),'7');
    assert.deepEqual(sentence.items.find(i=>i.char==='，').keys,[]);
});
test('unknown Chinese still warns, and English preserves capitalization/spacing/punctuation',()=>{
    assert.ok(model(target('未核新題')).warning);
    assert.equal(target("What's that?"),"What's that?");
});
