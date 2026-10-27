import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createHash} from 'node:crypto';
const base=resolve('automation/output/quiz'),dir=resolve(base,'drive-library');await mkdir(dir,{recursive:true});
const roots=['hanlin-midterm-local','hanlin-fractions-local',...(await readdir(resolve(base,'all-midterm-local'),{withFileTypes:true})).filter(e=>e.isDirectory()&&/^(kang-g|hanlin-g|nani-g)/.test(e.name)).map(e=>'all-midterm-local/'+e.name)];
const skipped=new Set(['source','original-images','runtime','qa','review','cloud-db','node_modules']);
const mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif'};
const assets={};let files=0;
async function walk(path,course){
 const entries=await readdir(path,{withFileTypes:true});
 for(const e of entries){
  const p=resolve(path,e.name);
  if(e.isDirectory()){if(!skipped.has(e.name))await walk(p,course);continue;}
  if(!/[\\/]web-(images|media|audio)$/.test(path)||!mime[extname(e.name).toLowerCase()])continue;
  const bytes=await readFile(p),hash=createHash('sha256').update(bytes).digest('hex'),md5=createHash('md5').update(bytes).digest('hex');
  const a=assets[hash]||={hash,md5,mime:mime[extname(e.name).toLowerCase()],bytes:bytes.length,localFile:p,courses:[],aliases:[]};
  if(bytes.length>8388608)throw Error('image_exceeds_existing_media_limit');
  if(!a.courses.includes(course))a.courses.push(course);
  const alias=e.name.split('.')[0];if(/^[a-f0-9]{64}$/.test(alias)&&!a.aliases.includes(alias))a.aliases.push(alias);
  files++;
 }
}
for(const course of roots)await walk(resolve(base,course),course);
const report={scope:'Existing prepared web images only; audio/source/QA excluded',createdAt:new Date().toISOString(),files,images:Object.keys(assets).length,bytes:Object.values(assets).reduce((s,a)=>s+a.bytes,0),assets};
await writeFile(resolve(dir,'inventory.json'),JSON.stringify(report,null,2),'utf8');console.log(JSON.stringify({...report,assets:undefined}));
