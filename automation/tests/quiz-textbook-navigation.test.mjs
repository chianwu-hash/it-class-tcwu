import test from 'node:test';import assert from 'node:assert/strict';
import {textbookBookPages} from '../../shared/quiz-study-data.mjs';
test('逐頁sequence仍可前後翻：同書已授權頁排序、完整拉頁只列一次、不同書隔離',()=>{
 const pages=[{id:'111',bookId:'math',sequence:'111',printedPages:[111]},{id:'other',bookId:'other',sequence:'110',printedPages:[110]},{id:'110',bookId:'math',sequence:'110',printedPages:[110]},{id:'spread',bookId:'math',sequence:'108',printedPages:[108,109]}];
 const before=structuredClone(pages),ordered=textbookBookPages(pages,'math');
 assert.deepEqual(ordered.map(p=>p.id),['spread','110','111']);
 assert.deepEqual(ordered[0].printedPages,[108,109]);assert.deepEqual(pages,before);
 assert.equal(ordered[ordered.findIndex(p=>p.id==='110')-1].id,'spread');assert.equal(ordered[ordered.findIndex(p=>p.id==='110')+1].id,'111');
 assert.deepEqual(textbookBookPages(pages,'not-authorized'),[]);
});
