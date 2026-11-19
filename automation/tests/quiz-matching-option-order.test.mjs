import test from 'node:test';import assert from 'node:assert/strict';
import {matchingOptionOrderIssues} from '../audit-matching-questions.mjs';
const options=(prefix,words)=>words.map((text,i)=>({id:prefix+i,content:{text,media:[]}}));
test('matching right-card positions align by original content, allowing different per-field option IDs',()=>{
 const fields=[{id:'a',options:options('a',['甲','乙'])},{id:'b',options:options('b',['甲','乙'])},{id:'fallback'}],before=JSON.stringify(fields);
 assert.deepEqual(matchingOptionOrderIssues(fields),[]);assert.equal(JSON.stringify(fields),before);
 const swapped={id:'swapped',options:options('s',['乙','甲'])};assert.deepEqual(matchingOptionOrderIssues([fields[0],swapped]),['swapped']);assert.deepEqual(matchingOptionOrderIssues([{id:'fallback'},fields[0],swapped]),['swapped']);assert.deepEqual(matchingOptionOrderIssues([]),[]);
});
