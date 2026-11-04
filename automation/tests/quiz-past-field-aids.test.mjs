import test from 'node:test';import assert from 'node:assert/strict';
import {pastFieldInputAids} from '../../shared/quiz-past-field-aids.mjs';
test('混合國字注音題按各格指示顯示鍵盤，不受共同長文干擾',()=>{
 const group={title:'寫國字或注音',material:'應【1：寫注音】【2：ㄍㄞ】可以幫忙；【3：ㄓㄨㄤˋ】歪【4：寫注音】了磚牆。'};
 assert.equal(pastFieldInputAids(group,{text:'「應」寫注音（應【】可以幫忙）'}).bopomofo,true);
 assert.equal(pastFieldInputAids(group,{text:'ㄍㄞ 寫國字（應ㄍㄞ可以幫忙）'}).bopomofo,false);
 assert.equal(pastFieldInputAids(group,{text:'ㄓㄨㄤˋ 寫國字（ㄓㄨㄤˋ歪了磚牆）'}).bopomofo,false);
 assert.equal(pastFieldInputAids(group,{text:'「歪」寫注音（撞歪了磚牆）'}).bopomofo,true);
 assert.equal(pastFieldInputAids(group,{text:'第5格'}).bopomofo,false);
});
test('純注音題仍可共用指示，國字與一般簡答不顯示注音鍵盤',()=>{
 assert.equal(pastFieldInputAids({material:'看國字，寫注音。'},{text:'「應」'}).bopomofo,true);
 assert.equal(pastFieldInputAids({material:'寫國字。'},{text:'ㄍㄞ'}).bopomofo,false);
 assert.equal(pastFieldInputAids({material:'回答問題。'},{text:'理由'}).bopomofo,false);
 assert.equal(pastFieldInputAids({title:'寫國字或注音'},{text:'寫國字'}).bopomofo,false);
 assert.equal(pastFieldInputAids({material:'填入標點符號。'},{text:'第1格'}).punctuation,true);
});
test('既有六年級混合題依原題引號中的國字或注音判斷',()=>{
 const group={title:'一、國字注音',material:'請依序寫出國字或注音。'};
 assert.equal(pastFieldInputAids(group,{text:'陰「ㄇㄞˊ」'}).bopomofo,false);
 assert.equal(pastFieldInputAids(group,{text:'溪水「潺」潺'}).bopomofo,true);
 assert.equal(pastFieldInputAids(group,{text:'「混」亂'}).bopomofo,true);
 assert.equal(pastFieldInputAids(group,{text:'「ㄈㄨˋ」痛'}).bopomofo,false);
 assert.equal(pastFieldInputAids(group,{text:'第1格'}).bopomofo,false);
});
