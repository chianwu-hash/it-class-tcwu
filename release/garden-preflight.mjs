import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
import {expectedCatalog,compareCatalog} from './garden-catalog.mjs';
import {checkExcludedSources} from './project-policy.mjs';
export const PROJECT='upxgyusodibaqcrocdzj',BUILD_COMMAND='node release/garden-preflight.mjs';
export const SOURCES=['shared/reward-tree-config.js','shared/typing-foundation-curriculum.mjs','shared/zhuyin-foundation-curriculum.mjs','shared/auth.js'];
export async function runPreflight({root=process.cwd(),fetcher=fetch,timeoutMs=12000}={}){
 const projectPolicyCheck=await checkExcludedSources(root);
 const files=await Promise.all(SOURCES.map(async p=>({path:p,bytes:await fs.readFile(path.join(root,p))})));
 const hashes=Object.fromEntries(files.map(f=>[f.path,createHash('sha256').update(f.bytes).digest('hex')]));
 const load=async i=>import('data:text/javascript;base64,'+files[i].bytes.toString('base64'));
 const [config,en,zh]=await Promise.all([load(0),load(1),load(2)]);
 const expected=expectedCatalog(config.getRewardTreeCourses(),[...en.lessons,...zh.zhuyinLessons].map(l=>l.key));
 const auth=files[3].bytes.toString('utf8');
 const url=auth.match(/export\s+const\s+SUPABASE_URL\s*=\s*["']([^"']+)["']/)?.[1];
 const key=auth.match(/export\s+const\s+SUPABASE_ANON_KEY\s*=\s*["']([^"']+)["']/)?.[1];
 if(url!==`https://${PROJECT}.supabase.co`||!key)throw Error('發布目標資料庫不符或缺少公開 API 設定');
 let timer;const controller=new AbortController();
 try{
  const request=(async()=>{
   const response=await fetcher(`${url}/rest/v1/rpc/garden_catalog_manifest`,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json','Cache-Control':'no-cache'},body:'{}',signal:controller.signal,cache:'no-store'});
   if(!response.ok)throw Error('正式任務目錄無法讀取（HTTP '+response.status+'），發布已阻擋');
   return response.json();
  })();
  const data=await Promise.race([request,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('正式任務目錄讀取逾時，發布已阻擋'));},timeoutMs)})]);
  if(data?.version!==1||data?.project!==PROJECT||!Number.isFinite(Date.parse(data.asOf))||Math.abs(Date.now()-Date.parse(data.asOf))>120000)throw Error('正式任務目錄來源無效或過期，發布已阻擋');
  const report=compareCatalog(expected,data.catalog);
  return {...report,projectPolicyCheck,project:PROJECT,checkedAt:new Date().toISOString(),databaseAsOf:data.asOf,sourceHashes:hashes};
 }finally{clearTimeout(timer)}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);let root=process.cwd();
 if(args.length){if(args.length!==2||args[0]!=='--root')throw Error('僅接受 --root <發布目錄>');root=path.resolve(args[1]);}
 try{const report=await runPreflight({root});console.log(JSON.stringify(report,null,2));if(!report.passed){console.error('努力樹升級任務目錄不一致，發布已阻擋。請先核對並套用正式資料庫目錄。');process.exitCode=1;}
 else console.log('努力樹升級目錄檢查通過。');}
 catch(e){console.error('發布檢查失敗：'+e.message);process.exitCode=1;}
}
