// Assemble an immutable full-production baseline from exact SHA-1 matches.
// Missing source files are listed for authenticated read-only retrieval.
import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
const main='D:/projects/it-class-tcwu',audit=main+'/automation/output/effort-prerelease-audit-20261031',m=JSON.parse(await fs.readFile(audit+'/production-manifest.json','utf8'));
const out=audit+'/release-base-'+m.deployment.id,roots=[main,process.cwd(),...['garden-unlock-notice','garden-tree-first','garden-tree-skin','garden-first-location','garden-auto-weather','garden-render-fix','garden-surprise-message','garden-profile-label'].map(x=>main+'/automation/output/quiz/'+x+'/publish')];
await fs.mkdir(out,{recursive:true});const missing=[],copied=[];const hash=b=>createHash('sha1').update(b).digest('hex');
for(const file of m.files){if(file.path.startsWith('/')||file.path.split('/').includes('..'))throw Error('invalid_manifest_path');let bytes=null,origin=null;for(const root of roots){try{const b=await fs.readFile(path.join(root,file.path));if(hash(b)===file.uid){bytes=b;origin=root;break}}catch{}}
 if(!bytes){missing.push(file);continue}const dest=path.join(out,file.path);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,bytes);copied.push({path:file.path,uid:file.uid,origin});}
await fs.writeFile(audit+'/release-base-assembly.json',JSON.stringify({deployment:m.deployment,out,complete:!missing.length,copied,missing},null,2));console.log(JSON.stringify({deployment:m.deployment.id,baselineFiles:m.files.length,copied:copied.length,missing:missing.map(x=>x.path),out}));
