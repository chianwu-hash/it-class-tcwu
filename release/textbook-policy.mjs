// Compatibility entry point. File-type rules live ONLY in project-policy.json.
import {DEFAULT_POLICY, GATE_FILES, normalizePath, filterReleaseFiles, assertPolicyTarget} from './project-policy.mjs';
export {isExcluded as isTextbookSource, filterReleaseFiles as filterTextbookFiles, checkExcludedSources as checkTextbookSources} from './project-policy.mjs';
export function assertDeploymentPayload(payload, policy = DEFAULT_POLICY) {
  const result = filterReleaseFiles(payload.files, policy);
  assertPolicyTarget(payload, policy);
  const names = new Set();
  for (const entry of payload.files) {
    const name = normalizePath(entry.file).toLowerCase();
    if (names.has(name)) throw Error('發布清單有重複路徑，已阻擋上傳：' + name);
    names.add(name);
  }
  if (result.excluded.length) throw Error('發布清單含專案排除來源，已阻擋上傳：' + result.excluded.join(', '));
  if (payload.builds || payload.projectSettings?.buildCommand && payload.projectSettings.buildCommand !== 'node release/garden-preflight.mjs' || payload.projectSettings?.outputDirectory && payload.projectSettings.outputDirectory !== '.') throw Error('發布清單覆寫建置關卡，已阻擋上傳');
  for (const file of [...GATE_FILES, 'vercel.json']) {
    if (!payload.files.some(entry => entry.file === file)) throw Error('發布清單缺少必要關卡：' + file);
  }
  return {passed: true, fileCount: result.files.length};
}
