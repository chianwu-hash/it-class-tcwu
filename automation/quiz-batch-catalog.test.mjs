import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBatchCatalog} from './lib/quiz-batch-plan.mjs';

test('跨單元目錄不可默默沿用第一筆來源；缺列、漏列及子字串不通過', () => {
  const packet = {candidates: ['2', '12'].map(unit => ({doc: {catalog: {unit}}}))};
  for (const catalogUnit of [undefined, '', '2', '12', '2、112']) {
    assert.throws(() => validateBatchCatalog({...packet, catalogUnit}));
  }
  assert.doesNotThrow(() => validateBatchCatalog({...packet, catalogUnit: '2、12'}));
  assert.doesNotThrow(() => validateBatchCatalog({...packet, catalogUnit: '12、2'}));
  assert.doesNotThrow(() => validateBatchCatalog({candidates: [packet.candidates[0]]}));
});
