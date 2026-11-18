import fs from 'node:fs';import {pathToFileURL} from 'node:url';
import {convertChoiceQuestion} from '../shared/quiz-choice-conversion.mjs';
import {presentationSignature} from '../shared/quiz-presentation-signature.mjs';
import {sourceStream} from '../shared/quiz-content-slices.mjs';
import {sourceBoxQuestion,sourceBoxReading} from '../shared/quiz-source-boxes.mjs';
const prepare=q=>convertChoiceQuestion(q,{sourceBoxes:false}).question;
export function auditSourceBoxes({native,pool,copies=[]}){
 const sources=new Map(native.map(n=>[n.id,n])),registry={},issues=[],findings=[];
 for(const row of pool){const n=sources.get(row.source_item_id);if(!n)continue;const q=prepare(row.question),text=sourceStream(q.prompt),ranges=[];
  if(!/^[a-f0-9]{64}$/u.test(n.sha256)||!n.boxes?.length||text===null){issues.push({id:q.id,code:'source_required'});continue;}
  let valid=true;for(const word of n.boxes){const at=text.indexOf(word);if(!word.trim()||at<0||text.indexOf(word,at+1)>=0){valid=false;break;}ranges.push([at,at+word.length]);}
  ranges.sort((a,b)=>a[0]-b[0]);if(!valid||ranges.some((r,i)=>i&&r[0]<ranges[i-1][1])){issues.push({id:q.id,code:'source_range_ambiguous'});continue;}
  const paired=n.type_code==='81'&&n.question.includes('□中的詞語是什麼意思')&&q.type==='fields'&&q.fields.every(f=>f.input==='single')&&q.fields.length===ranges.length;
  const p={guard:presentationSignature(q),sourceSha256:n.sha256,ranges,paired},view=sourceBoxQuestion(q,{[q.id]:[p]});
  if(view===q||paired&&!sourceBoxReading(view)){issues.push({id:q.id,code:'source_question_mapping_required'});continue;}
  (registry[q.id]??=[]).push(p);findings.push({id:q.id,source:n.id,boxes:ranges.length,paired});
 }
 let changedCopies=0;for(const row of [...pool,...copies]){const raw=JSON.stringify(row.question),q=prepare(row.question),view=sourceBoxQuestion(q,registry);if(q===view)continue;changedCopies++;
  if(q.fields!==view.fields||q.answer!==view.answer||q.prompt.text!==view.prompt.text||q.prompt.media!==view.prompt.media||raw!==JSON.stringify(row.question)||sourceBoxQuestion(view,registry)!==view)issues.push({id:q.id,code:'source_or_response_changed'});
 }
 return {registry,report:{registered:Object.keys(registry).length,changedCopies,findings,issues}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const result=auditSourceBoxes(JSON.parse(fs.readFileSync(process.argv[2],'utf8')));fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2));if(!result.report.issues.length&&process.argv[4])fs.writeFileSync(process.argv[4],'// NAS DOCX border ranges and display guards only. No source text or keys.\nexport const reviewedSourceBoxes='+JSON.stringify(result.registry,null,2)+';\n');console.log(JSON.stringify(result.report));if(result.report.issues.length)process.exitCode=1;}
