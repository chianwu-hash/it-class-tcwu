// Prepare and verify a local candidate. This tool never deploys or deletes deployments.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const policy = require('./vercel-slim-policy.json');
const sha1 = data => crypto.createHash('sha1').update(data).digest('hex');
const fail = message => { throw new Error(message); };

function safeRelative(value) {
  if (!value || value.includes('\\') || value.startsWith('/') || value.includes(':') || value.split('/').some(x => !x || x === '.' || x === '..')) fail(`Unsafe path: ${value}`);
  return value;
}

function sourceFiles(tree) {
  const root = tree.find(x => x.name === 'src' && x.type === 'directory');
  if (!root) fail('Deployment source tree is missing');
  const result = [];
  function visit(nodes, prefix = '') {
    for (const node of nodes) {
      const name = safeRelative(node.name);
      if (name.includes('/')) fail('Nested node name');
      const relative = prefix + name;
      if (node.type === 'directory') visit(node.children || [], relative + '/');
      else if (node.type === 'file' && /^[0-9a-f]{40}$/.test(node.uid)) result.push({ path: relative, sha1: node.uid });
      else fail(`Unsupported source entry: ${relative}`);
    }
  }
  visit(root.children);
  if (new Set(result.map(x => x.path.toLowerCase())).size !== result.length) fail('Duplicate source paths');
  return result;
}

function checkProduction(project, expected) {
  if (project.id !== policy.projectId || project.name !== 'it-class-tcwu' || project.accountId !== 'team_SOhQ0oysg6ZGV9vs3RryW2CB') fail('Project or team mismatch');
  if (project.targets?.production?.id !== expected) fail('Production has changed; prepare again from the new baseline');
}

function checkProductionAliases(result, expected) {
  for (const name of ['it-class-tcwu.vercel.app', 'it-class-tcwu-chianwu-4755s-projects.vercel.app']) {
    const alias = result.aliases?.find(x => x.alias === name);
    if (!alias || alias.projectId !== policy.projectId || (alias.deploymentId || alias.deployment?.id) !== expected)
      fail(`Production aliases disagree with the baseline: ${name}. Another release may be in progress.`);
  }
}

function readSource(root, relative) {
  let current = root;
  if (fs.lstatSync(current).isSymbolicLink()) fail('Source root must not be a symlink');
  for (const part of safeRelative(relative).split('/')) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) fail(`Symlink rejected: ${relative}`);
  }
  if (!fs.statSync(current).isFile()) fail(`Not a file: ${relative}`);
  return fs.readFileSync(current);
}

function referenceFindings(files, read) {
  const findings = [];
  const excluded = new Set(policy.excludedFiles.map(x => x.path));
  for (const file of files) {
    if (excluded.has(file.path) || !/\.(html?|js|mjs|cjs|css|json|svg|webmanifest|md|txt)$/i.test(file.path)) continue;
    let source = read(file.path).toString('utf8');
    // Cover encoded links and JSON/JS Unicode escapes as well as literal paths.
    source = source.replace(/\\u([0-9a-f]{4})/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
    source = source.replace(/(?:%[0-9a-f]{2})+/gi, encoded => {
      try { return decodeURIComponent(encoded); } catch { return encoded; }
    });
    for (const item of policy.excludedFiles) {
      if (source.includes(path.posix.basename(item.path))) findings.push({ file: file.path, reference: item.path });
    }
  }
  return findings;
}

function verifyDryRun(dry, files, candidate) {
  const expected = new Map(files.filter(x => !policy.excludedFiles.some(y => y.path === x.path)).map(x => [x.path, sha1(readSource(candidate, x.path))]));
  const actual = new Map();
  for (const file of dry.files || []) {
    if (!file.sha) continue; // The CLI also lists directory entries.
    const name = safeRelative(file.path.replace(/\\/g, '/'));
    if (actual.has(name)) fail(`Duplicate dry-run path: ${name}`);
    actual.set(name, file.sha);
  }
  for (const [name, digest] of expected) {
    if (actual.get(name) !== digest) fail(`Missing or changed upload: ${name}`);
  }
  for (const name of actual.keys()) if (!expected.has(name)) fail(`Unexpected upload: ${name}`);
  return actual.size;
}

function main() {
  const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, values) => {
    if (index % 2 === 0) pairs.push([value, values[index + 1]]);
    return pairs;
  }, []));
  const source = path.resolve(args['--source'] || fail('--source required'));
  const output = path.resolve(args['--out'] || fail('--out required'));
  const expectedId = args['--production'] || fail('--production required');
  if (!/^dpl_[a-zA-Z0-9]+$/.test(expectedId)) fail('Invalid deployment ID');
  const relative = path.relative(source, output);
  const reverse = path.relative(output, source);
  if (!relative || (!relative.startsWith('..' + path.sep) && !path.isAbsolute(relative)) || (!reverse.startsWith('..' + path.sep) && !path.isAbsolute(reverse))) fail('Source and output must be separate, non-overlapping directories');
  if (fs.existsSync(output)) fail('Output already exists; choose a new directory');
  const cli = args['--cli'] || path.join(process.env.APPDATA || '', 'npm/node_modules/vercel/dist/index.js');
  if (!fs.existsSync(cli)) fail('Installed Vercel CLI not found; provide --cli');
  function command(argv, cwd) {
    const result = spawnSync(process.execPath, [cli, ...argv], { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 120000, windowsHide: true });
    if (result.error || result.status !== 0) fail(`Read/dry-run command failed: ${result.error?.message || result.stderr.slice(-1000)}`);
    return JSON.parse(result.stdout);
  }
  const api = endpoint => command(['api', endpoint, '--scope', policy.team], source);
  const before = api(`/v9/projects/${policy.projectId}`);
  checkProduction(before, expectedId);
  const aliasesEndpoint = `/v2/aliases?projectId=${policy.projectId}&limit=100`;
  const beforeAliases = api(aliasesEndpoint);
  checkProductionAliases(beforeAliases, expectedId);
  const tree = api(`/v6/deployments/${expectedId}/files`);
  const files = sourceFiles(tree);
  const baseline = new Map();
  for (const file of files) {
    const bytes = readSource(source, file.path);
    if (sha1(bytes) !== file.sha1) fail(`Source does not match production: ${file.path}`);
    baseline.set(file.path, bytes);
  }
  for (const name of policy.requiredFiles) if (!baseline.has(name)) fail(`Required runtime missing: ${name}`);
  for (const file of policy.excludedFiles) {
    const bytes = baseline.get(file.path);
    if (!bytes || bytes.length !== file.size || sha1(bytes) !== file.sha1) fail(`Exclusion no longer matches audited file: ${file.path}`);
  }
  const findings = referenceFindings(files, name => baseline.get(name));
  if (findings.length) fail(`Excluded resource still referenced: ${JSON.stringify(findings)}`);
  const excluded = new Set(policy.excludedFiles.map(x => x.path));
  const rules = [...new Set(['*S091-Google網路AI好幫手-PDF*', '*S092-Canva魔法工作室PDF*', ...policy.excludedFiles.filter(x => !x.path.endsWith('.pdf')).map(x => '*' + path.posix.basename(x.path))])];
  const ignore = baseline.get('.vercelignore').toString('utf8').trimEnd() + '\n\n# Verified slim release policy v1 (Windows and POSIX)\n' + rules.join('\n') + '\n';
  fs.mkdirSync(output, { recursive: true });
  for (const file of files) {
    if (excluded.has(file.path)) continue;
    const destination = path.join(output, file.path);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, file.path === '.vercelignore' ? Buffer.from(ignore) : baseline.get(file.path));
  }
  const dry = command(['deploy', '--dry', '--json', '--project', policy.projectId, '--scope', policy.team, '--non-interactive'], output);
  const uploads = verifyDryRun(dry, files, output);
  for (const file of files) {
    if (excluded.has(file.path) || file.path === '.vercelignore') continue;
    if (sha1(readSource(output, file.path)) !== file.sha1) fail(`Retained source changed: ${file.path}`);
  }
  const after = api(`/v9/projects/${policy.projectId}`);
  checkProduction(after, expectedId);
  const afterAliases = api(aliasesEndpoint);
  checkProductionAliases(afterAliases, expectedId);
  for (const alias of beforeAliases.aliases) {
    const current = afterAliases.aliases.find(x => x.alias === alias.alias);
    if (!current || current.deploymentId !== alias.deploymentId) fail(`Alias changed during verification: ${alias.alias}`);
  }
  if (JSON.stringify(before.targets) !== JSON.stringify(after.targets) || JSON.stringify(before.latestDeployments?.map(x => x.id)) !== JSON.stringify(after.latestDeployments?.map(x => x.id))) fail('Deployment targets changed during verification; check again');
  const report = { at: new Date().toISOString(), production: expectedId, source, candidate: output, baselineCount: files.length, candidateCount: uploads, retainedUnchanged: uploads - 1, changed: ['.vercelignore'], excluded: policy.excludedFiles, excludedSourceBytes: policy.excludedFiles.reduce((sum, x) => sum + x.size, 0), dryRunBytes: dry.totalSize, requiredFilesPresent: true, referenceFindings: findings, productionUnchanged: true, deployPerformed: false, limitations: ['No authenticated student workflow or cloud build was executed.', 'External direct links and arbitrary dynamically constructed paths cannot be fully inferred from source scanning.'], policySha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'vercel-slim-policy.json'))).digest('hex') };
  const reportPath = args['--report'] || output + '.verification.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(reportPath + '.dry-run.json', JSON.stringify(dry, null, 2) + '\n');
  fs.writeFileSync(reportPath + '.baseline-tree.json', JSON.stringify(tree, null, 2) + '\n');
  console.log(JSON.stringify({ report: path.resolve(reportPath), baseline: files.length, uploads, unchanged: uploads - 1, removed: excluded.size, sourceBytesAvoided: report.excludedSourceBytes, productionUnchanged: true, deployed: false }, null, 2));
}

module.exports = { safeRelative, sourceFiles, checkProduction, checkProductionAliases, referenceFindings, verifyDryRun };
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
