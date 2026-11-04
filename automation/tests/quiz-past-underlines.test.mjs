import test from 'node:test';import assert from 'node:assert/strict';import {underlineTextParts} from '../../shared/quiz-past-underlines.mjs';
test('原句畫線只標指定片段，保留全文與重複出現位置',()=>{
 const text='①把握當下。②把握當下。';const parts=underlineTextParts(text,[{text:'把握當下',occurrence:2}]);assert.equal(parts.map(p=>p.text).join(''),text);assert.deepEqual(parts.filter(p=>p.underline),[{text:'把握當下',underline:true}]);assert.equal(parts[0].text,'①把握當下。②');
});
test('重疊畫線合併，無效或不在原句的片段不改文字',()=>{
 assert.deepEqual(underlineTextParts('甲乙丙丁',['甲乙','乙丙']),[{text:'甲乙丙',underline:true},{text:'丁',underline:false}]);assert.deepEqual(underlineTextParts('<script>原句</script>',['不存在','']),[{text:'<script>原句</script>',underline:false}]);
});
