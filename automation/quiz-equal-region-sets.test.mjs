import assert from 'node:assert/strict';
import test from 'node:test';
import {equalRegionAnswers} from './lib/quiz-equal-region-sets.mjs';
import {setupProductionQuizDB} from './fixtures/production-quiz-db.mjs';

test('the production grader accepts every way to color the requested number of equal regions', async () => {
  const {db} = await setupProductionQuizDB({snapshot: true});
  try {
    for (const [parts, count] of [[3, 2], [5, 3], [6, 3], [8, 7]]) {
      const ids = Array.from({length: parts}, (_, index) => 'r' + (index + 1));
      const question = {
        fields: [{id: 'regions', input: 'set', options: ids.map(id => ({id}))}],
        answer: {fields: {regions: equalRegionAnswers(ids, count)}},
      };
      for (let mask = 0; mask < 2 ** parts; mask++) {
        const regions = ids.filter((_, index) => mask & (1 << index)).reverse();
        const response = JSON.stringify({v: 1, f: {regions}});
        const {rows} = await db.query(
          'select public.quiz_fields_grade($1::jsonb, $2::text) as correct',
          [question, response],
        );
        assert.equal(rows[0].correct, regions.length === count, parts + ':' + mask);
      }
    }
  } finally {
    await db.close();
  }
});

test('the compiler rejects a partial answer list and an unsupported region count', () => {
  const ids = Array.from({length: 10}, (_, index) => 'r' + (index + 1));
  assert.throws(() => equalRegionAnswers(ids.slice(0, 8), 4), /20/);
  assert.throws(() => equalRegionAnswers(ids.slice(0, 9), 4), /2 至 8/);
  assert.throws(() => equalRegionAnswers(ids, 5), /2 至 8/);
  assert.throws(() => equalRegionAnswers(['r1', 'r1'], 1));
});
