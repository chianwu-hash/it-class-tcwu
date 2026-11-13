import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {workshopCourses,workshopNavigation} from '../shared/quiz-workshop-config.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const check=process.argv.includes('--check'), generated='shared/quiz-workshop/generated';
const read=async file=>(await fs.readFile(path.join(root,file),'utf8')).replace(/\r\n/g,'\n');
const hash=text=>createHash('sha256').update(text).digest('hex').slice(0,16);
const entries={quiz:['shared/quiz-student.mjs'],past:['shared/quiz-past-entry.mjs'],partner:['shared/partner-pilot/app.mjs'],library:['shared/quiz-library.mjs','shared/quiz-learning.mjs','shared/quiz-partner-pilot-entry.mjs']};
const common=['shared/quiz-theme.css','shared/vendor/katex/katex.min.css','shared/image-lightbox.css'];
const styles={
 quiz:['shared/quiz-author.css','shared/quiz-student.css',...common,'shared/quiz-workspace.css','shared/quiz-learning.css','shared/quiz-textbook-reader.css','shared/quiz-workshop.css'],
 past:['shared/quiz-author.css','shared/quiz-student.css',...common,'shared/quiz-past-style.css','shared/quiz-workspace.css','shared/quiz-textbook-reader.css','shared/quiz-workshop.css'],
 partner:[...common,'shared/quiz-library.css',...['style','visual','focused','message-media','team-flow','outcomes'].map(s=>`shared/partner-pilot/${s}.css`),'shared/quiz-workspace.css','shared/partner-pilot/review-layout.css','shared/quiz-workshop.css'],
 library:[...common,'shared/quiz-student.css','shared/quiz-wrong-questions.css','shared/quiz-library.css','shared/quiz-compose.css','shared/quiz-learning.css','shared/quiz-workshop.css','shared/quiz-library-home.css'],
};
const outputs=new Map(), moduleSources=new Map(), imports={};
const dependencyPattern=()=>/['"](\.{1,2}\/[^'"\s]+\.(?:m?js)(?:\?[^'"\s]*)?)['"]/g;
async function visit(file){
 if(moduleSources.has(file))return;
 const source=await read(file);moduleSources.set(file,source);
 for(const match of source.matchAll(dependencyPattern())){
  const target=new URL(match[1],`https://workshop.invalid/${file}`).pathname.slice(1);
  if(target.startsWith('shared/')&&!target.startsWith('shared/vendor/'))await visit(target);
 }
}
// Reachable shared modules, including navbar's dynamic imports, resolve to one URL per
// file. Legacy ?v aliases cannot instantiate a second auth/identity singleton.
for(const file of [...Object.values(entries).flat(),'shared/quiz-workshop-entry.mjs','shared/quiz-workshop-config.mjs',...workshopCourses.map(c=>c.basePath.slice(1)+'navbar.js')])await visit(file);
for(const [file,source] of moduleSources)imports[`/${file}`]=`/${file}?v=${hash(source)}`;
for(const [file,source] of moduleSources){
 for(const match of source.matchAll(dependencyPattern())){
  const url=new URL(match[1],`https://workshop.invalid/${file}`), target=url.pathname.slice(1);
  if(moduleSources.has(target))imports[url.pathname+url.search]=imports[url.pathname];
 }
}
async function css(file,ancestors=[]){
 if(ancestors.includes(file))throw Error(`CSS import cycle: ${file}`);
 let text=await read(file);
 // Flatten local imports so changing a nested CSS file also changes the bundle
 // URL. Rewrite media/font URLs relative to their ORIGINAL stylesheet.
 const pieces=[];let start=0;
 for(const match of text.matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?\s*;/g)){
  const imported=new URL(match[1],`https://workshop.invalid/${file}`);
  if(imported.origin!=='https://workshop.invalid')throw Error(`External CSS import: ${file}`);
  pieces.push(rewrite(text.slice(start,match.index),file),await css(imported.pathname.slice(1),[...ancestors,file]));start=match.index+match[0].length;
 }
 pieces.push(rewrite(text.slice(start),file));return pieces.join('\n');
}
function rewrite(text,file){return text.replace(/url\(\s*(["']?)([^)'"\s]+)\1\s*\)/g,(all,_quote,value)=>{
 if(/^(data:|https?:|\/|#)/.test(value))return all;
 const url=new URL(value,`https://workshop.invalid/${file}`);return `url("${url.pathname}${url.search}${url.hash}")`;
});}
const courses=[];
for(const course of workshopCourses){const navbar=`${course.basePath.slice(1)}navbar.js`;courses.push({...course,navigation:workshopNavigation(course),navbar:`/${navbar}?v=${hash(await read(navbar))}`});}
const manifest={courses,entries:Object.fromEntries(Object.entries(entries).map(([mode,files])=>[mode,files.map(file=>imports[`/${file}`])])),imports:Object.fromEntries(Object.entries(imports).sort(([a],[b])=>a.localeCompare(b)))};
const manifestText=JSON.stringify(manifest,null,2)+'\n', manifestUrl=`/${generated}/assets.json?v=${hash(manifestText)}`;
outputs.set(`${generated}/assets.json`,manifestText);
const loaderUrl=imports['/shared/quiz-workshop-entry.mjs'];
const katexUrl='/shared/vendor/katex/katex.min.js?v='+hash(await read('shared/vendor/katex/katex.min.js'));
for(const [mode,files] of Object.entries(styles)){
 const bundle=(await Promise.all([...files,'shared/quiz-question-reports.css'].map(file=>css(file)))).join('\n');
 const bundleFile=`${generated}/${mode}.css`;outputs.set(bundleFile,bundle);
 const assets=`<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;800;900&display=swap">\n<link rel="stylesheet" data-quiz-report-style href="/${bundleFile}?v=${hash(bundle)}">\n<script defer src="${katexUrl}"></script>\n`;
 const template=await read(`shared/quiz-workshop/shells/${mode}.html`);
 for(const course of workshopCourses){
  const values={ASSETS:assets,ENTRY:`<script type="module" data-workshop-entry="${mode}" data-manifest="${manifestUrl}" src="${loaderUrl}"></script>`,GRADE:course.grade,GRADE_LABEL:course.label,COURSE_ID:course.courseId,GRADE_OPTIONS:workshopCourses.map(c=>`<option value="${c.grade}">${c.label}</option>`).join(''),SUBJECT_OPTIONS:'<option value="">全部科目</option>'+course.subjects.map(s=>`<option>${s}</option>`).join('')};
  const html='<!-- 此檔由 automation/build-quiz-workshop.mjs 產生；請修改 shared/quiz-workshop/shells 或設定。 -->\n'+template.replace(/\{\{([A-Z_]+)\}\}/g,(_,key)=>{if(!(key in values))throw Error(key);return values[key];});
  outputs.set(course.basePath.slice(1)+({quiz:'quiz.html',past:'past-exam.html',partner:'partner-practice.html',library:'quiz-library.html'})[mode],html);
 }
}
let stale=0;
for(const [file,text] of outputs){if(check){if(await read(file).catch(()=>null)!==text){console.error(`需要重新產生：${file}`);stale++;}}else{await fs.mkdir(path.dirname(path.join(root,file)),{recursive:true});await fs.writeFile(path.join(root,file),text,'utf8');}}
if(stale)process.exitCode=1;
else console.log(`${check?'核對':'產生'}練功坊：${outputs.size} 檔；${workshopCourses.length} 課程、4 種入口。`);
