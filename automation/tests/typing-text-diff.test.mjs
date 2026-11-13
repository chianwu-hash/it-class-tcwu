import test from 'node:test';
import assert from 'node:assert/strict';
import {findTypingDifference as diff, normalizeTypingText} from '../../shared/typing-text-diff.mjs';

test('定位與原評分正規化一致，保留原始 UTF-16 索引',()=>{
 const original=s=>s.replace(/\r\n/g,'\n').split('\n').map(line=>line.trim()).join('\n').replace(/[奬奨]/g,'獎').replace(/説/g,'說');
 for(const input of ['  奬説 \r\n 奨勵  ','\t\n  ','a\rb','😀 e\u0301','  字\n\n  ']) assert.equal(normalizeTypingText(input).text,original(input));
 assert.equal(diff('  奬説 \r\n 奨勵  ','獎說\n獎勵'),null);
 const d=diff('  好\r\n  天汽  ','好\n天氣');
 assert.equal(d.actualStart,8);assert.equal(d.actualEnd,9);assert.equal(d.actualText,'汽');
});
test('錯字、多字、少字與尾端定位',()=>{
 for(const [actual,expected,kind,start,end] of [
  ['甲錯丙','甲乙丙','replace',1,2],['甲多乙丙','甲乙丙','extra',1,2],
  ['甲丙','甲乙丙','missing',1,1],['甲乙','甲乙丙','missing',2,2],
  ['甲乙多','甲乙','extra',2,3],['','甲','missing',0,0],['多','','extra',0,1],
  ['abc def','abcdef','extra',3,4],['abcdef','abc def','missing',3,3],
  ['甲\n乙','甲乙','extra',1,2],['甲乙','甲\n乙','missing',1,1],
  ['甲,乙','甲，乙','replace',1,2],['甲甲甲乙','甲甲乙','extra',2,3],
  ['😀錯文','😀對文','replace',2,3],['Ae\u0301B','AéB','replace',1,3],
  ['A👨‍👩‍👧B','A😀B','replace',1,9]
 ]) {const d=diff(actual,expected);assert.deepEqual([d.kind,d.actualStart,d.actualEnd],[kind,start,end],actual);}
 const prefix='這是一段會在窄螢幕折成很多行的長文。'.repeat(80);
 const d=diff(prefix+'汽象'+prefix,prefix+'氣象'+prefix);
 assert.equal(d.actualStart,prefix.length);assert.equal(d.actualText,'汽');assert.equal(d.expectedText,'氣');assert.ok(d.actualContext.moreBefore);
});
