import test from 'node:test';
import assert from 'node:assert/strict';
import {emfTextRuns,emfMatchingColumns} from './lib/quiz-emf-text.mjs';
import {divisionTextMatchingCandidate} from './lib/quiz-matching-division-text.mjs';
const fixture=(extra={})=>{
 const entries=[{x:10,y:10,text:'(１)有18顆糖，平分成5袋，每袋3顆，剩下3顆。'},{x:10,y:100,text:'２○有20枝筆，平分給3人，每人6枝，剩下2枝。'},{x:100,y:30,text:'\u2027'},{x:150,y:30,text:'\u2027'},{x:100,y:130,text:'\u2027'},{x:150,y:130,text:'\u2027'},{x:200,y:40,text:'ㄅ20÷3＝6…2'},{x:200,y:140,text:'ㄆ18÷5＝3…3'},...extra.entries??[]];
 const header=Buffer.alloc(88);header.writeUInt32LE(1);header.writeUInt32LE(88,4);header.write(' EMF',40);
 return Buffer.concat([header,...entries.map(r=>{const t=Buffer.from(r.text,'utf16le'),b=Buffer.alloc(Math.ceil((76+t.length)/4)*4);b.writeUInt32LE(84);b.writeUInt32LE(b.length,4);b.writeInt32LE(r.x,36);b.writeInt32LE(r.y,40);b.writeUInt32LE(t.length/2,44);b.writeUInt32LE(76,48);t.copy(b,76);return b;})]);
};
const source=()=>({id:'HL115G3M-00000001',source_files:[{name:'preamble-question.docx.gz',sha256:'a'.repeat(64)}],question:{content:{text:'連連看。',media:[{kind:'image',url:'https://example.invalid/image.png'}]}},answer:{content:{text:'(1)ㄆ；(2)ㄅ',media:[]}}});
const review=()=>({logical_targets:[{positions:[{position_id:'p1',kind:'single_choice',reference_value:'ㄆ'},{position_id:'p2',kind:'single_choice',reference_value:'ㄅ'}]}]});
test('擷取原向量文字，保持端點原序及教師鍵，獨立驗算全部算式',()=>{
 const out=divisionTextMatchingCandidate(source(),review(),{},fixture()),q=out.candidate.doc.blocks[0].questions[0];
 assert.deepEqual(q.answer.fields,{f1:['r2'],f2:['r1']});assert.equal(q.fields[0].options[0].content.text,'20÷3＝6…2');assert.equal(q.prompt.media.length,0);assert.ok(q.fields[0].label.includes('18顆糖'));assert.deepEqual(out.plan.omit,[]);
});
test('拒絕損毀長度、文字偏移及非 Unicode glyph 索引',()=>{
 for(const mutate of [b=>b.writeUInt32LE(0,92),b=>b.writeUInt32LE(99999,88+48),b=>b.writeUInt32LE(0x10,88+52)]){const b=fixture();mutate(b);assert.throws(()=>emfTextRuns(b));}
 assert.throws(()=>emfTextRuns(fixture().subarray(0,100)));
});
test('拒絕漏分配的原文及左右點數不符',()=>{
 assert.throws(()=>emfMatchingColumns(emfTextRuns(fixture({entries:[{x:120,y:10,text:'不可遺漏的題意'}]}))));
 const runs=emfTextRuns(fixture());runs.pop();runs.push({x:100,y:200,text:'\u2027'});assert.throws(()=>emfMatchingColumns(runs));
});
test('拒絕教師鍵或固定複核不一致',()=>{
 const s=source();s.answer.content.text='(1)ㄅ；(2)ㄆ';assert.throws(()=>divisionTextMatchingCandidate(s,review(),{},fixture()));
 const r=review();r.logical_targets[0].positions[0].reference_value='ㄅ';assert.throws(()=>divisionTextMatchingCandidate(source(),r,{},fixture()));
 const bad=fixture(),at=bad.indexOf(Buffer.from('20÷3＝6…2','utf16le'));assert.ok(at>0);bad.writeUInt16LE('7'.charCodeAt(0),at+5*2);assert.throws(()=>divisionTextMatchingCandidate(source(),review(),{},bad));
});
test('未支援文字、轉換與點陣圖不可被默默略過',()=>{
 for(const type of [35,36,83,96,97,108,77,81,114]){const record=Buffer.alloc(8);record.writeUInt32LE(type);record.writeUInt32LE(8,4);assert.throws(()=>emfTextRuns(Buffer.concat([fixture(),record])));}
 const decoration=Buffer.alloc(100);decoration.writeUInt32LE(76);decoration.writeUInt32LE(100,4);decoration.writeUInt32LE(0x00F00021,40);assert.ok(emfTextRuns(Buffer.concat([fixture(),decoration])).length);
 decoration.writeUInt32LE(4,96);assert.throws(()=>emfTextRuns(Buffer.concat([fixture(),decoration])));
});
