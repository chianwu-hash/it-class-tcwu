import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
const dir='automation/output/quiz/drive-library',project='upxgyusodibaqcrocdzj';
function cli(args){let raw;try{raw=execFileSync('pwsh',['-NoProfile','-Command',['&','supabase-personal',...args.map(a=>"'"+a.replaceAll("'","''")+"'")].join(' ')],{encoding:'utf8',windowsHide:true,timeout:90000,maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe']});}catch{throw Error('supabase_catalog_query_failed');}const x=raw.indexOf('{'),y=raw.indexOf('[');return JSON.parse(raw.slice(y>=0&&(x<0||y<x)?y:x));}
const ps=cli(['projects','list','--output','json']);if(!ps.some(p=>p.id===project&&p.name==="chianwu-hash's Project"))throw Error('project_mismatch');
const query=sql=>cli(['db','query','--linked','--project-ref',project,sql,'--output','json']).rows;
const assets=query('select url,object_path,mime,bytes from public.quiz_media_assets order by url;');
const versions=query('select id,bank_id,document from public.quiz_versions order by id;');
await writeFile(`${dir}/supabase-assets.json`,JSON.stringify(assets,null,2),'utf8');
await writeFile(`${dir}/supabase-versions.json`,JSON.stringify(versions,null,2),'utf8');
const inventory=JSON.parse(await readFile(`${dir}/inventory.json`,'utf8')),missing=[];let images=0,audios=0;
for(const a of assets){if(a.mime.startsWith('audio/')){audios++;continue;}if(!a.mime.startsWith('image/'))throw Error('unsupported_media');images++;const hash=new URL(a.url).pathname.split('/').at(-1),local=inventory.assets[hash];if(!local||local.bytes!==a.bytes||local.mime!==a.mime)missing.push({hash,mime:a.mime,bytes:a.bytes});}
await writeFile(`${dir}/catalog-check.json`,JSON.stringify({images,audios,versions:versions.length,missing},null,2),'utf8');
console.log(JSON.stringify({registeredImages:images,audioKeptOnSupabase:audios,versions:versions.length,missingImages:missing.length}));if(missing.length)process.exitCode=1;
