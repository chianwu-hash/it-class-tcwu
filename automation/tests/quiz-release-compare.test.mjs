import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { compareTrees } from '../quiz-release-compare.mjs';

const sha1 = s => createHash('sha1').update(s).digest('hex');
const tree = obj => new Map(Object.entries(obj).map(([k, v]) => [k, sha1(v)]));
const prod = tree({ 'a.js': 'a\n', 'b.js': 'b\n', 'old.js': 'old\n', 'eol.js': 'x\ny\n' });

test('宣告的新增、刪除與修改剛好相符時通過', async () => {
  const cand = tree({ 'a.js': 'a2\n', 'b.js': 'b\n', 'new.js': 'n\n', 'eol.js': 'x\ny\n' });
  const r = await compareTrees(prod, cand, { changed: ['a.js'], added: ['new.js'], removed: ['old.js'] });
  assert.equal(r.ok, true, JSON.stringify(r));
});

test('未宣告的新增或刪除會失敗', async () => {
  const cand = tree({ 'a.js': 'a\n', 'b.js': 'b\n', 'new.js': 'n\n', 'eol.js': 'x\ny\n' });
  const r = await compareTrees(prod, cand, {});
  assert.equal(r.ok, false);
  assert.deepEqual(r.addedCheck.unexpected, ['new.js']);
  assert.deepEqual(r.removedCheck.unexpected, ['old.js']);
});

test('宣告了但沒發生的變更也會失敗', async () => {
  const r = await compareTrees(prod, prod, { changed: ['a.js'] });
  assert.equal(r.ok, false);
  assert.deepEqual(r.missingFromChange, ['a.js']);
});

test('只差換行的變更在提供 --eol-dir 時歸到 eolOnly，內容差異仍失敗', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'release-compare-'));
  try {
    await fs.writeFile(path.join(dir, 'eol.js'), 'x\r\ny\r\n');
    await fs.writeFile(path.join(dir, 'b.js'), 'B\r\n');
    const cand = tree({ 'a.js': 'a\n', 'b.js': 'B\r\n', 'old.js': 'old\n', 'eol.js': 'x\r\ny\r\n' });
    const r = await compareTrees(prod, cand, { eolDir: dir });
    assert.deepEqual(r.eolOnly, ['eol.js']);
    assert.deepEqual(r.unexpected, ['b.js']);
    assert.equal(r.ok, false);
    const r2 = await compareTrees(prod, cand, { eolDir: dir, changed: ['b.js'] });
    assert.equal(r2.ok, true, JSON.stringify(r2));
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
