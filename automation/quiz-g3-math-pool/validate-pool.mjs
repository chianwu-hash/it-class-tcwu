import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {validateDocument,newDocument} from '../../shared/quiz-document.mjs';
const req=createRequire(new URL('../../tmp/quiz-runtime/package.json',import.meta.url)),katex=req('katex');
const base='automation/output/quiz/hanlin-g3-math-pool',pool=JSON.parse(await readFile(base+'/pool.json','utf8')),assets=JSON.parse(await readFile(base+'/media-assets.json','utf8'));
let formulas=0;const errors=[];
for(const r of pool){try{
 const doc=newDocument();doc.blocks[0].questions=[r.question];validateDocument(doc);
 for(const c of [r.question.prompt,r.question.explanation,...r.question.options.map(o=>o.content)]){
  for(const m of c.text.matchAll(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g)){katex.renderToString('\\displaystyle '+(m[1]??m[2]),{throwOnError:true,strict:'error',trust:false});formulas++;}
  for(const m of c.media){const sha=new URL(m.url).pathname.split('/').at(-1),a=assets[sha];if(!a||createHash('sha256').update(await readFile(a.path)).digest('hex')!==sha)throw Error('原圖雜湊不符');}
 }
}catch(e){errors.push({id:r.source_item_id,error:e.message});}}
if(new Set(pool.map(r=>r.question_id)).size!==pool.length)throw Error('題目ID重複');
const report={prepared:pool.length,pool_sha256:createHash('sha256').update(await readFile(base+'/pool.json')).digest('hex'),formulas,assets:Object.keys(assets).length,errors,passed:!errors.length,scope:'原始資料與答案文件交叉對照、圖文結構、公式排版及圖片雜湊；非每題獨立數學解題證明'};
await writeFile(base+'/qa/structure-validation.json',JSON.stringify(report,null,2),'utf8');console.log(JSON.stringify(report));if(errors.length)process.exitCode=1;
