import assert from 'node:assert/strict';
import test from 'node:test';
import {arrangementPlan,arrangementSketch,readArrangement} from '../shared/quiz-pattern-arrangement.mjs';
import {validateSketch} from '../shared/sketch/contract.mjs';

test('all placement cells round trip including offset circle rows and both fill states',()=>{
  for(const [kind,tiles] of [['square',['square']],['disc',['outline','filled']]]) {
    for(const tile of tiles){
      const cells=new Map(Array.from({length:49},(_,index)=>[index,tile]));
      const drawing=arrangementSketch(cells);
      assert.doesNotThrow(()=>validateSketch(drawing));
      assert.deepEqual(readArrangement(drawing,{kind}),cells);
    }
  }
  const alternating=new Map([[3,'outline'],[9,'filled'],[10,'filled'],[16,'outline']]);
  const drawing=arrangementSketch(alternating);
  assert.deepEqual(readArrangement(drawing,{kind:'disc'}),alternating);
  assert.equal(readArrangement(drawing,{kind:'square'}),null);
  drawing.strokes[1][2]=[0,0];
  assert.equal(readArrangement(drawing,{kind:'disc'}),null);
});

test('the arrangement board is bound to the specific original image and question type',()=>{
  const sha='86a82f46dee68fb5669bce6aec32660f5ab5a17b85fcad00c47c674b085d646a';
  const q={id:'hlg3m_046d8024_arrangement_v1',type:'open',fields:[{id:'drawing',input:'sketch'}],
    prompt:{media:[{kind:'image',url:'https://example.invalid/'+sha}]}};
  assert.deepEqual(arrangementPlan(q),{kind:'disc'});
  assert.equal(arrangementPlan({...q,id:'hlg3m_019e656d_arrangement_v1'}),null);
  assert.equal(arrangementPlan({...q,type:'fields'}),null);
});
