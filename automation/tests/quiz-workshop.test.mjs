import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {workshopCourses,workshopCourseForPath} from '../../shared/quiz-workshop-config.mjs';
import {fixtureRPC} from '../fixtures/workshop-rpc.mjs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const read=async file=>(await fs.readFile(new URL('../../'+file,import.meta.url),'utf8')).replace(/\r\n/g,'\n');
const hash=s=>createHash('sha256').update(s).digest('hex').slice(0,16);
test('雲端發布來源不含 automation 也能執行相同產物檢查',async()=>{
 const stage=await fs.mkdtemp(path.join(tmpdir(),'quiz-workshop-cloud-'));
 const source=new URL('../../',import.meta.url);
 try{
  await fs.cp(new URL('shared/',source),path.join(stage,'shared'),{recursive:true,filter:source=>!source.split(path.sep).includes('templates')});
  await fs.mkdir(path.join(stage,'release'));
  await fs.copyFile(new URL('release/quiz-workshop-build.mjs',source),path.join(stage,'release/quiz-workshop-build.mjs'));
  for(const course of workshopCourses){
   const dir=path.join(stage,course.basePath.slice(1));await fs.mkdir(dir,{recursive:true});
   for(const file of ['quiz.html','past-exam.html','partner-practice.html','quiz-library.html','navbar.js'])await fs.copyFile(new URL(course.basePath.slice(1)+file,source),path.join(dir,file));
  }
  execFileSync(process.execPath,['release/quiz-workshop-build.mjs','--check'],{cwd:stage});
  assert.match(await read('release/garden-preflight.mjs'),/release\/quiz-workshop-build\.mjs/);
  await assert.rejects(fs.access(path.join(stage,'automation')));
 }finally{await fs.rm(stage,{recursive:true,force:true});}
});
test('四課程四入口可重現；傳遞依賴與版本別名只有一個實體模組',async()=>{
 execFileSync(process.execPath,['automation/build-quiz-workshop.mjs','--check'],{cwd:new URL('../../',import.meta.url)});
 const manifest=JSON.parse(await read('shared/quiz-workshop/generated/assets.json'));
 for(const [source,target] of Object.entries(manifest.imports)){
  const targetPath=target.split('?')[0];
  assert.equal(target,`${targetPath}?v=${hash(await read(targetPath.slice(1)))}`);
  assert.equal(target,manifest.imports[source.split('?')[0]]);
 }
 for(const course of workshopCourses)for(const file of ['quiz.html','past-exam.html','partner-practice.html','quiz-library.html']){
  const html=await read(course.basePath.slice(1)+file);
  assert.equal((html.match(/data-workshop-entry=/g)||[]).length,1);
  assert.equal((html.match(/type="module"/g)||[]).length,1);
  assert.match(html,new RegExp(`data-grade="${course.grade}"`));
  assert.doesNotMatch(html,/\{\{|localStorage|addEventListener/);
 }
 assert.equal(workshopCourseForPath('/grade4/115-1/quiz.html').zhuyinImageScale,2);
 assert.equal(workshopCourseForPath('/grade5/115-1/quiz.html'),null);
 assert.equal(workshopCourseForPath('/grade4/114-1/quiz.html'),null);
});
test('樣式巢狀依賴已展開，字型與媒體路徑仍從原始位置解析',async()=>{
 for(const mode of ['quiz','past','partner','library']){
  const css=await read(`shared/quiz-workshop/generated/${mode}.css`);
  assert.doesNotMatch(css,/@import/);
  assert.match(css,/\/shared\/vendor\/katex\/fonts\//);
  if(mode!=='library')assert.match(css,/quiz-workspace-dock/);
 }
});
test('合成驗收介面不混用個人、原卷題組或不同帳號狀態',()=>{
 fixtureRPC({route:'reset'});
 const call=(grade,user,action,p_data={})=>fixtureRPC({route:'/rest/v1/rpc/quiz_past_action',grade,user,body:{p_action:action,p_data}});
 const a=call(4,'a','start');call(4,'a','save_draft',{groups:{boolean:['X']},current_group:'boolean'});
 assert.deepEqual(call(4,'a','resume').draft.groups.boolean,['X']);
 for(const [grade,user] of [[4,'b'],[3,'a'],[9,'a']])assert.deepEqual(call(grade,user,'resume').draft.groups,{});
 assert.equal(a.groups[1].fields.length,2);
 assert.notEqual(a.groups[1].fields[0].id,a.groups[1].fields[1].id);
});
