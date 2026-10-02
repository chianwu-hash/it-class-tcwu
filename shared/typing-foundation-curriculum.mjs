// Versioned curriculum: retain the original home-row key and its saved results.
const home='asdfghjkl;', top='qwertyuiop', bottom='zxcvbnm,./';
const letters='abcdefghijklmnopqrstuvwxyz';
const words=['read','play','help','make','draw','type','save','work','look','find','book','tree','blue','kind','team','time','home','hand','desk','bird'];
const make=(key,title,description,groups,learned,{kind='keys',speed=12,starterSpeed=8}={})=>({
  key,title,description,kind,speed,starterSpeed,
  stages:[...groups.map((focus,i)=>({title:`${['認識','熟悉','換指','連接','複習'][i]}${kind==='keys'?'按鍵':'練習'}`,keys:kind==='keys'?[...focus].join(' · '):focus,
    hint:'先看清題目，再用負責的手指按鍵；按完回到基準列。',focus:kind==='keys'?focus:null,learned,lengths:[16,16,24]})),
    {title:'綜合挑戰',keys:'本關混合',hint:'先打準，再打得順。',focus:null,learned,lengths:[32,32,32]}]
});
export const lessons=[
  make('english-home-row-v1','手指的暖身運動','從 F、J 的小凸點出發，一起認識基準列！',['fj','dk','sl','a;','gh'],home),
  make('english-top-row-v1','往上探索','食指先出發，逐步認識上排十個字母。',['ru','ty','ei','wo','qp'],home+top),
  make('english-bottom-row-v1','往下探險','向下伸指，加入逗號、句點與斜線。',['vm','bn','c,','x.','z/'],home+top+bottom),
  make('english-alphabet-v1','字母大集合','混合三排字母，練習換手與回到定位。',['fgrt','hjuyn','deik','swol','aqpzbxcv'],letters),
  make('english-shift-v1','大小寫搭檔','大寫使用另一手的小指按住 Shift，不使用 Caps Lock。',['ASDFG','HJKL','QWERT','YUIOP','ZXCVBNM'],letters+letters.toUpperCase()),
  make('english-punctuation-v1','標點小幫手','區分不按 Shift 與要按 Shift 的常用標點。',[",.",";'",'!?',':"','/;'],letters+",.;'!?:\"/"),
  make('english-numbers-v1','數字列探索','使用鍵盤上方數字列；數字鍵盤不列入這關指法。',['47','56','38','29','10'],'0123456789'),
  make('english-number-symbols-v1','數字符號變身','按住另一手的 Shift，輸入數字列上的符號。',['$&','%^','#*','@(','!)'],'!@#$%^&*()'),
  make('english-symbols-v1','符號工具箱','認識連字號、括號與其他英文半形符號。',['-_=+','[]{}','<>','\\|','`~'],'-_=+[]{}<>\\|`~'),
  make('english-words-v1','單字接力','把已學會的按鍵連成短單字，保持均勻節奏。',['認字','換手','連接','穩定','混合'],letters,{kind:'words',speed:14,starterSpeed:10}),
  make('english-sentences-v1','句子小旅行','句首大寫、字間空白、句尾標點，一起練習。',['句首','空白','標點','節奏','連句'],letters,{kind:'sentences',speed:14,starterSpeed:10}),
  make('english-finale-v1','英打成果挑戰','整合大小寫、數字、符號與句子，完成十二關。',['字母','單字','句子','數字','符號'],letters,{kind:'mixed',speed:15,starterSpeed:10}),
];
const firstTitles=['食指定位','中指加入','無名指加入','小指加入','食指伸展','基準列挑戰'];
lessons[0].stages.forEach((s,i)=>{s.title=firstTitles[i];s.learned=['fj','fdjk','sdfjkl','asdfjkl;',home,home][i];});
lessons.forEach((lesson,index)=>{
  lesson.number=index+1;
  // Do not introduce later keys into the review row before they were taught.
  if(index===1||index===2) lesson.stages.forEach((s,i)=>{s.learned=(index===1?home:home+top)+lesson.stages.slice(0,Math.min(i+1,5)).map(s=>s.focus).join('');});
  if([4,5,6,7,8].includes(index)) lesson.stages.forEach((s,i)=>{s.learned=(index===4||index===5?letters:'')+lesson.stages.slice(0,Math.min(i+1,5)).map(s=>s.focus).join('');});
});
export function getLesson(key=lessons[0].key){const lesson=lessons.find(l=>l.key===key);if(!lesson)throw new RangeError('Unknown foundation lesson');return lesson;}
export function lessonKind(lesson,stage){return lesson.kind==='mixed'?['keys','words','sentences','numbers','symbols','mixed'][stage]:lesson.kind;}
export const wordPool=words;
// Equal-length substitutions make server-side target counts deterministic.
export function sentenceRows(pick,finale=false){
  const animal=()=>pick(['bird','frog','bear','duck']);
  const verb=()=>pick(['play','read','work','sing']);
  return finale
    ? [`Team ${pick(['12','24','36','48'])}: ${animal()} + ${animal()} = fun!`, `We ${verb()} at ${pick(['10','11','12','13'])}:30; then rest.`, `Can the ${animal()} ${verb()}? Yes, it can!`]
    : [`The ${animal()} can ${verb()} with me.`, `We ${verb()} and help the ${animal()}.`, `I like to ${verb()}. Do you like it?`];
}
export function expectedCount(lesson,stage){
  const kind=lessonKind(lesson,stage);
  if(kind==='sentences'||kind==='mixed')return sentenceRows(xs=>xs[0],kind==='mixed').reduce((sum,row)=>sum+row.length,0);
  return stage===5?117:67;
}
