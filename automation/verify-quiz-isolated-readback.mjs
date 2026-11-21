import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupProductionQuizDB } from './fixtures/production-quiz-db.mjs';
import { newDocument, validateDocument } from '../shared/quiz-document.mjs';

const [input, bookFile, bookAssets, output] = process.argv.slice(2);
if (!input || !bookFile || !bookAssets || !output) {
  throw Error('Usage: node automation/verify-quiz-isolated-readback.mjs <private-input> <book-packet> <book-assets-dir> <private-output>');
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

const read = async path => JSON.parse((await fs.readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const started = performance.now();
const [rows, book, schema] = await Promise.all([
  read(input),
  read(bookFile),
  read('supabase/production-snapshot/schema.json'),
]);
assert.ok(Array.isArray(rows) && rows.length);
assert.equal(new Set(rows.map(row => row.item.question_id)).size, rows.length);
assert.equal(new Set(rows.map(row => row.source)).size, rows.length);

const poolKeys = [
  'question_id', 'source_item_id', 'group_key', 'unit_ids', 'knowledge_code', 'knowledge_name',
  'difficulty', 'source_version', 'publisher_explanation', 'question', 'checks',
];
const studyKeys = ['book_id', 'primary_page', 'reference_pages', 'student_explanation', 'teacher_notes', 'provenance'];
const poolColumns = poolKeys.join(',');
const poolParams = poolKeys.map((_, index) => '$' + (index + 1)).join(',');
const pageArray = numbers => '{' + numbers.join(',') + '}';
const candidates = new Map();
const results = [];
const { db, as } = await setupProductionQuizDB({ snapshot: true });
try {
  const triggerTables = new Set(['quiz_pool_study_sources', 'quiz_textbooks', 'quiz_textbook_pages']);
  for (const trigger of schema.triggers.filter(t => t.schema === 'public' && triggerTables.has(t.table))) {
    await db.exec(trigger.def);
  }
  for (const course of new Set(rows.map(row => row.item.course_id))) {
    await db.query('insert into public.quiz_courses values($1,$2,$3,true)',
      [course, book.grade, { school_year: String(book.schoolYear) }]);
  }
  await db.query('insert into public.quiz_textbooks values($1,$2,$3,$4,$5,$6,false)',
    [book.id, book.grade, book.schoolYear, book.semester, book.title, book.sourceSha256]);
  for (const page of book.pages) {
    assert.match(page.id, /^[a-zA-Z0-9_-]+$/);
    const bytes = await fs.readFile(resolve(bookAssets, page.id + '.webp'));
    assert.equal(bytes.length, page.bytes);
    assert.equal(sha(bytes), page.sha256);
    await db.query(
      'insert into public.quiz_textbook_pages(book_id,id,printed_pages,sequence,sha256,bytes,provenance) values($1,$2,$3,$4,$5,$6,$7)',
      [book.id, page.id, pageArray(page.printedPages), page.sequence, page.sha256, page.bytes, page.provenance],
    );
  }
  await db.query('update public.quiz_textbooks set enabled=true where id=$1', [book.id]);
  const bookPages = (await db.query('select printed_pages from public.quiz_textbook_pages')).rows;
  assert.equal(bookPages.length, book.pages.length);
  const printedPages = new Set(bookPages.flatMap(page => page.printed_pages));

  await db.exec('begin');
  for (const { source, ref, item } of rows) {
    const questionId = item.question_id;
    const course = item.course_id;
    const study = item.study;
    const result = { source, question_id: questionId, candidate_sha256: ref.sha256 };
    let stage = 'candidate';
    await db.exec('savepoint candidate');
    try {
      assert.equal(study.book_id, book.id);
      assert.equal(item.checks.source_parent_id, source);
      assert.equal(ref.question_id, item.question.id);
      if (!candidates.has(ref.path)) {
        const bytes = await fs.readFile(ref.path);
        const packet = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
        candidates.set(ref.path, { digest: sha(bytes), pool: new Map(packet.pool.map(row => [row.question_id, row])) });
      }
      const { digest, pool } = candidates.get(ref.path);
      assert.equal(digest, ref.sha256);
      assert.deepEqual(pool.get(questionId), item);

      const document = newDocument();
      document.blocks[0].questions = [item.question];
      validateDocument(document);
      stage = 'sql_validator';
      await db.query('select public.quiz_validate($1)', [document]);
      stage = 'pool_insert';
      await db.query('insert into public.quiz_question_pool (' + poolColumns + ',usable) values(' + poolParams + ',false)',
        poolKeys.map(key => item[key]));
      stage = 'membership_insert';
      await db.query('insert into public.quiz_pool_membership values($1,$2,$3)', [questionId, course, item.knowledge_reliable]);
      stage = 'study_insert';
      await db.query('insert into public.quiz_pool_study_sources values($1,$2,$3,$4,$5,$6,$7,$8,$9,false)', [
        questionId, course, item.question, study.book_id, study.primary_page, pageArray(study.reference_pages),
        study.student_explanation, study.teacher_notes, study.provenance,
      ]);

      stage = 'pool_readback';
      const storedPool = (await db.query('select * from public.quiz_question_pool where question_id=$1', [questionId])).rows[0];
      for (const key of poolKeys) assert.deepEqual(storedPool[key], item[key], key);
      assert.equal(storedPool.usable, false);
      stage = 'membership_readback';
      const membership = (await db.query('select * from public.quiz_pool_membership where question_id=$1', [questionId])).rows;
      assert.deepEqual(membership, [{ question_id: questionId, course_id: course, knowledge_reliable: item.knowledge_reliable }]);
      stage = 'study_readback';
      const readStudy = async () =>
        (await db.query('select * from public.quiz_pool_study_sources where question_id=$1', [questionId])).rows[0];
      const storedStudy = await readStudy();
      for (const key of studyKeys) assert.deepEqual(storedStudy[key], study[key], key);
      assert.deepEqual(storedStudy.question, item.question);
      assert.equal(storedStudy.course_id, course);
      assert.equal(storedStudy.enabled, false);
      stage = 'refs_readback';
      assert.ok(study.reference_pages.includes(study.primary_page));
      for (const page of study.reference_pages) assert.ok(printedPages.has(page));

      stage = 'immutability';
      await db.exec('savepoint mutating_source');
      try {
        await assert.rejects(
          db.query("update public.quiz_pool_study_sources set student_explanation=student_explanation || ' changed' where question_id=$1", [questionId]),
          error => error.code === 'P0001' && error.message === 'study_fixed_version',
        );
      } finally {
        await db.exec('rollback to savepoint mutating_source');
        await db.exec('release savepoint mutating_source');
      }
      assert.deepEqual(await readStudy(), storedStudy);
      await db.exec('release savepoint candidate');
      results.push({ ...result, passed: true });
    } catch (error) {
      await db.exec('rollback to savepoint candidate');
      await db.exec('release savepoint candidate');
      results.push({ ...result, passed: false, stage, code: error.code ?? error.name });
    }
  }
  await db.exec('commit');

  const isolation = [];
  for (const [student, role] of [[0, 'anon'], [2, 'authenticated']]) {
    await as(student, role);
    try {
      for (const table of ['quiz_question_pool', 'quiz_pool_study_sources']) {
        await assert.rejects(db.query('select * from public.' + table), error => error.code === '42501');
        isolation.push(role + ':' + table);
      }
    } finally {
      await db.exec('reset role');
    }
  }
  const failed = results.filter(row => !row.passed);
  const report = {
    schema: 'quiz-isolated-equivalent-readback/v1',
    sources: rows.length,
    passed: results.length - failed.length,
    failures: failed.length,
    seconds: Math.round((performance.now() - started) / 10) / 100,
    book_pages_readback: bookPages.length,
    isolation,
    snapshot_sha256: sha(await fs.readFile('supabase/production-snapshot/schema.json')),
    functions_sha256: sha(await fs.readFile('supabase/production-snapshot/functions.sql')),
    results,
  };
  await fs.writeFile(outputFile, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ sources: report.sources, passed: report.passed, failures: report.failures, seconds: report.seconds }));
} finally {
  await db.close();
}
