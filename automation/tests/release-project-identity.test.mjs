import test from 'node:test';
import assert from 'node:assert/strict';
import {candidateProjectMatches, PROJECT_ID} from '../release-from-main.mjs';
test('部署身分接受API兩種正式欄位，拒絕空白、錯誤及衝突專案',()=>{
 assert.equal(candidateProjectMatches({projectId:PROJECT_ID}),true);
 assert.equal(candidateProjectMatches({project:{id:PROJECT_ID}}),true);
 assert.equal(candidateProjectMatches({projectId:PROJECT_ID,project:{id:PROJECT_ID}}),true);
 for(const value of [{},{project:{id:'wrong'}},{projectId:'wrong'},{projectId:PROJECT_ID,project:{id:'wrong'}}])assert.equal(candidateProjectMatches(value),false);
});
