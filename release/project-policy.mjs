import fs from 'node:fs/promises';
import path from 'node:path';
export const POLICY_PATH = 'release/project-policy.json';
export const WARNING_BYTES = 20_000_000;
export const DEFAULT_POLICY = Object.freeze({version: 1, warningThresholdBytes: WARNING_BYTES, exclusions: [], legacyIgnorePatterns: [], purposes: {}});
export const GATE_FILES = ['release/garden-preflight.mjs', 'release/garden-catalog.mjs', 'release/textbook-policy.mjs', 'release/project-policy.mjs'];

export function normalizePath(file) {
  if (typeof file !== 'string' || !file || /[\0\r\n:]/.test(file)) throw Error('發布檔案路徑無效');
  let value = file;
  for (let i = 0; i < 3; i++) {
    let decoded; try { decoded = decodeURIComponent(value); } catch { break; }
    if (decoded === value) break;
    value = decoded;
  }
  value = value.normalize('NFC').replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '');
  if (!value || value.startsWith('/') || /[\0\r\n:]/.test(value) || value.split('/').some(p => !p || p === '..' || p === '.')) throw Error('發布路徑不可含有絕對路徑或 ..');
  return value;
}
export function validatePolicy(input) {
  const allowed = ['version', 'project', 'warningThresholdBytes', 'exclusions', 'legacyIgnorePatterns', 'purposes'];
  if (!input || Array.isArray(input) || input.version !== 1 || Object.keys(input).some(k => !allowed.includes(k))) throw Error('專案發布設定格式無效或含未知欄位');
  const policy = {...DEFAULT_POLICY, ...input};
  if (!Number.isSafeInteger(policy.warningThresholdBytes) || policy.warningThresholdBytes <= 0) throw Error('大檔警示門檻無效');
  if (!Array.isArray(policy.exclusions)) throw Error('exclusions 必須是陣列');
  const seen = new Set();
  policy.exclusions = policy.exclusions.map(rule => {
    if (!rule || !['file', 'directory'].includes(rule.kind) || typeof rule.reason !== 'string' || !rule.reason.trim()) throw Error('排除規則需要 path、kind 與 reason');
    const file = normalizePath(rule.path);
    if (Object.keys(rule).some(k => !['path', 'kind', 'reason', 'cliIgnorePatterns'].includes(k))) throw Error('排除規則含未知欄位');
    if (rule.cliIgnorePatterns !== undefined && (!Array.isArray(rule.cliIgnorePatterns) || rule.cliIgnorePatterns.some(p => typeof p !== 'string' || !p || /[\0\r\n]/.test(p)))) throw Error('規則 ignore patterns 格式無效');
    if (seen.has(file.toLowerCase())) throw Error('專案排除規則重複：' + file);
    seen.add(file.toLowerCase()); return {...rule, path: file};
  });
  if (!Array.isArray(policy.legacyIgnorePatterns) || policy.legacyIgnorePatterns.some(p => typeof p !== 'string' || !p || /[\0\r\n]/.test(p))) throw Error('legacyIgnorePatterns 格式無效');
  if (!policy.purposes || Array.isArray(policy.purposes) || typeof policy.purposes !== 'object') throw Error('purposes 格式無效');
  for (const [file, purpose] of Object.entries(policy.purposes)) if (normalizePath(file) !== file || typeof purpose !== 'string' || !purpose.trim()) throw Error('大檔用途註記無效');
  if (policy.project !== undefined && (!policy.project || typeof policy.project !== 'object' || Array.isArray(policy.project) || !policy.project.name && !policy.project.id || Object.keys(policy.project).some(k => !['name', 'id', 'teamId', 'teamSlug'].includes(k)) || Object.values(policy.project).some(v => typeof v !== 'string' || !v))) throw Error('專案身份設定無效');
  return policy;
}
export async function loadProjectPolicy(root, policyFile) {
  const file = policyFile ? path.resolve(policyFile) : path.join(root, POLICY_PATH);
  try { return validatePolicy(JSON.parse(await fs.readFile(file, 'utf8'))); }
  catch (error) {
    if (error.code === 'ENOENT' && !policyFile) return {...DEFAULT_POLICY};
    throw Error('專案發布設定無法讀取：' + error.message);
  }
}
export function isExcluded(file, policy = DEFAULT_POLICY) {
  const name = normalizePath(file).toLowerCase();
  return policy.exclusions.some(rule => { const prefix = rule.path.toLowerCase(); return name === prefix || rule.kind === 'directory' && name.startsWith(prefix + '/'); });
}
export function filterReleaseFiles(files, policy = DEFAULT_POLICY) {
  if (!Array.isArray(files)) throw Error('發布清單必須包含 files 陣列');
  const retained = [], excluded = [];
  for (const entry of files) (isExcluded(entry.file, policy) ? excluded : retained).push(entry);
  return {files: retained, excluded: excluded.map(entry => entry.file)};
}
export function assertPolicyTarget(payload, policy) {
  const project = policy.project; if (!project) return;
  for (const value of [payload.project, payload.projectId, payload.name].filter(v => v !== undefined)) if (![project.id, project.name].includes(value)) throw Error('發布清單的專案身份不符');
  if (payload.teamId !== undefined && payload.teamId !== project.teamId) throw Error('發布清單的團隊身份不符');
}
export async function checkExcludedSources(root, policy) {
  policy ??= await loadProjectPolicy(root);
  const excluded = [];
  async function walk(relative = '') {
    for (const entry of await fs.readdir(path.join(root, relative), {withFileTypes: true})) {
      if (['.git', 'node_modules', '.vercel'].includes(entry.name)) continue;
      const file = relative ? relative + '/' + entry.name : entry.name;
      if (isExcluded(file, policy)) { excluded.push(file); continue; }
      if (entry.isSymbolicLink()) throw Error('發布包不可含符號連結：' + file);
      if (entry.isDirectory()) await walk(file);
    }
  }
  await walk();
  if (excluded.length) throw Error('發布包含專案設定的排除來源，發布已阻擋：' + excluded.join(', '));
  return {passed: true, excludedCount: 0};
}
export function renderProjectIgnore(original, policy) {
  const start = '# BEGIN project release exclusions', end = '# END project release exclusions';
  if (original.includes(start) !== original.includes(end)) throw Error('受管理的 ignore 區塊不完整');
  const base = original.replace(/# BEGIN project release exclusions\r?\n[\s\S]*?# END project release exclusions\r?\n?/g, '')
    .split(/\r?\n/).filter(line => !policy.legacyIgnorePatterns.includes(line.trim())).join('\n').trimEnd();
  const rules = [...new Set([...policy.exclusions.map(r => r.path + (r.kind === 'directory' ? '/' : '')), ...policy.exclusions.flatMap(r => r.cliIgnorePatterns ?? [])])];
  return base + '\n\n' + start + '\n' + rules.join('\n') + '\n' + end + '\n';
}
