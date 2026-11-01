import test from 'node:test';
import assert from 'node:assert/strict';
import {createSurpriseVisit} from '../../shared/garden-surprise-visit.mjs';
const rest={petUnlocked:true,petMode:'rest',reduced:false,ready:true};
test('one fifth boundary and one draw per visit, all weather allowed',()=>{
 for(const scene of ['day','downpour','thunder']){
  let draws=0;const v=createSurpriseVisit(()=>{draws++;return .1999});
  assert.equal(v.decide({...rest,scene}),true);
  assert.equal(v.decide({...rest,scene,pet:'dog'}),false);assert.equal(draws,1);
 }
 assert.equal(createSurpriseVisit(()=>.2).decide(rest),false);
});
test('wait for readiness, do not reroll after walking or reduced motion',()=>{
 const v=createSurpriseVisit(()=>0);assert.equal(v.decide({...rest,ready:false}),false);assert.equal(v.checked,false);assert.equal(v.decide(rest),true);
 for(const patch of [{petMode:'walk'},{petUnlocked:false},{reduced:true}]){
  let draws=0;const x=createSurpriseVisit(()=>{draws++;return 0});assert.equal(x.decide({...rest,...patch}),false);assert.equal(x.decide(rest),false);assert.equal(draws,0);
 }
});
