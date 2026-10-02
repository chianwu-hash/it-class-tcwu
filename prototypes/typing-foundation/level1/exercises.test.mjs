import assert from 'node:assert/strict';
import { exercisePlans, generateExercise } from './exercises.mjs';

// Constant random values explicitly exercise the collision fallback.
for (const random of [Math.random, () => 0, () => 0.999999]) {
  exercisePlans.forEach((plan, stage) => {
    let previous = [];
    for (let attempt = 0; attempt < 150; attempt++) {
      const rows = generateExercise(stage, previous, random);
      assert.equal(rows.length, plan.lengths.length);
      assert.equal(new Set(rows).size, rows.length);
      rows.forEach((line, i) => {
        assert.equal(previous.includes(line), false, 'every line must be new relative to the last attempt');
        const groups = line.split(' ');
        assert.equal(line.length, plan.lengths[i] + plan.lengths[i] / 4 - 1);
        assert.equal(groups.length, plan.lengths[i] / 4);
        assert.ok(groups.every(group => group.length === 4), 'groups remain short and readable');
        assert.equal([...line].filter(k => k === ' ').length, groups.length - 1);
        assert.ok([...line].every(k => k === ' ' || plan.learned.includes(k)));
        if (plan.focus && i < 2) {
          for (const key of plan.focus) assert.equal([...line].filter(k => k === key).length, plan.lengths[i] / 2);
        }
      });
      if (!plan.focus) for (const key of plan.learned) assert.ok(rows.join('').includes(key));
      previous = rows;
    }
  });
}
console.log('PASS: 2700 generated exercises; scope, length, focus balance, all home keys, distinct rows and retries, repeated-RNG fallback.');
