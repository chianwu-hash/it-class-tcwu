import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupProductionQuizDB } from './fixtures/production-quiz-db.mjs';
import { fieldsResponseError } from '../shared/quiz-fields.mjs';
import { workAnswerPresentation } from '../shared/quiz-work-answer-layout.mjs';
import { mergeWorkSketch, splitWorkSketch } from '../shared/quiz-work-sketch-groups.mjs';
import { DEFAULT_PEN, PEN_COLORS } from '../shared/sketch/model.mjs';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  throw Error('Usage: node automation/verify-quiz-sketch-responses.mjs <private-input> <private-output>');
}
const root = await fs.realpath(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const outputParent = await fs.realpath(dirname(resolve(output)));
const outputFile = resolve(outputParent, basename(output));
const target = relative(root, outputFile);
if ((!isAbsolute(target) && !target.startsWith('..' + sep)) || !outputFile.endsWith('.private.json')) {
  throw Error('Readback evidence must use a private JSON path outside the repository');
}
const existing = await fs.lstat(outputFile).catch(error => {
  if (error.code !== 'ENOENT') throw error;
  return null;
});
if (existing && !existing.isFile()) throw Error('Readback evidence must be a regular file');

const read = bytes => JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
const rows = read(await fs.readFile(input));
assert.ok(Array.isArray(rows) && rows.length);
assert.equal(new Set(rows.map(row => row.source)).size, rows.length);
assert.equal(new Set(rows.map(row => row.ref.question_id)).size, rows.length);
const candidates = new Map();
const results = [];
const { db } = await setupProductionQuizDB({ snapshot: true });
try {
  for (const { source, ref, item } of rows) {
    if (!candidates.has(ref.path)) {
      const bytes = await fs.readFile(ref.path);
      candidates.set(ref.path, {
        digest: createHash('sha256').update(bytes).digest('hex'),
        pool: new Map(read(bytes).pool.map(row => [row.question_id, row])),
      });
    }
    const { digest, pool } = candidates.get(ref.path);
    assert.equal(digest, ref.sha256);
    assert.equal(item.question.id, ref.question_id);
    assert.equal(item.checks.source_parent_id, source);
    assert.deepEqual(pool.get(ref.question_id), item);
    const result = { source, question_id: ref.question_id, candidate_sha256: digest };
    const question = item.question;
    assert.equal(question.work?.input, 'sketch');
    const groups = workAnswerPresentation(question)?.sketchGroups?.length ?? 1;
    const parts = Array.from({ length: groups }, (_, index) => ({
      version: 1,
      strokes: [[[0.1, 0.15], [0.3, 0.2 + index * 0.1]]],
      colors: [index % 2 ? PEN_COLORS[1][1] : DEFAULT_PEN],
    }));
    const work = groups > 1 ? mergeWorkSketch(parts) : parts[0];
    if (groups > 1) {
      const decoded = splitWorkSketch(work, groups);
      assert.equal(decoded?.length, groups);
      for (const [index, part] of decoded.entries()) {
        assert.deepEqual(part.colors, parts[index].colors);
        assert.equal(part.strokes.length, 1);
        assert.equal(part.strokes[0].length, parts[index].strokes[0].length);
        for (const [point, [x, y]] of part.strokes[0].entries()) {
          const [expectedX, expectedY] = parts[index].strokes[0][point];
          assert.equal(x, expectedX);
          assert.ok(Math.abs(y - expectedY) < 0.000003);
        }
      }
    }
    const fields = Object.fromEntries(question.fields.map(field => [field.id, question.answer.fields[field.id][0]]));
    for (const tuple of question.answer.tuples ?? []) Object.assign(fields, tuple.accepted[0]);
    const response = JSON.stringify({ v: 1, f: fields, w: work });
    assert.equal(fieldsResponseError(question, response), '');
    assert.equal((await db.query('select public.quiz_fields_grade($1,$2) ok', [question, response])).rows[0].ok, true);
    result.sketch_groups_verified = groups;
    results.push(result);
  }
} finally {
  await db.close();
}
const report = {
  passed: results.length,
  grouped: results.filter(result => result.sketch_groups_verified > 1).length,
  results,
};
await fs.writeFile(outputFile, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ passed: report.passed, grouped: report.grouped }));
