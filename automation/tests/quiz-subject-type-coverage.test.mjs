import test from 'node:test';
import assert from 'node:assert/strict';
import {auditCoverage,auditPastCoverage} from '../audit-subject-type-coverage.mjs';
import {newQuestion} from '../../shared/quiz-document.mjs';
import {createMediaScope,bindQuizMedia} from '../../shared/quiz-media.mjs';
import {readingWorkbenchSupported} from '../../shared/quiz-reading-workbench.mjs';

test('來源複合標籤不重複計題；保留、未對應與隱私界線',()=>{
 const q=newQuestion();q.prompt.text='不得輸出的原題';q.answer={option_id:'secret-answer'};
 const rows=[{question_id:'one',course_id:null,question:q,usable:true},{question_id:'two',course_id:'c',question:q,usable:false}];
 const types={rows:[{question_id:'one',source_types:[{name:'算算看'},{name:'直式'},{name:'直式'}]}]};
 const before=JSON.stringify(rows),r=auditCoverage(rows,[],types);
 assert.equal(r.total,2);assert.equal(r.usable,1);assert.equal(r.missingSourceTypes,1);
 assert.equal(r.groups[1].sourceTypes.length,2);assert.equal(r.groups.reduce((s,g)=>s+g.total,0),2);
 assert.ok(!JSON.stringify(r).includes('secret-answer'));assert.ok(!JSON.stringify(r).includes('不得輸出的原題'));
 assert.equal(JSON.stringify(rows),before);assert.throws(()=>auditCoverage([rows[0],rows[0]],[],types),/duplicate/);
});

test('有完整閱讀投影的圖文材料可並排；計算過程及單題保持原介面',()=>{
 const q={type:'fields',fields:[],prompt:{text:'',media:[]}},p={passage:{text:'圖文',media:[{kind:'image'}]}};
 assert.equal(readingWorkbenchSupported(q,p),true);
 assert.equal(readingWorkbenchSupported({...q,work:{input:'expression'}},p),false);
 assert.equal(readingWorkbenchSupported(q,{...p,standalone:true}),false);
});

test('同題聽力依次播放，換題銷毀後停止舊音檔及失效播放',()=>{
 const scope=createMediaScope({context:{},read:async()=>''});
 class Audio extends EventTarget{paused=false;source=true;loads=0;pause(){this.paused=true;}removeAttribute(){this.source=false;}load(){this.loads++;}}
 const a=new Audio(),b=new Audio();scope.bindAudio(a);scope.bindAudio(a);scope.bindAudio(b);
 a.dispatchEvent(new Event('play'));assert.equal(b.paused,true);
 a.paused=false;b.paused=false;b.dispatchEvent(new Event('play'));assert.equal(a.paused,true);assert.equal(b.paused,false);
 scope.dispose();assert.equal(b.paused,true);assert.equal(a.source,false);assert.equal(a.loads,1);
 a.paused=false;a.dispatchEvent(new Event('play'));assert.equal(a.paused,true);
});

test('考古卷及夥伴的簡易媒體scope同樣停止前一段，不重用失效scope',()=>{
 const doc={};class Audio extends EventTarget{tagName='AUDIO';ownerDocument=doc;paused=false;pause(){this.paused=true;}}
 let alive=true;const scope={active:()=>alive},a=new Audio(),b=new Audio();bindQuizMedia(a,scope);bindQuizMedia(b,scope);
 a.dispatchEvent(new Event('play'));b.dispatchEvent(new Event('play'));assert.equal(a.paused,true);
 alive=false;b.paused=false;b.dispatchEvent(new Event('play'));assert.equal(b.paused,true);
});

test('考古卷只計啟用當前版，歷史版與停用卷不灌入題數',()=>{
 const v=(id,kind)=>({id,document:{catalog:{grade:3,subject:'國語'},groups:[{kind,fields:[{id:'private-field',answer:'不得輸出'}]}]}});
 const r=auditPastCoverage([v('old','short'),v('now','manual'),v('disabled','set')],[{enabled:true,active_version:'now'},{enabled:false,active_version:'disabled'}]);
 assert.equal(r.activeVersions,1);assert.equal(r.totalGroups,1);assert.equal(r.groups[0].kind,'manual');assert.equal(r.historicalVersions,3);assert.ok(!JSON.stringify(r).includes('不得輸出'));
 assert.equal(auditPastCoverage([],[{enabled:true,active_version:'missing'}]).missingActiveVersions,1);
});
