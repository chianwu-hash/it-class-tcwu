// Fixed excerpts verified against Chinese L8 pp.84,87 and English U4 pp.54–60.
export const WEEK13_LEVELS = [
 {id:1,lang:'zh',title:'走進安平古堡',ans:'安平古堡',replay:'博物館',source:'康軒國語三上第八課〈安平古堡參觀記〉p.84',replaySource:'國語第八課 p.84',hint:'四個字慢慢選，看看「堡」是不是選對了。'},
 {id:2,lang:'en',title:'認識新顏色',ans:'red',replay:'white',source:'翰林 Here We Go 1 Unit 4 p.58 顏色字',replaySource:'英語 Unit 4 p.59 顏色字',hint:'切到英文，用小寫輸入顏色單字。'},
 {id:3,lang:'zh',title:'看看古堡的屋頂',ans:'紅紅的屋頂',replay:'白色的牆',source:'國語第八課 p.87，原文短語節錄',replaySource:'國語第八課 p.87，原文短語節錄',hint:'看看屋頂的「頂」，有錯只改那個字。'},
 {id:4,lang:'en',title:'用英文回答顏色',ans:"It's blue.",replay:"It's white.",source:'英語 Unit 4 p.58 Target Language',replaySource:'英語備課用書 p.59 教師聽力稿',hint:'大寫 I 用 Shift；直撇號直接按，不加 Shift。記得空白與最後的句點。'},
 {id:5,lang:'zh',title:'古堡的完整描寫',ans:'紅紅的屋頂，白色的牆，又高又大，是安平古堡的地標。',replay:'裡頭有一面老城牆，上面長滿樹根。',source:'國語第八課 p.87，連續原文節錄',replaySource:'國語第八課 p.87，連續原文節錄',hint:'中文逗號、句號用全形。慢慢檢查，前五關完成合計一葉。'},
 {id:6,lang:'mixed',title:'魔王：古堡風光與失物招領',ans:"走上去，站在最高處往四面遠望，可以看到美麗的風光。\nGood morning, Teddy.\nGood morning. I lost my bag.\nThat's my bag!\nI see a rainbow!",replay:"這次的參觀，我看到寶貴的文物，也認識了安平古堡的故事，收穫真的好多！\nGood afternoon.\nOh, no! My bag!\nThank you.\nYou're welcome.",source:'國語第八課 p.87遠望風光原句＋英語Unit 4 Story Time p.55、57臺詞節錄；教師並列兩科，非互譯或課本原五行連文；直撇號統一為鍵盤半形',replaySource:'國語第八課 p.87參觀收穫原句＋英語Unit 4 Daily Talk p.60與Story Time p.54臺詞節錄；教師組合練習，非互譯或原故事順序；直撇號統一為鍵盤半形',hint:'五行新進度：中文練遠望風光；英文進入失物招領故事，打招呼、說包包不見了，再找到包包與彩虹。換題改練參觀收穫、下午招呼與禮貌用語。留意四次換行、逗號、句點、驚嘆號、直撇號與大小寫。'}
];

export { describeWeek12Mismatch as describeWeek13Mismatch } from './week12-content.mjs';

// Full-line readings checked against the phonetics printed on the private source pages.
// Read 長滿 as ㄓㄤˇ, 的 as neutral; preserve lexical 一 as printed (ㄧ).
const readings = new Map([
 ['安平古堡','ㄢ ㄆㄧㄥˊ ㄍㄨˇ ㄅㄠˇ'],
 ['博物館','ㄅㄛˊ ㄨˋ ㄍㄨㄢˇ'],
 ['紅紅的屋頂','ㄏㄨㄥˊ ㄏㄨㄥˊ ㄉㄜ˙ ㄨ ㄉㄧㄥˇ'],
 ['白色的牆','ㄅㄞˊ ㄙㄜˋ ㄉㄜ˙ ㄑㄧㄤˊ'],
 ['紅紅的屋頂，白色的牆，又高又大，是安平古堡的地標。','ㄏㄨㄥˊ ㄏㄨㄥˊ ㄉㄜ˙ ㄨ ㄉㄧㄥˇ ㄅㄞˊ ㄙㄜˋ ㄉㄜ˙ ㄑㄧㄤˊ ㄧㄡˋ ㄍㄠ ㄧㄡˋ ㄉㄚˋ ㄕˋ ㄢ ㄆㄧㄥˊ ㄍㄨˇ ㄅㄠˇ ㄉㄜ˙ ㄉㄧˋ ㄅㄧㄠ'],
 ['裡頭有一面老城牆，上面長滿樹根。','ㄌㄧˇ ㄊㄡˊ ㄧㄡˇ ㄧ ㄇㄧㄢˋ ㄌㄠˇ ㄔㄥˊ ㄑㄧㄤˊ ㄕㄤˋ ㄇㄧㄢˋ ㄓㄤˇ ㄇㄢˇ ㄕㄨˋ ㄍㄣ'],
 ['走上去，站在最高處往四面遠望，可以看到美麗的風光。','ㄗㄡˇ ㄕㄤˋ ㄑㄩˋ ㄓㄢˋ ㄗㄞˋ ㄗㄨㄟˋ ㄍㄠ ㄔㄨˋ ㄨㄤˇ ㄙˋ ㄇㄧㄢˋ ㄩㄢˇ ㄨㄤˋ ㄎㄜˇ ㄧˇ ㄎㄢˋ ㄉㄠˋ ㄇㄟˇ ㄌㄧˋ ㄉㄜ˙ ㄈㄥ ㄍㄨㄤ'],
 ['這次的參觀，我看到寶貴的文物，也認識了安平古堡的故事，收穫真的好多！','ㄓㄜˋ ㄘˋ ㄉㄜ˙ ㄘㄢ ㄍㄨㄢ ㄨㄛˇ ㄎㄢˋ ㄉㄠˋ ㄅㄠˇ ㄍㄨㄟˋ ㄉㄜ˙ ㄨㄣˊ ㄨˋ ㄧㄝˇ ㄖㄣˋ ㄕˋ ㄌㄜ˙ ㄢ ㄆㄧㄥˊ ㄍㄨˇ ㄅㄠˇ ㄉㄜ˙ ㄍㄨˋ ㄕˋ ㄕㄡ ㄏㄨㄛˋ ㄓㄣ ㄉㄜ˙ ㄏㄠˇ ㄉㄨㄛ']
]);
export function getWeek13KeyboardTarget(text) {
 return /\p{Script=Han}/u.test(text) ? {lang:'zh',text,zhuyin:readings.get(text)} : text;
}
