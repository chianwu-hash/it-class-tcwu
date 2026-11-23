import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateDocument} from '../../shared/quiz-document.mjs';

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export const readJson = async file => JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));

export function batchCounts(packet) {
  assert.equal(packet.schema, 1);
  assert.ok(Array.isArray(packet.candidates) && packet.candidates.length);
  assert.equal(new Set(packet.candidates.map(c => c.source)).size, packet.candidates.length);
  const questions = packet.candidates.flatMap(c => validateDocument(c.doc).blocks.flatMap(b => b.questions));
  assert.equal(new Set(questions.map(q => q.id)).size, questions.length);
  const media = new Set();
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (typeof value.url === 'string') media.add(value.url);
    for (const child of Object.values(value)) if (typeof child === 'object') walk(child);
  }
  packet.candidates.forEach(c => walk(c.doc));
  return {sources: packet.candidates.length, questions: questions.length,
    positions: questions.reduce((n, q) => n + (q.fields?.length ?? 1), 0),
    images: media.size, samples: Math.max(1, Math.ceil(packet.candidates.length * 0.05))};
}

export function expectedResponse(question, work) {
  if (question.type === 'single') return question.answer.option_id;
  assert.equal(question.type, 'fields');
  const fields = Object.fromEntries(question.fields.map(f => [f.id, question.answer.fields[f.id][0]]));
  for (const tuple of question.answer.tuples ?? []) Object.assign(fields, tuple.accepted[0]);
  if (question.work) assert.equal(typeof work, 'string');
  return {v: 1, f: fields, ...(question.work ? {w: work} : {})};
}

export async function loadBatch(file) {
  const bytes = await fs.readFile(file);
  const packet = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  const counts = batchCounts(packet);
  assert.equal(packet.studyRows.length, counts.questions);
  const questions = packet.candidates.flatMap(c => c.doc.blocks.flatMap(b => b.questions));
  assert.deepEqual(new Set(packet.studyRows.map(r => r.question_id)), new Set(questions.map(q => q.id)));
  for (const row of packet.studyRows) {
    assert.ok(row.reference.includes(row.primary));
    assert.ok(row.student_explanation?.trim() && row.teacher_notes?.reason?.trim());
    for (const n of row.reference) assert.ok(packet.pages.some(p => p.printed === n && p.verified));
  }
  assert.equal(packet.samples.length, counts.samples);
  assert.equal(new Set(packet.samples.map(s => s.source)).size, counts.samples);
  for (const sample of packet.samples) {
    const candidate = packet.candidates.find(c => c.source === sample.source);
    const q = candidate?.doc.blocks.flatMap(b => b.questions).find(q => q.id === sample.question_id);
    assert.ok(q);
    assert.ok(packet.studyRows.some(r => r.question_id === q.id));
    expectedResponse(q, sample.work);
  }
  for (const [source, hash] of Object.entries(packet.inputs)) assert.equal(digest(await fs.readFile(source)), hash, '固定來源檔案已改變');
  return {packet, counts, sha256: digest(bytes)};
}

export function assertOAuthReceipt(batch,receipt) {
  assert.ok(batch && receipt.passed && receipt.formalOAuth, '正式抽驗收據未通過');
  assert.equal(receipt.packetSha,batch.sha256,'正式抽驗批次不符');
  assert.equal(receipt.sampleCount,batch.counts.samples,'正式抽驗數不符');
  assert.equal(receipt.samples?.length,batch.counts.samples,'正式抽驗數不符');
  assert.deepEqual(receipt.samples.map(s=>s.question).sort(),batch.packet.samples.map(s=>s.question_id).sort(),'正式抽驗題目不符');
}

export function practiceWriteIntent(plan,isolated,operation) {
  assert.ok(['stage','activate'].includes(operation));
  assert.equal(plan.packetSha,isolated.packetSha);
  assert.ok(isolated.sql[operation]);
  return {packetSha:plan.packetSha,operation,sqlSha:isolated.sql[operation],session:plan.ids.session,samples:plan.ids.samples};
}
export async function freezeJson(file,value) {
  try {await fs.writeFile(file,JSON.stringify(value,null,2),{flag:'wx'});}
  catch(error){if(error.code!=='EEXIST')throw error;assert.deepEqual(await readJson(file),value,'固定寫入意圖已改變');}
}
