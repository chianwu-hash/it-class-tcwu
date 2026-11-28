import test from 'node:test';import assert from 'node:assert/strict';
import {textbookReadingDirection} from '../../shared/quiz-textbook-settings.mjs';
import {validateBatchBookDirection} from '../lib/quiz-batch-plan.mjs';
test('依已核教材ID設定翻閱方向，不由年級、科目或物件原型推測',()=>{
 for(const id of [
  'c26493b9-ec9f-5f17-91af-99dc2d88a508','c29f895f-17e1-59eb-b81e-49e58d2210f4',
  '479f5606-b8ff-53a3-a398-398f42ddea55','ddc22746-f922-505c-a65f-6c7fea35b6e3','0da18d0c-4269-5b72-aed7-31c439dcb638',
  'b33e5c9e-66f9-5b39-adff-85c98e5e2d9b','060de546-bc07-5fc7-ad05-43bbceb92979','75ede99a-853e-55f9-9f01-2093b0fc9333',
  '3d465a46-a690-5917-b5ae-290a9893ab1c',
 ])assert.equal(textbookReadingDirection(id),'rtl');
 for(const id of [undefined,null,'','國語','國文','grade9','九上翰林國文教冊','0b277270-b64c-575d-9a45-48e632e76e11','constructor','toString','__proto__'])assert.equal(textbookReadingDirection(id),'ltr');
});

test('教材合冊須在批次預檢時綁定原件的翻閱方向',()=>{
 const page={id:'p108-109',provenance:{readingDirection:'rtl'}};
 const combined={id:'3d465a46-a690-5917-b5ae-290a9893ab1c'};
 assert.equal(validateBatchBookDirection({book:combined,pages:[page]}),'rtl');
 assert.throws(()=>validateBatchBookDirection({book:{id:'unknown'},pages:[page]}),/與原件不符/);
 assert.equal(validateBatchBookDirection({book:{id:'unknown'},pages:[{id:'p41'}]}),'ltr');
});
