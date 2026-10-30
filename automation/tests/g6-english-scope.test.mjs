import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
test('WW7 本次範圍對應 Unit 1 與真正 Unit 3，不能把 Review 1 當第三單元',async()=>{
 const s=JSON.parse(await fs.readFile(new URL('../quiz-english-scope/scope.json',import.meta.url),'utf8'));
 assert.deepEqual(Object.keys(s.units),['1','3']);assert.equal(s.publisher_chapters['3'],'04');assert.equal(s.excluded_publisher_chapter['03'],'Review 1');assert.match(s.units['3'],/From Farm to Table/);
});
