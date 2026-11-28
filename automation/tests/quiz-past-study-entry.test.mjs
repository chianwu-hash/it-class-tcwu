import test from 'node:test';
import assert from 'node:assert/strict';
import {partnerPastStudyHref,readPastStudyEntry,assertPastStudySource,assertPastStudySnapshot} from '../../shared/quiz-past-study-entry.mjs';

const id='zhongzheng-114-1-g9-exam2-social', version='c04c3b2f-552d-442c-ae06-f33274cf8c0e';
const room={paperInfo:{grade:9,past:{sourcePaper:id},sourceVersion:version}};
const question={past:{group:'choice-38'},attempts:[]};
const href=()=>new URL(partnerPastStudyHref(room,question),'https://example.invalid').href;
test('未送答即可導向固定版本與原題組，不攜帶小隊、學生或作答資料',()=>{
 const url=new URL(href());
 assert.equal(url.pathname,'/grade9/115-1/past-exam.html');
 assert.deepEqual([...url.searchParams.keys()],['paper','study_version','study_group']);
 assert.deepEqual(readPastStudyEntry(url.href,id),{paperId:id,version,groupId:'choice-38'});
 assert.equal(partnerPastStudyHref(room,{...question,attempts:[{correct:false}]}),partnerPastStudyHref(room,question));
});
test('舊房、其他年級、未核教材與不合法題組不提供教材連結',()=>{
 for(const changed of [null,{paperInfo:{...room.paperInfo,grade:3}},{paperInfo:{...room.paperInfo,sourceVersion:'old'}},{paperInfo:{...room.paperInfo,past:{sourcePaper:'other'}}}]) assert.equal(partnerPastStudyHref(changed,question),null);
 for(const group of ['',null,'../other','" onclick="bad','x'.repeat(101)]) assert.equal(partnerPastStudyHref(room,{past:{group}}),null);
});
test('一般原卷網址不加入限制；不完整、重複或冒用教材參數拒絕',()=>{
 assert.equal(readPastStudyEntry('https://example.invalid/grade9/115-1/past-exam.html?paper='+id,id),null);
 for(const mutate of [u=>u.searchParams.delete('study_group'),u=>u.searchParams.append('study_version',version),u=>u.searchParams.set('study_version','old'),u=>u.pathname='/grade3/115-1/past-exam.html',u=>u.searchParams.set('paper','other')]){
  const u=new URL(href());mutate(u);assert.throws(()=>readPastStudyEntry(u.href,id),/版本/);
 }
});
test('開卷前核對正式目錄，開卷後再次核對版本與題組，防止讀取期間換版',()=>{
 const entry=readPastStudyEntry(href(),id);
 assert.doesNotThrow(()=>assertPastStudySource(entry,{papers:[{id,grade:9,enabled:true,version}]}));
 for(const paper of [null,{id,grade:9,enabled:false,version},{id,grade:9,version:'changed'},{id,grade:6,version}]) assert.throws(()=>assertPastStudySource(entry,{papers:paper?[paper]:[]}),/版本/);
 assert.doesNotThrow(()=>assertPastStudySnapshot(entry,{version,groups:[{id:'choice-38'}]}));
 assert.throws(()=>assertPastStudySnapshot(entry,{version:'changed',groups:[{id:'choice-38'}]}),/版本/);
 assert.throws(()=>assertPastStudySnapshot(entry,{version,groups:[{id:'other'}]}),/版本/);
 assert.doesNotThrow(()=>assertPastStudySource(null,null));
 assert.doesNotThrow(()=>assertPastStudySnapshot(null,null));
});
