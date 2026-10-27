export const difficultyModes={
 easy:{label:'易・基礎練習',weights:[3,2,0],rule:'易題不足補中題；中題不足補易題，不加入難題。'},
 medium:{label:'中・綜合練習',weights:[1,3,1],rule:'易題或難題不足補中題；中題不足先補易題，再補難題。'},
 hard:{label:'難・進階挑戰',weights:[0,2,3],rule:'難題不足補中題；中題不足補難題，不加入易題。'},
};
export function difficultyTarget(mode,count){return Object.fromEntries(['easy','medium','hard'].map((key,i)=>[key,difficultyModes[mode].weights[i]*count/5]));}
export function difficultyAdjustment(d){
 if(!d?.difficulty||!difficultyModes[d.difficulty])return '';
 const short=['easy','medium','hard'].filter(k=>d.shortages?.[k]>0);
 if(!short.length)return '';
 const labels={easy:'易題',medium:'中等題',hard:'難題'};
 const filled=['easy','medium','hard'].filter(k=>d[k]>d.target?.[k]).map(k=>labels[k]);
 return `這個範圍的${short.map(k=>labels[k]).join('、')}較少，${filled.length?'已自動補入'+filled.join('、')+'。':'目前可用題目已全數選入。'}`;
}
