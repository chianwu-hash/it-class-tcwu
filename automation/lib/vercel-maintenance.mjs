import {createHash} from 'node:crypto';

const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])])) : value;
export const fingerprint = value => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const idPattern = /^dpl_[a-zA-Z0-9]+$/;

export function validateConfig(config) {
  if (config?.version !== 1 || !config.project || !['name', 'id', 'teamId', 'teamSlug', 'accountEmail'].every(k => typeof config.project[k] === 'string' && config.project[k])) throw Error('維護專案設定或身份無效');
  if (!Number.isFinite(config.snapshotMaxAgeMinutes) || config.snapshotMaxAgeMinutes <= 0) throw Error('快照有效期限無效');
  for (const metric of ['deploymentStorage', 'functionsStorage']) if (!Number.isSafeInteger(config.quotaBytes?.[metric]) || config.quotaBytes[metric] <= 0) throw Error('用量額度設定無效');
  return config;
}

export function identityIssues(snapshot, config) {
  validateConfig(config);
  const issues = [];
  for (const [key, expected] of Object.entries(config.project)) if (snapshot.identity?.[key] !== expected) issues.push('身份不符：' + key);
  for (const [key, expected] of [['id', config.project.id], ['name', config.project.name], ['teamId', config.project.teamId]]) if (snapshot.project?.[key] !== expected) issues.push('專案快照身份不符：' + key);
  if (snapshot.version !== 1 || !validTime(snapshot.collectedAt)) issues.push('快照格式或時間無效');
  if (snapshot.collectionFailed || snapshot.errors?.length) issues.push('取資料流程未完整完成');
  return issues;
}

function seriesIssues(points) {
  if (!Array.isArray(points) || !points.length) return ['沒有可用日點'];
  const seen = new Set();
  for (const point of points) {
    if (!validTime(point.date) || !Number.isSafeInteger(point.totalBytes) || point.totalBytes < 0 || !Array.isArray(point.projects)) return ['日點格式或位元組數無效'];
    if (seen.has(point.date)) return ['日點重複']; seen.add(point.date);
    const projects = new Set();
    for (const project of point.projects) {
      if (typeof project.name !== 'string' || projects.has(project.name) || !Number.isSafeInteger(project.bytes) || project.bytes < 0) return ['專案日點格式或名稱無效'];
      projects.add(project.name);
    }
    if (point.projects.reduce((sum, project) => sum + project.bytes, 0) !== point.totalBytes) return ['團隊日點與專案加總不符'];
  }
  return [];
}

export function evaluateMetric(metric, config, metricName, {now = new Date(), hasRetainedReady = true} = {}) {
  const quotaBytes = config.quotaBytes[metricName];
  const base = {status: 'unknown', quotaBytes, recoveryConfirmed: false, currentPoint: null, latestCoherentCompletedDay: null, reasons: [], source: {readAt: metric?.readAt ?? null, uiPeriod: metric?.uiPeriod ?? null, uiUpdated: metric?.uiUpdated ?? null, ingestedAt: metric?.ingestedAt ?? null, browserTimeZone: metric?.browserTimeZone ?? null}};
  if (!metric || metric.error) return {...base, reasons: [metric?.error ?? '沒有用量快照']};
  if (metric.unit !== 'bytes' || metric.aggregation !== 'daily-maximum') return {...base, reasons: ['指標定義或單位無法比較']};
  const invalid = seriesIssues(metric.points);
  if (invalid.length) return {...base, reasons: invalid};
  const today = new Date(now).toISOString().slice(0, 10);
  const points = [...metric.points].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  base.source.chartPeriod = {first: points[0].date, last: points.at(-1).date, unit: metric.unit, aggregation: metric.aggregation};
  const coherent = point => {
    const own = point.projects.find(project => project.name === config.project.name);
    if (!own) return false;
    // A retained READY course website cannot be certified empty from a zero placeholder.
    return !hasRetainedReady || own.bytes > 0;
  };
  const completed = points.filter(point => point.date.slice(0, 10) < today && coherent(point));
  const describe = point => ({date: point.date, totalBytes: point.totalBytes, projectBytes: point.projects.find(p => p.name === config.project.name)?.bytes ?? null, ratio: point.totalBytes / quotaBytes, nonzeroProjects: point.projects.filter(p => p.bytes > 0).length, projectCount: point.projects.length});
  base.latestCoherentCompletedDay = completed.length ? describe(completed.at(-1)) : null;
  const latest = points.at(-1); base.currentPoint = describe(latest);
  if (latest.date.slice(0, 10) > today) return {...base, reasons: ['日點位於未來']};
  if (!coherent(latest)) return {...base, reasons: ['資訊課專案新日缺漏或0B占位，不認定清空／恢復']};
  if (latest.date.slice(0, 10) < today) return {...base, reasons: ['只有歷史日點，無法判定當下額度狀態']};
  if (latest.totalBytes >= quotaBytes) return {...base, status: 'exceeded', reasons: ['最新可讀日點已達額度；不是精確即時實體存量']};
  return {...base, status: 'provisional-within-limit', reasons: ['今日仍未結束，只能描述當日觀測值，未確認清理降幅或恢復']};
}

export function dailyReport(snapshot, config, previousState = null, {now = new Date()} = {}) {
  const issues = identityIssues(snapshot, config);
  const age = Date.parse(now) - Date.parse(snapshot.collectedAt);
  if (Number.isFinite(age) && (age < -60_000 || age > config.snapshotMaxAgeMinutes * 60_000)) issues.push('快照過期或時間超前');
  const metrics = {};
  for (const metric of ['deploymentStorage', 'functionsStorage']) metrics[metric] = evaluateMetric(snapshot.usage?.[metric], config, metric, {now, hasRetainedReady: snapshot.coverage?.deploymentsComplete === true && Array.isArray(snapshot.deployments) ? snapshot.deployments.some(d => d.readyState === 'READY') : true});
  const status = issues.length ? 'blocked' : metrics.deploymentStorage.status;
  const stateKey = fingerprint({project: config.project, status, issues, reasons: metrics.deploymentStorage.reasons});
  const changed = !previousState || previousState.projectId !== config.project.id || previousState.stateKey !== stateKey;
  const deploymentCount = Array.isArray(snapshot.deployments) ? snapshot.deployments.length : null;
  return {
    version: 1, reportType: 'daily-read-only', generatedAt: new Date(now).toISOString(), collectedAt: snapshot.collectedAt,
    project: config.project, status, issues, metrics, deploymentCount,
    deploymentCountDelta: Number.isSafeInteger(previousState?.deploymentCount) && Number.isSafeInteger(deploymentCount) ? deploymentCount - previousState.deploymentCount : null,
    notification: {recommended: changed && ['blocked', 'unknown', 'exceeded'].includes(status), reason: changed ? '首次或狀態改變的通知建議' : '相同狀態不重複建議通知', sent: false},
    nextState: {version: 1, projectId: config.project.id, stateKey, status, deploymentCount, emittedAt: new Date(now).toISOString()},
    actions: {cloudWrites: false, deletions: false, deployment: false, notificationSent: false},
    limitations: ['每日最高GB日點不等於GB-month期間計費量或精確即時存量。', '本工具只產生通知建議，不寄信、不發訊息；本機狀態僅對已輸出的報告去重。'],
  };
}

export function validateRegistry(registry, config) {
  if (registry?.version !== 1 || registry.projectId !== config.project.id || !Array.isArray(registry.entries)) throw Error('保留／任務登記表無效或專案不符');
  const ids = new Set();
  for (const entry of registry.entries) {
    if (!idPattern.test(entry.id) || ids.has(entry.id) || !['protected', 'active', 'completed', 'unknown'].includes(entry.status) || typeof entry.reason !== 'string' || !entry.reason || typeof entry.evidence !== 'string' || !entry.evidence) throw Error('保留／任務登記項目無效');
    ids.add(entry.id);
    if (entry.reviewAfter !== undefined && entry.reviewAfter !== null && !validTime(entry.reviewAfter)) throw Error('複查日期無效');
    if (entry.productionHistoryReviewed !== undefined && typeof entry.productionHistoryReviewed !== 'boolean') throw Error('正式歷史用途審閱狀態無效');
  }
  return registry;
}

export function weeklyReport(snapshot, config, registry, {now = new Date()} = {}) {
  const issues = identityIssues(snapshot, config);
  validateRegistry(registry, config);
  const age = Date.parse(now) - Date.parse(snapshot.collectedAt);
  if (!Number.isFinite(age) || age < -60_000 || age > config.snapshotMaxAgeMinutes * 60_000) issues.push('快照過期或時間超前');
  for (const field of ['deploymentsComplete', 'aliasesComplete', 'domainsComplete']) if (snapshot.coverage?.[field] !== true) issues.push('盤點資料不完整：' + field);
  for (const field of ['productionUnchanged', 'aliasesUnchanged', 'inventoryUnchanged', 'domainsUnchanged']) if (snapshot.verification?.[field] !== true) issues.push('查核期間狀態不一致：' + field);
  const deployments = Array.isArray(snapshot.deployments) ? snapshot.deployments : [];
  const ids = new Set();
  for (const deployment of deployments) {
    if (!idPattern.test(deployment.id) || ids.has(deployment.id) || deployment.projectId !== config.project.id || !Number.isFinite(deployment.createdAt)) issues.push('部署身份、日期或重複項目無效');
    ids.add(deployment.id);
  }
  const productionId = snapshot.project?.productionId;
  if (!idPattern.test(productionId) || !ids.has(productionId)) issues.push('目前正式版本未包含在完整清單');
  const aliases = Array.isArray(snapshot.aliases) ? snapshot.aliases : [];
  const aliasNames = new Set(), aliasIds = new Set();
  for (const alias of aliases) {
    if (!alias.name || aliasNames.has(alias.name) || alias.projectId !== config.project.id || !ids.has(alias.deploymentId)) issues.push('別名身份或部署對應無法核對');
    aliasNames.add(alias.name); aliasIds.add(alias.deploymentId);
  }
  for (const domain of snapshot.domains ?? []) if (domain.projectId !== config.project.id || !domain.name || !domain.redirect && !aliasNames.has(domain.name)) issues.push('專案網域尚未在完整別名對應中核對：' + domain.name);
  if (!aliases.some(alias => alias.deploymentId === productionId)) issues.push('無法核對正式版本的別名');
  const registrations = new Map(registry.entries.map(entry => [entry.id, entry]));
  const retained = [], candidates = [];
  for (const deployment of deployments) {
    const reasons = [], record = registrations.get(deployment.id);
    if (issues.length) reasons.push('快照／身份未通過，禁止產生清理候選');
    if (deployment.id === productionId) reasons.push('目前正式版本');
    if (aliasIds.has(deployment.id)) reasons.push('別名仍指向此版本');
    if (deployment.isRollbackCandidate === true) reasons.push('平台標記回復候選，須先核對回復用途');
    if (deployment.isRollbackCandidate !== true && deployment.isRollbackCandidate !== false) reasons.push('平台回復保護狀態未知');
    if (deployment.target === 'production' && !(record?.status === 'completed' && record.productionHistoryReviewed === true)) reasons.push('正式發布歷史，回復用途尚未明確審閱');
    if (!['READY', 'ERROR', 'CANCELED'].includes(deployment.readyState)) reasons.push('部署狀態尚在進行或未知');
    if (!record || record.status === 'unknown') reasons.push('用途未明，沒有任務已結束的正面證據');
    if (record && ['active', 'protected'].includes(record.status)) reasons.push('登記保留：' + record.reason);
    if (record?.status === 'completed' && record.reviewAfter && Date.parse(record.reviewAfter) > Date.parse(now)) reasons.push('指定複查時間尚未到達');
    const item = {
      id: deployment.id, url: deployment.url, createdAt: deployment.createdAt, target: deployment.target, readyState: deployment.readyState, branch: deployment.branch,
      reasons, registration: record ?? null,
      reviewNeeded: !record || record.status === 'unknown' || !record.reviewAfter || Date.parse(record.reviewAfter) <= Date.parse(now),
    };
    if (reasons.length) retained.push(item);
    else candidates.push({...item, reasons: ['任務已有結束證據；無別名、非正式／回復／活躍保護版本'], evidence: record.evidence});
  }
  const missingRegistered = registry.entries.filter(entry => ['active', 'protected'].includes(entry.status) && !ids.has(entry.id));
  if (missingRegistered.length) {
    issues.push('既有明確保留版本不在盤點清單，需人工核對');
    retained.push(...candidates.splice(0).map(item => ({...item, reasons: ['既有保留版本缺漏，候選全部撤回']})));
  }
  const batch = {
    project: config.project, productionId,
    aliasMap: aliases.map(alias => [alias.name, alias.deploymentId]).sort((a, b) => a[0].localeCompare(b[0])),
    domains: [...(snapshot.domains ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    registryHash: fingerprint(registry), candidateIds: candidates.map(item => item.id).sort(),
    inventoryHash: fingerprint([...deployments].sort((a, b) => a.id.localeCompare(b.id))),
  };
  return {
    version: 1, reportType: 'weekly-inventory-only', generatedAt: new Date(now).toISOString(), collectedAt: snapshot.collectedAt,
    project: config.project, status: issues.length ? 'blocked' : 'review-only', issues,
    productionId, deploymentCount: deployments.length, retained, candidates, missingRegistered,
    batch: {...batch, fingerprint: fingerprint(batch), expiresAt: validTime(snapshot.collectedAt) ? new Date(Date.parse(snapshot.collectedAt) + config.snapshotMaxAgeMinutes * 60_000).toISOString() : null},
    deletionAuthorized: false, actions: {cloudWrites: false, deletions: false, deployment: false},
    limitations: ['候選只是人工審閱資料，不是刪除授權。', '沒有逐部署帳務可回收量，不以檔案大小乘部署數估算節省GB。', '沒有任務結束證據的版本保留；登記到期只觸發複查。'],
  };
}

export function assertBatchStillCurrent(previous, current, {now = new Date()} = {}) {
  if (previous.status !== 'review-only' || current.status !== 'review-only' || !validTime(previous.batch.expiresAt) || Date.parse(previous.batch.expiresAt) <= Date.parse(now) || previous.batch.fingerprint !== current.batch.fingerprint) throw Error('候選過期或正式／別名／保留／部署集合已變，需重新盤點');
  return true;
}
