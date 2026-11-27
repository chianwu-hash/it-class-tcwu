import {fingerprint, weeklyReport, validateRegistry} from './vercel-maintenance.mjs';

const DAY = 86_400_000;
export const TRIAL_POLICY = Object.freeze({recentHours: 24, productionDays: 7, previewDays: 3, unsuccessfulDays: 3, rollbackVersions: 2, dailyDays: 7});
export const taipeiDay = value => new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(value));

// A release receipt proves promotion and the file-tree gate, not classroom acceptance
// or database compatibility. Protect these versions even when that evidence is absent.
export function releaseEvidence(snapshot, history, now) {
  const deployments = new Map(snapshot.deployments.map(d => [d.id, d]));
  const seen = new Set(), receipts = [];
  for (const row of history.filter(r => Number.isFinite(Date.parse(r.promotedAt))).sort((a, b) => Date.parse(b.promotedAt) - Date.parse(a.promotedAt))) {
    const d = deployments.get(row.candidate);
    if (!d || d.readyState !== 'READY' || row.state !== 'promoted' || row.alias !== row.candidate || row.comparison?.ok !== true || row.mainAncestor !== true || !/^[a-f0-9]{40}$/.test(row.commit ?? '') || row.commit !== d.commitSha || !Number.isFinite(Date.parse(row.promotedAt)) || Date.parse(row.promotedAt) > Date.parse(now) || seen.has(row.candidate)) continue;
    seen.add(row.candidate);
    receipts.push({id: d.id, commit: row.commit, promotedAt: row.promotedAt, rollback: row.rollback, source: 'release-history.ndjson:promoted+comparison.ok+main-ancestor'});
  }
  return receipts;
}

export function trialInventory(snapshot, config, registry, history, {now = new Date()} = {}) {
  validateRegistry(registry, config);
  const time = Date.parse(now), production = snapshot.project?.productionId;
  const historyValid = snapshot.coverage?.releaseHistoryComplete === true;
  const receipts = releaseEvidence({...snapshot, deployments: snapshot.deployments ?? []}, history, now);
  const current = (snapshot.deployments ?? []).find(d => d.id === production);
  const rollback = [], distinct = new Set(current?.commitSha ? [current.commitSha] : []);
  for (const receipt of receipts) {
    if (receipt.id === production || distinct.has(receipt.commit)) continue;
    rollback.push(receipt); distinct.add(receipt.commit);
    if (rollback.length === TRIAL_POLICY.rollbackVersions) break;
  }
  const daily = new Map();
  for (const receipt of receipts) {
    const age = time - Date.parse(receipt.promotedAt);
    const date = taipeiDay(receipt.promotedAt);
    if (age >= 0 && age < TRIAL_POLICY.dailyDays * DAY && !daily.has(date)) daily.set(date, receipt);
  }
  const policy = new Map();
  const protect = (id, reason) => policy.set(id, [...(policy.get(id) ?? []), reason]);
  if (production) protect(production, '正式網址實際指向的目前版本');
  for (const r of rollback) protect(r.id, '最近兩個不同 commit 的已發布回復版本；功能驗收與資料庫相容性仍需人工確認');
  for (const [date, r] of daily) protect(r.id, `近七天每日最後發布版本：${date}（臺灣）`);
  for (const d of snapshot.deployments ?? []) {
    const age = time - d.createdAt;
    if (age < 0) protect(d.id, '部署日期位於未來，先保留');
    if (age < TRIAL_POLICY.recentHours * 3_600_000) protect(d.id, '最近24小時的部署');
    const days = ['ERROR', 'CANCELED'].includes(d.readyState) ? TRIAL_POLICY.unsuccessfulDays : d.target === 'production' ? TRIAL_POLICY.productionDays : TRIAL_POLICY.previewDays;
    if (age < days * DAY) protect(d.id, `尚未達${days}天的候選期限`);
    const receipt = receipts.find(r => r.id === production);
    if (receipt?.rollback === d.id) protect(d.id, '目前發布收據指定的直接回復基準');
  }
  // Reuse the existing explicit completion requirement. A previous promotion or
  // age alone never fabricates a completed task / reviewed production history.
  const effective = structuredClone(registry);
  for (const [id, reasons] of policy) {
    const existing = effective.entries.find(e => e.id === id);
    const entry = {id, status: 'protected', reason: reasons.join('；'), evidence: 'trial-policy-v1; ' + (receipts.find(r => r.id === id)?.source ?? 'live inventory')};
    if (existing) Object.assign(existing, entry, {reason: existing.reason + '；' + entry.reason});
    else effective.entries.push(entry);
  }
  const augmented = structuredClone(snapshot);
  const extraIssues = [];
  if (!historyValid) extraIssues.push('發布紀錄未完整讀取或無法驗證 main 來源');
  if (rollback.length < TRIAL_POLICY.rollbackVersions) extraIssues.push('不足兩個可核對的不同版本回復目標，撤回所有候選');
  if (snapshot.verification?.releaseIdle !== true) extraIssues.push('發布進行中或查核期間發布鎖／紀錄變動，撤回所有候選');
  if (snapshot.verification?.retentionUnchanged !== true) extraIssues.push('查核期間 Vercel 保留設定變動，撤回所有候選');
  if (extraIssues.length) { augmented.collectionFailed = true; augmented.errors = [...(augmented.errors ?? []), ...extraIssues]; }
  const result = weeklyReport(augmented, config, effective, {now});
  result.issues.push(...extraIssues);
  result.reportType = 'seven-day-cleanup-trial-read-only';
  result.policy = TRIAL_POLICY;
  result.rollbackVersions = rollback;
  result.dailyBaselines = [...daily].map(([date, receipt]) => ({date, ...receipt}));
  result.policyProtections = [...policy].map(([id, reasons]) => ({id, reasons}));
  result.acceptanceCaveat = '發布收據只證明曾上線及檔案樹檢查通過；沒有自動執行回復，也不保證與目前資料庫相容。';
  const kept = new Set(result.retained.map(d => d.id));
  result.protectionCheck = {currentProductionRetained: kept.has(production), rollbackTargetsRetained: rollback.length === 2 && rollback.every(r => kept.has(r.id)), policyProtectedNotCandidates: [...policy.keys()].every(id => !result.candidates.some(d => d.id === id))};
  if (production && !result.protectionCheck.currentProductionRetained || !result.protectionCheck.policyProtectedNotCandidates || rollback.some(r => !kept.has(r.id))) throw Error('保留條件驗證失敗，禁止輸出可用候選');
  result.registryHash = fingerprint(registry);
  return result;
}

export function trialSlot(config, now = new Date()) {
  const start = Date.parse(config.trial?.startDate + 'T00:00:00+08:00'), days = config.trial?.days;
  if (!Number.isFinite(start) || days !== 7) throw Error('試行必須指定開始日期與七個日曆日');
  const today = taipeiDay(now), index = Math.round((Date.parse(today + 'T00:00:00+08:00') - start) / DAY);
  return {date: today, day: index + 1, allowed: index >= 0 && index < days};
}
