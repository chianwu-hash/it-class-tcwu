import {renderLocalContent} from './quiz-past-content.mjs';
import {renderManualResponse} from './quiz-past-manual.mjs';
export const ACTIVITY_LABELS={classroom:'課堂卷',practice:'題庫練習',self:'自組卷',past_exam:'考古題',extension:'延伸練習'};
export function activityLabel(value){return ACTIVITY_LABELS[value]||'其他活動';}
export function pastAnswerText(value,kind){
 if(value===undefined||value===null)return '未提供';
 if(kind==='mark'&&typeof value==='boolean')return value?'勾選':'不勾選';
 if(Array.isArray(value))return value.map(x=>pastAnswerText(x,kind)).join(kind==='sequence'?' → ':'／');
 if(typeof value==='object')return Object.entries(value).map(([key,v])=>`${key}：${pastAnswerText(v,kind)}`).join('；');
 return String(value);
}
export function renderPastAnswerItem(host,item,mediaScope){
 const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 const g=item.group,f=item.field,kind=g.kind;
 const article=el('article',undefined,'question-card');article.dataset.questionId=f.id;article.dataset.groupId=g.id;
 const state=!item.answered?'尚未作答':item.manual?'已自評／需人工核對':item.correct===true?'答對':item.correct===false?'答錯':'已保存／未判分';
 article.append(el('h3',`第 ${item.number} 題・${g.sourceLabel||g.title||''} ${f.label||''}・${state}`));
 const rich=(root,value)=>renderLocalContent(root,value,{mediaScope});
 const material=g.materialContent||{text:g.material||'',media:[]};
 const media=[...(material.media||[]),...(g.assets||[]).filter(a=>!(material.media||[]).some(m=>m.url===a.url)).map(a=>({kind:a.kind||'image',...a}))];
 if(material.text||material.layout||media.length){const box=el('div',undefined,'material');rich(box,{...material,media});article.append(box);}
 rich(article,g.promptContent||{text:g.prompt||g.title||'',media:[]});
 if(f.text)rich(article,{text:f.text,media:[]});
 for(const choice of g.choices||[]){const opt=el('div',undefined,'option-row');opt.append(el('strong',`${choice.id}．`));rich(opt,choice.content||{text:choice.text||'',media:[]});article.append(opt);}
 const answers=el('div',undefined,'answer-grid');
 for(const [label,value] of [['學生原答',item.answered?pastAnswerText(item.response,kind):'尚未作答'],[item.manual?'參考答案／核對資訊':'正解',pastAnswerText(item.official,kind)]]){const box=el('div',undefined,'answer-box');box.append(el('strong',label),el('span',value));answers.append(box);}
 article.append(answers);
 if(kind==='manual'&&item.answered&&item.response&&typeof item.response==='object'&&Array.isArray(item.response.strokes)){
  const view=el('div',undefined,'saved-drawing');
  renderManualResponse({host:view,value:structuredClone(item.response),locked:true,asset:g.assets?.[0],resolveAsset:mediaScope.resolve});
  const label=view.querySelector('.field-label'),input=view.querySelector('textarea');
  if(label&&input){input.id=`saved-manual-${item.number}`;label.htmlFor=input.id;label.textContent='學生已保存作答（唯讀）';}
  article.append(view);
 }
 if(item.manual&&g.referenceUrl){const reference=el('div',undefined,'material');rich(reference,{text:'參考圖',media:[{kind:'image',url:g.referenceUrl,alt:'原卷參考圖'}]});article.append(reference);}
 if(f.explanation){const box=el('div',undefined,'explanation');rich(box,typeof f.explanation==='string'?{text:f.explanation,media:[]}:f.explanation);article.append(box);}
 if(item.manual)article.append(el('p','自評或人工題不視為自動判分答錯；以下保留已保存的原答與參考資訊。','small muted'));
 host.append(article);
}
