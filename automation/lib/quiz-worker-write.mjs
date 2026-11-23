import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {digest,readJson} from './quiz-batch-plan.mjs';
const canonical=x=>JSON.stringify(function sort(v){if(Array.isArray(v))return v.map(sort);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])]));return v;}(x));

export function workerIntent(baseline, expectedFiles, identity) {
  assert.ok(identity.accountVerified && identity.freePlanVerified);
  assert.deepEqual(Object.keys(baseline.files).sort(),Object.keys(expectedFiles).sort());
  for(const [name,source] of Object.entries(baseline.files))if(name!=='assets.mjs')assert.equal(expectedFiles[name],source);
  const parse=s=>JSON.parse(s.replace(/^export const assets\s*=\s*/,'').replace(/;\s*$/,''));
  const old=parse(baseline.files['assets.mjs']),next=parse(expectedFiles['assets.mjs']);
  for(const [hash,row] of Object.entries(old))assert.deepEqual(next[hash],row,'既有媒體索引不得改寫');
  return {schema:1,identity,baseline,expectedFiles,expectedSha:digest(canonical(expectedFiles)),settingsSha:digest(canonical(baseline.settings))};
}

export async function freezeWorkerIntent(file,intent) {
  try{await fs.writeFile(file,JSON.stringify(intent,null,2),{flag:'wx'});}
  catch(error){if(error.code!=='EEXIST')throw error;assert.deepEqual(await readJson(file),intent,'不可改寫既有寫入意圖');}
}

export function reconcileWorker(intent,current) {
  assert.equal(digest(canonical(intent.expectedFiles)),intent.expectedSha);
  assert.equal(digest(canonical(intent.baseline.settings)),intent.settingsSha);
  assert.equal(canonical(current.settings),canonical(intent.baseline.settings),'Worker 設定已改變');
  const actual=canonical(current.files);
  if(actual===canonical(intent.expectedFiles))return 'applied';
  if(actual===canonical(intent.baseline.files))return 'pending';
  throw Error('Worker 完整檔案與固定基準及預期結果皆不符');
}

/** Freeze before calling. The transport verifies the current visible account and plan.
 * read() returns complete files AND settings; write() must preserve bindings.
 * Uncertain writes are reconciled by reads only and are never blindly resent. */
export async function applyWorkerIntent(intent,{read,write,delay=ms=>new Promise(r=>setTimeout(r,ms)),attempts=3}) {
  const before=await read();
  if(reconcileWorker(intent,before)==='applied')return {passed:true,reused:true,expectedSha:intent.expectedSha,settingsSha:intent.settingsSha};
  let writeError;
  try{await write(intent.expectedFiles,intent.baseline.settings);}catch(error){writeError=error.message;}
  for(let i=0;i<attempts;i++){
    if(i)await delay(1000*i);
    let current;try{current=await read();}catch(error){if(i===attempts-1)throw error;continue;}
    if(reconcileWorker(intent,current)==='applied')return {passed:true,reused:false,reconciled:!!writeError,expectedSha:intent.expectedSha,settingsSha:intent.settingsSha};
  }
  throw Error('Worker 寫入尚未確認；保留意圖並先讀回，不自動重送');
}
