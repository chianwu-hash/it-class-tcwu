import {imageChoicePresentation} from './quiz-image-choices.mjs';
import {choiceQuestionPresentation} from './quiz-choice-conversion.mjs';
import {studentPromptContent} from './quiz-student-content.mjs';
import {readingPresentation} from './quiz-reading-presentation.mjs';
import {sequenceFieldPresentation,sequencePromptPresentation} from './quiz-sequence-presentation.mjs';
import {matchingPresentation} from './quiz-matching-presentation.mjs';
import {openSubquestionPresentation} from './quiz-open-subquestions.mjs';
import {answerTemplatePresentation} from './quiz-answer-templates.mjs';
import {workAnswerPassage} from './quiz-work-answer-layout.mjs';
import {circleColoringPlan} from './quiz-circle-coloring.mjs';
import {fractionPartitionPlan} from './quiz-fraction-partition.mjs';
import {sourceRoutePlan} from './quiz-source-route.mjs';
import {arrangementPlan} from './quiz-pattern-arrangement.mjs';
import {gridDrawingPlan} from './quiz-grid-drawing.mjs';
import {groupingDrawingPlan} from './quiz-grouping-drawing.mjs';
import {fractionColorsPlan} from './quiz-fraction-colors.mjs';
import {fractionComparisonPlan} from './quiz-fraction-comparison.mjs';
import {fractionShadingPlan,fractionBarPlan,fractionRectPlan} from './quiz-fraction-shading.mjs';
// Compatibility for the reviewed Chinese import's circled-code choice fields.
// Only the view changes: the original field ID, circled values and fields-v1
// response envelope remain exactly as stored. Never read or infer an answer.
export function fieldPresentation(q,field){
 const open=openSubquestionPresentation(q);if(open)return open.fields.find(f=>f.id===field.id)??field;
 const sequence=sequenceFieldPresentation(q,field);if(sequence!==field)return sequence;
 const converted=choiceQuestionPresentation(q),presented=converted.fields?.find(f=>f.id===field.id)??field;if(presented!==field)return presented;
 if(q.type!=='fields'||!q.id?.startsWith('kg6ch_')||q.fields?.length!==1||field.input!=='text'||
  !/^選擇題(?:[\s\-－—:：]|$)/u.test(q.prompt?.text||'')||q.prompt?.media?.length||
  q.prompt?.layout?.some(p=>p.type!=='paragraph'||p.runs.some(r=>r.type!=='text')))return field;
 const source=field.label.trim(),marks=[...source.matchAll(/[①②③④⑤⑥⑦⑧]/gu)];
 if(marks.length<2||marks.length>8||marks[0].index!==0||marks.some((m,i)=>m[0]!==String.fromCodePoint(0x2460+i)))return field;
 const compact=s=>s.replace(/\s/gu,'');
 if(!compact(q.prompt.text).endsWith(compact(source)))return field;
 const options=marks.map((m,i)=>({id:m[0],content:{text:source.slice(m.index+1,marks[i+1]?.index??source.length).trim(),media:[]}}));
 if(options.some(o=>!o.content.text))return field;
 return {...field,input:'single',label:'答案',options};
}

export const fieldsAreSingleChoice=q=>q.type==='fields'&&q.fields?.length===1&&fieldPresentation(q,q.fields[0]).input==='single';

export function fieldsPromptPresentation(q,{showGroupingBoard=false}={}){
 const partition=showGroupingBoard&&fractionPartitionPlan(q);if(partition)return partition.passage;
 const route=showGroupingBoard&&sourceRoutePlan(q);if(route)return route.passage;
 const colors=showGroupingBoard&&fractionColorsPlan(q);if(colors)return colors.passage;
 const comparison=showGroupingBoard&&fractionComparisonPlan(q);if(comparison)return comparison.passage;
 const shading=showGroupingBoard&&(fractionShadingPlan(q)||fractionBarPlan(q)||fractionRectPlan(q));if(shading)return shading.passage;
 const grouping=showGroupingBoard&&groupingDrawingPlan(q);if(grouping)return grouping.passage;
 const circle=circleColoringPlan(q);if(circle)return circle.passage;
 const arrangement=arrangementPlan(q);if(arrangement?.passage)return arrangement.passage;
 const grid=gridDrawingPlan(q);if(grid)return grid.passage;
 const workPassage=workAnswerPassage(q);if(workPassage)return workPassage;
 const sequence=sequencePromptPresentation(q);if(sequence)return sequence;
 const converted=choiceQuestionPresentation(q);q=converted;
 const picture=imageChoicePresentation(q);if(picture)return picture.passage;
 const open=openSubquestionPresentation(q);if(open)return open.passage;
 const matching=matchingPresentation(q);if(matching)return matching.passage;
 const reading=readingPresentation(q);if(reading)return reading.passage;
 const template=answerTemplatePresentation(q);if(template)return template.passage;
 if(q.fields?.length!==1||fieldPresentation(q,q.fields[0])===q.fields[0])return studentPromptContent(q.prompt);
 const label=q.fields[0].label.trim(),text=q.prompt.text.trimEnd();
 // Retain the complete original prompt in storage and full-paper review. Only
 // remove duplicated options/importer instructions beside the actual controls.
 if(!text.endsWith(label))return studentPromptContent(q.prompt);
 return studentPromptContent({text:text.slice(0,-label.length).replace('依原題順序完成所有答案欄；同一份原題保留為一組。','').replace(/\n{3,}/gu,'\n\n').trim(),media:[]});
}
