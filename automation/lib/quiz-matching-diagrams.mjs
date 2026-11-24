import assert from 'node:assert/strict';
import {validateDocument} from '../../shared/quiz-document.mjs';
import {presentationSignature} from '../../shared/quiz-presentation-signature.mjs';

const rational=value=>{
  assert.match(value,/^\d+(?:\/\d+)?$/);
  const [n,d=1]=value.split('/').map(Number);assert.ok(Number.isSafeInteger(n)&&Number.isSafeInteger(d)&&d>0);
  return [n,d];
};
export function equalFraction(a,b){const [n,d]=rational(a),[m,e]=rational(b);return BigInt(n)*BigInt(e)===BigInt(m)*BigInt(d);}

// Takes a separately reviewed source/crop mapping; it never infers answers from
// image colour or invents a one-to-one restriction.
export function diagramMatchingCandidate(src,proof,{catalog,owner,correction}){
  assert.equal(src.id,proof.source);
  assert.ok(proof.croppedImagesVisuallyReviewed&&proof.numbersAndConnectorDotsExcluded);
  assert.ok(proof.originalFilesVerified.length>0);
  const count=proof.crops.length;assert.ok(count>=2&&count<=8);
  assert.equal(proof.mapping.length,count);
  const right=proof.rightValues;assert.ok(right.length>=2&&right.length<=8);right.forEach(rational);
  const teacherText=src.answer.content.text.replace(/\$\\frac\{(\d+)\}\{(\d+)\}\$/gu,'$1/$2').normalize('NFKC').replace(/\s/gu,'').replace(/^答案[:：]/u,'');
  const teacherParts=[...teacherText.matchAll(/(?:\((\d)\)|([1-8]))(?:→|->)?([^;]+)/gu)];
  assert.equal(teacherParts.map(m=>m[0]).join(';'),teacherText,'Incomplete original teacher key');
  assert.equal(teacherParts.length,count);
  const options=right.map((value,i)=>({id:'r'+(i+1),content:{text:(value.includes('/')?'$\\frac{'+value.replace('/','}{')+'}$':value)+(proof.unit??''),media:[]}}));
  const answers={},mapping=[];
  for(const [i,m] of proof.mapping.entries()){
    assert.equal(m.leftIndex,i);assert.equal(m.position,`${src.id}/target-1/position-${i+1}`);
    assert.ok(Number.isInteger(m.rightIndex)&&right[m.rightIndex]!==undefined);
    const teacher=teacherParts[i];assert.equal(Number(teacher[1]??teacher[2]),i+1);
    assert.equal(teacher[3],m.teacherKey.normalize('NFKC').replace(/\s/gu,''));
    if(/^[ㄅㄆㄇㄈㄉㄊㄋㄌ]$/u.test(teacher[3]))assert.equal('ㄅㄆㄇㄈㄉㄊㄋㄌ'.indexOf(teacher[3]),m.rightIndex,'Teacher option order mismatch');
    else assert.equal(teacher[3],right[m.rightIndex]+(proof.unit??''),'Teacher original fraction mismatch');
    if(m.fixedReviewKey!==m.teacherKey){
      assert.equal(correction?.source,src.id);assert.equal(correction?.position,m.position);
      assert.equal(correction?.oldFixedKey,m.fixedReviewKey);assert.equal(correction?.correctedKey,m.teacherKey);
      assert.equal(correction?.observedFraction,m.observedFraction);assert.equal(correction?.passed,true);
    }
    assert.ok(equalFraction(m.observedFraction,right[m.rightIndex]));
    const accepted=[m.rightIndex,...right.map((_,j)=>j).filter(j=>j!==m.rightIndex&&equalFraction(m.observedFraction,right[j]))];
    assert.deepEqual(new Set(accepted),new Set(m.equivalentRightIndices));
    answers['f'+(i+1)]=accepted.map(j=>options[j].id);
    mapping.push({...m,acceptedRightIndices:accepted});
  }
  const media=proof.crops.map((c,i)=>{
    assert.equal(c.index,i+1);assert.equal(c.pixelsUnchanged,true);
    assert.equal(c.sourcePngSha256,proof.sourcePngSha256);assert.match(c.sha256,/^[a-f0-9]{64}$/);
    return {kind:'image',url:`https://quiz-media.invalid/${owner}/${c.sha256}`,alt:`第${i+1}個原圖`};
  });
  const text=src.question.content.text;
  const q={id:'hlg3m_'+src.id.slice(-8)+'_mf'+proof.sourcePngSha256.slice(0,12),type:'fields',prompt:{text,media,layout:[{type:'paragraph',runs:[{type:'text',text}]},...media.map((_,i)=>({type:'paragraph',runs:[{type:'image',media_index:i,width:Math.min(800,proof.crops[i].size[0])}]}))]},fields:media.map((_,i)=>({id:'f'+(i+1),label:`第${i+1}個圖形`,input:'single',options:structuredClone(options)})),answer:{format:'fields-v1',fields:answers},explanation:{text:mapping.map((m,i)=>`圖${i+1}的塗色部分是${m.observedFraction}${proof.unit??''}。`).join('\n'),media:[]}};
  const doc=validateDocument({schema:1,title:'圖形與分數連線',catalog,blocks:[{id:'source_'+src.id.slice(-8),material:{text:'',media:[]},questions:[q]}]});
  const plan={signature:presentationSignature(q),boards:[{indices:q.fields.map((_,i)=>i),unique:false,leftCrops:proof.crops.map((c,i)=>({index:i,viewBox:{x:0,y:0,width:c.size[0],height:c.size[1],sourceWidth:c.size[0],sourceHeight:c.size[1]}}))}],omit:[[text.length,text.length+1+media.length*2]],sourceSha256:proof.originalFilesVerified.find(f=>f.path.endsWith('preamble-question.docx.gz')).sha256};
  return {candidate:{source:src.id,doc},plan,mapping};
}
