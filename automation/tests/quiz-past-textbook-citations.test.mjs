import assert from 'node:assert/strict';
import test from 'node:test';
import {pastTextbookCitation} from '../../shared/quiz-past-textbook-citations.mjs';

const versions=[
 {year:113,id:'2f1f3092-8c07-42f5-96db-cfff37ae5070',total:33},
 {year:114,id:'0bb00384-8a6a-49ec-9941-fa4a4896a26a',total:40},
];

test('兩份自然考古卷的課本對照僅適用於已固定版本與題組',()=>{
 for(const {year,id,total} of versions){
  for(let number=1;number<=total;number++){
   const group='choice-'+String(number).padStart(2,'0'),citation=pastTextbookCitation(id,group);
   assert.match(citation.book,new RegExp(year+'上學期.*課本$'));
   assert.ok(citation.sections.length);
   for(const {chapter,pages,pdfPages,downloadUrl} of citation.sections){
    const range={2:[30,61],3:[62,87],5:[130,161],6:[162,187]}[chapter];
    assert.ok(pages.length&&pages.every(n=>Number.isInteger(n)&&n>=range[0]&&n<=range[1]));
    assert.deepEqual(pdfPages,pages.map(page=>page-range[0]+1));
    const url=new URL(downloadUrl);
    assert.equal(url.origin,'https://resource.hle.com.tw');
    assert.match(decodeURIComponent(url.pathname),new RegExp(year+'.*課本CH'+chapter+'.*\\.pdf$'));
    assert.equal(url.search,'');
   }
  }
  assert.equal(pastTextbookCitation(id,'choice-'+String(total+1).padStart(2,'0')),null);
  assert.equal(pastTextbookCitation(id,'constructor'),null);
 }
 assert.equal(pastTextbookCitation('constructor','choice-01'),null);
 assert.equal(pastTextbookCitation('older-version','choice-01'),null);
 assert.deepEqual(pastTextbookCitation(versions[0].id,'choice-01').sections[0].pages,[38]);
 assert.equal(pastTextbookCitation(versions[1].id,'choice-01').related,true);
});
