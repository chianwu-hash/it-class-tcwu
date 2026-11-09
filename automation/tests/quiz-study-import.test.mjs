import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {execFileSync} from 'node:child_process';import {randomUUID} from 'node:crypto';
test('離線匯入不連網、不啟用；保留拉頁、來源SHA檢查及缺供圖紀錄',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'quiz-study-import-')),out=path.join(dir,'.chat-mode'),file=path.join(dir,'packet.private.json');
 const packet={schema:1,books:[{id:randomUUID(),grade:6,schoolYear:115,semester:1,title:'合成課本',sourceSha256:'a'.repeat(64),pages:[{id:'79-80',printedPages:[79,80],sequence:'u3',sha256:'b'.repeat(64),bytes:100}]}],packages:[{id:randomUUID(),kind:'normal',versionId:randomUUID(),sourceDocumentSha256:'c'.repeat(64),reviewed:true,provenance:{source:'synthetic'},items:[]}]};
 packet.packages[0].items=[{questionId:'water',bookId:packet.books[0].id,primaryPage:79,referencePages:[79,80],studentExplanation:"先比較'水流'的速度。",origin:'ai'}];
 const run=()=>execFileSync(process.execPath,['automation/build-quiz-study-import.mjs','--packet',file,'--out',out],{encoding:'utf8',stdio:'pipe'});
 try{
  await fs.writeFile(file,JSON.stringify(packet));assert.ok(run().includes('"enabled":false'));
  const sql=await fs.readFile(path.join(out,'study-import.private.sql'),'utf8'),report=JSON.parse(await fs.readFile(path.join(out,'study-import-report.private.json'),'utf8'));
  assert.ok(sql.includes('array[79,80]'));assert.ok(sql.includes("先比較''水流''"));assert.ok(sql.includes('study_source_changed'));assert.ok(sql.includes('study_question_missing'));assert.ok(!sql.includes('enabled=true'));assert.equal(report.pending.length,1);
  packet.packages[0].items[0].questionId="bad$$';drop table x;";await fs.writeFile(file,JSON.stringify(packet));assert.throws(run);
  packet.packages[0].items[0].questionId='water';packet.books[0].pages.push({...packet.books[0].pages[0],id:'80'});await fs.writeFile(file,JSON.stringify(packet));assert.throws(run);
 }finally{assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep+'quiz-study-import-'));await fs.rm(dir,{recursive:true,force:true});}
});
