// Standard (DaChen) layout. Spaces are only first-tone actions, never separators.
export const zhuyinKeys=Object.fromEntries([...('1qaz2wsxedcrfv5tgbyhnujm8ik,9ol.0p;/-3467 ')].map((key,i)=>[key,[...'ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄧㄨㄩㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦˇˋˊ˙'][i]||'一聲']));
const make=(slug,title,mode,groups,base='')=>({key:`zhuyin-${slug}-v1`,title,mode,track:'zhuyin',speed:0,starterSpeed:0,
 stages:[...groups.map((keys,i)=>({title:['食指定位','中指加入','無名指加入','小指加入','食指伸展'][i],keys,learned:base+groups.slice(0,i+1).join('')})),{title:'綜合挑戰',keys:'本關混合',learned:base+groups.join('')} ]});
export const zhuyinLessons=[
 make('home','注音基準列：手指回家','keys',['fj','dk','sl','a;','gh']),
 make('top','上排注音：向上探索','keys',['ru','ty','ei','wo','qp'],'asdfghjkl;'),
 make('bottom','下排注音：向下探索','keys',['vm','bn','c,','x.','z/'],'asdfghjkl;qwertyuiop'),
 make('number','數字列上的注音','keys',['58','29','10','-1','28590-'],'asdfghjkl;qwertyuiopzxcvbnm,./'),
 make('all','三十七個注音集合','keys',['rfv5tgbyhn','ujm8ik,','2wsx9ol.','1qaz0p;/-','edc'],'asdfghjkl;qwertyuiopzxcvbnm,./125890-'),
 make('sounds','拼音與五種聲調','sounds',['一聲','二聲','三聲','四聲與輕聲','三符號音節']),
 make('words','常用詞：開始輸入中文','ime',['家人','學校','生活','自然','混合']),
 make('choose','同音字：看清楚再選','ime',['時間與石頭','公園與工作','眼睛與已經','知道與直到','混合']),
 make('sentences','短句：一次輸入詞語','ime',['主詞','動作','地點','連接','混合']),
 make('punctuation','全形標點：句子更清楚','ime',['句號','逗號','問號','驚嘆號','混合']),
 make('edit','修正練習：檢查再送出','ime',['同音詞','句尾','標點','整句','混合']),
 make('finale','中打成果：完整表達','ime',['校園','生活','閱讀','合作','混合']),
];
zhuyinLessons.forEach((l,i)=>{l.number=i+1;if(i)l.stages.slice(0,5).forEach((s,j)=>{s.title=l.mode==='keys'?['食指出發','增加鍵位','換指練習','延伸練習','累積複習'][j]:s.keys;});});
export function getZhuyinLesson(key=zhuyinLessons[0].key){const l=zhuyinLessons.find(l=>l.key===key);if(!l)throw new RangeError('Unknown zhuyin lesson');return l;}
const wordGroups=[['爸爸','媽媽','哥哥','姐姐','家人','妹妹'],['老師','同學','學校','教室','桌子','椅子'],['吃飯','喝水','睡覺','洗手','走路','回家'],['天空','白雲','小鳥','花朵','大樹','河水']];
const chooseGroups=[['時間','石頭','事情','實在','十個','時候'],['公園','工作','公司','功課','工具','公共'],['眼睛','已經','安靜','乾淨','經過','精神'],['知道','直到','指導','制度','紙張','值得']];
// Each group has multiple distinct, equally long targets; no candidate index is prescribed.
const sentences=['我們一起去看書','大家一起去上課','同學一起去運動','老師帶著我閱讀','今天我們去公園','我和同學去散步'];
const sentenceGroups=[sentences.slice(0,4),['大家一起來洗手','我們一起來畫圖','同學一起去運動','老師帶著我閱讀'],['今天我們去公園','今天我們去學校','今天我們去操場','我和同學去散步'],['先洗手再來吃飯','先看題目再打字','打完之後再檢查','先坐好再來上課']];
const punct={
 '。':['我們一起去看書。','大家一起去上課。','同學一起去運動。','今天我們去公園。'],
 '？':['你想一起去看書？','你想一起去上課？','你想一起去運動？','你想一起去公園？'],
 '！':['我們一起去看書！','大家一起去上課！','同學一起去運動！','今天我們去公園！'],
 '，':['下課了，我去看書。','下課了，我去喝水。','放學了，我去公園。','放學了，我去散步。'],
 '混合':['下課了，我去看書。','放學了，我去公園。','看完書，記得收好！','要上課，你準備好？']};
const long=['今天我們一起到圖書館看書。','老師提醒大家要把雙手洗淨。','下課後我們一起整理好教室。','我和同學一起完成今天作業。','每天練習一點就能慢慢進步。','打字完成以後記得檢查內容。'];
const soundGroups=[['a8 ','q8 ','g8 ','w8 '],['a86','q86','g86','s86'],['a83','183','g83','w83'],['a84','184','a87','w84'],['vu;3','xu;6','ru;3','su;4']];
function pool(lesson,stage){
 if(lesson.number===7||lesson.number===8){const groups=lesson.number===7?wordGroups:chooseGroups;return stage<4?groups[stage]:groups.flat();}
 if(lesson.number===9)return stage<4?sentenceGroups[stage]:sentenceGroups.flat();
 if(lesson.number===10)return punct[stage===1?'，':stage===2?'？':stage===3?'！':stage>=4?'混合':'。'];
 if(lesson.number===11)return stage===0?chooseGroups.flat():stage===2?punct['，']:sentences;
 return long;
}
export function zhuyinCount(lesson,stage){
 if(lesson.mode==='keys')return stage===5?96:56;
 if(lesson.mode==='sounds')return stage===5?81:stage===4?72:54;
 const length=pool(lesson,stage)[0].length;
 return length*(lesson.number===7||lesson.number===8||lesson.number===11&&stage===0?(stage===5?6:3):1)*3;
}
export function generateZhuyin(lesson,stage,previous=[],random=Math.random){
 if(!lesson.stages[stage])throw new RangeError('Unknown stage');
 const excluded=new Set();let counter=0;
 const pick=items=>items[(Math.floor(random()*items.length)+counter++)%items.length];
 return [0,1,2].map(row=>{
  for(let attempt=0;attempt<256;attempt++){
   counter=attempt+row;
   let text;
   if(lesson.mode==='keys'){
    const chars=[...new Set(stage<5&&row<2?lesson.stages[stage].keys:lesson.stages[stage].learned)];
    const count=stage===5?32:row===2?24:16;
    text=Array.from({length:count},()=>pick(chars)).join('');
    // A position swap provides additional variants even for two keys and a fixed RNG.
    const a=[...text],x=attempt%a.length,y=(attempt*3+1)%a.length;[a[x],a[y]]=[a[y],a[x]];text=a.join('');
   }else if(lesson.mode==='sounds'){
    // Final mixes every tone and three-symbol syllables, with a fixed 27 keys per row.
    text=stage===5?[pick(soundGroups[0]),pick(soundGroups[1]),pick(soundGroups[2]),pick(['a84','184','w84']),'a87',...Array.from({length:3},()=>pick(soundGroups[4]))].join(''):Array.from({length:6},()=>pick(soundGroups[stage])).join('');
   }
   else {const items=pool(lesson,stage),count=zhuyinCount(lesson,stage)/3/items[0].length;text=Array.from({length:count},()=>pick(items)).join('');}
   if(!excluded.has(text)&&text!==previous[row]){excluded.add(text);return text;}
  }
  throw new Error('Exercise pool exhausted');
 });
}
export function textDistance(a,b){
 let prev=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=next;}return prev[b.length];
}
