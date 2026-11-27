import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fingerprint} from './vercel-maintenance.mjs';

export function cliReader({cliEntry, globalConfig, cwd, project}) {
  const allowed = new Set(['/v2/user', `/v9/projects/${project.id}`, `/v9/projects/${project.id}/domains`, '/v6/deployments', '/v4/aliases', '/v4/aliases/it-class-tcwu.vercel.app']);
  const execute = endpoint => execFileSync(process.execPath, [cliEntry, ...(globalConfig ? ['--global-config', globalConfig] : []), 'api', endpoint, '--method', 'GET', '--raw'], {cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 45_000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
  const get = async endpoint => {
    const url = new URL(endpoint, 'https://api.vercel.com');
    if (!endpoint.startsWith('/') || endpoint.startsWith('//') || !allowed.has(url.pathname) || url.hash) throw Error('唯讀收集器拒絕未允許的端點');
    const required = url.pathname !== '/v2/user';
    if (required && url.searchParams.get('teamId') !== project.teamId) throw Error('團隊範圍不符');
    if (['/v6/deployments', '/v4/aliases'].includes(url.pathname) && url.searchParams.get('projectId') !== project.id) throw Error('專案範圍不符');
    const stdout = execute(endpoint);
    return JSON.parse(stdout);
  };
  // Only used for an alias target absent from the fully paginated inventory.
  // A 401/403, timeout, or generic CLI failure must never be treated as a 404.
  get.deploymentStatus = async id => {
    if (!/^dpl_[a-zA-Z0-9]+$/.test(id)) throw Error('部署ID格式無效');
    try {
      const d = JSON.parse(execute('/v13/deployments/' + id + '?teamId=' + encodeURIComponent(project.teamId)));
      if (d.id !== id || d.projectId !== project.id) throw Error('別名目標身份無法核對');
      return {id, status: 200, readyState: d.readyState, deletedAt: d.deletedAt ?? null};
    } catch (error) {
      if (/^Error: Deployment not found \(404\)\s*$/.test(String(error.stderr ?? ''))) return {id, status: 404, error: 'deployment_not_found'};
      throw Error('別名目標唯讀查核失敗，不能認定不存在');
    }
  };
  return get;
}

export async function paginate(get, endpoint, key) {
  const rows = [], seen = new Set(); let cursor;
  for (let n = 0; n < 100; n++) {
    const data = await get(endpoint + (cursor === undefined ? '' : '&until=' + encodeURIComponent(cursor)));
    if (!Array.isArray(data[key])) throw Error('分頁資料格式無效：' + key);
    rows.push(...data[key]);
    const next = data.pagination?.next;
    if (next === null || next === undefined) {
      if (next === undefined && data[key].length >= 100) throw Error('無法證明完整分頁：' + key);
      return rows;
    }
    if (seen.has(String(next))) throw Error('分頁游標重複');
    seen.add(String(next)); cursor = next;
  }
  throw Error('超過分頁上限');
}

export async function collectInventory({get, project, readLocal, getDeploymentStatus = get.deploymentStatus}) {
  const localBefore = readLocal();
  const snapshot = {version: 1, source: 'vercel-cli-get-only', identity: {...project}, collectedAt: null, project: {id: project.id, name: project.name, teamId: project.teamId}, deployments: [], aliases: [], domains: [], coverage: {}, verification: {}, errors: []};
  if (localBefore.lockExists) {
    snapshot.collectionFailed = true; snapshot.errors.push('發布鎖存在，略過本輪唯讀候選盤點'); snapshot.collectedAt = new Date().toISOString();
    return {snapshot, history: localBefore.history};
  }
  try {
    const user = await get('/v2/user');
    if (user.user?.email !== project.accountEmail) throw Error('Vercel 登入帳號不符');
    const team = encodeURIComponent(project.teamId), id = encodeURIComponent(project.id);
    const query = '?teamId=' + team;
    const projectRead = async () => {
      const p = await get('/v9/projects/' + id + query);
      if (p.id !== project.id || p.name !== project.name || p.accountId !== project.teamId) throw Error('Vercel 專案或團隊不符');
      return {id: p.id, name: p.name, teamId: p.accountId, retention: p.deploymentExpiration ?? null};
    };
    const read = async () => {
      const p = await projectRead();
      const alias = await get('/v4/aliases/it-class-tcwu.vercel.app' + query);
      if (alias.projectId !== project.id || !alias.deploymentId) throw Error('正式網址的專案或部署對應無效');
      p.productionId = alias.deploymentId;
      const ds = await paginate(get, '/v6/deployments' + query + '&projectId=' + id + '&limit=100', 'deployments');
      const as = await paginate(get, '/v4/aliases' + query + '&projectId=' + id + '&limit=100', 'aliases');
      const domains = await paginate(get, '/v9/projects/' + id + '/domains' + query + '&limit=100', 'domains');
      const listed = new Set(ds.map(d => d.uid ?? d.id));
      const checks = [];
      for (const id of new Set(as.map(a => a.deploymentId ?? a.deployment?.id).filter(id => !listed.has(id)))) {
        if (!getDeploymentStatus) throw Error('缺少別名目標逐筆查核能力');
        const check = await getDeploymentStatus(id);
        if (check.id !== id || ![200, 404].includes(check.status)) throw Error('別名目標查核結果無效');
        checks.push({...check, checkedAt: new Date().toISOString()});
      }
      return {project: p, aliasTargetChecks: checks, deployments: ds.map(d => ({id: d.uid ?? d.id, projectId: d.projectId, createdAt: d.createdAt ?? d.created, readyState: d.readyState ?? d.state, target: d.target ?? null, url: d.url ?? null, branch: d.meta?.gitCommitRef ?? d.meta?.githubCommitRef ?? null, commitSha: d.meta?.gitCommitSha ?? d.meta?.githubCommitSha ?? null, isRollbackCandidate: d.isRollbackCandidate ?? null})).sort((a, b) => a.id.localeCompare(b.id)), aliases: as.map(a => ({name: a.alias, projectId: a.projectId, deploymentId: a.deploymentId ?? a.deployment?.id})).sort((a, b) => a.name.localeCompare(b.name)), domains: domains.map(d => ({name: d.name, projectId: project.id, redirect: d.redirect ?? null})).sort((a, b) => a.name.localeCompare(b.name))};
    };
    const before = await read(), after = await read(), localAfter = readLocal();
    if ((await get('/v2/user')).user?.email !== project.accountEmail) throw Error('查核期間帳號變動');
    Object.assign(snapshot, before);
    snapshot.aliasTargetChecks = [...before.aliasTargetChecks, ...after.aliasTargetChecks];
    snapshot.coverage = {deploymentsComplete: true, aliasesComplete: true, domainsComplete: true, aliasTargetsComplete: true, releaseHistoryComplete: localBefore.historyComplete && localAfter.historyComplete};
    const targetState = rows => rows.map(({checkedAt, ...state}) => state).sort((a, b) => a.id.localeCompare(b.id));
    snapshot.verification = {productionUnchanged: before.project.productionId === after.project.productionId, inventoryUnchanged: fingerprint(before.deployments) === fingerprint(after.deployments), aliasesUnchanged: fingerprint(before.aliases) === fingerprint(after.aliases), aliasTargetsUnchanged: fingerprint(targetState(before.aliasTargetChecks)) === fingerprint(targetState(after.aliasTargetChecks)), domainsUnchanged: fingerprint(before.domains) === fingerprint(after.domains), retentionUnchanged: fingerprint(before.project.retention) === fingerprint(after.project.retention), releaseIdle: !localAfter.lockExists && localBefore.historyHash === localAfter.historyHash};
  } catch (error) {
    // Do not persist CLI stderr: some CLI failures can contain account/session hints.
    snapshot.collectionFailed = true;
    snapshot.errors.push(error.stdout !== undefined ? 'Vercel CLI 唯讀查詢失敗，請核對授權與連線' : error.message);
  }
  snapshot.collectedAt = new Date().toISOString();
  return {snapshot, history: localBefore.history};
}

export function localReleaseReader(repo) {
  const git = (...args) => execFileSync('git', args, {cwd: repo, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']}).trim();
  const common = path.resolve(repo, git('rev-parse', '--git-common-dir'));
  const mainCache = new Map();
  return () => {
    const historyFile = path.join(common, 'release-history.ndjson');
    let text = '', historyComplete = true, history = [];
    try {
      text = fs.readFileSync(historyFile, 'utf8');
      history = text.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
      if (!history.length) historyComplete = false;
      history = history.map(row => {
        let mainAncestor = false;
        if (/^[a-f0-9]{40}$/.test(row.commit ?? '')) {
          if (!mainCache.has(row.commit)) { try { git('merge-base', '--is-ancestor', row.commit, 'origin/main'); mainCache.set(row.commit, true); } catch { mainCache.set(row.commit, false); } }
          mainAncestor = mainCache.get(row.commit);
        }
        return {...row, mainAncestor};
      });
    } catch { historyComplete = false; }
    return {lockExists: fs.existsSync(path.join(common, 'release-lock.json')), history, historyComplete, historyHash: fingerprint(text)};
  };
}
