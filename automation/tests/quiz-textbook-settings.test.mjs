import test from 'node:test';import assert from 'node:assert/strict';
import {textbookReadingDirection} from '../../shared/quiz-textbook-settings.mjs';
test('依已核教材ID設定翻閱方向，不由年級、科目或物件原型推測',()=>{
 for(const id of ['c26493b9-ec9f-5f17-91af-99dc2d88a508','c29f895f-17e1-59eb-b81e-49e58d2210f4'])assert.equal(textbookReadingDirection(id),'rtl');
 for(const id of [undefined,null,'','國語','國文','grade9','九上翰林國文教冊','0b277270-b64c-575d-9a45-48e632e76e11','constructor','toString','__proto__'])assert.equal(textbookReadingDirection(id),'ltr');
});
