import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateSketch} from '../../shared/sketch/contract.mjs';
import {validateDocument} from '../../shared/quiz-document.mjs';
import {batchMediaAssets} from './quiz-batch-media.mjs';
import {arrangementPlan,readArrangement} from '../../shared/quiz-pattern-arrangement.mjs';
import {gridDrawingPlan} from '../../shared/quiz-grid-drawing.mjs';
import {isSourceRoute,sourceRoutePlan,readSourceRoute} from '../../shared/quiz-source-route.mjs';
import {fractionColorsPlan,isFractionColorsQuestion,readFractionColors} from '../../shared/quiz-fraction-colors.mjs';
import {fractionComparisonPlan,readFractionComparison} from '../../shared/quiz-fraction-comparison.mjs';
import {fractionShadingPlan,fractionBarPlan,fractionRectPlan,readFractionShading} from '../../shared/quiz-fraction-shading.mjs';

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export const readJson = async file => JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));

export function validateBatchCatalog(packet) {
  const units = new Set(packet.candidates.map(c => c.doc.catalog?.unit).filter(Boolean));
  if (units.size <= 1) return;
  assert.ok(typeof packet.catalogUnit === 'string' && packet.catalogUnit.trim(), '跨單元批次須明列完整目錄單元');
  const listed = new Set(packet.catalogUnit.split('、').map(s => s.trim()));
  for (const unit of units) assert.ok(listed.has(unit), '批次目錄遺漏來源單元：' + unit);
}

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

export function expectedResponse(question, work, openResponse) {
  if (question.type === 'single') return question.answer.option_id;
  if(question.type==='open'){
    const grid = gridDrawingPlan(question), arrangement = arrangementPlan(question);
    assert.ok(grid || arrangement || question.fields.every(f=>f.input==='text'),'Open sketch requires its own reviewed batch adapter');
    assert.ok(openResponse&&openResponse.v===1&&openResponse.f&&typeof openResponse.f==='object'&&!Array.isArray(openResponse.f));
    assert.deepEqual(Object.keys(openResponse).sort(),['f','v']);assert.deepEqual(Object.keys(openResponse.f).sort(),question.fields.map(f=>f.id).sort());
    if (arrangement) {
      validateSketch(openResponse.f.drawing);
      assert.ok(readArrangement(openResponse.f.drawing, arrangement)?.size, 'Invalid reviewed arrangement example');
      return structuredClone(openResponse);
    }
    if (grid) {
      validateSketch(openResponse.f.drawing);
      const onLine = (value, lines) => lines.some(line => Math.abs(value - line) < 1e-7);
      const valid = ([x,y]) => onLine(x * grid.width,grid.xs) && onLine(y * grid.height,grid.ys);
      for (const stroke of openResponse.f.drawing.strokes) {
        assert.ok(stroke.length===2 && stroke.every(valid), 'The reviewed grid example must use the original intersections');
      }
      return structuredClone(openResponse);
    }
    for(const f of question.fields)assert.ok(typeof openResponse.f[f.id]==='string'&&openResponse.f[f.id].trim()&&openResponse.f[f.id].length<=250);
    assert.ok(JSON.stringify(openResponse).length<=2000);return structuredClone(openResponse);
  }
  assert.equal(question.type, 'fields');
  const fields = Object.fromEntries(question.fields.map(f => [f.id, question.answer.fields[f.id][0]]));
  for (const tuple of question.answer.tuples ?? []) Object.assign(fields, tuple.accepted[0]);
  if (question.work?.input==='expression') assert.ok(typeof work==='string'&&work.trim());
  else if(question.work?.input==='sketch')validateSketch(work);
  else assert.ok(!question.work);
  const response = {v: 1, f: fields, ...(question.work ? {w: work} : {})};
  if (isSourceRoute(question)) {
    const plan=sourceRoutePlan(question);
    assert.ok(plan && question.answer.fields.route.every(value=>readSourceRoute(plan,value)?.at(-1)===plan.end),
      'Reviewed paths must link the original start and end');
  }
  if (isFractionColorsQuestion(question)) {
    const colors = fractionColorsPlan(question);
    assert.ok(colors && readFractionColors(colors,response)?.size===colors.regions.length,'Reviewed colors must match the original image and fill the board');
  }
  const fraction = fractionComparisonPlan(question);
  if (fraction) assert.ok(readFractionComparison(fraction,response),'Reviewed shading must match both stored counts');
  if (/_fraction_(?:(?:bar|rect)_)?shade_\d+$/u.test(question.id)||
      question.work?.input==='sketch'&&question.fields.some(f=>f.id==='colored')) {
    const shading=fractionShadingPlan(question)||fractionBarPlan(question)||fractionRectPlan(question);
    assert.ok(shading&&readFractionShading(shading,response)?.size,'Reviewed shading must match the image and stored count');
  }
  return response;
}

export async function loadBatch(file) {
  const bytes = await fs.readFile(file);
  const packet = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  const counts = batchCounts(packet);
  validateBatchCatalog(packet);
  batchMediaAssets(packet);
  assert.equal(packet.studyRows.length, counts.questions);
  const questions = packet.candidates.flatMap(c => c.doc.blocks.flatMap(b => b.questions));
  assert.deepEqual(new Set(packet.studyRows.map(r => r.question_id)), new Set(questions.map(q => q.id)));
  validatePageBindings(packet.pages);
  for (const row of packet.studyRows) {
    assert.ok(row.reference.includes(row.primary));
    assert.ok(row.student_explanation?.trim() && row.teacher_notes?.reason?.trim());
    for (const n of row.reference) assert.ok(packet.pages.some(p => p.printedPages.includes(n) && p.verified));
  }
  assert.equal(packet.samples.length, counts.samples);
  assert.equal(new Set(packet.samples.map(s => s.source)).size, counts.samples);
  for (const sample of packet.samples) {
    const candidate = packet.candidates.find(c => c.source === sample.source);
    const q = candidate?.doc.blocks.flatMap(b => b.questions).find(q => q.id === sample.question_id);
    assert.ok(q);
    assert.ok(packet.studyRows.some(r => r.question_id === q.id));
    expectedResponse(q, sample.work,packet.openResponses?.[q.id]);
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
  for(const s of receipt.samples){const q=batch.packet.candidates?.flatMap(c=>c.doc.blocks.flatMap(b=>b.questions)).find(q=>q.id===s.question);if(q?.type==='open'){assert.equal(s.correct,null);assert.equal(s.assessment_status,'self_checked');assert.ok(['understood','practice'].includes(s.rating));assert.ok(s.saved_and_reopened&&s.self_checked_and_reopened);}}
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

export function validatePageBindings(pages) {
  assert.ok(Array.isArray(pages) && pages.length);
  const ids=new Map(),printed=new Map();
  for(const page of pages){
    assert.ok(typeof page.id==='string' && page.id);
    assert.ok(Number.isInteger(page.printed) && page.printed>0);
    assert.ok(Array.isArray(page.printedPages) && page.printedPages.length && page.printedPages.every(n=>Number.isInteger(n)&&n>0));
    assert.ok(page.printedPages.includes(page.printed),'引用印刷頁不在課本頁面中');
    assert.equal(new Set(page.printedPages).size,page.printedPages.length);
    const sha=page.sha??page.sha256;assert.match(sha,/^[a-f0-9]{64}$/);
    const spec={printedPages:page.printedPages,sha};
    if(ids.has(page.id))assert.deepEqual(ids.get(page.id),spec,'同一課本圖的頁碼或 SHA 不符');
    ids.set(page.id,spec);
    for(const n of page.printedPages){if(printed.has(n))assert.equal(printed.get(n),page.id,'同一印刷頁對應多張課本圖');printed.set(n,page.id);}
  }
}

// Timing is intentionally separate from every hashed production receipt.
export async function recordBatchTime(packet,packetSha,event) {
  if(!packet.timing)return;
  assert.ok(['development','production'].includes(packet.timing.mode));
  assert.ok(Number.isFinite(Date.parse(packet.timing.selectionStartedAt)));
  assert.match(packet.prefix,/^[a-z0-9-]+$/);assert.match(event,/^[a-z-]+$/);
  const folder=packet.outputDir+'/'+packet.prefix+'-timing';await fs.mkdir(folder,{recursive:true});
  const file=folder+'/'+event+'.private.json';
  const value={packetSha,event,mode:packet.timing.mode,selectionStartedAt:packet.timing.selectionStartedAt,at:new Date().toISOString()};
  try {await fs.writeFile(file,JSON.stringify(value,null,2),{flag:'wx'});return value;}
  catch(error){if(error.code!=='EEXIST')throw error;const old=await readJson(file);assert.equal(old.packetSha,packetSha);assert.equal(old.event,event);return old;}
}

export async function preserveOAuthReceipt(file,batch,proof) {
  assertOAuthReceipt(batch,proof);
  try {await fs.writeFile(file,JSON.stringify(proof,null,2),{flag:'wx'});}
  catch(error){
    if(error.code!=='EEXIST')throw error;
    const original=await readJson(file);assertOAuthReceipt(batch,original);
    const fixed=s=>({source:s.source,question:s.question,session:s.session,version:s.version,package:s.package,checks:s.checks,correct:s.correct,saved_and_reopened:s.saved_and_reopened});
    assert.deepEqual(original.samples.map(fixed),proof.samples.map(fixed),'OAuth 重驗與固定證據不符');
    await fs.writeFile(file+'.recheck-'+Date.now(),JSON.stringify(proof,null,2),{flag:'wx'});
  }
}
