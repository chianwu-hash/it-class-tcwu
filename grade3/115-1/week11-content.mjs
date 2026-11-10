// Visually verified: 康軒三上 L7 p.76,78; Here We Go 1 U3 p.44,45.
export const WEEK11_LEVELS = [
 {id:1,lang:'zh',title:'老街起步',ans:'老街',hint:'切到中文，選對「街」，再按 Enter 確認。',source:'康軒國語三上第七課〈淡水小鎮〉p.76',replay:'山坡',replaySource:'國語第七課 p.78'},
 {id:2,lang:'en',title:'文具小詞組',ans:'a pen',hint:'切到英文，用小寫字母，a 和 pen 中間空一格。',source:'翰林 Here We Go 1 Unit 3 p.44',replay:'a book',replaySource:'英語 Unit 3 p.44'},
 {id:3,lang:'zh',title:'認識紅毛城',ans:'紅毛城',hint:'三個字，仔細選對「城」。有錯只改那個字。',source:'國語第七課 p.78',replay:'百年商行',replaySource:'國語第七課 p.76'},
 {id:4,lang:'en',title:'這是什麼？',ans:"What's this?",hint:"W 大寫，直撇號 '、問號 ? 都用英文半形。",source:'英語 Unit 3 p.44',replay:"What's that?",replaySource:'英語 Unit 3 p.45'},
 {id:5,lang:'zh',title:'老街完整句',ans:'長長的老街，有傳統餅店，有百年商行。',hint:'中文逗號、句號用全形；前五關都完成，合計得到一片葉子。',source:'國語第七課 p.76，首三行合併，保留原標點',replay:'蒼老的紅毛城，站在山坡上。',replaySource:'國語第七課 p.78，首兩行合併'},
 {id:6,lang:'mixed',title:'魔王：老街與文具問答',ans:"長長的老街，有傳統餅店，有百年商行。\nWhat's this?\nIt's an eraser.",hint:'共三行，中文切英文，eraser 前面是 an。全部完成再開一朵花！',source:'國語第七課 p.76＋英語 Unit 3 p.44；兩科組合，非翻譯',replay:"蒼老的紅毛城，站在山坡上。\nWhat's that?\nIt's a book.",replaySource:'國語第七課 p.78＋英語 Unit 3 p.45；兩科組合，非翻譯'}
];

export function describeWeek11Mismatch(answer,value) {
 let i=0;while(i<value.length&&value[i]===answer[i])i++;
 const lines=answer.slice(0,i).split('\n');
 const pos=`第 ${lines.length} 行第 ${lines.at(-1).length+1} 個字元`;
 if(i===answer.length)return `${pos}附近有多出的字，移到多字旁邊，用 Backspace 刪左邊或 Delete 刪右邊。`;
 if(answer[i]==='\n')return `${pos}要換行，請按 Enter，再輸入下一行。`;
 if(i===value.length)return `${pos}起還沒打完，請接著輸入，不用刪掉前面正確的文字。`;
 return `從${pos}附近檢查選字、大小寫、空白與標點。用方向鍵移到錯字旁邊：Backspace 刪左邊，Delete 刪右邊；少字就直接補上。`;
}
