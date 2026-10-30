import fs from 'node:fs/promises';
const names=['quiz-api.mjs','quiz-server.mjs','quiz-module.js','quiz-student.mjs','quiz-library.mjs','quiz-wrong-questions.mjs','quiz-past-entry.mjs','quiz-past-exams.mjs','quiz-past-ui.mjs','quiz-author.mjs'];
const paths=['admin-quiz.html',...names.map(n=>'shared/'+n),...['grade3','grade6'].flatMap(g=>['quiz.html','quiz-library.html','past-exam.html'].map(n=>`${g}/115-1/${n}`))];
const pattern=new RegExp('('+names.map(n=>n.replaceAll('.','\\.')).join('|')+')\\?v=[A-Za-z0-9-]+','g');
for(const path of paths){const old=await fs.readFile(path,'utf8'),next=old.replace(pattern,'$1?v=20261030-question-reports');if(old!==next)await fs.writeFile(path,next);}
