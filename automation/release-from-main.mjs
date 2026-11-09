// The only supported way to publish it-class-tcwu to production (2026-11-04).
// It refuses unless: the checkout is clean and exactly origin/main, nobody else holds the release lock,
// production has not changed since the release started, and the candidate's full file tree differs from
// production only in the declared files (line-ending-only differences allowed).
//
// usage (run from a clean worktree of this repository, checked out at origin/main):
//   node automation/release-from-main.mjs status
//   node automation/release-from-main.mjs start   --agent <name> [--changed a,b] [--added c] [--removed d]
//   node automation/release-from-main.mjs deploy  --agent <name>      # candidate only, never promotes
//   node automation/release-from-main.mjs promote --agent <name>      # promotes the verified candidate
//   node automation/release-from-main.mjs abort   --agent <name>      # gives up and releases the lock
// options: --global-config <Vercel CLI config dir> (or env VERCEL_GLOBAL_CONFIG)
//
// The lock lives in the repository's shared git directory (<git-common-dir>/release-lock.json), so every
// worktree of this repository sees it. Finished releases are appended to <git-common-dir>/release-history.ndjson.
// After promote, add the printed row to docs/development/agent-handoff.md through a PR.
import fs from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { flattenTree, compareTrees } from './quiz-release-compare.mjs';

export const PROJECT = 'it-class-tcwu';
export const ALIAS = 'it-class-tcwu.vercel.app';
export const PROJECT_ID = 'prj_eJ1qle57xyilS5MKy6ZS6OuYtyFb';
export function candidateProjectMatches(info) {
  const ids = [info.projectId, info.project?.id].filter(Boolean);
  return ids.length > 0 && ids.every(id => id === PROJECT_ID);
}

export class ReleaseError extends Error {}
const fail = msg => { throw new ReleaseError(msg); };
const list = v => (v ? String(v).split(',').map(s => s.trim()).filter(Boolean) : []);

// Real side effects, injectable for tests.
export function realEnv({ cwd = process.cwd(), globalConfig = process.env.VERCEL_GLOBAL_CONFIG } = {}) {
  const git = (...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const vercel = (...a) => execFileSync(process.platform === 'win32' ? 'cmd.exe' : 'vercel',
    [...(process.platform === 'win32' ? ['/d', '/c', 'vercel'] : []), ...(globalConfig ? ['--global-config', globalConfig] : []), ...a],
    { cwd, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 900000 });
  const api = p => JSON.parse(vercel('api', p));
  const common = path.resolve(cwd, git('rev-parse', '--git-common-dir'));
  return {
    cwd,
    fetch: () => git('fetch', '--quiet', 'origin', 'main'),
    head: () => git('rev-parse', 'HEAD'),
    originMain: () => git('rev-parse', 'origin/main'),
    dirty: () => git('status', '--porcelain', '--untracked-files=normal'),
    lockPath: path.join(common, 'release-lock.json'),
    historyPath: path.join(common, 'release-history.ndjson'),
    readFile: f => fs.readFile(f, 'utf8'),
    createExclusive: async (f, text) => { const h = await fs.open(f, 'wx'); try { await h.writeFile(text); } finally { await h.close(); } },
    writeFile: (f, text) => fs.writeFile(f, text),
    appendFile: (f, text) => fs.appendFile(f, text),
    remove: f => fs.rm(f, { force: true }),
    // The live baseline is what the production alias serves. targets.production can point to a newer
    // deployment that failed to build (seen 2026-11-04: dpl_DPCuJ… ERROR while the alias stayed on dpl_BDJAT…).
    productionId: () => api(`/v4/aliases/${ALIAS}`).deploymentId,
    aliasTarget: () => api(`/v4/aliases/${ALIAS}`).deploymentId,
    tree: id => api(`/v6/deployments/${id}/files`),
    deployCandidate: () => {
      // Refuse before invoking CLI: --yes can otherwise create a project named
      // after this fresh worktree when .vercel/project.json is missing.
      let linked;
      try { linked = JSON.parse(readFileSync(path.join(cwd, '.vercel/project.json'), 'utf8')); }
      catch { fail(`link this clean worktree to ${PROJECT} before deploying`); }
      if (linked.projectId !== PROJECT_ID) fail(`linked Vercel project is not ${PROJECT}`);
      // CLI normally writes only the URL to stdout. Request structured output so the ID is reliable.
      const out = vercel('deploy', '--prod', '--skip-domain', '--yes', '--json');
      const id = out.match(/"id":\s*"(dpl_[A-Za-z0-9]+)"/)?.[1] || out.match(/dpl_[A-Za-z0-9]+/)?.[0];
      if (!id) fail('could not read the candidate deployment id from vercel deploy output');
      if (/"readyState":\s*"(ERROR|CANCELED)"/.test(out) || /"status":\s*"error"/.test(out)) fail(`candidate ${id} failed to build`);
      const info = api(`/v13/deployments/${id}`);
      if (!candidateProjectMatches(info) || info.target !== 'production' || info.readyState !== 'READY')
        fail(`candidate ${id} is not a READY production-target deployment of ${PROJECT}`);
      return id;
    },
    promote: id => vercel('promote', id, '--yes'),
    now: () => new Date().toISOString(),
  };
}

async function readLock(env) {
  try { return JSON.parse(await env.readFile(env.lockPath)); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}

// Clean checkout at exactly origin/main (after fetching).
async function assertCleanMain(env) {
  env.fetch();
  const dirty = env.dirty();
  if (dirty) fail(`working tree is not clean; publish only from a clean checkout of origin/main:\n${dirty.split('\n').slice(0, 10).join('\n')}`);
  const head = env.head(), main = env.originMain();
  if (head !== main) fail(`HEAD ${head.slice(0, 7)} is not origin/main ${main.slice(0, 7)}; check out the latest origin/main (frozen bundles and feature branches are not allowed)`);
  return head;
}

async function ownLock(env, agent) {
  const lock = await readLock(env);
  if (!lock) fail('no release in progress; run start first');
  if (lock.agent !== agent) fail(`release lock is held by ${lock.agent} since ${lock.startedAt}; stop and ask the user`);
  return lock;
}

export async function status(env) {
  return { lock: await readLock(env), production: env.productionId(), alias: env.aliasTarget(), originMain: (env.fetch(), env.originMain()) };
}

export async function start(env, { agent, changed = [], added = [], removed = [] }) {
  if (!agent) fail('--agent is required');
  const commit = await assertCleanMain(env);
  const existing = await readLock(env);
  if (existing) fail(`release lock is held by ${existing.agent} since ${existing.startedAt} (commit ${existing.commit.slice(0, 7)}); stop and ask the user`);
  const baseline = env.productionId();
  const lock = { agent, commit, baseline, expected: { changed, added, removed }, startedAt: env.now(), state: 'started' };
  try { await env.createExclusive(env.lockPath, JSON.stringify(lock, null, 1)); }
  catch (e) { if (e.code === 'EEXIST') fail('another release started at the same moment; stop and ask the user'); throw e; }
  return lock;
}

export async function deploy(env, { agent }) {
  const lock = await ownLock(env, agent);
  const commit = await assertCleanMain(env);
  if (commit !== lock.commit) fail(`origin/main moved from ${lock.commit.slice(0, 7)} to ${commit.slice(0, 7)} after start; abort and start again`);
  if (env.productionId() !== lock.baseline) fail(`production changed from ${lock.baseline} since start; abort and start again`);
  const candidate = env.deployCandidate();
  const comparison = await compareTrees(flattenTree(env.tree(lock.baseline)), flattenTree(env.tree(candidate)), { ...lock.expected, eolDir: env.cwd });
  const next = { ...lock, candidate, comparison: summarize(comparison), state: comparison.ok ? 'verified' : 'rejected', deployedAt: env.now() };
  await env.writeFile(env.lockPath, JSON.stringify(next, null, 1));
  if (!comparison.ok) fail(`candidate ${candidate} does not match the declared changes: ${JSON.stringify(summarize(comparison))}`);
  return next;
}

export async function promote(env, { agent }) {
  const lock = await ownLock(env, agent);
  if (lock.state !== 'verified' || !lock.candidate) fail('no verified candidate; run deploy first');
  const commit = await assertCleanMain(env);
  if (commit !== lock.commit) fail(`origin/main moved from ${lock.commit.slice(0, 7)} to ${commit.slice(0, 7)}; abort and start again`);
  if (env.productionId() !== lock.baseline) fail(`production changed from ${lock.baseline} since start; abort and start again`);
  // Re-verify right before promoting: the comparison must still hold.
  const comparison = await compareTrees(flattenTree(env.tree(lock.baseline)), flattenTree(env.tree(lock.candidate)), { ...lock.expected, eolDir: env.cwd });
  if (!comparison.ok) fail(`candidate ${lock.candidate} no longer matches the declared changes`);
  env.promote(lock.candidate);
  const live = env.aliasTarget();
  const done = { ...lock, state: live === lock.candidate ? 'promoted' : 'promote-unconfirmed', promotedAt: env.now(), alias: live, rollback: lock.baseline };
  await env.appendFile(env.historyPath, JSON.stringify(done) + '\n');
  await env.remove(env.lockPath);
  if (done.state !== 'promoted') fail(`promote ran but ${ALIAS} points to ${live}; check the Vercel dashboard (rollback: ${lock.baseline})`);
  return { ...done, handoffRow: `| 已完成 | ${agent} | ${lock.startedAt} | \`${lock.commit.slice(0, 7)}\` | \`${lock.baseline}\` | ${[...lock.expected.changed, ...lock.expected.added.map(f => '+' + f), ...lock.expected.removed.map(f => '-' + f)].join('、') || '—'} | \`${lock.candidate}\`／回滾 \`${lock.baseline}\`（eolOnly ${lock.comparison?.eolOnly ?? 0}） |` };
}

export async function abort(env, { agent }) {
  const lock = await ownLock(env, agent);
  await env.appendFile(env.historyPath, JSON.stringify({ ...lock, state: 'aborted', abortedAt: env.now() }) + '\n');
  await env.remove(env.lockPath);
  return { aborted: true, candidate: lock.candidate || null };
}

const summarize = c => ({ ok: c.ok, changed: c.changed, added: c.added, removed: c.removed, eolOnly: c.eolOnly.length, unexpected: c.unexpected, missingFromChange: c.missingFromChange, addedCheck: c.addedCheck, removedCheck: c.removedCheck });

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2), opt = k => (rest.includes(k) ? rest[rest.indexOf(k) + 1] : undefined);
  const env = realEnv({ globalConfig: opt('--global-config') || process.env.VERCEL_GLOBAL_CONFIG });
  const args = { agent: opt('--agent'), changed: list(opt('--changed')), added: list(opt('--added')), removed: list(opt('--removed')) };
  const commands = { status, start, deploy, promote, abort };
  try {
    if (!commands[cmd]) fail('command must be one of: status, start, deploy, promote, abort');
    console.log(JSON.stringify(await commands[cmd](env, args), null, 1));
  } catch (e) {
    console.error(e instanceof ReleaseError ? `release blocked: ${e.message}` : e);
    process.exitCode = 1;
  }
}
