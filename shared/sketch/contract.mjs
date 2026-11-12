// Shared drawing format; server validation remains independent.
export function validateSketch(value){
 if(!value||typeof value!=='object'||Object.keys(value).some(k=>!['version','strokes','colors'].includes(k))||value.version!==1||!Array.isArray(value.strokes)||value.strokes.length<1||value.strokes.length>80)throw Error('請先畫下想法，最多80筆。');
 if(Object.hasOwn(value,'colors')&&(!Array.isArray(value.colors)||value.colors.length!==value.strokes.length||value.colors.some(c=>!['#185e60','#2459b3','#b83246','#7643a8','#a94b0b','#263238'].includes(c))))throw Error('畫筆顏色不符。');
 for(const stroke of value.strokes){if(!Array.isArray(stroke)||!stroke.length||stroke.length>128)throw Error('畫圖點數超過限制。');for(const point of stroke)if(!Array.isArray(point)||point.length!==2||point.some(n=>!Number.isFinite(n)||n<0||n>1))throw Error('畫圖內容不符。');}
 if(new TextEncoder().encode(JSON.stringify(value)).length>262144)throw Error('畫圖內容太大。');return value;
}
