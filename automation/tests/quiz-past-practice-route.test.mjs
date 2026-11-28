import test from 'node:test';import assert from 'node:assert/strict';
import {pastPracticeHref} from '../../shared/quiz-wrong-route.mjs';
const origin='https://example.invalid',query='?cloud=1&learning=1&session=00000000-0000-4000-8000-000000000001';
test('考古錯題延伸練習接受三四六九年級本人年級網址，保留原場次參數',()=>{
 for(const grade of [3,4,6,9]){
  const path=`/grade${grade}/115-1/quiz.html`+query;
  assert.equal(pastPracticeHref(path,grade,origin),origin+path);assert.equal(pastPracticeHref(origin+path,String(grade),origin),origin+path);
 }
 assert.equal(pastPracticeHref('/grade9/115-1/quiz.html'+query,9,'http://localhost:8876'),'http://localhost:8876/grade9/115-1/quiz.html'+query);
});
test('拒絕外站、其他年級、非練習頁及無效來源，不擴充後端授權',()=>{
 for(const href of ['https://other.invalid/grade9/115-1/quiz.html','//other.invalid/grade9/115-1/quiz.html','/grade3/115-1/quiz.html','/grade6/115-1/quiz.html','/grade9/115-1/index.html','/grade9/114-1/quiz.html','javascript:alert(1)','data:text/html,x','https://user:password@example.invalid/grade9/115-1/quiz.html',null,undefined,{},'http://[bad'])assert.throws(()=>pastPracticeHref(href,9,origin),/練習連結無效/);
 for(const grade of [null,undefined,0,5,7,'grade9',NaN])assert.throws(()=>pastPracticeHref('/grade9/115-1/quiz.html',grade,origin),/練習連結無效/);
});
