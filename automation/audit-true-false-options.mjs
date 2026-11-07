// Read-only census; raw choice text/IDs stay in an ignored private evidence directory.
// node automation/audit-true-false-options.mjs --live --workdir <linked repo> [--output <public summary>]
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';
import {booleanChoicePresentation as display} from '../shared/quiz-boolean-choice.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),args=process.argv.slice(2),opt=(key,value)=>args.includes(key)?args[args.indexOf(key)+1]:value;
const privateDir=path.resolve(opt('--private-dir',path.join(root,'.chat-mode/tf-audit')));fs.mkdirSync(privateDir,{recursive:true});
let data;
if(args.includes('--live')){
 const workdir=opt('--workdir','D:/projects/it-class-tcwu');
 if(fs.readFileSync(path.join(workdir,'supabase/.temp/project-ref'),'utf8').trim()!=='upxgyusodibaqcrocdzj')throw Error('Unexpected linked project');
 const cli=opt('--cli','D:/local-bin/supabase-personal.cmd');
 const raw=execFileSync('cmd.exe',['/d','/c',cli,'db','query','--linked','-o','json','-f',path.join(root,'automation/sql/audit-true-false-options.sql')],{cwd:workdir,encoding:'utf8',maxBuffer:128<<20,timeout:120000,stdio:['ignore','pipe','pipe']});
 data=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1)).rows[0].inventory;
 fs.writeFileSync(path.join(privateDir,'inventory.private.json'),JSON.stringify(data,null,2));
}else if(args.includes('--input'))data=JSON.parse(fs.readFileSync(opt('--input'),'utf8'));
else throw Error('Use --live for a read-only production census, or --input <private inventory>');
const bySource={},patterns={},uncovered=[];
for(const row of data.candidates){
 const opts=row.choices.map(c=>({id:c.id,content:{text:c.text,media:c.mediaCount?[{}]:[],...(c.hasLayout?{layout:[{}]}:{})}})),tf=display(opts);
 if(tf&&row.kind==='single'){
  bySource[row.source]=(bySource[row.source]||0)+1;
  const pair=row.choices.map(c=>c.id+':'+c.text).join('|');patterns[row.source+' '+pair]=(patterns[row.source+' '+pair]||0)+1;
 }else if(row.kind==='single'&&row.choices.length===2&&row.choices.every(c=>/^(O{1,2}|X{1,2}|○|×|╳|T{1,2}|F{1,2})$/i.test(c.text.trim())))uncovered.push(row);
}
const report={documents:data.documents,pastPapers:data.pastPapers,pastEnabledPapers:data.pastEnabledPapers,pastBlockedEntries:data.pastBlockedEntries,questionTotals:data.questionTotals,unitNote:'Past totals count group objects, not independently answerable fields; historical versions/copies may repeat the same source question.',kindTotals:data.kindTotals,trueFalseSingleChoiceGroups:bySource,patterns,uncoveredCount:uncovered.length,scope:'all past versions, enabled/disabled; all normal bank drafts/versions; all partner copies; no student attempts or answers queried',dataChanged:false};
fs.writeFileSync(opt('--output',path.join(privateDir,'summary.json')),JSON.stringify(report,null,2)+'\n');fs.writeFileSync(path.join(privateDir,'uncovered.private.json'),JSON.stringify(uncovered,null,2));
console.log(JSON.stringify(report));if(uncovered.length)process.exitCode=1;
