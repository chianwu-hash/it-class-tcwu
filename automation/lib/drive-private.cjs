// Windows DPAPI storage outside the repository. Never print decrypted content.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(process.env.LOCALAPPDATA, 'Codex', 'secrets', 'dingxi-drive', 'oauth.dpapi');
function transform(input, encrypt) {
  const code = encrypt
    ? '$v=[Console]::In.ReadToEnd(); $s=ConvertTo-SecureString $v -AsPlainText -Force; ConvertFrom-SecureString $s'
    : '$v=[Console]::In.ReadToEnd(); $s=ConvertTo-SecureString $v; [System.Net.NetworkCredential]::new("",$s).Password';
  const result = spawnSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command', code], { input, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error('DPAPI operation failed (details withheld)');
  return result.stdout.trim();
}
exports.exists = () => fs.existsSync(file);
exports.save = value => {
  if (fs.existsSync(file)) throw new Error('Private backup already exists; refusing overwrite');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, transform(JSON.stringify(value), true), { flag: 'wx' });
};
exports.load = () => JSON.parse(transform(fs.readFileSync(file, 'utf8'), false));
