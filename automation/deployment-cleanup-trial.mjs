// Seven-calendar-day GET-only trial. No apply, delete, deploy or retention writer exists.
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validateConfig, fingerprint} from './lib/vercel-maintenance.mjs';
import {trialInventory, trialSlot, taipeiDay} from './lib/deployment-cleanup-trial.mjs';
import {cliReader, collectInventory, localReleaseReader} from './lib/deployment-cleanup-collector.mjs';
import {inventoryMarkdown} from './vercel-maintenance.mjs';

const PINNED = {id: 'prj_eJ1qle57xyilS5MKy6ZS6OuYtyFb', name: 'it-class-tcwu', teamId: 'team_SOhQ0oysg6ZGV9vs3RryW2CB', teamSlug: 'chianwu-4755s-projects', accountEmail: 'chianwu@gmail.com'};
export function validateTrialConfig(config) {
  validateConfig(config);
  for (const [key, value] of Object.entries(PINNED)) if (config.project[key] !== value) throw Error('試行僅允許資訊課指定帳號與專案');
  for (const key of ['repo', 'outputRoot', 'registryFile', 'cliEntry', 'globalConfig']) if (typeof config[key] !== 'string' || !path.isAbsolute(config[key])) throw Error('本機設定需使用完整絕對路徑：' + key);
  const relative = path.relative(path.resolve(config.repo), path.resolve(config.outputRoot));
  if (!relative || !relative.startsWith('..') && !path.isAbsolute(relative)) throw Error('私有報告不可寫入公開網站 repo');
  trialSlot(config);
  return config;
}

export function trialMarkdown(report, slot, check) {
  const rows = [
    ['目前正式版本', report.productionId, report.protectionCheck.currentProductionRetained],
    ...report.rollbackVersions.map((r, i) => ['必要回復版本 ' + (i + 1), r.id, report.retained.some(d => d.id === r.id)]),
  ];
  let text = `# 資訊課舊部署清理試行：${slot.date}\n\n`;
  text += check ? '本次為立即驗證，不計入七天排程。\n\n' : `第 ${slot.day}／7 天；凌晨 03:00 排程，時區 Asia/Taipei。\n\n`;
  text += `**狀態：${report.status === 'blocked' ? '受阻，候選全部撤回' : '僅供審閱'}。沒有刪除、部署或變更 Vercel 保留設定。**\n\n`;
  text += `部署 ${report.deploymentCount} 筆；保留 ${report.retained.length} 筆；候選 ${report.candidates.length} 筆。\n\n`;
  text += '| 保護項目 | 部署 ID | 已排除候選 |\n| --- | --- | --- |\n' + rows.map(([name, id, ok]) => `| ${name} | \`${id ?? '未知'}\` | ${ok ? '是' : '無法確認'} |`).join('\n') + '\n\n';
  text += `${report.acceptanceCaveat}\n\n七天每日穩定版共 ${report.dailyBaselines.length} 筆；24小時寬限與保留規則取聯集。平台原生保留設定保持原狀，本報告不能阻止平台自行回收。\n\n`;
  if (report.issues.length) text += '需處理：\n\n' + [...new Set(report.issues)].map(i => '- ' + i).join('\n') + '\n\n';
  if (report.missingRegistered.length) text += `歷史保留登記已有 ${report.missingRegistered.length} 筆未出現在遠端清單；不擅自解除登記，候選全部撤回，完整 ID 見 inventory.json。\n\n`;
  if (report.archivedRegistrations?.length) text += `歷史封存登記 ${report.archivedRegistrations.length} 筆，已保存原用途及逐筆查核證據；本次沒有刪除遠端部署。\n\n`;
  if (report.knownUnavailableAliases?.length) text += `已查核但保持原狀的舊預覽網址 ${report.knownUnavailableAliases.length} 個，目標本輪兩次查詢404；不是忽略未知網址。\n\n`;
  return text + '[候選清單](cleanup-candidates.md) · [完整保留清單](retained-deployments.md) · [結構化證據](inventory.json)\n';
}

export async function runTrial({configFile, check = false, now, collector}) {
  const clock = () => now === undefined ? new Date() : new Date(now);
  const config = validateTrialConfig(JSON.parse(await fs.readFile(configFile, 'utf8')));
  const slot = trialSlot(config, clock());
  if (!check && !slot.allowed) return {status: 'outside-trial', date: slot.date, deletions: false};
  await fs.mkdir(config.outputRoot, {recursive: true});
  const statePath = path.join(config.outputRoot, 'trial-state.json'), lockPath = path.join(config.outputRoot, 'trial-run.lock');
  let handle;
  try { handle = await fs.open(lockPath, 'wx'); } catch (e) { if (e.code === 'EEXIST') return {status: 'already-running', deletions: false}; throw e; }
  try {
    let state = {version: 1, projectId: config.project.id, startDate: config.trial.startDate, completedDates: []};
    try { state = JSON.parse(await fs.readFile(statePath, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (state.version !== 1 || state.projectId !== config.project.id || state.startDate !== config.trial.startDate || !Array.isArray(state.completedDates)) throw Error('試行狀態不符，禁止自動重設');
    if (!check && state.completedDates.some(r => r.date === slot.date)) return {status: 'already-recorded', date: slot.date, deletions: false};
    if (!check && state.completedDates.length >= 7) return {status: 'trial-complete', deletions: false};
    const name = check ? 'check-' + clock().toISOString().replace(/[:.]/g, '-') : slot.date;
    const output = path.join(config.outputRoot, name);
    await fs.mkdir(output);
    try {
      const registry = JSON.parse(await fs.readFile(config.registryFile, 'utf8'));
      if (!collector) {
        execFileSync('git', ['fetch', '--quiet', 'origin', 'main'], {cwd: config.repo, windowsHide: true, timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe']});
        const get = cliReader({cliEntry: config.cliEntry, globalConfig: config.globalConfig, cwd: config.repo, project: config.project});
        collector = () => collectInventory({get, project: config.project, readLocal: localReleaseReader(config.repo)});
      }
      const {snapshot, history} = await collector();
      await fs.writeFile(path.join(output, 'snapshot.private.json'), JSON.stringify(snapshot, null, 2) + '\n', {flag: 'wx'});
      const report = trialInventory(snapshot, config, registry, history, {now: clock()});
      report.trial = {date: slot.date, day: check ? null : slot.day, check, window: config.trial, writesAllowed: false};
      report.sourceHash = fingerprint(await Promise.all(['deployment-cleanup-trial.mjs', 'lib/deployment-cleanup-trial.mjs', 'lib/deployment-cleanup-collector.mjs', 'lib/vercel-maintenance.mjs'].map(f => fs.readFile(new URL(f, import.meta.url), 'utf8'))));
      await fs.writeFile(path.join(output, 'inventory.json'), JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
      await fs.writeFile(path.join(output, 'summary.md'), trialMarkdown(report, slot, check), {flag: 'wx'});
      await fs.writeFile(path.join(output, 'cleanup-candidates.md'), inventoryMarkdown(report, 'candidates'), {flag: 'wx'});
      await fs.writeFile(path.join(output, 'retained-deployments.md'), inventoryMarkdown(report, 'retained'), {flag: 'wx'});
      const result = {status: report.status, date: slot.date, day: check ? null : slot.day, output, productionId: report.productionId, rollbackIds: report.rollbackVersions.map(r => r.id), deploymentCount: report.deploymentCount, retained: report.retained.length, candidates: report.candidates.length, missingRegistered: report.missingRegistered.length, archivedRegistrations: report.archivedRegistrations?.length ?? 0, knownUnavailableAliases: report.knownUnavailableAliases?.length ?? 0, protectionCheck: report.protectionCheck, deletions: false, retentionChanged: false};
      await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
      if (!check) {
        state.completedDates.push({date: slot.date, status: report.status, output});
        const temp = statePath + '.' + process.pid + '.tmp';
        await fs.writeFile(temp, JSON.stringify(state, null, 2) + '\n', {flag: 'wx'}); await fs.rename(temp, statePath);
      }
      return result;
    } catch (error) {
      await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify({status: 'failed', date: slot.date, error: error.stdout !== undefined ? '本機唯讀命令失敗，請查核連線及授權' : error.message, candidates: [], deletions: false}, null, 2) + '\n', {flag: 'wx'});
      throw error;
    }
  } finally { await handle.close(); await fs.unlink(lockPath); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2); let configFile, check = false;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--config' && !configFile && args[i + 1] && !args[i + 1].startsWith('--')) configFile = args[++i];
      else if (args[i] === '--check' && !check) check = true;
      else throw Error('僅接受 --config 與 --check；不提供刪除、套用或設定變更參數');
    }
    if (!configFile) throw Error('缺少 --config 本機試行設定');
    console.log(JSON.stringify(await runTrial({configFile, check})));
  } catch (error) { console.error(error.stdout !== undefined ? '唯讀查詢失敗，未執行任何遠端寫入' : error.message); process.exitCode = 1; }
}
