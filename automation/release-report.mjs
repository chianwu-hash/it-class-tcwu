// Read-only: inspects an explicit CLI/API upload manifest, never deploys or edits a release.
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {normalizePath, loadProjectPolicy, validatePolicy, isExcluded, assertPolicyTarget} from '../release/project-policy.mjs';

export function manifestEntries(manifest) {
  if (Array.isArray(manifest) && manifest.some(node => node.name === 'src')) {
    const files = [];
    const walk = (nodes, prefix = '') => {
      for (const node of nodes) {
        const name = normalizePath(node.name);
        if (name.includes('/')) throw Error('來源清單節點名稱無效');
        const file = prefix + name;
        if (node.type === 'directory') walk(node.children ?? [], file + '/');
        else if (node.type === 'file') files.push({file, sha: node.uid, size: node.size});
        else throw Error('來源清單含不支援的節點：' + file);
      }
    };
    walk(manifest.find(node => node.name === 'src').children ?? []);
    return files;
  }
  const files = Array.isArray(manifest) ? manifest : manifest?.files;
  if (!Array.isArray(files)) throw Error('請提供明確的 files 發布清單或 Vercel src 檔案樹');
  return files.filter(entry => entry.type !== 'directory').map(entry => ({...entry, file: entry.file ?? entry.path, sha: entry.sha ?? entry.sha1}));
}

async function localFile(root, file) {
  let current = await fs.realpath(root);
  // Check each component; junctions must not redirect reads outside the release.
  if ((await fs.lstat(root)).isSymbolicLink()) throw Error('發布來源根目錄不可為連結');
  for (const part of file.split('/')) {
    current = path.join(current, part);
    if ((await fs.lstat(current)).isSymbolicLink()) throw Error('發布來源不可含連結：' + file);
  }
  if (!(await fs.stat(current)).isFile()) throw Error('發布項目不是檔案：' + file);
  const hash = createHash('sha1'); let sizeBytes = 0;
  for await (const bytes of createReadStream(current)) { sizeBytes += bytes.length; hash.update(bytes); }
  return {sha: hash.digest('hex'), sizeBytes};
}

export async function inspectManifest(manifest, root, {baseline = false} = {}) {
  const seen = new Set(), files = [];
  for (const entry of manifestEntries(manifest)) {
    const file = normalizePath(entry.file), identity = file.toLowerCase();
    if (seen.has(identity)) throw Error('發布清單路徑重複：' + file);
    seen.add(identity);
    if (entry.sha !== undefined && !/^[a-f0-9]{40}$/i.test(entry.sha)) throw Error('SHA-1 無效：' + file);
    let actual;
    if (entry.data !== undefined) {
      if (typeof entry.data !== 'string' || entry.encoding !== undefined && !['base64', 'utf8', 'utf-8'].includes(entry.encoding)) throw Error('內嵌檔案編碼無效：' + file);
      const bytes = Buffer.from(entry.data, entry.encoding === 'base64' ? 'base64' : 'utf8');
      actual = {sha: createHash('sha1').update(bytes).digest('hex'), sizeBytes: bytes.length};
    } else if (root) actual = await localFile(root, file);
    else if (baseline && entry.sha) actual = {sha: entry.sha.toLowerCase(), sizeBytes: Number.isSafeInteger(entry.size) && entry.size >= 0 ? entry.size : null};
    else throw Error('無法核對發布檔案大小與內容，請提供 --root 或內嵌 data：' + file);
    if (entry.sha && entry.sha.toLowerCase() !== actual.sha) throw Error('發布清單與實際檔案 SHA 不符：' + file);
    if (entry.size !== undefined && entry.size !== actual.sizeBytes) throw Error('發布清單與實際檔案大小不符：' + file);
    files.push({file, ...actual});
  }
  if (!files.length) throw Error('發布清單不可為空');
  return files;
}

export async function createReleaseReport({manifest, root, policyFile, policy, baseline, baselineRoot} = {}) {
  if (!manifest) throw Error('需要明確的實際發布清單；不會自行掃描工作目錄猜測上傳內容');
  policy = validatePolicy(policy ?? await loadProjectPolicy(root ?? process.cwd(), policyFile));
  assertPolicyTarget(manifest, policy);
  const files = await inspectManifest(manifest, root);
  const excluded = files.filter(entry => isExcluded(entry.file, policy));
  if (excluded.length) throw Error('實際發布清單包含專案明確排除項目：' + excluded.map(entry => entry.file).join(', '));
  if (baseline) assertPolicyTarget(baseline, policy);
  const old = baseline ? await inspectManifest(baseline, baselineRoot, {baseline: true}) : null;
  const oldMap = new Map(old?.map(entry => [entry.file, entry]) ?? []), nextMap = new Map(files.map(entry => [entry.file, entry]));
  const changes = {added: [], removed: [], changed: [], unchanged: []};
  if (old) {
    for (const entry of files) {
      const before = oldMap.get(entry.file);
      changes[!before ? 'added' : before.sha !== entry.sha ? 'changed' : 'unchanged'].push(entry.file);
    }
    for (const entry of old) if (!nextMap.has(entry.file)) changes.removed.push(entry.file);
  }
  const sum = entries => entries.some(entry => entry.sizeBytes === null) ? null : entries.reduce((total, entry) => total + entry.sizeBytes, 0);
  const totalBytes = sum(files), baselineBytes = old ? sum(old) : null;
  const largeFiles = files.filter(entry => entry.sizeBytes > policy.warningThresholdBytes).map(entry => ({
    ...entry, megabytes: entry.sizeBytes / 1_000_000,
    status: !old ? 'first-scan' : !oldMap.has(entry.file) ? 'added' : oldMap.get(entry.file).sha === entry.sha ? 'unchanged' : 'changed',
    purpose: policy.purposes[entry.file] ?? null,
  })).sort((a, b) => Number(a.status === 'unchanged') - Number(b.status === 'unchanged') || b.sizeBytes - a.sizeBytes || a.file.localeCompare(b.file));
  return {
    version: 1, checkedAt: new Date().toISOString(), project: policy.project ?? null,
    passed: true, warningOnly: true, warningThresholdBytes: policy.warningThresholdBytes,
    fileCount: files.length, totalBytes, baselineFileCount: old?.length ?? null, baselineBytes,
    deltaBytes: baselineBytes === null ? null : totalBytes - baselineBytes,
    largeFileCount: largeFiles.length, largeFiles, comparisonAvailable: Boolean(old), changes, files,
    policyExclusions: policy.exclusions,
    limitations: [
      '只核對呼叫者提供的發布清單；本工具不呼叫 Vercel、不部署，也不驗證雲端正式 ID 是否仍相同。',
      ...(baselineBytes === null && old ? ['基準清單缺少大小，未計算總量增減；可提供 --baseline-root 核對完整基準來源。'] : []),
      '來源檔案大小不等於 Deployment Storage 帳務存量或可回收空間。',
    ],
  };
}

export function reportMarkdown(report) {
  const cell = value => String(value).replaceAll('|', '\\|').replace(/[\r\n]/g, ' ');
  const size = value => value === null ? '未知' : `${(value / 1_000_000).toFixed(2)} MB（${value} bytes）`;
  const status = {'first-scan': '首次掃描', added: '新增', changed: '變更', unchanged: '未變更'};
  return '# 本機發布前報告\n\n' + `檢查時間：${report.checkedAt}\n\n` +
    '**大檔只警示，不會因檔案超過門檻而阻止發布；本報告不代表已獲發布授權。**\n\n' +
    `發布檔案：${report.fileCount}；總量：${size(report.totalBytes)}。\n\n` +
    `正式基準總量：${size(report.baselineBytes)}；增減：${size(report.deltaBytes)}。\n\n` +
    `超過 ${report.warningThresholdBytes / 1_000_000} MB：${report.largeFileCount} 檔。用途註記只供說明，不是放行或排除授權。\n\n` +
    '| 檔案 | 大小 | 狀態 | 用途 |\n| --- | --- | --- | --- |\n' +
    report.largeFiles.map(entry => `| ${cell(entry.file)} | ${size(entry.sizeBytes)} | ${status[entry.status]} | ${cell(entry.purpose ?? '未註記')} |`).join('\n') + '\n\n' +
    (report.comparisonAvailable ? `差異：新增 ${report.changes.added.length}、移除 ${report.changes.removed.length}、變更 ${report.changes.changed.length}、未變更 ${report.changes.unchanged.length}。\n\n` : '未提供正式基準，沒有推算增減或變更狀態。\n\n') +
    report.limitations.map(note => '- ' + note).join('\n') + '\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), values = {};
    for (let i = 0; i < args.length; i += 2) {
      if (!['--manifest', '--root', '--policy', '--baseline', '--baseline-root', '--out'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--') || values[args[i]]) throw Error('參數無效或重複');
      values[args[i]] = args[i + 1];
    }
    if (!values['--manifest']) throw Error('需要 --manifest <實際發布清單JSON>');
    if (values['--baseline-root'] && !values['--baseline']) throw Error('--baseline-root 必須搭配 --baseline');
    const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
    const report = await createReleaseReport({manifest: await read(values['--manifest']), root: values['--root'], policyFile: values['--policy'], baseline: values['--baseline'] ? await read(values['--baseline']) : undefined, baselineRoot: values['--baseline-root']});
    if (values['--out']) {
      const output = path.join(await fs.realpath(path.dirname(path.resolve(values['--out']))), path.basename(values['--out']));
      for (const sourceRoot of [values['--root'], values['--baseline-root']].filter(Boolean)) {
        const relative = path.relative(await fs.realpath(sourceRoot), output);
        if (!relative || !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative)) throw Error('報告輸出必須位於發布與基準來源目錄之外');
      }
      // Never overwrite a source, input manifest, or earlier evidence.
      await fs.writeFile(values['--out'], JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
      await fs.writeFile(values['--out'] + '.md', reportMarkdown(report), {flag: 'wx'});
      console.log(JSON.stringify({passed: true, warningOnly: true, largeFileCount: report.largeFileCount, fileCount: report.fileCount, totalBytes: report.totalBytes, report: path.resolve(values['--out'])}));
    } else console.log(reportMarkdown(report));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
