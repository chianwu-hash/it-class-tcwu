const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const vercelignorePath = path.join(repoRoot, '.vercelignore');

const publicRoots = [
  'assets',
  'grade3',
  'grade6',
  'shared',
];

const publicRootFiles = [
  '114-2-it-class.html',
  'admin-grades.html',
  'admin-progress.html',
  'angry_birds_guide.html',
  'index.html',
  'package.json',
];

const scanExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.mjs',
  '.svg',
  '.webmanifest',
]);

const referencePattern = /\b(?:href|src|action)\s*=\s*["']([^"']+)["']|(?:import\s+(?:[^"']+\s+from\s+)?|import\s*\(|fetch\s*\(|new\s+Worker\s*\(|new\s+URL\s*\()\s*["'`]([^"'`]+)["'`]/g;

function readIgnoredRoots() {
  const raw = fs.readFileSync(vercelignorePath, 'utf8');
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .filter((line) => line.endsWith('/') && !line.includes('*'))
    .map((line) => line.replace(/^\/+/, '').replace(/\/+$/, ''))
    .filter((line) => !line.startsWith('.'));
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (scanExtensions.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function normalizeRef(ref) {
  if (!ref || ref.startsWith('#')) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref)) return null;
  if (ref.startsWith('//')) return null;
  return ref.replace(/^[./]+/, '').replace(/\\/g, '/');
}

function main() {
  if (!fs.existsSync(vercelignorePath)) {
    throw new Error('.vercelignore not found');
  }

  const ignoredRoots = readIgnoredRoots();
  const files = [
    ...publicRootFiles.map((file) => path.join(repoRoot, file)).filter((file) => fs.existsSync(file)),
    ...publicRoots.flatMap((root) => walk(path.join(repoRoot, root))),
  ];

  const findings = [];

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const relFile = path.relative(repoRoot, file).replace(/\\/g, '/');
    let match;

    while ((match = referencePattern.exec(source))) {
      const ref = normalizeRef(match[1] || match[2]);
      if (!ref) continue;

      for (const root of ignoredRoots) {
        if (ref === root || ref.startsWith(`${root}/`)) {
          findings.push({ file: relFile, reference: ref, ignoredRoot: root });
        }
      }
    }
  }

  if (findings.length > 0) {
    console.error('Public files reference paths excluded by .vercelignore:');
    for (const item of findings) {
      console.error(`- ${item.file}: ${item.reference} -> ${item.ignoredRoot}/`);
    }
    process.exit(1);
  }

  console.log(`Checked ${files.length} public files. No references to .vercelignore excluded root folders were found.`);
}

main();
