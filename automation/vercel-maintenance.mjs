// Local reporting only. There is deliberately no delete/deploy/scheduler command.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateConfig, dailyReport, weeklyReport} from './lib/vercel-maintenance.mjs';

const bytes = value => value === null || value === undefined ? '未知' : value >= 1e9 ? `${(value / 1e9).toFixed(3)} GB` : `${(value / 1e6).toFixed(2)} MB`;
const cell = value => String(value ?? '').replaceAll('|', '\\|').replace(/[\r\n]/g, ' ');
const date = value => new Intl.DateTimeFormat('zh-TW', {timeZone: 'Asia/Taipei', dateStyle: 'short', timeStyle: 'short', hour12: false}).format(new Date(value));
const status = {'blocked': '查核受阻', 'unknown': '未知／尚不能判定恢復', 'exceeded': '最新日點已達額度', 'provisional-within-limit': '今日暫時觀測在額度內，尚未確認恢復'};

export function dailyMarkdown(report) {
  let text = '# 每日唯讀用量檢查\n\n' + `查核時間：${date(report.generatedAt)}（臺灣時間）；專案：${report.project.name}。\n\n`;
  text += `**目前判讀：${status[report.status]}。** 不以0B占位、歷史最高量或部分新日資料宣稱清空或精確清理降幅。\n\n`;
  text += '| 指標 | 最新日點（UTC） | 最新團隊量 | 本專案量 | 最近已結束日的合理觀測 | 判讀 |\n| --- | --- | --- | --- | --- | --- |\n';
  for (const [key, title] of [['deploymentStorage', '部署儲存'], ['functionsStorage', '函式儲存']]) {
    const metric = report.metrics[key], point = metric.currentPoint, old = metric.latestCoherentCompletedDay;
    text += `| ${title} | ${cell(point?.date ?? '無')} | ${bytes(point?.totalBytes)} | ${bytes(point?.projectBytes)} | ${old ? `${old.date.slice(0, 10)}：團隊${bytes(old.totalBytes)}，本專案${bytes(old.projectBytes)}` : '無'} | ${cell(metric.reasons.join('；'))} |\n`;
  }
  for (const [key, title] of [['deploymentStorage', '部署儲存'], ['functionsStorage', '函式儲存']]) {
    const source = report.metrics[key].source;
    text += `\n${title}來源期間：${cell(source.uiPeriod ?? '未提供')}；圖表UTC日點範圍：${source.chartPeriod ? source.chartPeriod.first + '至' + source.chartPeriod.last : '未知'}。\n\n`;
    text += `取數：${cell(source.readAt ?? report.collectedAt)}；介面更新文字：${cell(source.uiUpdated ?? '未提供')}；獨立入庫時間：${cell(source.ingestedAt ?? '未提供，不能以Updated just now代替')}。\n\n`;
  }
  text += `\n部署清單數：${report.deploymentCount ?? '未知'}。\n\n通知建議：${report.notification.recommended ? '本次應提醒' : '本次不建議重複提醒'}；${report.notification.reason}。尚未寄信或發送任何訊息。\n\n`;
  if (report.issues.length) text += '查核問題：' + report.issues.map(cell).join('；') + '。\n\n';
  return text + report.limitations.map(note => '- ' + note).join('\n') + '\n';
}

export function inventoryMarkdown(report, kind) {
  const candidates = kind === 'candidates', rows = candidates ? report.candidates : report.retained;
  let text = `# ${candidates ? '舊部署清理候選' : '部署保留清單'}\n\n`;
  text += `盤點時間：${date(report.generatedAt)}（臺灣時間）；專案：${report.project.name}。\n\n`;
  text += `部署總數${report.deploymentCount}；保留${report.retained.length}；清理候選${report.candidates.length}。目前正式：\`${report.productionId ?? '未知'}\`。\n\n`;
  text += '**本清單沒有刪除授權，不會執行刪除。用途未明、回復狀態未明或關鍵資料無法核對時保留。**\n\n';
  if (report.issues.length) text += '盤點受阻：' + report.issues.map(cell).join('；') + '。\n\n';
  if (!rows.length) text += candidates ? '沒有符合正面結束證據及全部安全條件的清理候選，不為了產生清單而猜測可刪。\n\n' : '沒有可列出的部署，不能據此認定已清空。\n\n';
  else {
    text += '| 版本 | 建立時間（臺灣） | 類型／狀態 | 理由 | 需複查 |\n| --- | --- | --- | --- | --- |\n';
    for (const row of rows) {
      const link = row.url && /^[a-zA-Z0-9.-]+$/.test(row.url) ? `[${row.id.slice(0, 16)}…](https://${row.url})` : cell(row.id);
      text += `| ${link} | ${Number.isFinite(row.createdAt) ? date(row.createdAt) : '未知'} | ${row.target === 'production' ? '正式歷史' : '預覽'}／${cell(row.readyState)} | ${cell(row.reasons.join('；'))} | ${row.reviewNeeded ? '是' : '否'} |\n`;
    }
    text += '\n完整ID與登記證據保留於weekly.json，不以短ID執行任何操作。\n\n';
  }
  if (report.missingRegistered.length) text += `先前登記保留但本次未見：${report.missingRegistered.map(row => '`' + row.id + '`').join('、')}，需人工核對。\n\n`;
  text += `批次指紋：\`${report.batch.fingerprint}\`。\n\n快照有效至${report.batch.expiresAt ? date(report.batch.expiresAt) : '未知，必須重新取數'}；到期需重讀，不代表可自動刪除。\n\n`;
  return text + report.limitations.map(note => '- ' + note).join('\n') + '\n';
}

export async function runMaintenance({mode = 'report', snapshotFile, configFile, registryFile, output, stateFile}) {
  if (!['daily', 'weekly', 'report'].includes(mode) || !snapshotFile || !output) throw Error('需要 daily／weekly／report、--snapshot 與新的 --out 目錄');
  configFile ??= fileURLToPath(new URL('./vercel-maintenance-project.json', import.meta.url));
  const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
  const config = validateConfig(await read(configFile)), snapshot = await read(snapshotFile);
  if (mode !== 'daily') registryFile ??= path.resolve(path.dirname(configFile), config.registryFile);
  let previous = null, stateWarning = null;
  if (stateFile) {
    try {
      previous = await read(stateFile);
      if (previous.projectId !== config.project.id) throw Error('狀態檔屬於不同專案，禁止覆寫');
      if (previous.version !== 1 || typeof previous.stateKey !== 'string') { previous = null; stateWarning = '狀態格式損毀，按首次檢查判讀'; }
    } catch (error) {
      if (error.code === 'ENOENT') stateWarning = '首次檢查，尚無去重狀態';
      else if (error instanceof SyntaxError) stateWarning = '狀態JSON損毀，按首次檢查判讀';
      else throw error;
    }
  }
  const daily = mode !== 'weekly' ? dailyReport(snapshot, config, previous) : null;
  if (daily) daily.stateReadWarning = stateWarning;
  const weekly = mode !== 'daily' ? weeklyReport(snapshot, config, await read(registryFile)) : null;
  await fs.mkdir(output); // Existing output is never overwritten.
  if (daily) {
    await fs.writeFile(path.join(output, 'daily.json'), JSON.stringify(daily, null, 2) + '\n', {flag: 'wx'});
    await fs.writeFile(path.join(output, 'daily-usage.md'), dailyMarkdown(daily), {flag: 'wx'});
  }
  if (weekly) {
    await fs.writeFile(path.join(output, 'weekly.json'), JSON.stringify(weekly, null, 2) + '\n', {flag: 'wx'});
    await fs.writeFile(path.join(output, 'retained-deployments.md'), inventoryMarkdown(weekly, 'retained'), {flag: 'wx'});
    await fs.writeFile(path.join(output, 'cleanup-candidates.md'), inventoryMarkdown(weekly, 'candidates'), {flag: 'wx'});
  }
  if (daily && stateFile) {
    if (stateWarning && !stateWarning.includes('首次檢查，尚無')) await fs.copyFile(stateFile, stateFile + '.invalid-' + Date.now() + '.bak');
    const temporary = stateFile + '.' + process.pid + '.tmp';
    await fs.writeFile(temporary, JSON.stringify(daily.nextState, null, 2) + '\n', {flag: 'wx'});
    await fs.rename(temporary, stateFile);
  }
  const result = {output: path.resolve(output), dailyStatus: daily?.status, notificationRecommended: daily?.notification.recommended, weeklyStatus: weekly?.status, deploymentCount: weekly?.deploymentCount, retained: weekly?.retained.length, candidates: weekly?.candidates.length, deletionAuthorized: false, scheduled: false};
  await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [mode, ...args] = process.argv.slice(2), values = {};
    for (let i = 0; i < args.length; i += 2) {
      if (!['--snapshot', '--config', '--registry', '--out', '--state'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--') || values[args[i]]) throw Error('參數無效或重複；不支援任何刪除／部署／排程參數');
      values[args[i]] = args[i + 1];
    }
    console.log(JSON.stringify(await runMaintenance({mode, snapshotFile: values['--snapshot'], configFile: values['--config'], registryFile: values['--registry'], output: values['--out'], stateFile: values['--state']})));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
