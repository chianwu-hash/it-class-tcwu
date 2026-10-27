import {readFile} from 'node:fs/promises';
import {createHmac} from 'node:crypto';
import vault from './quiz-drive-worker-private.cjs';
export async function createDriveWorkerMedia({base,manifestPath}){
 const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
 const secrets=vault.load();
 if(!/^https:\/\/[a-z0-9.-]+\.workers\.dev$/.test(manifest.workerOrigin))throw Error('invalid_worker_origin');
 return {...base,async call(body,token='teacher'){
  // Existing local handler + real PostgreSQL contract gates unrevealed media.
  const result=await base.call(body,token);
  if(body.action!=='read'||result.status!==200||!result.result.url)return result;
  const hash=new URL(body.url).pathname.split('/').at(-1),asset=manifest.assets[hash];
  if(!asset)throw Error('drive_asset_missing');
  const payload=Buffer.from(JSON.stringify({aud:'quiz-drive-media-poc',hash,fileId:asset.fileId,mime:asset.mime,bytes:asset.bytes,role:asset.roles.includes('explanation')?'explanation':asset.roles[0],exp:Math.floor(Date.now()/1000)+300})).toString('base64url');
  const sig=createHmac('sha256',Buffer.from(secrets.ticketKey,'base64url')).update(payload).digest('base64url');
  result.result.url=`${manifest.workerOrigin}/media/${hash}?ticket=${payload}.${sig}`;
  return result;
 }};
}
