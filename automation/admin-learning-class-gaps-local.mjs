import fs from 'node:fs/promises';import path from 'node:path';import http from 'node:http';import {createHash} from 'node:crypto';
const out=path.resolve('automation/output/admin-learning-class-gaps-20261101'),root=path.join(out,'publish');
if(process.argv.includes('--prepare')){
  const release=path.resolve('automation/output/admin-learning-release-20261101');
  const baseline=JSON.parse(await fs.readFile(release+'/baseline.json','utf8')),guard=JSON.parse(await fs.readFile(release+'/source-guard.json','utf8'));
  const files=[...new Set([...baseline.files.map(f=>f.path),'admin-learning.html','shared/admin-learning.mjs','shared/admin-learning-api.mjs','shared/admin-learning-model.mjs','shared/admin-learning-rewards.mjs','shared/admin-learning-garden.mjs','shared/admin-learning.css'])];
  for(const f of files){const dest=path.join(root,f);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.copyFile(path.join(release,'publish',f),dest);}
  const changed=['admin-learning.html','shared/admin-learning.mjs','shared/admin-learning.css','shared/admin-learning-garden.mjs'];
  const sha=b=>createHash('sha256').update(b).digest('hex'),before={};
  for(const f of changed){before[f]=sha(await fs.readFile(path.join(release,'publish',f)));await fs.copyFile(f,path.join(root,f));}
  for(const f of changed)if(before[f]!==sha(await fs.readFile(path.join(release,'publish',f))))throw Error('release_package_changed');
  await fs.writeFile(out+'/candidate.json',JSON.stringify({basedOn:guard.deployment,files:files.length,changed,localOnly:true,releasePackageUnchanged:true,releaseHashes:before},null,2));
  console.log(JSON.stringify({prepared:true,localOnly:true,releasePackageUnchanged:true}));
}
if(process.argv.includes('--serve'))http.createServer(async(req,res)=>{
  try{
    if(!['localhost:3000','127.0.0.1:3000'].includes(req.headers.host)||req.method!=='GET'){res.writeHead(403);return res.end();}
    let name=decodeURIComponent(new URL(req.url,'http://localhost:3000').pathname);if(name==='/')name='/admin-learning.html';
    const file=path.resolve(root,'.'+name);if(name.split('/').some(x=>x.startsWith('.'))||!file.startsWith(root+path.sep)){res.writeHead(404);return res.end();}
    let bytes=await fs.readFile(file);
    if(name==='/admin-learning.html')bytes=Buffer.from(bytes.toString('utf8').replace('<p id="environment" class="notice" hidden></p>','<p id="environment" class="notice">本機候選｜全班剩餘解鎖條件；僅查閱既有資料，尚未上線。</p>'));
    const mime={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf'}[path.extname(name)]||'application/octet-stream';
    res.writeHead(200,{'Content-Type':mime+'; charset=utf-8','Cache-Control':'no-store'});res.end(bytes);
  }catch{res.writeHead(404);res.end();}
}).listen(3000,'127.0.0.1',()=>console.log('全班剩餘解鎖條件本機候選：http://localhost:3000/admin-learning.html'));
