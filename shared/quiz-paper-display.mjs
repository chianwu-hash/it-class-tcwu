// Display metadata only. Never rewrite a frozen paper or infer a student's ability.
import {difficultyModes} from './quiz-difficulty.mjs';
export const grade3MathUnits=['10000以內的數','10000以內的加減','毫米與數線','乘法','角與形狀','除法','公斤與公克','分數','列表與規律'];
const collator=new Intl.Collator('zh-Hant',{numeric:true});
const subjects=['國語','英語','數學','社會','自然'];
// Verified against the existing 115-1 preset catalog; these titles have no ordinal.
const presetOrders={
 '115|3|翰林|自然|植物大發現':1,'115|3|翰林|自然|磁鐵好好玩':2,
 '115|6|翰林|數學|最大公因數與最小公倍數':1,'115|6|翰林|數學|分數除法':2,
 '115|6|翰林|數學|小數除法':3,'115|6|翰林|數學|比與比值':4,
 '115|6|南一|自然|多樣的天氣變化':1,'115|6|南一|自然|熱對物質的影響':2,
 '115|6|南一|社會|日治時期臺灣的發展與變遷':1,'115|6|南一|社會|邁向民主的社會':2,
};
const chineseNumber=s=>{if(/^\d+$/.test(s))return Number(s);let total=0,digit=0;for(const c of s){if(c==='十'||c==='百'){total+=(digit||1)*(c==='十'?10:100);digit=0;}else{const n='零一二三四五六七八九'.indexOf(c==='〇'?'零':c==='兩'?'二':c);if(n<0)return Infinity;digit=n;}}return total+digit;};
export function presetOrdinal(p){
 const c=p.catalog||{},unit=c.unit||p.title||'',m=unit.match(/第\s*([0-9零〇一二兩三四五六七八九十百]+)\s*(?:課|單元|章|節)/)||unit.match(/^\s*([0-9零〇一二兩三四五六七八九十百]+)\s*[、．.：:]/)||unit.match(/^(?:Unit|Lesson)\s*(\d+)/i);
 if(m)return chineseNumber(m[1]);
 const key=[c.school_year,String(c.volume||'').slice(0,1),c.publisher,c.subject,unit].join('|');
 return presetOrders[key]??Infinity;
}
export function comparePapers(a,b){
 if(Boolean(a.generated)!==Boolean(b.generated))return a.generated?-1:1;
 if(a.generated)return (Date.parse(b.saved_at)||0)-(Date.parse(a.saved_at)||0)||collator.compare(a.id,b.id);
 const rank=s=>{const i=subjects.indexOf(s);return i<0?subjects.length:i;};
 const subject=rank(a.catalog?.subject)-rank(b.catalog?.subject);if(subject)return subject;
 const na=presetOrdinal(a),nb=presetOrdinal(b);if(na!==nb)return na<nb?-1:1;
 return collator.compare(a.catalog?.unit||a.title||'',b.catalog?.unit||b.title||'')||collator.compare(a.id,b.id);
}
export const isExtension=p=>p.generated&&(p.generated_kind==='extension'||/^同重點再練習[：:]/.test(p.catalog?.unit||''));
export const learningPoint=p=>String(p.learning_point||String(p.catalog?.unit||'').replace(/^同重點再練習[：:]\s*/,''));
export function paperRange(p){
 if(isExtension(p))return '學習重點：'+learningPoint(p);
 if(!p.generated)return p.catalog?.unit||'';
 let units=p.unit_ids;
 if(!Array.isArray(units)){const match=String(p.catalog?.unit||'').match(/^自選單元[：:]\s*(\[[\d,\s]+\])$/);try{units=match?JSON.parse(match[1]):[];}catch{units=[];}}
 units=[...new Set(units)].filter(n=>Number.isInteger(n)&&n>=1&&n<=9).sort((a,b)=>a-b);
 if(!units.length)return '自選範圍';
 const math=p.catalog?.subject==='數學'&&String(p.catalog?.volume).startsWith('3');
 if(math&&units.length===9)return '全冊9個單元';
 return units.map(n=>`第${n}單元${math?'：'+grade3MathUnits[n-1]:''}`).join('、');
}
export const paperTitle=p=>p.display_name||(isExtension(p)?'同重點再練：'+learningPoint(p):p.title);
export const paperDifficulty=p=>p.generated&&!isExtension(p)?difficultyModes[p.distribution?.difficulty||'medium']?.label||'':'';
export function paperMix(p){
 const d=p.distribution;
 if(d&&['easy','medium','hard'].every(k=>Number.isInteger(d[k])&&d[k]>=0))return `題目組合：易 ${d.easy} 題・中 ${d.medium} 題・難 ${d.hard} 題`;
 const value=p.catalog?.difficulty;if(!value)return '';
 return '題目組合：'+String(value).replaceAll('容易','易').replaceAll('中等','中').replaceAll('困難','難');
}
