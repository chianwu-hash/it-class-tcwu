import test from 'node:test';import assert from 'node:assert/strict';
import {deriveImageChoiceTemplate,imageChoiceSignature,imageChoicePresentation,partnerImageChoiceSource,partnerImageChoicePresentation} from '../../shared/quiz-image-choices.mjs';
import {answerTemplateSources} from '../../shared/quiz-answer-template-sources.mjs';
import {convertChoiceQuestion,choiceAnswerLabel} from '../../shared/quiz-choice-conversion.mjs';
import {partnerChoicePresentation} from '../../shared/partner-pilot/choice-presentation.mjs';
import {answerFeedback} from '../../shared/partner-pilot/answer-feedback.mjs';
const settings={width:320,badges:['(1)','(2)','(3)']};
const make=()=>{const widths=[100,150,200],options=widths.map((width,i)=>({id:'o'+i,content:{text:'',media:[{kind:'image',url:`https://example.invalid/${i}.png`,alt:'原圖'+i}],layout:[{type:'paragraph',runs:[{type:'image',media_index:0,width}]}]}}));return{id:'image-choice-test',type:'single',prompt:{text:'圈出原圖。\n(1)\n(2)\n(3)',media:options.map(o=>({...o.content.media[0]})),layout:[{type:'paragraph',runs:[{type:'text',text:'圈出原圖。'}]},...widths.map((width,i)=>({type:'paragraph',runs:[{type:'text',text:`(${i+1})`},{type:'image',media_index:i,width}]}))]},options};};
test('native choices retain full original bank and IDs, projecting only duplicated display without reading answer',()=>{
 const q=make(),before=JSON.stringify(q),model=deriveImageChoiceTemplate(q,settings);assert.ok(model);assert.deepEqual(model.sourceWidths,[100,150,200]);assert.equal(JSON.stringify(q),before);
 const record={guard:imageChoiceSignature(q),model},registry={[q.id]:record};Object.defineProperty(q,'answer',{get(){throw Error('answer read')}});const view=imageChoicePresentation(q,registry);assert.ok(view);assert.equal(view.passage.media.length,0);assert.equal(view.passage.text,'圈出原圖。');answerTemplateSources[q.id]=record;try{assert.equal(convertChoiceQuestion(q).question,q);assert.deepEqual(convertChoiceQuestion(q).changes,[]);assert.equal(choiceAnswerLabel(q,'o2'),'(3)');}finally{delete answerTemplateSources[q.id];}
});
test('native guard includes option order, IDs, alt, scale and source content, not just prompt',()=>{
 for(const mutate of [q=>q.options.reverse(),q=>q.options[0].id='other',q=>q.options[0].content.media[0].alt+='changed',q=>q.options[0].content.layout[0].runs[0].width++,q=>q.prompt.text+='changed',q=>q.id+='changed']){const q=make(),record={guard:imageChoiceSignature(q),model:deriveImageChoiceTemplate(q,settings)},registry={[q.id]:record};mutate(q);assert.equal(imageChoicePresentation(q,registry),null);}
});
test('unknown or non-picture tasks cannot enable image choice projection',()=>{
 for(const mutate of [q=>q.options[0].content.layout[0].runs.unshift({type:'text',text:'new option'}),q=>delete q.options[0].content.layout[0].runs[0].width,q=>q.options[0].content.media.push({kind:'image',url:'extra'}),q=>q.options[0].content.layout=[],q=>q.options[1].id='o0',q=>q.type='fields',q=>q.prompt.media[0].url+='-unrelated',q=>q.prompt.layout[1].runs[1].width=50]){const q=make();mutate(q);assert.equal(deriveImageChoiceTemplate(q,settings),null);}
 assert.equal(imageChoicePresentation(make()),null);assert.equal(deriveImageChoiceTemplate(make(),{width:320,badges:['A','B','C']}),null);assert.equal(deriveImageChoiceTemplate(make(),{width:20}),null);
});
test('heaviest-cup instruction remains present after the duplicated picture bank is projected out',()=>{
 const q=make(),reference={kind:'image',url:'https://example.invalid/reference.png',alt:'完整天平'};q.prompt={text:'\n（，，）最重',media:[reference,...q.options.map(o=>o.content.media[0])],layout:[{type:'paragraph',runs:[{type:'image',media_index:0,width:440}]},{type:'paragraph',runs:[{type:'text',text:'（'},...q.options.flatMap((o,i)=>[{type:'image',media_index:i+1,width:o.content.layout[0].runs[0].width},{type:'text',text:i===2?'）最重':'，'}])]}]};
 const before=JSON.stringify(q),model=deriveImageChoiceTemplate(q,{width:180});assert.ok(model);const view=imageChoicePresentation(q,{[q.id]:{guard:imageChoiceSignature(q),model}});assert.equal(view.passage.media.length,1);assert.equal(view.passage.media[0].url,reference.url);assert.ok(view.passage.text.includes('圈出最重的杯子。'));assert.equal(JSON.stringify(q),before);
});
test('legacy partner native single uses exact public rich fingerprint and never needs a normal question or attempts',()=>{
 const q=make(),partner={id:17,past:null,options:['','',''],rich:{prompt:q.prompt,options:q.options.map(o=>o.content)}};Object.defineProperty(partner,'attempts',{get(){throw Error('attempt read')}});const source=partnerImageChoiceSource(partner),record={guard:imageChoiceSignature(q),partnerViewGuard:imageChoiceSignature(source),model:deriveImageChoiceTemplate(q,settings)},registry={[q.id]:record};assert.ok(partnerImageChoicePresentation(partner,registry));
 answerTemplateSources[q.id]=record;try{assert.equal(partnerChoicePresentation(partner),partner);}finally{delete answerTemplateSources[q.id];}
 assert.equal(partnerImageChoicePresentation({...partner,past:{kind:'single'}},registry),null);assert.equal(partnerImageChoicePresentation({...partner,normal:q},registry),null);
 partner.rich={...partner.rich,options:[...partner.rich.options].reverse()};assert.equal(partnerImageChoicePresentation(partner,registry),null);
});
test('revealed partner picture reference retains original numbered labels instead of inventing letters',()=>{
 const q=make(),partner={id:31,options:['','',''],rich:{prompt:q.prompt,options:q.options.map(o=>o.content)},correct:2,attempts:[{choice:2,correct:true}]},source=partnerImageChoiceSource(partner);answerTemplateSources[q.id]={guard:imageChoiceSignature(q),partnerViewGuard:imageChoiceSignature(source),model:deriveImageChoiceTemplate(q,settings)};
 try{const html=answerFeedback(partner,{esc:s=>s,fragment:(q,part,index)=>`image-${index}`});assert.ok(html.includes('(3)・image-2'));assert.ok(!html.includes('C・image-2'));}finally{delete answerTemplateSources[q.id];}
});
