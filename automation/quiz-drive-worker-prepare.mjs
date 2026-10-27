import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {validateDocument} from '../shared/quiz-document.mjs';
const folder=resolve('automation/output/quiz/drive-worker-poc');await mkdir(folder,{recursive:true});
const source=JSON.parse(await readFile('automation/output/quiz/hanlin-u1-analysis/native-trial.quiz.json','utf8'));
const fractions=JSON.parse(await readFile('automation/output/quiz/hanlin-fractions-local/runtime/shuffled-trial.quiz.json','utf8'));
source.title='考前練功房：Google Drive 雲端圖片試答（3題）';
source.blocks=[source.blocks[1],source.blocks[2],fractions.blocks[0]];
const assets={};
for(const b of source.blocks)for(const q of b.questions){
 for(const [role,c] of [['prompt',q.prompt],...q.options.map(o=>['option',o.content]),['explanation',q.explanation],['material',b.material]]){
  for(const m of c?.media||[]){
   const url=new URL(m.url),name=url.pathname.slice(1),base=url.hostname.startsWith('hanlin-fractions')?'automation/output/quiz/hanlin-fractions-local/web-images':'automation/output/quiz/hanlin-u1-analysis/native-assets';
   const localFile=resolve(base,name),bytes=await readFile(localFile),hash=createHash('sha256').update(bytes).digest('hex');
   const a=assets[hash]||={hash,localFile,mime:'image/png',bytes:bytes.length,roles:[]};if(!a.roles.includes(role))a.roles.push(role);
   m.url=`https://quiz-drive-poc.example.invalid/${hash}.png`;
  }
 }
}
validateDocument(source);
await writeFile(resolve(folder,'source.quiz.json'),JSON.stringify(source,null,2),'utf8');
await writeFile(resolve(folder,'upload-manifest.json'),JSON.stringify({schoolEmail:'th990821@mail.thps.ntpc.edu.tw',assets},null,2),'utf8');
console.log(JSON.stringify({questions:source.blocks.length,images:Object.keys(assets).length,bytes:Object.values(assets).reduce((sum,a)=>sum+a.bytes,0)}));
