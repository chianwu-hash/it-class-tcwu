const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { safeRelative, sourceFiles, checkProduction, checkProductionAliases, referenceFindings, verifyDryRun } = require('../prepare-vercel-slim-release.cjs');
const policy = require('../vercel-slim-policy.json');

test('rejects stale production or another team before preparing a package', () => {
  const project = { id: policy.projectId, name: 'it-class-tcwu', accountId: 'team_SOhQ0oysg6ZGV9vs3RryW2CB', targets: { production: { id: 'dpl_current' } } };
  assert.doesNotThrow(() => checkProduction(project, 'dpl_current'));
  assert.throws(() => checkProduction(project, 'dpl_old'), /Production has changed/);
  assert.throws(() => checkProduction({ ...project, accountId: 'other-team' }, 'dpl_current'), /mismatch/);
});

test('includes public teaching notes and encoded references in the removal guard', () => {
  const target = policy.excludedFiles.find(x => x.path.endsWith('.pdf')).path.split('/').at(-1);
  for (const content of [target, '100% width: ' + encodeURIComponent(target), target.replace(/./g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))]) {
    assert.equal(referenceFindings([{ path: 'grade3/LessonPlan/Week.md' }], () => Buffer.from(content)).length, 1);
  }
});

test('rejects a parallel release even when project production metadata is still unchanged', () => {
  const aliases = { aliases: ['it-class-tcwu.vercel.app', 'it-class-tcwu-chianwu-4755s-projects.vercel.app'].map(alias => ({ alias, projectId: policy.projectId, deploymentId: 'dpl_current' })) };
  assert.doesNotThrow(() => checkProductionAliases(aliases, 'dpl_current'));
  aliases.aliases[1].deploymentId = 'dpl_other_release';
  assert.throws(() => checkProductionAliases(aliases, 'dpl_current'), /Another release/);
});

test('retains the PNG referenced by the public week 1 lesson plan', () => {
  const retained = 'grade3/115-1/images/week01/week01-computer-lab-rules-v2-01.png';
  assert.ok(policy.requiredFiles.includes(retained));
  assert.ok(!policy.excludedFiles.some(x => x.path === retained));
});

test('refuses traversal, symlinks in the source manifest, and case collisions', () => {
  for (const unsafe of ['../auth.js', '/auth.js', 'C:/auth.js', 'grade3\\auth.js']) assert.throws(() => safeRelative(unsafe));
  assert.throws(() => sourceFiles([{ name: 'src', type: 'directory', children: [{ name: 'shared', type: 'symlink' }] }]));
  const file = name => ({ name, type: 'file', uid: 'a'.repeat(40) });
  assert.throws(() => sourceFiles([{ name: 'src', type: 'directory', children: [file('Auth.js'), file('auth.js')] }]), /Duplicate/);
});

test('dry-run gate rejects missing runtime, changed hashes, and unexpected uploads', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vercel-slim-test-'));
  try {
    fs.writeFileSync(path.join(dir, 'index.html'), 'production page');
    const digest = crypto.createHash('sha1').update('production page').digest('hex');
    const files = [{ path: 'index.html', sha1: digest }];
    assert.equal(verifyDryRun({ files: [{ path: 'index.html', sha: digest }] }, files, dir), 1);
    assert.throws(() => verifyDryRun({ files: [] }, files, dir), /Missing/);
    assert.throws(() => verifyDryRun({ files: [{ path: 'index.html', sha: 'a'.repeat(40) }] }, files, dir), /changed/);
    assert.throws(() => verifyDryRun({ files: [{ path: 'index.html', sha: digest }, { path: 'private.txt', sha: digest }] }, files, dir), /Unexpected/);
  } finally {
    // Remove only the exact disposable file and directory created above.
    fs.unlinkSync(path.join(dir, 'index.html'));
    fs.rmdirSync(dir);
  }
});
