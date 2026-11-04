import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
const out='automation/output/quiz/question-reports',base='C:/Users/user/.codex/worktrees/grade6-week09-release/it-class-tcwu/tmp/production-release';
await fs.mkdir(out,{recursive:true});
const tree=JSON.parse(await fs.readFile('automation/output/quiz/reports-files.private.json','utf8'));
const files=[];function walk(items,prefix=''){for(const i of items){const file=prefix+i.name;if(i.type==='file')files.push({file,sha:i.uid});else walk(i.children||[],file+'/');}}walk(tree.find(x=>x.name==='src').children);
for(const {file,sha} of files){const bytes=await fs.readFile(path.join(base,file));if(createHash('sha1').update(bytes).digest('hex')!==sha)throw Error('baseline_source_mismatch:'+file);}
const ancestor='8d053741d5e0eb15fcfbda16824c887307440078';
const changes=['admin-progress.html','admin-quiz.html',...['grade3','grade6'].flatMap(g=>['quiz.html','quiz-library.html','past-exam.html'].map(n=>`${g}/115-1/${n}`)),...['quiz-api.mjs','quiz-author.mjs','quiz-library.mjs','quiz-module.js','quiz-past-entry.mjs','quiz-past-exams.mjs','quiz-past-ui.mjs','quiz-server.mjs','quiz-student.mjs','quiz-wrong-questions.mjs'].map(n=>'shared/'+n)];
await fs.cp(base,path.join(out,'release'),{recursive:true});
const added=['shared/quiz-question-reports.mjs','shared/quiz-question-reports.css','shared/quiz-report-admin.mjs'];
const names=['quiz-api.mjs','quiz-server.mjs','quiz-module.js','quiz-student.mjs','quiz-library.mjs','quiz-wrong-questions.mjs','quiz-past-entry.mjs','quiz-past-exams.mjs','quiz-past-ui.mjs','quiz-author.mjs'];
const pattern=new RegExp('('+names.map(n=>n.replaceAll('.','\\.')).join('|')+')\\?v=[A-Za-z0-9-]+','g');
const normalize=s=>s.replaceAll('\r\n','\n').replace(pattern,'$1?v=20261030-question-reports');
const merged=[];
for(const file of changes){
 const sources=[await fs.readFile(file,'utf8'),execFileSync('git',['show',ancestor+':'+file],{encoding:'utf8'}),await fs.readFile(path.join(base,file),'utf8')];
 const temporary=['ours','ancestor','production'].map(n=>path.join(out,'merge-'+n));
 for(let i=0;i<3;i++)await fs.writeFile(temporary[i],normalize(sources[i]));
 let bytes;try{bytes=execFileSync('git',['merge-file','-p',...temporary]);}catch{throw Error('overlay_conflict:'+file);}
 await fs.writeFile(path.join(out,'release',file),bytes);if(normalize(sources[1])!==normalize(sources[2]))merged.push(file);
}
for(const file of added)await fs.copyFile(file,path.join(out,'release',file));
const hashes=[];for(const file of [...changes,...added])hashes.push({file,sha256:createHash('sha256').update(await fs.readFile(path.join(out,'release',file))).digest('hex')});
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify({baseline:'dpl_3Ab6ZKnw7M8oLkC8R6ikUAuG4GJL',preserved:files.filter(f=>!changes.includes(f.file)),merged,changes:hashes},null,2));
console.log(JSON.stringify({baselineVerified:files.length,overlays:changes.length+added.length}));
