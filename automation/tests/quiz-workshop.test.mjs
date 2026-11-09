import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {workshopCourses,workshopCourseForPath,workshopNavigation} from '../../shared/quiz-workshop-config.mjs';
import {fixtureRPC} from '../fixtures/workshop-rpc.mjs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const read=async file=>(await fs.readFile(new URL('../../'+file,import.meta.url),'utf8')).replace(/\r\n/g,'\n');
const hash=s=>createHash('sha256').update(s).digest('hex').slice(0,16);
test('導覽品牌與課程路徑由設定供應，保留既有標籤及努力樹課程',()=>{
 const labels={3:'考前練功坊｜三年級',4:'考前練功坊｜土城四年級',6:'考前練功坊｜六年級',9:'考前練功坊｜中正九年級'};
 for(const course of workshopCourses){const navigation=workshopNavigation(course);assert.equal(navigation.gradeLabel,labels[course.grade]);assert.equal(navigation.homeHref,course.basePath+'quiz-library.html');assert.equal(new URL(navigation.extraLinks[0].href,'https://example.invalid').searchParams.get('course'),course.courseId);assert.equal(navigation.extraLinks[1].href,course.basePath+'index.html');assert.equal(course.pastExams,true);assert.ok(course.pastCatalogIntro);}
});
test('預覽重設只影響本輪合成命名空間，不清掉使用者正在檢視的其他練習',()=>{
 const call=(namespace,action,data={})=>fixtureRPC({route:'/rest/v1/rpc/quiz_past_action',grade:4,user:'a',namespace,body:{p_action:action,p_data:data}});
 call('preview-user','save_draft',{groups:{boolean:['O']},current_group:'boolean'});
 call('default','save_draft',{groups:{boolean:['X']},current_group:'boolean'});
 fixtureRPC({route:'reset'});assert.deepEqual(call('preview-user','resume').draft.groups.boolean,['O']);assert.deepEqual(call('default','resume').draft.groups,{});
});
test('合成夥伴走原房間及題號契約，訂正保留歷次作答，原卷同段完整保留',()=>{
 const call=(action,data={},roomKind='normal')=>fixtureRPC({route:'/rest/v1/rpc/quiz_partner_pilot_action',grade:6,user:'a',namespace:'preview-unit',roomKind,body:{p:{action,...data}}});
 const before=call('snapshot');assert.equal(before.exercise.mine.length,2);assert.equal(before.exercise.submitted,1);
 const wrong=call('answer',{qid:1,choice:1});assert.equal(wrong.exercise.mine[0].attempts.at(-1).correct,false);
 const corrected=call('answer',{qid:1,choice:0});assert.equal(corrected.exercise.mine[0].attempts.length,2);assert.equal(corrected.exercise.mine[0].attempts[0].correct,false);
 const past=call('snapshot',{},'past');assert.equal(new Set(past.exercise.mine.map(q=>q.past.group)).size,1);assert.notEqual(past.exercise.mine[0].id,past.exercise.mine[1].id);
});
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
